package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type ActivityRepository interface {
	Create(ctx context.Context, entry *models.ActivityLog) error
	// List returns activity logs. If userID is not nil, only entries for that user are returned.
	List(ctx context.Context, limit, offset int, action string, dateFrom, dateTo *time.Time, sortBy, order string, userID *uuid.UUID) ([]models.ActivityLog, int64, error)
}

type activityRepository struct {
	db *gorm.DB
}

func NewActivityRepository(db *gorm.DB) ActivityRepository {
	return &activityRepository{db: db}
}

func (r *activityRepository) Create(ctx context.Context, entry *models.ActivityLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}

func (r *activityRepository) List(ctx context.Context, limit, offset int, action string, dateFrom, dateTo *time.Time, sortBy, order string, userID *uuid.UUID) ([]models.ActivityLog, int64, error) {
	q := r.db.WithContext(ctx).Model(&models.ActivityLog{})
	if userID != nil {
		q = q.Where("user_id = ?", *userID)
	}
	if action != "" {
		q = q.Where("action = ?", action)
	}
	if dateFrom != nil {
		q = q.Where("timestamp >= ?", *dateFrom)
	}
	if dateTo != nil {
		q = q.Where("timestamp <= ?", *dateTo)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	col := "timestamp"
	switch sortBy {
	case "user_id":
		col = "user_id"
	case "action":
		col = "action"
	case "entity_type":
		col = "entity_type"
	case "entity_id":
		col = "entity_id"
	default:
		col = "timestamp"
	}
	if order == "asc" {
		q = q.Order(col + " ASC")
	} else {
		q = q.Order(col + " DESC")
	}
	var list []models.ActivityLog
	err := q.Preload("User").Limit(limit).Offset(offset).Find(&list).Error
	return list, total, err
}
