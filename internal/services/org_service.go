package services

import (
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
)

type OrgService struct {
	holdingRepo repositories.HoldingCompanyRepository
	companyRepo repositories.CompanyRepository
	funcRepo    repositories.FunctionRepository
	deptRepo    repositories.DepartmentRepository
	teamRepo    repositories.TeamRepository
}

func NewOrgService(
	holdingRepo repositories.HoldingCompanyRepository,
	companyRepo repositories.CompanyRepository,
	funcRepo repositories.FunctionRepository,
	deptRepo repositories.DepartmentRepository,
	teamRepo repositories.TeamRepository,
) *OrgService {
	return &OrgService{
		holdingRepo: holdingRepo,
		companyRepo: companyRepo,
		funcRepo:    funcRepo,
		deptRepo:    deptRepo,
		teamRepo:    teamRepo,
	}
}

func ts(t time.Time) string { return t.Format(time.RFC3339) }

// Holding companies
func (s *OrgService) CreateHoldingCompany(req dto.HoldingCompanyCreateRequest) (*dto.HoldingCompanyResponse, error) {
	h := &models.HoldingCompany{Name: req.Name, Description: req.Description}
	if err := s.holdingRepo.Create(h); err != nil {
		return nil, err
	}
	return &dto.HoldingCompanyResponse{ID: h.ID.String(), Name: h.Name, Description: h.Description, CreatedAt: ts(h.CreatedAt)}, nil
}
func (s *OrgService) ListHoldingCompanies() ([]dto.HoldingCompanyResponse, error) {
	list, err := s.holdingRepo.List()
	if err != nil {
		return nil, err
	}
	out := make([]dto.HoldingCompanyResponse, len(list))
	for i := range list {
		out[i] = dto.HoldingCompanyResponse{ID: list[i].ID.String(), Name: list[i].Name, Description: list[i].Description, CreatedAt: ts(list[i].CreatedAt)}
	}
	return out, nil
}
func (s *OrgService) GetHoldingCompany(id uuid.UUID) (*dto.HoldingCompanyResponse, error) {
	h, err := s.holdingRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return &dto.HoldingCompanyResponse{ID: h.ID.String(), Name: h.Name, Description: h.Description, CreatedAt: ts(h.CreatedAt)}, nil
}
func (s *OrgService) UpdateHoldingCompany(id uuid.UUID, req dto.HoldingCompanyUpdateRequest) (*dto.HoldingCompanyResponse, error) {
	h, err := s.holdingRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		h.Name = *req.Name
	}
	if req.Description != nil {
		h.Description = *req.Description
	}
	if err := s.holdingRepo.Update(h); err != nil {
		return nil, err
	}
	return &dto.HoldingCompanyResponse{ID: h.ID.String(), Name: h.Name, Description: h.Description, CreatedAt: ts(h.CreatedAt)}, nil
}
func (s *OrgService) DeleteHoldingCompany(id uuid.UUID) error {
	return s.holdingRepo.Delete(id)
}

