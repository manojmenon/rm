package dto

type ProductRequestCreateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type ProductRequestApproveRequest struct {
	Approved bool   `json:"approved"`
	OwnerID  string `json:"owner_id"` // required when approved
}

type ProductRequestResponse struct {
	ID          string        `json:"id"`
	RequestedBy string        `json:"requested_by"`
	Requester   *UserResponse `json:"requester,omitempty"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Status      string        `json:"status"`
	CreatedAt   string        `json:"created_at"`
}
