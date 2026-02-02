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

var ErrEndDateBeforeStart = errors.New("end_date must be greater than or equal to start_date")
var ErrCertifyRequiresTestedSuccessfully = errors.New("a Certify milestone cannot exist without a Tested Successfully milestone for the same product (and version)")

type MilestoneService struct {
	milestoneRepo repositories.MilestoneRepository
	productRepo   repositories.ProductRepository
	depRepo       repositories.DependencyRepository
	auditSvc      *AuditService
	activitySvc   *ActivityService
}

func NewMilestoneService(
	milestoneRepo repositories.MilestoneRepository,
	productRepo repositories.ProductRepository,
	depRepo repositories.DependencyRepository,
	auditSvc *AuditService,
	activitySvc *ActivityService,
) *MilestoneService {
	return &MilestoneService{
		milestoneRepo: milestoneRepo,
		productRepo:   productRepo,
		depRepo:       depRepo,
		auditSvc:      auditSvc,
		activitySvc:   activitySvc,
	}
}

func (s *MilestoneService) Create(ctx context.Context, req dto.MilestoneCreateRequest, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) (*dto.MilestoneResponse, error) {
	productID, _ := uuid.Parse(req.ProductID)
	if callerRole == models.RoleOwner {
		p, err := s.productRepo.GetByID(productID)
		if err != nil {
			return nil, err
		}
		if p.LifecycleStatus != models.LifecycleActive {
			return nil, ErrForbidden
		}
		if p.OwnerID == nil || *p.OwnerID != callerID {
			return nil, ErrForbidden
		}
	}
	var endDate *time.Time
	if !req.EndDate.IsZero() {
		if req.EndDate.Before(req.StartDate) {
			return nil, ErrEndDateBeforeStart
		}
		endDate = &req.EndDate
	}
	m := &models.Milestone{
		ProductID: productID,
		Label:     req.Label,
		StartDate: req.StartDate,
		EndDate:   endDate,
		Type:      req.Type,
		Color:     req.Color,
		Extra:     models.JSONB(req.Extra),
	}
	if req.ProductVersionID != "" {
		versionID, err := uuid.Parse(req.ProductVersionID)
		if err == nil {
			m.ProductVersionID = &versionID
		}
	}
	// Business rule: Certify milestone requires a Tested Successfully milestone for the same product (and version)
	if strings.EqualFold(strings.TrimSpace(req.Label), "Certify") {
		milestones, err := s.milestoneRepo.ListByProductID(productID)
		if err != nil {
			return nil, err
		}
		hasTested := false
		for i := range milestones {
			if strings.EqualFold(strings.TrimSpace(milestones[i].Label), "Tested Successfully") {
				if m.ProductVersionID == nil && milestones[i].ProductVersionID == nil {
					hasTested = true
					break
				}
				if m.ProductVersionID != nil && milestones[i].ProductVersionID != nil && *m.ProductVersionID == *milestones[i].ProductVersionID {
					hasTested = true
					break
				}
			}
		}
		if !hasTested {
			return nil, ErrCertifyRequiresTestedSuccessfully
		}
	}
	if err := s.milestoneRepo.Create(m); err != nil {
		return nil, err
	}
	resp := milestoneToResponse(m)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "milestone",
			EntityID:   m.ID.String(),
			NewData:    ToJSONB(resp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	if s.activitySvc != nil && meta.UserID != nil {
		s.activitySvc.Log(ctx, ActivityEntry{
			UserID:     meta.UserID,
			Action:     "create",
			EntityType: "milestone",
			EntityID:   m.ID.String(),
			Details:    m.Label,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
		})
	}
	return resp, nil
}

func (s *MilestoneService) GetByID(id uuid.UUID) (*dto.MilestoneResponse, error) {
	m, err := s.milestoneRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return milestoneToResponse(m), nil
}

func (s *MilestoneService) ListByProductID(productID uuid.UUID) ([]dto.MilestoneResponse, error) {
	list, err := s.milestoneRepo.ListByProductID(productID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.MilestoneResponse, len(list))
	for i := range list {
		out[i] = *milestoneToResponse(&list[i])
	}
	return out, nil
}

func (s *MilestoneService) Update(ctx context.Context, id uuid.UUID, req dto.MilestoneUpdateRequest, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) (*dto.MilestoneResponse, error) {
	m, err := s.milestoneRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if callerRole == models.RoleOwner {
		p, err := s.productRepo.GetByID(m.ProductID)
		if err != nil {
			return nil, err
		}
		if p.LifecycleStatus != models.LifecycleActive {
			return nil, ErrForbidden
		}
		if p.OwnerID == nil || *p.OwnerID != callerID {
			return nil, ErrForbidden
		}
	}
	oldResp := milestoneToResponse(m)
	applyMilestoneUpdate(m, req)
	if m.EndDate != nil && (*m.EndDate).Before(m.StartDate) {
		return nil, ErrEndDateBeforeStart
	}
	// Business rule: Certify milestone requires a Tested Successfully milestone for the same product (and version)
	if strings.EqualFold(strings.TrimSpace(m.Label), "Certify") {
		milestones, err := s.milestoneRepo.ListByProductID(m.ProductID)
		if err != nil {
			return nil, err
		}
		hasTested := false
		for i := range milestones {
			if milestones[i].ID == id {
				continue
			}
			if strings.EqualFold(strings.TrimSpace(milestones[i].Label), "Tested Successfully") {
				if m.ProductVersionID == nil && milestones[i].ProductVersionID == nil {
					hasTested = true
					break
				}
				if m.ProductVersionID != nil && milestones[i].ProductVersionID != nil && *m.ProductVersionID == *milestones[i].ProductVersionID {
					hasTested = true
					break
				}
			}
		}
		if !hasTested {
			return nil, ErrCertifyRequiresTestedSuccessfully
		}
	}
	if err := s.milestoneRepo.Update(m); err != nil {
		return nil, err
	}
	// TODO: auto-reschedule dependents when dates change
	_ = s.rescheduleDependents(m)
	newResp := milestoneToResponse(m)
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "update",
			EntityType: "milestone",
			EntityID:   id.String(),
			OldData:    ToJSONB(oldResp),
			NewData:    ToJSONB(newResp),
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	if s.activitySvc != nil && meta.UserID != nil {
		s.activitySvc.Log(ctx, ActivityEntry{
			UserID:     meta.UserID,
			Action:     "save",
			EntityType: "milestone",
			EntityID:   id.String(),
			Details:    m.Label,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
		})
	}
	return newResp, nil
}

func (s *MilestoneService) rescheduleDependents(m *models.Milestone) error {
	if m.EndDate == nil {
		return nil
	}
	deps, err := s.depRepo.ListBySource(m.ID)
	if err != nil {
		return err
	}
	for _, d := range deps {
		target, _ := s.milestoneRepo.GetByID(d.TargetMilestoneID)
		if target == nil {
			continue
		}
		var newStart, newEnd time.Time
		switch d.Type {
		case models.DepFinishToStart:
			delta := target.StartDate.Sub(*m.EndDate)
			newStart = (*m.EndDate).Add(delta)
			if target.EndDate != nil {
				newEnd = (*target.EndDate).Add(newStart.Sub(target.StartDate))
			} else {
				newEnd = newStart
			}
		case models.DepStartToStart:
			delta := target.StartDate.Sub(m.StartDate)
			newStart = m.StartDate.Add(delta)
			if target.EndDate != nil {
				newEnd = (*target.EndDate).Add(newStart.Sub(target.StartDate))
			} else {
				newEnd = newStart
			}
		case models.DepFinishToFinish:
			if target.EndDate != nil {
				delta := (*target.EndDate).Sub(*m.EndDate)
				newEnd = (*m.EndDate).Add(delta)
				newStart = target.StartDate.Add(newEnd.Sub(*target.EndDate))
			} else {
				newEnd = newStart
				newStart = target.StartDate
			}
		}
		target.StartDate = newStart
		target.EndDate = &newEnd
		_ = s.milestoneRepo.Update(target)
	}
	return nil
}

func (s *MilestoneService) Delete(ctx context.Context, id uuid.UUID, callerID uuid.UUID, callerRole models.Role, meta dto.AuditMeta) error {
	if callerRole == models.RoleOwner {
		m, err := s.milestoneRepo.GetByID(id)
		if err != nil {
			return err
		}
		p, err := s.productRepo.GetByID(m.ProductID)
		if err != nil {
			return err
		}
		if p.LifecycleStatus != models.LifecycleActive {
			return ErrForbidden
		}
		if p.OwnerID == nil || *p.OwnerID != callerID {
			return ErrForbidden
		}
	}
	m, _ := s.milestoneRepo.GetByID(id)
	oldData := models.JSONB(nil)
	if m != nil {
		oldData = ToJSONB(milestoneToResponse(m))
	}
	if err := s.milestoneRepo.Delete(id); err != nil {
		return err
	}
	if s.auditSvc != nil {
		s.auditSvc.Log(ctx, AuditEntry{
			UserID:     meta.UserID,
			Action:     "delete",
			EntityType: "milestone",
			EntityID:   id.String(),
			OldData:    oldData,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
			TraceID:    meta.TraceID,
		})
	}
	if s.activitySvc != nil && meta.UserID != nil {
		details := ""
		if m != nil {
			details = m.Label
		}
		s.activitySvc.Log(ctx, ActivityEntry{
			UserID:     meta.UserID,
			Action:     "delete",
			EntityType: "milestone",
			EntityID:   id.String(),
			Details:    details,
			IPAddress:  meta.IP,
			UserAgent:  meta.UserAgent,
		})
	}
	return nil
}

func applyMilestoneUpdate(m *models.Milestone, req dto.MilestoneUpdateRequest) {
	if req.Label != nil {
		m.Label = *req.Label
	}
	if req.StartDate != nil {
		m.StartDate = *req.StartDate
	}
	if req.EndDate != nil {
		m.EndDate = req.EndDate
	}
	if req.Type != nil {
		m.Type = *req.Type
	}
	if req.Color != nil {
		m.Color = *req.Color
	}
	if req.Extra != nil {
		m.Extra = models.JSONB(req.Extra)
	}
}

func milestoneToResponse(m *models.Milestone) *dto.MilestoneResponse {
	resp := &dto.MilestoneResponse{
		ID:        m.ID.String(),
		ProductID: m.ProductID.String(),
		Label:     m.Label,
		StartDate: m.StartDate.Format("2006-01-02"),
		Type:      m.Type,
		Color:     m.Color,
		CreatedAt: m.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if m.EndDate != nil {
		resp.EndDate = m.EndDate.Format("2006-01-02")
	}
	if m.ProductVersionID != nil {
		s := m.ProductVersionID.String()
		resp.ProductVersionID = &s
	}
	if m.Extra != nil {
		resp.Extra = m.Extra
	}
	return resp
}
