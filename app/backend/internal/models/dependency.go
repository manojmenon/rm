package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DependencyType string

const (
	DepFinishToStart DependencyType = "FS"
	DepStartToStart  DependencyType = "SS"
	DepFinishToFinish DependencyType = "FF"
)

type Dependency struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	SourceMilestoneID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"source_milestone_id"`
	TargetMilestoneID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"target_milestone_id"`
	Type               DependencyType `gorm:"type:varchar(5);not null" json:"type"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	SourceMilestone Milestone `gorm:"foreignKey:SourceMilestoneID" json:"-"`
	TargetMilestone Milestone `gorm:"foreignKey:TargetMilestoneID" json:"-"`
}

func (Dependency) TableName() string { return "dependencies" }

func (d *Dependency) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
