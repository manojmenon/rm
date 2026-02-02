package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
)

type ProductVersionService struct {
	versionRepo repositories.ProductVersionRepository
	productRepo repositories.ProductRepository
	auditSvc    *AuditService
}

func NewProductVersionService(versionRepo repositories.ProductVersionRepository, productRepo repositories.ProductRepository, auditSvc *AuditService) *ProductVersionService {
	return &ProductVersionService{versionRepo: versionRepo, productRepo: productRepo, auditSvc: auditSvc}
}

// canModifyVersions returns nil if caller (admin or product owner) can add/modify versions when product is active.
func (s *ProductVersionService) canModifyVersions(productID, callerID uuid.UUID, callerRole models.Role) error {
	p, err := s.productRepo.GetByID(productID)
	if err != nil {
		return err
	}
	if callerRole == models.RoleAdmin {
		return nil
	}
	if p.LifecycleStatus != models.LifecycleActive {
		return ErrForbidden
	}
	if p.OwnerID == nil || *p.OwnerID != callerID {
		return ErrForbidden
	}
	return nil
}

func (s *ProductVersionService) Create(ctx context.Context, req dto.ProductVersionCreateRequest, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) (*dto.ProductVersionResponse, error) {
	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		return nil, err
	}
	if err := s.canModifyVersions(productID, callerID, callerRole); err != nil {
		return nil, err
	}
	pv := &models.ProductVersion{
		ProductID: productID,
		Version:   req.Version,
	}
	if err := s.versionRepo.Create(pv); err != nil {
		return nil, err
	}
	resp := &dto.ProductVersionResponse{
		ID:        pv.ID.String(),
		ProductID: pv.ProductID.String(),
		Version:   pv.Version,
		CreatedAt: pv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "product_version",
			EntityID:   pv.ID.String(),
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return resp, nil
}

func (s *ProductVersionService) Update(ctx context.Context, id uuid.UUID, req dto.ProductVersionUpdateRequest, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) (*dto.ProductVersionResponse, error) {
	pv, err := s.versionRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if err := s.canModifyVersions(pv.ProductID, callerID, callerRole); err != nil {
		return nil, err
	}
	oldData := ToJSONB(&dto.ProductVersionResponse{
		ID:        pv.ID.String(),
		ProductID: pv.ProductID.String(),
		Version:   pv.Version,
		CreatedAt: pv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	pv.Version = req.Version
	if err := s.versionRepo.Update(pv); err != nil {
		return nil, err
	}
	resp := &dto.ProductVersionResponse{
		ID:        pv.ID.String(),
		ProductID: pv.ProductID.String(),
		Version:   pv.Version,
		CreatedAt: pv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "update",
			EntityType: "product_version",
			EntityID:   id.String(),
			OldData:    oldData,
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return resp, nil
}

func (s *ProductVersionService) ListByProductID(productID uuid.UUID) ([]dto.ProductVersionResponse, error) {
	list, err := s.versionRepo.ListByProductID(productID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ProductVersionResponse, len(list))
	for i := range list {
		out[i] = dto.ProductVersionResponse{
			ID:        list[i].ID.String(),
			ProductID: list[i].ProductID.String(),
			Version:   list[i].Version,
			CreatedAt: list[i].CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}
	return out, nil
}

func (s *ProductVersionService) Delete(ctx context.Context, id uuid.UUID, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) error {
	pv, err := s.versionRepo.GetByID(id)
	if err != nil {
		return err
	}
	if err := s.canModifyVersions(pv.ProductID, callerID, callerRole); err != nil {
		return err
	}
	oldData := ToJSONB(&dto.ProductVersionResponse{
		ID:        pv.ID.String(),
		ProductID: pv.ProductID.String(),
		Version:   pv.Version,
		CreatedAt: pv.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	if err := s.versionRepo.Delete(id); err != nil {
		return err
	}
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "delete",
			EntityType: "product_version",
			EntityID:   id.String(),
			OldData:    oldData,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return nil
}
