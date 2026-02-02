package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

type DepartmentRepository interface {
	Create(d *models.Department) error
	GetByID(id uuid.UUID) (*models.Department, error)
	List(functionID *uuid.UUID) ([]models.Department, error)
	Update(d *models.Department) error
	Delete(id uuid.UUID) error
}

type departmentRepository struct {
	db *gorm.DB
}

func NewDepartmentRepository(db *gorm.DB) DepartmentRepository {
	return &departmentRepository{db: db}
}

func (r *departmentRepository) Create(d *models.Department) error {
	return r.db.Create(d).Error
}

func (r *departmentRepository) GetByID(id uuid.UUID) (*models.Department, error) {
	var d models.Department
	if err := r.db.Preload("Teams").First(&d, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *departmentRepository) List(functionID *uuid.UUID) ([]models.Department, error) {
	var list []models.Department
	q := r.db.Order("name")
	if functionID != nil {
		q = q.Where("function_id = ?", *functionID)
	}
	err := q.Find(&list).Error
	return list, err
}

func (r *departmentRepository) Update(d *models.Department) error {
	return r.db.Save(d).Error
}

func (r *departmentRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Department{}, "id = ?", id).Error
}
