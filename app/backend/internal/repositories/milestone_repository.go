package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type MilestoneRepository interface {
	Create(m *models.Milestone) error
	GetByID(id uuid.UUID) (*models.Milestone, error)
	ListByProductID(productID uuid.UUID) ([]models.Milestone, error)
	Update(m *models.Milestone) error
	Delete(id uuid.UUID) error
}

type milestoneRepository struct {
	db *gorm.DB
}

func NewMilestoneRepository(db *gorm.DB) MilestoneRepository {
	return &milestoneRepository{db: db}
}

func (r *milestoneRepository) Create(m *models.Milestone) error {
	return r.db.Create(m).Error
}

func (r *milestoneRepository) GetByID(id uuid.UUID) (*models.Milestone, error) {
	var m models.Milestone
	err := r.db.First(&m, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *milestoneRepository) ListByProductID(productID uuid.UUID) ([]models.Milestone, error) {
	var list []models.Milestone
	err := r.db.Where("product_id = ?", productID).Order("start_date").Find(&list).Error
	return list, err
}

func (r *milestoneRepository) Update(m *models.Milestone) error {
	return r.db.Save(m).Error
}

func (r *milestoneRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Milestone{}, "id = ?", id).Error
}
