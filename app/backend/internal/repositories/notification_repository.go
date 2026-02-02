package repositories

import (
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type NotificationRepository interface {
	Create(n *models.Notification) error
	List(userID uuid.UUID, includeArchived bool, limit, offset int) ([]models.Notification, error)
	Count(userID uuid.UUID, includeArchived bool) (int64, error)
	UnreadCount(userID uuid.UUID) (int64, error)
	GetByID(id, userID uuid.UUID) (*models.Notification, error)
	MarkRead(id, userID uuid.UUID) error
	MarkReadAll(userID uuid.UUID) error
	Archive(id, userID uuid.UUID) error
	Delete(id, userID uuid.UUID) error
}

type notificationRepository struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) Create(n *models.Notification) error {
	return r.db.Create(n).Error
}

func (r *notificationRepository) List(userID uuid.UUID, includeArchived bool, limit, offset int) ([]models.Notification, error) {
	var list []models.Notification
	q := r.db.Where("user_id = ? AND deleted_at IS NULL", userID)
	if !includeArchived {
		q = q.Where("archived_at IS NULL")
	}
	err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&list).Error
	return list, err
}

func (r *notificationRepository) Count(userID uuid.UUID, includeArchived bool) (int64, error) {
	var count int64
	q := r.db.Model(&models.Notification{}).Where("user_id = ? AND deleted_at IS NULL", userID)
	if !includeArchived {
		q = q.Where("archived_at IS NULL")
	}
	err := q.Count(&count).Error
	return count, err
}

func (r *notificationRepository) UnreadCount(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL AND archived_at IS NULL AND deleted_at IS NULL", userID).
		Count(&count).Error
	return count, err
}

func (r *notificationRepository) GetByID(id, userID uuid.UUID) (*models.Notification, error) {
	var n models.Notification
	err := r.db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).First(&n).Error
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *notificationRepository) MarkRead(id, userID uuid.UUID) error {
	now := time.Now().UTC()
	return r.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).
		Update("read_at", now).Error
}

func (r *notificationRepository) MarkReadAll(userID uuid.UUID) error {
	now := time.Now().UTC()
	return r.db.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL AND deleted_at IS NULL", userID).
		Update("read_at", now).Error
}

func (r *notificationRepository) Archive(id, userID uuid.UUID) error {
	now := time.Now().UTC()
	return r.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).
		Updates(map[string]interface{}{"archived_at": now, "read_at": now}).Error
}

func (r *notificationRepository) Delete(id, userID uuid.UUID) error {
	// Use GORM's soft delete: Delete() sets deleted_at on the model
	return r.db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).
		Delete(&models.Notification{}).Error
}
