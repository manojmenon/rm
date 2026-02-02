package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Company struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	HoldingCompanyID uuid.UUID      `gorm:"type:uuid;not null;index" json:"holding_company_id"`
	Name             string         `gorm:"size:255;not null" json:"name"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	HoldingCompany *HoldingCompany `gorm:"foreignKey:HoldingCompanyID" json:"holding_company,omitempty"`
	Functions      []Function      `gorm:"foreignKey:CompanyID" json:"functions,omitempty"`
}

func (Company) TableName() string { return "companies" }

func (c *Company) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
