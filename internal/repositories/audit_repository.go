package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

type AuditRepository interface {
	Create(ctx context.Context, entry *models.AuditLog) error
	List(ctx context.Context, limit, offset int, entityType, action string, dateFrom, dateTo *time.Time, archived *bool, sortBy, order string) ([]models.AuditLog, int64, error)
	// ListForOwner returns audit logs only for entities belonging to the given product IDs (products the user owns).
	ListForOwner(ctx context.Context, productIDs []uuid.UUID, limit, offset int, entityType, action string, dateFrom, dateTo *time.Time, archived *bool, sortBy, order string) ([]models.AuditLog, int64, error)
	// Archive marks the given log IDs as archived (archived=true, archived_at=now). Only non-archived rows are updated.
	Archive(ctx context.Context, ids []uuid.UUID) error
	// DeleteArchived permanently deletes audit log rows that are archived. Only rows with archived=true are deleted.
	DeleteArchived(ctx context.Context, ids []uuid.UUID) error
}

type auditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) AuditRepository {
	return &auditRepository{db: db}
}

func (r *auditRepository) Create(ctx context.Context, entry *models.AuditLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}

func (r *auditRepository) List(ctx context.Context, limit, offset int, entityType, action string, dateFrom, dateTo *time.Time, archived *bool, sortBy, order string) ([]models.AuditLog, int64, error) {
	var list []models.AuditLog
	q := r.db.WithContext(ctx).Model(&models.AuditLog{})
	if entityType != "" {
		q = q.Where("entity_type = ?", entityType)
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
	if archived != nil {
		q = q.Where("archived = ?", *archived)
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
	case "ip_address":
		col = "ip_address"
	case "trace_id":
		col = "trace_id"
	default:
		col = "timestamp"
	}
	if order == "asc" {
		q = q.Order(col + " ASC")
	} else {
		q = q.Order(col + " DESC")
	}
	err := q.Preload("User").Limit(limit).Offset(offset).Find(&list).Error
	return list, total, err
}

func (r *auditRepository) Archive(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	now := time.Now()
	return r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("id IN ? AND (archived = ? OR archived IS NULL)", ids, false).
		Updates(map[string]interface{}{"archived": true, "archived_at": now}).Error
}

func (r *auditRepository) DeleteArchived(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Where("id IN ? AND archived = ?", ids, true).Delete(&models.AuditLog{}).Error
}

func (r *auditRepository) ListForOwner(ctx context.Context, productIDs []uuid.UUID, limit, offset int, entityType, action string, dateFrom, dateTo *time.Time, archived *bool, sortBy, order string) ([]models.AuditLog, int64, error) {
	if len(productIDs) == 0 {
		return nil, 0, nil
	}
	productIDStrs := make([]string, len(productIDs))
	for i, id := range productIDs {
		productIDStrs[i] = id.String()
	}
	var list []models.AuditLog
	q := r.db.WithContext(ctx).Model(&models.AuditLog{}).Where(
		"(entity_type = ? AND entity_id IN ?) OR (entity_type = ? AND entity_id IN (SELECT id::text FROM milestones WHERE product_id IN ?)) OR (entity_type = ? AND entity_id IN (SELECT id::text FROM product_versions WHERE product_id IN ?))",
		"product", productIDStrs, "milestone", productIDs, "product_version", productIDs,
	)
	if entityType != "" {
		q = q.Where("entity_type = ?", entityType)
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
	if archived != nil {
		q = q.Where("archived = ?", *archived)
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
	case "ip_address":
		col = "ip_address"
	case "trace_id":
		col = "trace_id"
	default:
		col = "timestamp"
	}
	if order == "asc" {
		q = q.Order(col + " ASC")
	} else {
		q = q.Order(col + " DESC")
	}
	err := q.Preload("User").Limit(limit).Offset(offset).Find(&list).Error
	return list, total, err
}
