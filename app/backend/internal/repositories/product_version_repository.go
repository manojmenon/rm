package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type ProductVersionRepository interface {
	Create(pv *models.ProductVersion) error
	GetByID(id uuid.UUID) (*models.ProductVersion, error)
	ListByProductID(productID uuid.UUID) ([]models.ProductVersion, error)
	Update(pv *models.ProductVersion) error
	Delete(id uuid.UUID) error
	CountByProductID(productID uuid.UUID) (int64, error)
}

type productVersionRepository struct {
	db *gorm.DB
}

func NewProductVersionRepository(db *gorm.DB) ProductVersionRepository {
	return &productVersionRepository{db: db}
}

func (r *productVersionRepository) Create(pv *models.ProductVersion) error {
	return r.db.Create(pv).Error
}

func (r *productVersionRepository) GetByID(id uuid.UUID) (*models.ProductVersion, error) {
	var pv models.ProductVersion
	err := r.db.Preload("Milestones").First(&pv, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &pv, nil
}

func (r *productVersionRepository) ListByProductID(productID uuid.UUID) ([]models.ProductVersion, error) {
	var list []models.ProductVersion
	err := r.db.Where("product_id = ?", productID).Order("version").Find(&list).Error
	return list, err
}

func (r *productVersionRepository) Update(pv *models.ProductVersion) error {
	return r.db.Save(pv).Error
}

func (r *productVersionRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.ProductVersion{}, "id = ?", id).Error
}

func (r *productVersionRepository) CountByProductID(productID uuid.UUID) (int64, error) {
	var n int64
	err := r.db.Model(&models.ProductVersion{}).Where("product_id = ?", productID).Count(&n).Error
	return n, err
}
