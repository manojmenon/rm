package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProductVersionDependency records that a product version depends on another product (and optional version) having a required status.
// E.g. "Product A version 2.0 cannot be available until Product B has status Pricing Committee Approval."
type ProductVersionDependency struct {
	ID                      uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"`
	SourceProductVersionID  uuid.UUID       `gorm:"type:uuid;not null;index" json:"source_product_version_id"`
	TargetProductID         uuid.UUID       `gorm:"type:uuid;not null;index" json:"target_product_id"`
	TargetProductVersionID  *uuid.UUID      `gorm:"type:uuid;index" json:"target_product_version_id,omitempty"`
	RequiredStatus          string          `gorm:"type:varchar(200);not null" json:"required_status"`
	CreatedAt               time.Time       `json:"created_at"`
	UpdatedAt               time.Time       `json:"updated_at"`
	DeletedAt               gorm.DeletedAt  `gorm:"index" json:"-"`

	SourceProductVersion *ProductVersion `gorm:"foreignKey:SourceProductVersionID" json:"-"`
	TargetProduct        *Product       `gorm:"foreignKey:TargetProductID" json:"-"`
	TargetProductVersion *ProductVersion `gorm:"foreignKey:TargetProductVersionID" json:"-"`
}

func (ProductVersionDependency) TableName() string { return "product_version_dependencies" }

func (d *ProductVersionDependency) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
