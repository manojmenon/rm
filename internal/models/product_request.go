package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RequestStatus string

const (
	RequestPending   RequestStatus = "pending"
	RequestApproved  RequestStatus = "approved"
	RequestRejected  RequestStatus = "rejected"
)

type ProductRequest struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	RequestedBy uuid.UUID      `gorm:"type:uuid;not null;index" json:"requested_by"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	Status      RequestStatus  `gorm:"type:varchar(20);not null;default:pending" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Requester User `gorm:"foreignKey:RequestedBy" json:"requester,omitempty"`
}

func (ProductRequest) TableName() string { return "product_requests" }

func (r *ProductRequest) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
