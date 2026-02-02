package dto

type ProductVersionDependencyCreateRequest struct {
	SourceProductVersionID  string  `json:"source_product_version_id" binding:"required"`
	TargetProductID         string  `json:"target_product_id" binding:"required"`
	TargetProductVersionID  string  `json:"target_product_version_id"` // optional
	RequiredStatus          string  `json:"required_status" binding:"required"`
}

type ProductVersionDependencyResponse struct {
	ID                      string  `json:"id"`
	SourceProductVersionID  string  `json:"source_product_version_id"`
	TargetProductID         string  `json:"target_product_id"`
	TargetProductVersionID  *string `json:"target_product_version_id,omitempty"`
	RequiredStatus          string  `json:"required_status"`
	CreatedAt               string  `json:"created_at"`
	// Resolved names for display (optional)
	TargetProductName       string  `json:"target_product_name,omitempty"`
	TargetProductVersion    string  `json:"target_product_version,omitempty"`
}
