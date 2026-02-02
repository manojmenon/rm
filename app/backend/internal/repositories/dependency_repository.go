package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type DependencyRepository interface {
	Create(d *models.Dependency) error
	GetByID(id uuid.UUID) (*models.Dependency, error)
	ListAll() ([]models.Dependency, error)
	ListBySource(id uuid.UUID) ([]models.Dependency, error)
	ListByTarget(id uuid.UUID) ([]models.Dependency, error)
	Update(d *models.Dependency) error
	Delete(id uuid.UUID) error
}

type dependencyRepository struct {
	db *gorm.DB
}

func NewDependencyRepository(db *gorm.DB) DependencyRepository {
	return &dependencyRepository{db: db}
}

func (r *dependencyRepository) Create(d *models.Dependency) error {
	return r.db.Create(d).Error
}

func (r *dependencyRepository) GetByID(id uuid.UUID) (*models.Dependency, error) {
	var dep models.Dependency
	err := r.db.Preload("SourceMilestone").Preload("TargetMilestone").First(&dep, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &dep, nil
}

func (r *dependencyRepository) ListAll() ([]models.Dependency, error) {
	var list []models.Dependency
	err := r.db.Find(&list).Error
	return list, err
}

func (r *dependencyRepository) ListBySource(id uuid.UUID) ([]models.Dependency, error) {
	var list []models.Dependency
	err := r.db.Where("source_milestone_id = ?", id).Find(&list).Error
	return list, err
}

func (r *dependencyRepository) ListByTarget(id uuid.UUID) ([]models.Dependency, error) {
	var list []models.Dependency
	err := r.db.Where("target_milestone_id = ?", id).Find(&list).Error
	return list, err
}

func (r *dependencyRepository) Update(d *models.Dependency) error {
	return r.db.Save(d).Error
}

func (r *dependencyRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Dependency{}, "id = ?", id).Error
}
