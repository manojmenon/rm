package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Milestone struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductVersionID *uuid.UUID     `gorm:"type:uuid;index" json:"product_version_id"`
	Label            string         `gorm:"not null" json:"label"`
	StartDate time.Time      `gorm:"not null;index" json:"start_date"`
	EndDate   *time.Time     `gorm:"index" json:"end_date,omitempty"`
	Type      string         `json:"type"` // e.g. alpha, beta, ga, support
	Color     string         `json:"color"`
	Extra     JSONB          `gorm:"type:jsonb" json:"extra,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Product        Product        `gorm:"foreignKey:ProductID" json:"-"`
	ProductVersion *ProductVersion `gorm:"foreignKey:ProductVersionID" json:"product_version,omitempty"`
	OutgoingDeps   []Dependency   `gorm:"foreignKey:SourceMilestoneID" json:"-"`
	IncomingDeps   []Dependency   `gorm:"foreignKey:TargetMilestoneID" json:"-"`
}

func (Milestone) TableName() string { return "milestones" }

func (m *Milestone) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
