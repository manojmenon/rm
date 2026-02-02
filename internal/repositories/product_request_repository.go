package repositories

import (
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

type ProductRequestRepository interface {
	Create(req *models.ProductRequest) error
	GetByID(id uuid.UUID) (*models.ProductRequest, error)
	List(status *models.RequestStatus, requestedBy *uuid.UUID, fromDate, toDate *time.Time) ([]models.ProductRequest, error)
	Update(req *models.ProductRequest) error
}

type productRequestRepository struct {
	db *gorm.DB
}

func NewProductRequestRepository(db *gorm.DB) ProductRequestRepository {
	return &productRequestRepository{db: db}
}

func (r *productRequestRepository) Create(req *models.ProductRequest) error {
	return r.db.Create(req).Error
}

func (r *productRequestRepository) GetByID(id uuid.UUID) (*models.ProductRequest, error) {
	var req models.ProductRequest
	err := r.db.Preload("Requester").First(&req, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &req, nil
}

func (r *productRequestRepository) List(status *models.RequestStatus, requestedBy *uuid.UUID, fromDate, toDate *time.Time) ([]models.ProductRequest, error) {
	var list []models.ProductRequest
	q := r.db.Preload("Requester")
	if status != nil {
		q = q.Where("status = ?", *status)
	}
	if requestedBy != nil {
		q = q.Where("requested_by = ?", *requestedBy)
	}
	if fromDate != nil {
		q = q.Where("created_at >= ?", fromDate.UTC())
	}
	if toDate != nil {
		endOfDay := time.Date(toDate.Year(), toDate.Month(), toDate.Day(), 23, 59, 59, 999999999, toDate.Location())
		q = q.Where("created_at <= ?", endOfDay.UTC())
	}
	err := q.Order("created_at DESC").Find(&list).Error
	return list, err
}

func (r *productRequestRepository) Update(req *models.ProductRequest) error {
	return r.db.Save(req).Error
}
