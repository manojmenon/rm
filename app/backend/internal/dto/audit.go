package dto

import "github.com/google/uuid"

type AuditMeta struct {
	UserID   *uuid.UUID
	IP       string
	UserAgent string
	TraceID   string
}

type AuditLogResponse struct {
	ID             string                 `json:"id"`
	Timestamp      string                 `json:"timestamp"`
	UserID         *string                `json:"user_id,omitempty"`
	User           *UserResponse          `json:"user,omitempty"`
	Action         string                 `json:"action"`
	EntityType     string                 `json:"entity_type"`
	EntityID       string                 `json:"entity_id"`
	ProductName    string                 `json:"product_name,omitempty"`
	ProductVersion string                 `json:"product_version,omitempty"`
	OldData        map[string]interface{} `json:"old_data,omitempty"`
	NewData        map[string]interface{} `json:"new_data,omitempty"`
	IPAddress      string                 `json:"ip_address"`
	UserAgent      string                 `json:"user_agent"`
	TraceID        string                 `json:"trace_id"`
}
