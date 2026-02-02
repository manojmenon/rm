package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Function struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	CompanyID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"company_id"`
	Name       string         `gorm:"size:255;not null" json:"name"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Company     *Company     `gorm:"foreignKey:CompanyID" json:"company,omitempty"`
	Departments []Department `gorm:"foreignKey:FunctionID" json:"departments,omitempty"`
}

func (Function) TableName() string { return "functions" }

func (f *Function) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return nil
}
