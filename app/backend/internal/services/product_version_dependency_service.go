package services

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/models"
	"github.com/rm/roadmap/backend/internal/repositories"
)

type ProductVersionDependencyService struct {
	versionDepRepo repositories.ProductVersionDependencyRepository
	versionRepo    repositories.ProductVersionRepository
	productRepo    repositories.ProductRepository
	auditSvc       *AuditService
}

func NewProductVersionDependencyService(
	versionDepRepo repositories.ProductVersionDependencyRepository,
	versionRepo repositories.ProductVersionRepository,
	productRepo repositories.ProductRepository,
	auditSvc *AuditService,
) *ProductVersionDependencyService {
	return &ProductVersionDependencyService{
		versionDepRepo: versionDepRepo,
		versionRepo:    versionRepo,
		productRepo:    productRepo,
		auditSvc:       auditSvc,
	}
}

func (s *ProductVersionDependencyService) canModifySourceVersion(sourceProductVersionID, callerID uuid.UUID, callerRole models.Role) (productID uuid.UUID, err error) {
	pv, err := s.versionRepo.GetByID(sourceProductVersionID)
	if err != nil {
		return uuid.Nil, err
	}
	p, err := s.productRepo.GetByID(pv.ProductID)
	if err != nil {
		return uuid.Nil, err
	}
	if callerRole.IsAdminOrAbove() {
		return p.ID, nil
	}
	if p.OwnerID == nil || *p.OwnerID != callerID {
		return uuid.Nil, ErrForbidden
	}
	return p.ID, nil
}

func (s *ProductVersionDependencyService) ListByProductVersionID(ctx context.Context, sourceProductVersionID uuid.UUID, callerID uuid.UUID, callerRole models.Role) ([]dto.ProductVersionDependencyResponse, error) {
	if _, err := s.canModifySourceVersion(sourceProductVersionID, callerID, callerRole); err != nil {
		return nil, err
	}
	list, err := s.versionDepRepo.ListBySourceProductVersionID(ctx, sourceProductVersionID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.ProductVersionDependencyResponse, len(list))
	for i := range list {
		out[i] = *productVersionDependencyToResponse(&list[i])
	}
	return out, nil
}

func (s *ProductVersionDependencyService) Create(ctx context.Context, req dto.ProductVersionDependencyCreateRequest, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) (*dto.ProductVersionDependencyResponse, error) {
	sourceVersionID, err := uuid.Parse(req.SourceProductVersionID)
	if err != nil {
		return nil, err
	}
	if _, err := s.canModifySourceVersion(sourceVersionID, callerID, callerRole); err != nil {
		return nil, err
	}
	targetProductID, err := uuid.Parse(req.TargetProductID)
	if err != nil {
		return nil, err
	}
	if _, err := s.productRepo.GetByID(targetProductID); err != nil {
		return nil, err
	}
	d := &models.ProductVersionDependency{
		SourceProductVersionID: sourceVersionID,
		TargetProductID:        targetProductID,
		RequiredStatus:         strings.TrimSpace(req.RequiredStatus),
	}
	if req.TargetProductVersionID != "" {
		targetVersionID, err := uuid.Parse(req.TargetProductVersionID)
		if err != nil {
			return nil, err
		}
		tv, err := s.versionRepo.GetByID(targetVersionID)
		if err != nil {
			return nil, err
		}
		if tv.ProductID != targetProductID {
			return nil, ErrForbidden
		}
		d.TargetProductVersionID = &targetVersionID
	}
	if err := s.versionDepRepo.Create(ctx, d); err != nil {
		return nil, err
	}
	fresh, _ := s.versionDepRepo.GetByID(ctx, d.ID)
	resp := productVersionDependencyToResponse(fresh)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "product_version_dependency",
			EntityID:   d.ID.String(),
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return resp, nil
}

func (s *ProductVersionDependencyService) Delete(ctx context.Context, id uuid.UUID, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) error {
	d, err := s.versionDepRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if _, err := s.canModifySourceVersion(d.SourceProductVersionID, callerID, callerRole); err != nil {
		return err
	}
	oldData := ToJSONB(productVersionDependencyToResponse(d))
	if err := s.versionDepRepo.Delete(ctx, id); err != nil {
		return err
	}
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "delete",
			EntityType: "product_version_dependency",
			EntityID:   id.String(),
			OldData:    oldData,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return nil
}

func productVersionDependencyToResponse(d *models.ProductVersionDependency) *dto.ProductVersionDependencyResponse {
	resp := &dto.ProductVersionDependencyResponse{
		ID:                     d.ID.String(),
		SourceProductVersionID: d.SourceProductVersionID.String(),
		TargetProductID:        d.TargetProductID.String(),
		RequiredStatus:         d.RequiredStatus,
		CreatedAt:              d.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if d.TargetProductVersionID != nil {
		s := d.TargetProductVersionID.String()
		resp.TargetProductVersionID = &s
	}
	if d.TargetProduct != nil {
		resp.TargetProductName = d.TargetProduct.Name
	}
	if d.TargetProductVersion != nil {
		resp.TargetProductVersion = d.TargetProductVersion.Version
	}
	return resp
}
