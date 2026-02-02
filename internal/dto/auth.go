package dto

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role"` // user | owner | admin | superadmin (superadmin cannot self-register); default user
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	User         UserResponse `json:"user"`
}

type UserResponse struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Email            string  `json:"email"`
	Role             string  `json:"role"`
	TeamID           *string `json:"team_id,omitempty"`
	DirectManagerID  *string `json:"direct_manager_id,omitempty"`
}
type UserUpdateRequest struct {
	Name             *string `json:"name"`
	Role             *string `json:"role"`
	TeamID           *string `json:"team_id"`
	DirectManagerID  *string `json:"direct_manager_id"`
}
type UserDottedLineManagerResponse struct {
	ID        string        `json:"id"`
	UserID    string        `json:"user_id"`
	ManagerID string        `json:"manager_id"`
	Manager   *UserResponse `json:"manager,omitempty"`
	CreatedAt string        `json:"created_at"`
}
