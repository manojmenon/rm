package repositories

import (
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type ProductRepository interface {
	Create(product *models.Product) error
	GetByID(id uuid.UUID) (*models.Product, error)
	List(ownerID *uuid.UUID, status *models.ProductStatus, lifecycleStatus *models.LifecycleStatus, category1, category2, category3 *string, productIDs *[]uuid.UUID, excludedProductIDs *[]uuid.UUID, dateFrom, dateTo *time.Time, sortBy, order string, limit, offset int) ([]models.Product, int64, error)
	Update(product *models.Product) error
	Delete(id uuid.UUID) error
	ClearOwnerForUser(userID uuid.UUID) error
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) Create(product *models.Product) error {
	return r.db.Create(product).Error
}

func (r *productRepository) GetByID(id uuid.UUID) (*models.Product, error) {
	var p models.Product
	err := r.db.Preload("Owner").Preload("Milestones").Preload("ProductVersions").First(&p, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *productRepository) List(ownerID *uuid.UUID, status *models.ProductStatus, lifecycleStatus *models.LifecycleStatus, category1, category2, category3 *string, productIDs *[]uuid.UUID, excludedProductIDs *[]uuid.UUID, dateFrom, dateTo *time.Time, sortBy, order string, limit, offset int) ([]models.Product, int64, error) {
	var products []models.Product
	q := r.db.Preload("Owner")
	if ownerID != nil {
		q = q.Where("owner_id = ?", *ownerID)
	}
	if status != nil {
		q = q.Where("status = ?", *status)
	}
	if lifecycleStatus != nil {
		q = q.Where("lifecycle_status = ?", *lifecycleStatus)
	}
	if category1 != nil && *category1 != "" {
		q = q.Where("category_1 = ?", *category1)
	}
	if category2 != nil && *category2 != "" {
		q = q.Where("category_2 = ?", *category2)
	}
	if category3 != nil && *category3 != "" {
		q = q.Where("category_3 = ?", *category3)
	}
	if productIDs != nil {
		if len(*productIDs) == 0 {
			return nil, 0, nil
		}
		q = q.Where("id IN ?", *productIDs)
	}
	if excludedProductIDs != nil && len(*excludedProductIDs) > 0 {
		q = q.Where("id NOT IN ?", *excludedProductIDs)
	}
	if dateFrom != nil {
		q = q.Where("created_at >= ?", *dateFrom)
	}
	if dateTo != nil {
		q = q.Where("created_at <= ?", *dateTo)
	}
	var total int64
	if err := q.Model(&models.Product{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	col := "name"
	switch sortBy {
	case "version":
		col = "version"
	case "status":
		col = "status"
	case "lifecycle_status":
		col = "lifecycle_status"
	case "category_1":
		col = "category_1"
	case "category_2":
		col = "category_2"
	case "category_3":
		col = "category_3"
	case "owner_id":
		col = "owner_id"
	case "created_at":
		col = "created_at"
	default:
		col = "name"
	}
	if order == "desc" {
		q = q.Order(col + " DESC")
	} else {
		q = q.Order(col + " ASC")
	}
	err := q.Limit(limit).Offset(offset).Find(&products).Error
	return products, total, err
}

func (r *productRepository) Update(product *models.Product) error {
	// Omit associations so only scalar columns (including owner_id) are updated
	return r.db.Model(product).Omit("Owner", "Milestones", "ProductVersions").Save(product).Error
}

func (r *productRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Product{}, "id = ?", id).Error
}

func (r *productRepository) ClearOwnerForUser(userID uuid.UUID) error {
	return r.db.Model(&models.Product{}).Where("owner_id = ?", userID).Update("owner_id", nil).Error
}
