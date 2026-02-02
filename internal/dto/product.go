package dto

type ProductCreateRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Version     string                 `json:"version"`
	Description string                 `json:"description"`
	Category1   string                 `json:"category_1"`
	Category2   string                 `json:"category_2"`
	Category3   string                 `json:"category_3"`
	Metadata    map[string]interface{}  `json:"metadata"`
}

type ProductUpdateRequest struct {
	Name             *string                 `json:"name"`
	Version          *string                 `json:"version"`
	Description      *string                 `json:"description"`
	Status           *string                 `json:"status"`
	LifecycleStatus  *string                 `json:"lifecycle_status"` // active | suspend | end_of_roadmap (admin only)
	Category1        *string                 `json:"category_1"`
	Category2        *string                 `json:"category_2"`
	Category3        *string                 `json:"category_3"`
	OwnerID          *string                 `json:"owner_id"`   // UUID string; empty or omit to leave unchanged; use clear_owner to unset
	ClearOwner       *bool                   `json:"clear_owner"` // when true, set owner to nil (admin only)
	Metadata         map[string]interface{}  `json:"metadata"`
}

type ProductResponse struct {
	ID                     string                           `json:"id"`
	Name                   string                           `json:"name"`
	Version                string                           `json:"version"`
	Description            string                           `json:"description"`
	OwnerID                *string                          `json:"owner_id"`
	Owner                  *UserResponse                   `json:"owner,omitempty"`
	Status                 string                           `json:"status"`
	LifecycleStatus        string                           `json:"lifecycle_status"`
	Category1              string                           `json:"category_1"`
	Category2              string                           `json:"category_2"`
	Category3              string                           `json:"category_3"`
	PendingDeletionRequest *ProductDeletionRequestResponse  `json:"pending_deletion_request,omitempty"`
	Metadata               map[string]interface{}            `json:"metadata,omitempty"`
	CreatedAt              string                           `json:"created_at"`
}
