package dto

type ActivityLogResponse struct {
	ID         string        `json:"id"`
	Timestamp  string        `json:"timestamp"`
	UserID     *string       `json:"user_id,omitempty"`
	User       *UserResponse `json:"user,omitempty"`
	Action     string        `json:"action"`
	EntityType string        `json:"entity_type"`
	EntityID   string        `json:"entity_id"`
	Details    string        `json:"details"`
	IPAddress  string        `json:"ip_address"`
	UserAgent  string        `json:"user_agent"`
}
