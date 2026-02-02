package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

type HoldingCompanyRepository interface {
	Create(h *models.HoldingCompany) error
	GetByID(id uuid.UUID) (*models.HoldingCompany, error)
	List() ([]models.HoldingCompany, error)
	Update(h *models.HoldingCompany) error
	Delete(id uuid.UUID) error
}

type holdingCompanyRepository struct {
	db *gorm.DB
}

func NewHoldingCompanyRepository(db *gorm.DB) HoldingCompanyRepository {
	return &holdingCompanyRepository{db: db}
}

func (r *holdingCompanyRepository) Create(h *models.HoldingCompany) error {
	return r.db.Create(h).Error
}

func (r *holdingCompanyRepository) GetByID(id uuid.UUID) (*models.HoldingCompany, error) {
	var h models.HoldingCompany
	if err := r.db.Preload("Companies").First(&h, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &h, nil
}

func (r *holdingCompanyRepository) List() ([]models.HoldingCompany, error) {
	var list []models.HoldingCompany
	err := r.db.Order("name").Find(&list).Error
	return list, err
}

func (r *holdingCompanyRepository) Update(h *models.HoldingCompany) error {
	return r.db.Save(h).Error
}

func (r *holdingCompanyRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.HoldingCompany{}, "id = ?", id).Error
}
