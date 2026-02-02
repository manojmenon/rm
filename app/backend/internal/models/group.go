package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Group is a named set of products (e.g. for a Gantt view). Created by a user.
type Group struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	CreatedBy   *uuid.UUID     `gorm:"type:uuid;index" json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Products []Product `gorm:"many2many:group_products;" json:"products,omitempty"`
}

func (Group) TableName() string { return "product_groups" }

func (g *Group) BeforeCreate(tx *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}
