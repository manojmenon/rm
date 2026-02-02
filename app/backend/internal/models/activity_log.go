package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ActivityLog struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Timestamp  time.Time      `gorm:"not null;index" json:"timestamp"`
	UserID     *uuid.UUID     `gorm:"type:uuid;index" json:"user_id"`
	Action     string         `gorm:"not null;index" json:"action"` // login, login_failed, logout, create, save, delete
	EntityType string         `gorm:"index" json:"entity_type"`
	EntityID   string         `gorm:"index" json:"entity_id"`
	Details    string         `gorm:"type:text" json:"details"`
	IPAddress  string         `json:"ip_address"`
	UserAgent  string         `json:"user_agent"`
	CreatedAt  time.Time      `json:"created_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (ActivityLog) TableName() string { return "activity_logs" }

func (a *ActivityLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.Timestamp.IsZero() {
		a.Timestamp = time.Now()
	}
	return nil
}