// Companies
func (s *OrgService) CreateCompany(req dto.CompanyCreateRequest) (*dto.CompanyResponse, error) {
	hid, _ := uuid.Parse(req.HoldingCompanyID)
	c := &models.Company{HoldingCompanyID: hid, Name: req.Name}
	if err := s.companyRepo.Create(c); err != nil {
		return nil, err
	}
	return &dto.CompanyResponse{ID: c.ID.String(), HoldingCompanyID: c.HoldingCompanyID.String(), Name: c.Name, CreatedAt: ts(c.CreatedAt)}, nil
}
func (s *OrgService) ListCompanies(holdingCompanyID *uuid.UUID) ([]dto.CompanyResponse, error) {
	list, err := s.companyRepo.List(holdingCompanyID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.CompanyResponse, len(list))
	for i := range list {
		out[i] = dto.CompanyResponse{ID: list[i].ID.String(), HoldingCompanyID: list[i].HoldingCompanyID.String(), Name: list[i].Name, CreatedAt: ts(list[i].CreatedAt)}
	}
	return out, nil
}
func (s *OrgService) GetCompany(id uuid.UUID) (*dto.CompanyResponse, error) {
	c, err := s.companyRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return &dto.CompanyResponse{ID: c.ID.String(), HoldingCompanyID: c.HoldingCompanyID.String(), Name: c.Name, CreatedAt: ts(c.CreatedAt)}, nil
}
func (s *OrgService) UpdateCompany(id uuid.UUID, req dto.CompanyUpdateRequest) (*dto.CompanyResponse, error) {
	c, err := s.companyRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.HoldingCompanyID != nil {
		hid, _ := uuid.Parse(*req.HoldingCompanyID)
		c.HoldingCompanyID = hid
	}
	if req.Name != nil {
		c.Name = *req.Name
	}
	if err := s.companyRepo.Update(c); err != nil {
		return nil, err
	}
	return &dto.CompanyResponse{ID: c.ID.String(), HoldingCompanyID: c.HoldingCompanyID.String(), Name: c.Name, CreatedAt: ts(c.CreatedAt)}, nil
}
func (s *OrgService) DeleteCompany(id uuid.UUID) error {
	return s.companyRepo.Delete(id)
}

// Functions
func (s *OrgService) CreateFunction(req dto.FunctionCreateRequest) (*dto.FunctionResponse, error) {
	cid, _ := uuid.Parse(req.CompanyID)
	f := &models.Function{CompanyID: cid, Name: req.Name}
	if err := s.funcRepo.Create(f); err != nil {
		return nil, err
	}
	return &dto.FunctionResponse{ID: f.ID.String(), CompanyID: f.CompanyID.String(), Name: f.Name, CreatedAt: ts(f.CreatedAt)}, nil
}
func (s *OrgService) ListFunctions(companyID *uuid.UUID) ([]dto.FunctionResponse, error) {
	list, err := s.funcRepo.List(companyID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.FunctionResponse, len(list))
	for i := range list {
		out[i] = dto.FunctionResponse{ID: list[i].ID.String(), CompanyID: list[i].CompanyID.String(), Name: list[i].Name, CreatedAt: ts(list[i].CreatedAt)}
	}
	return out, nil
}
func (s *OrgService) GetFunction(id uuid.UUID) (*dto.FunctionResponse, error) {
	f, err := s.funcRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return &dto.FunctionResponse{ID: f.ID.String(), CompanyID: f.CompanyID.String(), Name: f.Name, CreatedAt: ts(f.CreatedAt)}, nil
}
func (s *OrgService) UpdateFunction(id uuid.UUID, req dto.FunctionUpdateRequest) (*dto.FunctionResponse, error) {
	f, err := s.funcRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.CompanyID != nil {
		cid, _ := uuid.Parse(*req.CompanyID)
		f.CompanyID = cid
	}
	if req.Name != nil {
		f.Name = *req.Name
	}
	if err := s.funcRepo.Update(f); err != nil {
		return nil, err
	}
	return &dto.FunctionResponse{ID: f.ID.String(), CompanyID: f.CompanyID.String(), Name: f.Name, CreatedAt: ts(f.CreatedAt)}, nil
}
func (s *OrgService) DeleteFunction(id uuid.UUID) error {
	return s.funcRepo.Delete(id)
}

