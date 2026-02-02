package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
)

type ProductDeletionRequestService struct {
	reqRepo         repositories.ProductDeletionRequestRepository
	productRepo     repositories.ProductRepository
	versionRepo     repositories.ProductVersionRepository
	userRepo        repositories.UserRepository
	auditSvc        *AuditService
	activitySvc     *ActivityService
	notificationSvc *NotificationService
}

func NewProductDeletionRequestService(
	reqRepo repositories.ProductDeletionRequestRepository,
	productRepo repositories.ProductRepository,
	versionRepo repositories.ProductVersionRepository,
	userRepo repositories.UserRepository,
	auditSvc *AuditService,
	activitySvc *ActivityService,
	notificationSvc *NotificationService,
) *ProductDeletionRequestService {
	return &ProductDeletionRequestService{
		reqRepo:         reqRepo,
		productRepo:     productRepo,
		versionRepo:     versionRepo,
		userRepo:        userRepo,
		auditSvc:        auditSvc,
		activitySvc:     activitySvc,
		notificationSvc: notificationSvc,
	}
}

func (s *ProductDeletionRequestService) Create(ctx context.Context, productID uuid.UUID, requestedBy uuid.UUID, meta dto.AuditMeta) (*dto.ProductDeletionRequestResponse, error) {
	req := &models.ProductDeletionRequest{
		ProductID:   productID,
		RequestedBy: requestedBy,
		Status:      models.RequestPending,
	}
	if err := s.reqRepo.Create(req); err != nil {
		return nil, err
	}
	resp := deletionRequestToResponse(req)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "product_deletion_request",
			EntityID:   req.ID.String(),
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	if s.activitySvc != nil && meta.UserID != nil {
		details := req.ProductID.String()
		if p, err := s.productRepo.GetByID(productID); err == nil {
			details = p.Name
		}
		s.activitySvc.Log(ctx, ActivityEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "product_deletion_request",
			EntityID:   req.ID.String(),
			Details:    details,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
		})
	}
	// Notify admin and superadmin users (so they can review and approve/reject)
	if s.notificationSvc != nil && s.userRepo != nil {
		admins, _ := s.userRepo.ListByRole(models.RoleAdmin)
		superadmins, _ := s.userRepo.ListByRole(models.RoleSuperadmin)
		productName := ""
		if p, err := s.productRepo.GetByID(productID); err == nil {
			productName = p.Name
		}
		reqID := req.ID
		title := "New product deletion request"
		message := "A user has requested to delete a product."
		if productName != "" {
			message = "A user has requested to delete the product \"" + productName + "\". Review and approve or reject from the Requests page."
		} else {
			message = "A user has requested to delete a product. Review and approve or reject from the Requests page."
		}
		for i := range admins {
			if admins[i].ID != requestedBy {
				_, _ = s.notificationSvc.Create(admins[i].ID, models.NotificationTypeProductDeletionRequestSubmitted, title, message, "product_deletion_request", &reqID)
			}
		}
		for i := range superadmins {
			if superadmins[i].ID != requestedBy {
				_, _ = s.notificationSvc.Create(superadmins[i].ID, models.NotificationTypeProductDeletionRequestSubmitted, title, message, "product_deletion_request", &reqID)
			}
		}
	}
	return resp, nil
}

func (s *ProductDeletionRequestService) List(status *models.RequestStatus, callerID uuid.UUID, callerRole string, ownerID *uuid.UUID, fromDate, toDate *time.Time) ([]dto.ProductDeletionRequestResponse, error) {
	var productOwnerID *uuid.UUID
	var requestedBy *uuid.UUID
	if ownerID != nil {
		requestedBy = ownerID
	} else if !models.Role(strings.ToLower(callerRole)).IsAdminOrAbove() {
		productOwnerID = &callerID
	}
	list, err := s.reqRepo.List(status, productOwnerID, requestedBy, fromDate, toDate)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ProductDeletionRequestResponse, len(list))
	for i := range list {
		out[i] = *deletionRequestToResponse(&list[i])
	}
	return out, nil
}

func (s *ProductDeletionRequestService) Approve(ctx context.Context, id uuid.UUID, approved bool, meta dto.AuditMeta) (*dto.ProductDeletionRequestResponse, error) {
	req, err := s.reqRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	oldResp := deletionRequestToResponse(req)
	if approved {
		// Archive the product instead of deleting it (double confirmation is done in the UI)
		p, err := s.productRepo.GetByID(req.ProductID)
		if err != nil {
			return nil, err
		}
		oldProductResp := productToResponse(p)
		p.Status = models.StatusArchived
		if err := s.productRepo.Update(p); err != nil {
			return nil, err
		}
		fresh, _ := s.productRepo.GetByID(req.ProductID)
		newProductResp := productToResponse(fresh)
		if s.auditSvc != nil {
			s.auditSvc.Log(ctx, AuditEntry{
				UserID:     meta.UserID,
				Action:     "update",
				EntityType: "product",
				EntityID:   p.ID.String(),
				OldData:    ToJSONB(oldProductResp),
				NewData:    ToJSONB(newProductResp),
				IPAddress:  meta.IP,
				UserAgent:  meta.UserAgent,
				TraceID:    meta.TraceID,
			})
		}
		req.Status = models.RequestApproved
	} else {
		req.Status = models.RequestRejected
	}
	if err := s.reqRepo.Update(req); err != nil {
		return nil, err
	}
	newResp := deletionRequestToResponse(req)
	if s.auditSvc != nil {
		action := "approve"
		if !approved {
			action = "reject"
		}
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     action,
			EntityType: "product_deletion_request",
			EntityID:   id.String(),
			OldData:    ToJSONB(oldResp),
			NewData:    ToJSONB(newResp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	if s.activitySvc != nil && meta.UserID != nil {
		details := string(req.Status)
		if p, err := s.productRepo.GetByID(req.ProductID); err == nil {
			details = p.Name + " " + details
		}
		s.activitySvc.Log(ctx, ActivityEntry{
			UserID:     meta.UserID,
			Action:     "save",
			EntityType: "product_deletion_request",
			EntityID:   id.String(),
			Details:    details,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
		})
	}
	if s.notificationSvc != nil {
		productName := ""
		if p, err := s.productRepo.GetByID(req.ProductID); err == nil {
			productName = p.Name
		}
		var notifType, title, message string
		if approved {
			notifType = models.NotificationTypeProductDeletionApproved
			title = "Product deletion request approved"
			if productName != "" {
				message = "Your request to delete the product \"" + productName + "\" was approved. The product has been archived."
			} else {
				message = "Your request to delete the product was approved. The product has been archived."
			}
		} else {
			notifType = models.NotificationTypeProductDeletionRejected
			title = "Product deletion request rejected"
			if productName != "" {
				message = "Your request to delete the product \"" + productName + "\" was rejected. The product remains active."
			} else {
				message = "Your request to delete the product was rejected. The product remains active."
			}
		}
		_, _ = s.notificationSvc.Create(req.RequestedBy, notifType, title, message, "product_deletion_request", &id)
	}
	return newResp, nil
}

func deletionRequestToResponse(r *models.ProductDeletionRequest) *dto.ProductDeletionRequestResponse {
	resp := &dto.ProductDeletionRequestResponse{
		ID:          r.ID.String(),
		ProductID:   r.ProductID.String(),
		RequestedBy: r.RequestedBy.String(),
		Status:      string(r.Status),
		CreatedAt:   r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if r.Requester.ID != uuid.Nil {
		ur := UserToResponse(&r.Requester)
		resp.Requester = &ur
	}
	return resp
}
