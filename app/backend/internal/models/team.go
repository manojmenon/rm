package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Team struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	DepartmentID uuid.UUID      `gorm:"type:uuid;not null;index" json:"department_id"`
	Name         string         `gorm:"size:255;not null" json:"name"`
	ManagerID    *uuid.UUID     `gorm:"type:uuid;index" json:"manager_id,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Department *Department `gorm:"foreignKey:DepartmentID" json:"department,omitempty"`
	Manager    *User       `gorm:"foreignKey:ManagerID" json:"manager,omitempty"`
	Members    []User      `gorm:"foreignKey:TeamID" json:"members,omitempty"`
}

func (Team) TableName() string { return "teams" }

func (t *Team) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}