// Departments
func (s *OrgService) CreateDepartment(req dto.DepartmentCreateRequest) (*dto.DepartmentResponse, error) {
	fid, _ := uuid.Parse(req.FunctionID)
	d := &models.Department{FunctionID: fid, Name: req.Name}
	if err := s.deptRepo.Create(d); err != nil {
		return nil, err
	}
	return &dto.DepartmentResponse{ID: d.ID.String(), FunctionID: d.FunctionID.String(), Name: d.Name, CreatedAt: ts(d.CreatedAt)}, nil
}
func (s *OrgService) ListDepartments(functionID *uuid.UUID) ([]dto.DepartmentResponse, error) {
	list, err := s.deptRepo.List(functionID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.DepartmentResponse, len(list))
	for i := range list {
		out[i] = dto.DepartmentResponse{ID: list[i].ID.String(), FunctionID: list[i].FunctionID.String(), Name: list[i].Name, CreatedAt: ts(list[i].CreatedAt)}
	}
	return out, nil
}
func (s *OrgService) GetDepartment(id uuid.UUID) (*dto.DepartmentResponse, error) {
	d, err := s.deptRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return &dto.DepartmentResponse{ID: d.ID.String(), FunctionID: d.FunctionID.String(), Name: d.Name, CreatedAt: ts(d.CreatedAt)}, nil
}
func (s *OrgService) UpdateDepartment(id uuid.UUID, req dto.DepartmentUpdateRequest) (*dto.DepartmentResponse, error) {
	d, err := s.deptRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.FunctionID != nil {
		fid, _ := uuid.Parse(*req.FunctionID)
		d.FunctionID = fid
	}
	if req.Name != nil {
		d.Name = *req.Name
	}
	if err := s.deptRepo.Update(d); err != nil {
		return nil, err
	}
	return &dto.DepartmentResponse{ID: d.ID.String(), FunctionID: d.FunctionID.String(), Name: d.Name, CreatedAt: ts(d.CreatedAt)}, nil
}
func (s *OrgService) DeleteDepartment(id uuid.UUID) error {
	return s.deptRepo.Delete(id)
}

// Teams
func (s *OrgService) CreateTeam(req dto.TeamCreateRequest) (*dto.TeamResponse, error) {
	did, _ := uuid.Parse(req.DepartmentID)
	t := &models.Team{DepartmentID: did, Name: req.Name}
	if req.ManagerID != nil && *req.ManagerID != "" {
		mid, _ := uuid.Parse(*req.ManagerID)
		t.ManagerID = &mid
	}
	if err := s.teamRepo.Create(t); err != nil {
		return nil, err
	}
	return teamToResp(t), nil
}
func (s *OrgService) ListTeams(departmentID *uuid.UUID) ([]dto.TeamResponse, error) {
	list, err := s.teamRepo.List(departmentID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.TeamResponse, len(list))
	for i := range list {
		out[i] = *teamToResp(&list[i])
	}
	return out, nil
}
func (s *OrgService) GetTeam(id uuid.UUID) (*dto.TeamResponse, error) {
	t, err := s.teamRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return teamToResp(t), nil
}
func (s *OrgService) UpdateTeam(id uuid.UUID, req dto.TeamUpdateRequest) (*dto.TeamResponse, error) {
	t, err := s.teamRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.DepartmentID != nil {
		did, _ := uuid.Parse(*req.DepartmentID)
		t.DepartmentID = did
	}
	if req.Name != nil {
		t.Name = *req.Name
	}
	if req.ManagerID != nil {
		if *req.ManagerID == "" {
			t.ManagerID = nil
		} else {
			mid, _ := uuid.Parse(*req.ManagerID)
			t.ManagerID = &mid
		}
	}
	// Clear associations so GORM persists department_id and manager_id columns
	t.Department = nil
	t.Manager = nil
	if err := s.teamRepo.Update(t); err != nil {
		return nil, err
	}
	return teamToResp(t), nil
}
func (s *OrgService) DeleteTeam(id uuid.UUID) error {
	return s.teamRepo.Delete(id)
}

func teamToResp(t *models.Team) *dto.TeamResponse {
	r := &dto.TeamResponse{ID: t.ID.String(), DepartmentID: t.DepartmentID.String(), Name: t.Name, CreatedAt: ts(t.CreatedAt)}
	if t.ManagerID != nil {
		s := t.ManagerID.String()
		r.ManagerID = &s
	}
	return r
}
