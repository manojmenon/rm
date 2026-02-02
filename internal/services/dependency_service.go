package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
)

type DependencyService struct {
	depRepo     repositories.DependencyRepository
	milestoneRepo repositories.MilestoneRepository
	auditSvc    *AuditService
}

func NewDependencyService(depRepo repositories.DependencyRepository, milestoneRepo repositories.MilestoneRepository, auditSvc *AuditService) *DependencyService {
	return &DependencyService{depRepo: depRepo, milestoneRepo: milestoneRepo, auditSvc: auditSvc}
}

func (s *DependencyService) Create(ctx context.Context, req dto.DependencyCreateRequest, meta dto.AuditMeta) (*dto.DependencyResponse, error) {
	src, _ := uuid.Parse(req.SourceMilestoneID)
	tgt, _ := uuid.Parse(req.TargetMilestoneID)
	d := &models.Dependency{
		SourceMilestoneID: src,
		TargetMilestoneID: tgt,
		Type:              models.DependencyType(req.Type),
	}
	if err := s.depRepo.Create(d); err != nil {
		return nil, err
	}
	resp := dependencyToResponse(d)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "dependency",
			EntityID:   d.ID.String(),
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return resp, nil
}

func (s *DependencyService) GetByID(id uuid.UUID) (*dto.DependencyResponse, error) {
	d, err := s.depRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return dependencyToResponse(d), nil
}

// List returns all dependencies, optionally filtered by product (dependencies where source or target milestone belongs to the product).
func (s *DependencyService) List(productID *uuid.UUID) ([]*dto.DependencyResponse, error) {
	list, err := s.depRepo.ListAll()
	if err != nil {
		return nil, err
	}
	if productID != nil {
		milestones, err := s.milestoneRepo.ListByProductID(*productID)
		if err != nil {
			return nil, err
		}
		ids := make(map[uuid.UUID]bool)
		for _, m := range milestones {
			ids[m.ID] = true
		}
		filtered := list[:0]
		for _, d := range list {
			if ids[d.SourceMilestoneID] || ids[d.TargetMilestoneID] {
				filtered = append(filtered, d)
			}
		}
		list = filtered
	}
	out := make([]*dto.DependencyResponse, len(list))
	for i := range list {
		out[i] = dependencyToResponse(&list[i])
	}
	return out, nil
}

func (s *DependencyService) Delete(ctx context.Context, id uuid.UUID, meta dto.AuditMeta) error {
	d, err := s.depRepo.GetByID(id)
	if err != nil {
		return err
	}
	oldData := ToJSONB(dependencyToResponse(d))
	if err := s.depRepo.Delete(id); err != nil {
		return err
	}
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "delete",
			EntityType: "dependency",
			EntityID:   id.String(),
			OldData:    oldData,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	return nil
}

func dependencyToResponse(d *models.Dependency) *dto.DependencyResponse {
	return &dto.DependencyResponse{
		ID:                d.ID.String(),
		SourceMilestoneID: d.SourceMilestoneID.String(),
		TargetMilestoneID: d.TargetMilestoneID.String(),
		Type:              string(d.Type),
		CreatedAt:         d.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
