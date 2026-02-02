package dto

type ProductDeletionRequestResponse struct {
	ID          string        `json:"id"`
	ProductID   string        `json:"product_id"`
	RequestedBy string        `json:"requested_by"`
	Requester   *UserResponse `json:"requester,omitempty"`
	Status      string        `json:"status"`
	CreatedAt   string        `json:"created_at"`
}

type ProductDeletionApproveRequest struct {
	Approved bool `json:"approved"`
}
