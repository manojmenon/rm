package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

type TeamRepository interface {
	Create(t *models.Team) error
	GetByID(id uuid.UUID) (*models.Team, error)
	List(departmentID *uuid.UUID) ([]models.Team, error)
	Update(t *models.Team) error
	Delete(id uuid.UUID) error
}

type teamRepository struct {
	db *gorm.DB
}

func NewTeamRepository(db *gorm.DB) TeamRepository {
	return &teamRepository{db: db}
}

func (r *teamRepository) Create(t *models.Team) error {
	return r.db.Create(t).Error
}

func (r *teamRepository) GetByID(id uuid.UUID) (*models.Team, error) {
	var t models.Team
	if err := r.db.Preload("Manager").Preload("Department").First(&t, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *teamRepository) List(departmentID *uuid.UUID) ([]models.Team, error) {
	var list []models.Team
	q := r.db.Order("name")
	if departmentID != nil {
		q = q.Where("department_id = ?", *departmentID)
	}
	err := q.Find(&list).Error
	return list, err
}

func (r *teamRepository) Update(t *models.Team) error {
	return r.db.Save(t).Error
}

func (r *teamRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Team{}, "id = ?", id).Error
}
