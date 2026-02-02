package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type CompanyRepository interface {
	Create(c *models.Company) error
	GetByID(id uuid.UUID) (*models.Company, error)
	List(holdingCompanyID *uuid.UUID) ([]models.Company, error)
	Update(c *models.Company) error
	Delete(id uuid.UUID) error
}

type companyRepository struct {
	db *gorm.DB
}

func NewCompanyRepository(db *gorm.DB) CompanyRepository {
	return &companyRepository{db: db}
}

func (r *companyRepository) Create(c *models.Company) error {
	return r.db.Create(c).Error
}

func (r *companyRepository) GetByID(id uuid.UUID) (*models.Company, error) {
	var c models.Company
	if err := r.db.Preload("Functions").First(&c, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *companyRepository) List(holdingCompanyID *uuid.UUID) ([]models.Company, error) {
	var list []models.Company
	q := r.db.Order("name")
	if holdingCompanyID != nil {
		q = q.Where("holding_company_id = ?", *holdingCompanyID)
	}
	err := q.Find(&list).Error
	return list, err
}

func (r *companyRepository) Update(c *models.Company) error {
	return r.db.Save(c).Error
}

func (r *companyRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Company{}, "id = ?", id).Error
}
