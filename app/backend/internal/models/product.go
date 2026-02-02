package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductStatus string

const (
	StatusPending   ProductStatus = "pending"
	StatusApproved  ProductStatus = "approved"
	StatusArchived  ProductStatus = "archived"
)

type LifecycleStatus string

const (
	LifecycleActive       LifecycleStatus = "active"
	LifecycleNotActive    LifecycleStatus = "not_active" // default when product status is pending
	LifecycleSuspend      LifecycleStatus = "suspend"
	LifecycleEndOfRoadmap LifecycleStatus = "end_of_roadmap"
)

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(b, j)
}

type Product struct {
	ID               uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"`
	Name             string          `gorm:"not null" json:"name"`
	Version          string          `json:"version"` // legacy / display version
	Description      string          `json:"description"`
	OwnerID          *uuid.UUID      `gorm:"type:uuid" json:"owner_id"`
	Status           ProductStatus   `gorm:"type:varchar(20);not null;default:approved" json:"status"`
	LifecycleStatus  LifecycleStatus `gorm:"type:varchar(20);not null;default:active" json:"lifecycle_status"`
	Category1        string          `gorm:"type:varchar(100);index" json:"category_1"`
	Category2        string          `gorm:"type:varchar(100);index" json:"category_2"`
	Category3        string          `gorm:"type:varchar(100);index" json:"category_3"`
	Metadata         JSONB           `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	Owner             *User            `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Milestones        []Milestone      `gorm:"foreignKey:ProductID" json:"milestones,omitempty"`
	ProductVersions   []ProductVersion `gorm:"foreignKey:ProductID" json:"product_versions,omitempty"`
}

func (Product) TableName() string { return "products" }

func (p *Product) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
