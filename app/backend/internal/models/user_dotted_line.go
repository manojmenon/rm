package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserDottedLineManager struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_user_manager" json:"user_id"`
	ManagerID uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_user_manager" json:"manager_id"`
	CreatedAt time.Time `json:"created_at"`

	User    User `gorm:"foreignKey:UserID" json:"-"`
	Manager User `gorm:"foreignKey:ManagerID" json:"manager,omitempty"`
}

func (UserDottedLineManager) TableName() string { return "user_dotted_line_managers" }

func (u *UserDottedLineManager) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
