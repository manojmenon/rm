package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type HoldingCompany struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Companies []Company `gorm:"foreignKey:HoldingCompanyID" json:"companies,omitempty"`
}

func (HoldingCompany) TableName() string { return "holding_companies" }

func (h *HoldingCompany) BeforeCreate(tx *gorm.DB) error {
	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	return nil
}
