package repositories

import (
	"context"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type ProductVersionDependencyRepository interface {
	Create(ctx context.Context, d *models.ProductVersionDependency) error
	ListBySourceProductVersionID(ctx context.Context, sourceProductVersionID uuid.UUID) ([]models.ProductVersionDependency, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.ProductVersionDependency, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type productVersionDependencyRepository struct {
	db *gorm.DB
}

func NewProductVersionDependencyRepository(db *gorm.DB) ProductVersionDependencyRepository {
	return &productVersionDependencyRepository{db: db}
}

func (r *productVersionDependencyRepository) Create(ctx context.Context, d *models.ProductVersionDependency) error {
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *productVersionDependencyRepository) ListBySourceProductVersionID(ctx context.Context, sourceProductVersionID uuid.UUID) ([]models.ProductVersionDependency, error) {
	var list []models.ProductVersionDependency
	err := r.db.WithContext(ctx).Where("source_product_version_id = ?", sourceProductVersionID).
		Preload("TargetProduct").Preload("TargetProductVersion").Find(&list).Error
	return list, err
}

func (r *productVersionDependencyRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ProductVersionDependency, error) {
	var d models.ProductVersionDependency
	err := r.db.WithContext(ctx).Preload("TargetProduct").Preload("TargetProductVersion").First(&d, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *productVersionDependencyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.ProductVersionDependency{}, "id = ?", id).Error
}
