package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Department struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	FunctionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"function_id"`
	Name       string         `gorm:"size:255;not null" json:"name"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Function *Function `gorm:"foreignKey:FunctionID" json:"function,omitempty"`
	Teams    []Team    `gorm:"foreignKey:DepartmentID" json:"teams,omitempty"`
}

func (Department) TableName() string { return "departments" }

func (d *Department) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
