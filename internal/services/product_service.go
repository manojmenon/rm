package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
)

var (
	ErrProductNotFound                          = errors.New("product not found")
	ErrForbidden                                = errors.New("forbidden")
	ErrInvalidOwnerID                           = errors.New("invalid owner_id")
	ErrProductActiveRequiresPricingCommitteeApproval = errors.New("product cannot be set to active until it has a Pricing Committee Approval milestone")
)

type ProductService struct {
	productRepo     repositories.ProductRepository
	versionRepo     repositories.ProductVersionRepository
	deletionReqRepo repositories.ProductDeletionRequestRepository
	groupRepo       repositories.GroupRepository
	milestoneRepo   repositories.MilestoneRepository
	auditSvc        *AuditService
	notificationSvc *NotificationService
}

func NewProductService(productRepo repositories.ProductRepository, versionRepo repositories.ProductVersionRepository, deletionReqRepo repositories.ProductDeletionRequestRepository, groupRepo repositories.GroupRepository, milestoneRepo repositories.MilestoneRepository, auditSvc *AuditService, notificationSvc *NotificationService) *ProductService {
	return &ProductService{productRepo: productRepo, versionRepo: versionRepo, deletionReqRepo: deletionReqRepo, groupRepo: groupRepo, milestoneRepo: milestoneRepo, auditSvc: auditSvc, notificationSvc: notificationSvc}
}

func (s *ProductService) Create(ctx context.Context, req dto.ProductCreateRequest, ownerID *uuid.UUID, isAdmin bool, meta dto.AuditMeta) (*dto.ProductResponse, error) {
	status := models.StatusApproved
	lifecycle := models.LifecycleActive
	if !isAdmin {
		// User-created products: pending status and default lifecycle Not Active until admin changes
		if ownerID == nil {
			status = models.StatusPending
			lifecycle = models.LifecycleNotActive
		} else {
			lifecycle = models.LifecycleSuspend
		}
	}
	p := &models.Product{
		Name:            req.Name,
		Version:         req.Version,
		Description:     req.Description,
		Category1:       req.Category1,
		Category2:       req.Category2,
		Category3:       req.Category3,
		OwnerID:         ownerID,
		Status:          status,
		LifecycleStatus: lifecycle,
		Metadata:        models.JSONB(req.Metadata),
	}
	if err := s.productRepo.Create(p); err != nil {
		return nil, err
	}
	resp := productToResponse(p)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "product",
			EntityID:   p.ID.String(),
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return resp, nil
}

func (s *ProductService) GetByID(id uuid.UUID) (*dto.ProductResponse, error) {
	p, err := s.productRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	resp := productToResponse(p)
	if s.deletionReqRepo != nil {
		pending, _ := s.deletionReqRepo.FindPendingByProductID(id)
		if pending != nil {
			resp.PendingDeletionRequest = &dto.ProductDeletionRequestResponse{
				ID:          pending.ID.String(),
				ProductID:   pending.ProductID.String(),
				RequestedBy: pending.RequestedBy.String(),
				Status:      string(pending.Status),
				CreatedAt:   pending.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			}
		}
	}
	return resp, nil
}

func (s *ProductService) List(ownerID *uuid.UUID, status *models.ProductStatus, lifecycleStatus *models.LifecycleStatus, category1, category2, category3 *string, groupID *uuid.UUID, dateFrom, dateTo *time.Time, sortBy, order string, callerID uuid.UUID, callerRole models.Role, limit, offset int) (*dto.PageResult[dto.ProductResponse], error) {
	if callerRole == models.RoleOwner && ownerID == nil {
		ownerID = &callerID
	}
	var productIDs *[]uuid.UUID
	if groupID != nil && s.groupRepo != nil {
		ids, err := s.groupRepo.GetProductIDs(*groupID)
		if err != nil {
			return nil, err
		}
		productIDs = &ids
	}
	products, total, err := s.productRepo.List(ownerID, status, lifecycleStatus, category1, category2, category3, productIDs, dateFrom, dateTo, sortBy, order, limit, offset)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ProductResponse, len(products))
	for i := range products {
		out[i] = *productToResponse(&products[i])
	}
	return &dto.PageResult[dto.ProductResponse]{Items: out, Total: total, Limit: limit, Offset: offset}, nil
}

