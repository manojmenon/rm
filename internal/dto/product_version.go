package dto

type ProductVersionCreateRequest struct {
	ProductID string `json:"product_id" binding:"required"`
	Version   string `json:"version" binding:"required"`
}

type ProductVersionUpdateRequest struct {
	Version string `json:"version" binding:"required"`
}

type ProductVersionResponse struct {
	ID        string `json:"id"`
	ProductID string `json:"product_id"`
	Version   string `json:"version"`
	CreatedAt string `json:"created_at"`
}
