package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductVersion struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	Version   string         `gorm:"not null;index" json:"version"` // e.g. "1.0", "2.0"
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Product    Product    `gorm:"foreignKey:ProductID" json:"-"`
	Milestones []Milestone `gorm:"foreignKey:ProductVersionID" json:"milestones,omitempty"`
}

func (ProductVersion) TableName() string { return "product_versions" }

func (p *ProductVersion) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