func (s *ProductService) Update(ctx context.Context, id uuid.UUID, req dto.ProductUpdateRequest, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) (*dto.ProductResponse, error) {
	p, err := s.productRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	// Admin can always update. Product owner can update only when assigned and (other checks below).
	if callerRole != models.RoleAdmin && (p.OwnerID == nil || *p.OwnerID != callerID) {
		return nil, ErrForbidden
	}
	if callerRole == models.RoleOwner && req.Status != nil {
		return nil, ErrForbidden
	}
	if callerRole == models.RoleOwner && p.LifecycleStatus != models.LifecycleActive {
		return nil, ErrForbidden
	}
	if callerRole == models.RoleOwner && req.LifecycleStatus != nil {
		return nil, ErrForbidden
	}
	// Business rule: product cannot be available (active) until it has a Pricing Committee Approval milestone,
	// except when approving a pending product (status pending -> approved); that approval does not require the milestone.
	settingLifecycleToActive := req.LifecycleStatus != nil && strings.EqualFold(strings.TrimSpace(*req.LifecycleStatus), string(models.LifecycleActive))
	isProductApproval := p.Status == models.StatusPending && req.Status != nil && strings.EqualFold(strings.TrimSpace(*req.Status), string(models.StatusApproved))
	if settingLifecycleToActive && !isProductApproval {
		milestones, err := s.milestoneRepo.ListByProductID(id)
		if err != nil {
			return nil, err
		}
		hasPricingCommittee := false
		for i := range milestones {
			if strings.EqualFold(strings.TrimSpace(milestones[i].Label), "Pricing Committee Approval") {
				hasPricingCommittee = true
				break
			}
		}
		if !hasPricingCommittee {
			return nil, ErrProductActiveRequiresPricingCommitteeApproval
		}
	}
	oldResp := productToResponse(p)
	if err := applyProductUpdate(p, req); err != nil {
		return nil, err
	}
	// Clear association so GORM persists owner_id column; refetch will repopulate Owner
	p.Owner = nil
	if err := s.productRepo.Update(p); err != nil {
		return nil, err
	}
	// Refetch so Owner (and other associations) are correct in the response
	fresh, err := s.productRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	newResp := productToResponse(fresh)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "update",
			EntityType: "product",
			EntityID:   id.String(),
			OldData:    ToJSONB(oldResp),
			NewData:    ToJSONB(newResp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	// When admin changes status, lifecycle, or owner, notify the product owner (the selected user)
	if callerRole == models.RoleAdmin && s.notificationSvc != nil && fresh.OwnerID != nil {
		statusChanged := req.Status != nil && (oldResp.Status != newResp.Status)
		lifecycleChanged := req.LifecycleStatus != nil && (oldResp.LifecycleStatus != newResp.LifecycleStatus)
		oldOwnerStr, newOwnerStr := "", ""
		if oldResp.OwnerID != nil {
			oldOwnerStr = *oldResp.OwnerID
		}
		if newResp.OwnerID != nil {
			newOwnerStr = *newResp.OwnerID
		}
		ownerChanged := (req.OwnerID != nil && *req.OwnerID != "" || (req.ClearOwner != nil && *req.ClearOwner)) && oldOwnerStr != newOwnerStr
		if statusChanged || lifecycleChanged || ownerChanged {
			title := "Product updated"
			msg := "An admin has updated your product \"" + fresh.Name + "\"."
			if statusChanged {
				msg += " Status is now: " + string(fresh.Status) + "."
			}
			if lifecycleChanged {
				msg += " Lifecycle status is now: " + string(fresh.LifecycleStatus) + "."
			}
			if ownerChanged {
				msg += " You have been set as the product owner."
			}
			_, _ = s.notificationSvc.Create(*fresh.OwnerID, models.NotificationTypeProductStatusChanged, title, msg, "product", &id)
		}
	}
	return newResp, nil
}

var ErrProductHasVersions = errors.New("product has versions; delete all versions first")

func (s *ProductService) Delete(ctx context.Context, id uuid.UUID, callerRole models.Role, meta dto.AuditMeta) error {
	if callerRole != models.RoleAdmin {
		return ErrForbidden
	}
	n, err := s.versionRepo.CountByProductID(id)
	if err != nil {
		return err
	}
	if n > 0 {
		return ErrProductHasVersions
	}
	p, _ := s.productRepo.GetByID(id)
	oldData := models.JSONB(nil)
	if p != nil {
		oldData = ToJSONB(productToResponse(p))
	}
	if err := s.productRepo.Delete(id); err != nil {
		return err
	}
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "delete",
			EntityType: "product",
			EntityID:   id.String(),
			OldData:    oldData,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return nil
}

func applyProductUpdate(p *models.Product, req dto.ProductUpdateRequest) error {
	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.Version != nil {
		p.Version = *req.Version
	}
	if req.Description != nil {
		p.Description = *req.Description
	}
	if req.Status != nil {
		p.Status = models.ProductStatus(*req.Status)
	}
	if req.LifecycleStatus != nil {
		p.LifecycleStatus = models.LifecycleStatus(*req.LifecycleStatus)
	}
	if req.Category1 != nil {
		p.Category1 = *req.Category1
	}
	if req.Category2 != nil {
		p.Category2 = *req.Category2
	}
	if req.Category3 != nil {
		p.Category3 = *req.Category3
	}
	if req.ClearOwner != nil && *req.ClearOwner {
		p.OwnerID = nil
	} else if req.OwnerID != nil && *req.OwnerID != "" {
		parsed, err := uuid.Parse(*req.OwnerID)
		if err != nil {
			return ErrInvalidOwnerID
		}
		p.OwnerID = &parsed
	}
	if req.Metadata != nil {
		p.Metadata = models.JSONB(req.Metadata)
	}
	return nil
}

func productToResponse(p *models.Product) *dto.ProductResponse {
	resp := &dto.ProductResponse{
		ID:               p.ID.String(),
		Name:             p.Name,
		Version:          p.Version,
		Description:      p.Description,
		Status:           string(p.Status),
		LifecycleStatus:  string(p.LifecycleStatus),
		Category1:        p.Category1,
		Category2:        p.Category2,
		Category3:        p.Category3,
		CreatedAt:        p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if p.Metadata != nil {
		resp.Metadata = p.Metadata
	}
	if p.OwnerID != nil {
		s := p.OwnerID.String()
		resp.OwnerID = &s
	}
	if p.Owner != nil {
		ur := userToResponse(p.Owner)
		resp.Owner = &ur
	}
	return resp
}
