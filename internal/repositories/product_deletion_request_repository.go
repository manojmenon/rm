package repositories

import (
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

type ProductDeletionRequestRepository interface {
	Create(req *models.ProductDeletionRequest) error
	GetByID(id uuid.UUID) (*models.ProductDeletionRequest, error)
	List(status *models.RequestStatus, productOwnerID *uuid.UUID, requestedBy *uuid.UUID, fromDate, toDate *time.Time) ([]models.ProductDeletionRequest, error)
	FindPendingByProductID(productID uuid.UUID) (*models.ProductDeletionRequest, error)
	Update(req *models.ProductDeletionRequest) error
}

type productDeletionRequestRepository struct {
	db *gorm.DB
}

func NewProductDeletionRequestRepository(db *gorm.DB) ProductDeletionRequestRepository {
	return &productDeletionRequestRepository{db: db}
}

func (r *productDeletionRequestRepository) Create(req *models.ProductDeletionRequest) error {
	return r.db.Create(req).Error
}

func (r *productDeletionRequestRepository) GetByID(id uuid.UUID) (*models.ProductDeletionRequest, error) {
	var req models.ProductDeletionRequest
	err := r.db.Preload("Product").Preload("Requester").First(&req, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *productDeletionRequestRepository) List(status *models.RequestStatus, productOwnerID *uuid.UUID, requestedBy *uuid.UUID, fromDate, toDate *time.Time) ([]models.ProductDeletionRequest, error) {
	var list []models.ProductDeletionRequest
	q := r.db.Preload("Product").Preload("Requester")
	if status != nil {
		q = q.Where("product_deletion_requests.status = ?", *status)
	}
	if productOwnerID != nil {
		q = q.Joins("JOIN products ON products.id = product_deletion_requests.product_id").
			Where("products.owner_id = ?", *productOwnerID)
	}
	if requestedBy != nil {
		q = q.Where("product_deletion_requests.requested_by = ?", *requestedBy)
	}
	if fromDate != nil {
		q = q.Where("product_deletion_requests.created_at >= ?", fromDate.UTC())
	}
	if toDate != nil {
		endOfDay := time.Date(toDate.Year(), toDate.Month(), toDate.Day(), 23, 59, 59, 999999999, toDate.Location())
		q = q.Where("product_deletion_requests.created_at <= ?", endOfDay.UTC())
	}
	err := q.Order("product_deletion_requests.created_at DESC").Find(&list).Error
	return list, err
}

func (r *productDeletionRequestRepository) FindPendingByProductID(productID uuid.UUID) (*models.ProductDeletionRequest, error) {
	var req models.ProductDeletionRequest
	err := r.db.Where("product_id = ? AND status = ?", productID, models.RequestPending).First(&req).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}

func (r *productDeletionRequestRepository) Update(req *models.ProductDeletionRequest) error {
	return r.db.Save(req).Error
}
