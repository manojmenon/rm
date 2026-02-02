package services

import (
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
)

var (
	ErrGroupNotFound       = errors.New("group not found")
	ErrGroupDescTooShort   = errors.New("group description must be more than 10 characters")
)

type GroupService struct {
	repo repositories.GroupRepository
}

func NewGroupService(repo repositories.GroupRepository) *GroupService {
	return &GroupService{repo: repo}
}

func (s *GroupService) Create(req dto.GroupCreateRequest, createdBy uuid.UUID) (*dto.GroupResponse, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		return nil, errors.New("name is required")
	}
	if len(req.Description) <= 10 {
		return nil, ErrGroupDescTooShort
	}
	productIDs, err := parseUUIDs(req.ProductIDs)
	if err != nil {
		return nil, err
	}
	g := &models.Group{
		Name:        req.Name,
		Description: req.Description,
		CreatedBy:   &createdBy,
	}
	if err := s.repo.Create(g); err != nil {
		return nil, err
	}
	if err := s.repo.SetProducts(g.ID, productIDs); err != nil {
		return nil, err
	}
	return s.getByID(g.ID)
}

func (s *GroupService) GetByID(id uuid.UUID, callerID uuid.UUID, callerRole models.Role) (*dto.GroupResponse, error) {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrGroupNotFound
	}
	// Non-admin can only see their own groups
	if callerRole != models.RoleAdmin && (g.CreatedBy == nil || *g.CreatedBy != callerID) {
		return nil, ErrForbidden
	}
	return groupToResponse(g), nil
}

func (s *GroupService) List(callerID uuid.UUID, callerRole models.Role) ([]dto.GroupResponse, error) {
	var createdBy *uuid.UUID
	if !callerRole.IsAdminOrAbove() {
		createdBy = &callerID
	}
	list, err := s.repo.List(createdBy)
	if err != nil {
		return nil, err
	}
	out := make([]dto.GroupResponse, len(list))
	for i := range list {
		out[i] = *groupToResponse(&list[i])
	}
	return out, nil
}

func (s *GroupService) Update(id uuid.UUID, req dto.GroupUpdateRequest, callerID uuid.UUID, callerRole models.Role) (*dto.GroupResponse, error) {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return nil, ErrGroupNotFound
	}
	if !callerRole.IsAdminOrAbove() && (g.CreatedBy == nil || *g.CreatedBy != callerID) {
		return nil, ErrForbidden
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, errors.New("name cannot be empty")
		}
		g.Name = name
	}
	if req.Description != nil {
		desc := strings.TrimSpace(*req.Description)
		if len(desc) <= 10 {
			return nil, ErrGroupDescTooShort
		}
		g.Description = desc
	}
	if err := s.repo.Update(g); err != nil {
		return nil, err
	}
	if req.ProductIDs != nil {
		productIDs, err := parseUUIDs(req.ProductIDs)
		if err != nil {
			return nil, err
		}
		if err := s.repo.SetProducts(id, productIDs); err != nil {
			return nil, err
		}
	}
	return s.getByID(id)
}

func (s *GroupService) Delete(id uuid.UUID, callerID uuid.UUID, callerRole models.Role) error {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return ErrGroupNotFound
	}
	if !callerRole.IsAdminOrAbove() && (g.CreatedBy == nil || *g.CreatedBy != callerID) {
		return ErrForbidden
	}
	return s.repo.Delete(id)
}

func (s *GroupService) getByID(id uuid.UUID) (*dto.GroupResponse, error) {
	g, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return groupToResponse(g), nil
}

func groupToResponse(g *models.Group) *dto.GroupResponse {
	resp := &dto.GroupResponse{
		ID:           g.ID.String(),
		Name:         g.Name,
		Description:  g.Description,
		ProductIDs:   []string{},
		ProductCount: 0,
		CreatedAt:    g.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if g.CreatedBy != nil {
		s := g.CreatedBy.String()
		resp.CreatedBy = &s
	}
	if len(g.Products) > 0 {
		resp.ProductIDs = make([]string, len(g.Products))
		for i := range g.Products {
			resp.ProductIDs[i] = g.Products[i].ID.String()
		}
		resp.ProductCount = len(g.Products)
	}
	return resp
}

func parseUUIDs(ids []string) ([]uuid.UUID, error) {
	out := make([]uuid.UUID, 0, len(ids))
	for _, s := range ids {
		if s == "" {
			continue
		}
		id, err := uuid.Parse(s)
		if err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}
