package dto

type NotificationResponse struct {
	ID                string  `json:"id"`
	UserID            string  `json:"user_id"`
	Type              string  `json:"type"`
	Title             string  `json:"title"`
	Message           string  `json:"message"`
	RelatedEntityType string  `json:"related_entity_type,omitempty"`
	RelatedEntityID   string  `json:"related_entity_id,omitempty"`
	ReadAt            *string `json:"read_at,omitempty"`
	ArchivedAt        *string `json:"archived_at,omitempty"`
	CreatedAt         string  `json:"created_at"`
}

type NotificationListResponse struct {
	Items  []NotificationResponse `json:"items"`
	Total  int64                  `json:"total"`
	Offset int                    `json:"offset"`
	Limit  int                    `json:"limit"`
}

type NotificationUnreadCountResponse struct {
	Count int64 `json:"count"`
}
