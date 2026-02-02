package dto

import "time"

type MilestoneCreateRequest struct {
	ProductID        string                 `json:"product_id" binding:"required"`
	ProductVersionID string                 `json:"product_version_id"` // optional; milestones can be per version
	Label            string                 `json:"label" binding:"required"`
	StartDate time.Time              `json:"start_date" binding:"required"`
	EndDate   time.Time              `json:"end_date"` // optional; when provided must be >= start_date
	Type      string                 `json:"type"`
	Color     string                 `json:"color"`
	Extra     map[string]interface{} `json:"extra"`
}

type MilestoneUpdateRequest struct {
	Label     *string                `json:"label"`
	StartDate *time.Time             `json:"start_date"`
	EndDate   *time.Time             `json:"end_date"`
	Type      *string                `json:"type"`
	Color     *string                `json:"color"`
	Extra     map[string]interface{} `json:"extra"`
}

type MilestoneResponse struct {
	ID               string                 `json:"id"`
	ProductID        string                 `json:"product_id"`
	ProductVersionID *string                `json:"product_version_id,omitempty"`
	Label            string                 `json:"label"`
	StartDate string                 `json:"start_date"`
	EndDate   string                 `json:"end_date,omitempty"` // empty when not set
	Type      string                 `json:"type"`
	Color     string                 `json:"color"`
	Extra     map[string]interface{} `json:"extra,omitempty"`
	CreatedAt string                 `json:"created_at"`
}
