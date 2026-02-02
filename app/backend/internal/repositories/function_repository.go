package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type FunctionRepository interface {
	Create(f *models.Function) error
	GetByID(id uuid.UUID) (*models.Function, error)
	List(companyID *uuid.UUID) ([]models.Function, error)
	Update(f *models.Function) error
	Delete(id uuid.UUID) error
}

type functionRepository struct {
	db *gorm.DB
}

func NewFunctionRepository(db *gorm.DB) FunctionRepository {
	return &functionRepository{db: db}
}

func (r *functionRepository) Create(f *models.Function) error {
	return r.db.Create(f).Error
}

func (r *functionRepository) GetByID(id uuid.UUID) (*models.Function, error) {
	var f models.Function
	if err := r.db.Preload("Departments").First(&f, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *functionRepository) List(companyID *uuid.UUID) ([]models.Function, error) {
	var list []models.Function
	q := r.db.Order("name")
	if companyID != nil {
		q = q.Where("company_id = ?", *companyID)
	}
	err := q.Find(&list).Error
	return list, err
}

func (r *functionRepository) Update(f *models.Function) error {
	return r.db.Save(f).Error
}

func (r *functionRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Function{}, "id = ?", id).Error
}
