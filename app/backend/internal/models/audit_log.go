package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditLog struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Timestamp  time.Time      `gorm:"not null;index" json:"timestamp"`
	UserID     *uuid.UUID     `gorm:"type:uuid;index" json:"user_id"`
	Action     string         `gorm:"not null;index" json:"action"`
	EntityType string         `gorm:"not null;index" json:"entity_type"`
	EntityID   string         `gorm:"index" json:"entity_id"`
	OldData    JSONB          `gorm:"type:jsonb" json:"old_data,omitempty"`
	NewData    JSONB          `gorm:"type:jsonb" json:"new_data,omitempty"`
	Metadata   JSONB          `gorm:"type:jsonb" json:"metadata,omitempty"`
	IPAddress  string         `json:"ip_address"`
	UserAgent  string         `json:"user_agent"`
	TraceID    string         `gorm:"index" json:"trace_id"`
	Archived   bool           `gorm:"default:false;index" json:"archived"`
	ArchivedAt *time.Time     `json:"archived_at,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (AuditLog) TableName() string { return "audit_logs" }

func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.Timestamp.IsZero() {
		a.Timestamp = time.Now()
	}
	return nil
}
