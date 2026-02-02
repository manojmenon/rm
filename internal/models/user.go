package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Role string

const (
	RoleSuperadmin Role = "superadmin"
	RoleAdmin      Role = "admin"
	RoleOwner      Role = "owner"
	RoleUser       Role = "user"
)

// IsAdminOrAbove returns true for admin or superadmin (hierarchy: user < owner < admin < superadmin).
func (r Role) IsAdminOrAbove() bool {
	s := strings.ToLower(string(r))
	return s == "admin" || s == "superadmin"
}

type User struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name             string         `gorm:"not null" json:"name"`
	Email            string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash     string         `gorm:"column:password_hash;not null" json:"-"`
	Role             Role           `gorm:"type:varchar(20);not null" json:"role"`
	TeamID           *uuid.UUID     `gorm:"type:uuid;index" json:"team_id,omitempty"`
	DirectManagerID  *uuid.UUID     `gorm:"type:uuid;index" json:"direct_manager_id,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`

	Team            *Team                  `gorm:"foreignKey:TeamID" json:"team,omitempty"`
	DirectManager   *User                  `gorm:"foreignKey:DirectManagerID" json:"direct_manager,omitempty"`
	DirectReports   []User                 `gorm:"foreignKey:DirectManagerID" json:"direct_reports,omitempty"`
	DottedLineManagers []UserDottedLineManager `gorm:"foreignKey:UserID" json:"dotted_line_managers,omitempty"`
	Products        []Product              `gorm:"foreignKey:OwnerID" json:"-"`
}

func (User) TableName() string { return "users" }

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
