package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Notification struct {
	ID                uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID            uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Type              string     `gorm:"type:varchar(64);not null" json:"type"`
	Title             string     `gorm:"type:varchar(256);not null" json:"title"`
	Message           string     `gorm:"type:text;not null" json:"message"`
	RelatedEntityType string     `gorm:"type:varchar(64)" json:"related_entity_type,omitempty"`
	RelatedEntityID   *uuid.UUID `gorm:"type:uuid" json:"related_entity_id,omitempty"`
	ReadAt            *time.Time `json:"read_at,omitempty"`
	ArchivedAt        *time.Time `json:"archived_at,omitempty"`
	DeletedAt         *time.Time `json:"-"`
	CreatedAt         time.Time  `json:"created_at"`
}

func (Notification) TableName() string { return "notifications" }

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}

const (
	NotificationTypeProductRequestApproved       = "product_request_approved"
	NotificationTypeProductRequestRejected       = "product_request_rejected"
	NotificationTypeProductRequestSubmitted      = "product_request_submitted"
	NotificationTypeProductDeletionApproved      = "product_deletion_approved"
	NotificationTypeProductDeletionRejected      = "product_deletion_rejected"
	NotificationTypeProductDeletionRequestSubmitted = "product_deletion_request_submitted"
	NotificationTypeProductStatusChanged         = "product_status_changed"
)
