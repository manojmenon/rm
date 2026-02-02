package dto

type GroupCreateRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description" binding:"required"` // required, must be > 10 characters (validated in service)
	ProductIDs  []string `json:"product_ids"`                     // UUIDs
}

type GroupUpdateRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	ProductIDs  []string `json:"product_ids"` // UUIDs; replaces existing
}

type GroupResponse struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	CreatedBy   *string          `json:"created_by,omitempty"`
	ProductIDs  []string         `json:"product_ids"`
	ProductCount int              `json:"product_count"`
	CreatedAt   string           `json:"created_at"`
}
