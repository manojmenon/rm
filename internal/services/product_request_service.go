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

type ProductRequestService struct {
	reqRepo         repositories.ProductRequestRepository
	productRepo     repositories.ProductRepository
	userRepo        repositories.UserRepository
	auditSvc        *AuditService
	notificationSvc *NotificationService
}

func NewProductRequestService(
	reqRepo repositories.ProductRequestRepository,
	productRepo repositories.ProductRepository,
	userRepo repositories.UserRepository,
	auditSvc *AuditService,
	notificationSvc *NotificationService,
) *ProductRequestService {
	return &ProductRequestService{reqRepo: reqRepo, productRepo: productRepo, userRepo: userRepo, auditSvc: auditSvc, notificationSvc: notificationSvc}
}

func (s *ProductRequestService) Create(ctx context.Context, req dto.ProductRequestCreateRequest, userID uuid.UUID, meta dto.AuditMeta) (*dto.ProductRequestResponse, error) {
	r := &models.ProductRequest{
		RequestedBy: userID,
		Name:        req.Name,
		Description: req.Description,
		Status:      models.RequestPending,
	}
	if err := s.reqRepo.Create(r); err != nil {
		return nil, err
	}
	resp := productRequestToResponse(r)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "product_request",
			EntityID:   r.ID.String(),
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	// Notify Admin users only (so they can review and approve/reject)
	if s.notificationSvc != nil && s.userRepo != nil {
		admins, _ := s.userRepo.ListByRole(models.RoleAdmin)
		reqID := r.ID
		title := "New product creation request"
		message := "A user has submitted a product creation request: \"" + r.Name + "\". Review and approve or reject from the Requests page."
		for i := range admins {
			if admins[i].ID != userID {
				_, _ = s.notificationSvc.Create(admins[i].ID, models.NotificationTypeProductRequestSubmitted, title, message, "product_request", &reqID)
			}
		}
	}
	return resp, nil
}

func (s *ProductRequestService) GetByID(id uuid.UUID) (*dto.ProductRequestResponse, error) {
	r, err := s.reqRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return productRequestToResponse(r), nil
}

func (s *ProductRequestService) List(status *models.RequestStatus, callerID uuid.UUID, callerRole string, ownerID *uuid.UUID, fromDate, toDate *time.Time) ([]dto.ProductRequestResponse, error) {
	var requestedBy *uuid.UUID
	if ownerID != nil {
		requestedBy = ownerID
	} else if strings.ToLower(callerRole) != "admin" {
		requestedBy = &callerID
	}
	list, err := s.reqRepo.List(status, requestedBy, fromDate, toDate)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ProductRequestResponse, len(list))
	for i := range list {
		out[i] = *productRequestToResponse(&list[i])
	}
	return out, nil
}

func (s *ProductRequestService) Approve(ctx context.Context, id uuid.UUID, approved bool, ownerID *uuid.UUID, meta dto.AuditMeta) (*dto.ProductRequestResponse, error) {
	r, err := s.reqRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	oldResp := productRequestToResponse(r)
	if approved && ownerID != nil {
		r.Status = models.RequestApproved
		product := &models.Product{
			Name:        r.Name,
			Description: r.Description,
			OwnerID:     ownerID,
			Status:      models.StatusApproved,
		}
		if err := s.productRepo.Create(product); err != nil {
			return nil, err
		}
	} else {
		r.Status = models.RequestRejected
	}
	if err := s.reqRepo.Update(r); err != nil {
		return nil, err
	}
	newResp := productRequestToResponse(r)
	if s.auditSvc != nil {
		action := "approve"
		if !approved {
			action = "reject"
		}
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     action,
			EntityType: "product_request",
			EntityID:   id.String(),
			OldData:    ToJSONB(oldResp),
			NewData:    ToJSONB(newResp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	if s.notificationSvc != nil {
		notifType := models.NotificationTypeProductRequestApproved
		title := "Product creation request approved"
		message := "Your product creation request for \"" + r.Name + "\" was approved. The product is now available."
		if !approved {
			notifType = models.NotificationTypeProductRequestRejected
			title = "Product creation request rejected"
			message = "Your product creation request for \"" + r.Name + "\" was rejected."
		}
		_, _ = s.notificationSvc.Create(r.RequestedBy, notifType, title, message, "product_request", &id)
	}
	return newResp, nil
}

func productRequestToResponse(r *models.ProductRequest) *dto.ProductRequestResponse {
	resp := &dto.ProductRequestResponse{
		ID:          r.ID.String(),
		RequestedBy: r.RequestedBy.String(),
		Name:        r.Name,
		Description: r.Description,
		Status:      string(r.Status),
		CreatedAt:   r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if r.Requester.ID != uuid.Nil {
		ur := userToResponse(&r.Requester)
		resp.Requester = &ur
	}
	return resp
}
