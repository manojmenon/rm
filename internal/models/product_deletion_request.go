package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductDeletionRequest struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	RequestedBy uuid.UUID      `gorm:"type:uuid;not null;index" json:"requested_by"`
	Status      RequestStatus  `gorm:"type:varchar(20);not null;default:pending" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Product   Product `gorm:"foreignKey:ProductID" json:"-"`
	Requester User    `gorm:"foreignKey:RequestedBy" json:"requester,omitempty"`
}

func (ProductDeletionRequest) TableName() string { return "product_deletion_requests" }

func (r *ProductDeletionRequest) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
