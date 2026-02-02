package services

import (
	"errors"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/auth"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/models"
	"github.com/rm/roadmap/backend/internal/repositories"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailExists        = errors.New("email already registered")
)

type AuthService struct {
	userRepo repositories.UserRepository
	jwt      *auth.JWTService
}

func NewAuthService(userRepo repositories.UserRepository, jwt *auth.JWTService) *AuthService {
	return &AuthService{userRepo: userRepo, jwt: jwt}
}

func (s *AuthService) Login(req dto.LoginRequest) (*dto.AuthResponse, error) {
	u, err := s.userRepo.GetByEmail(req.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	access, expSec, err := s.jwt.GenerateAccessToken(u.ID, u.Email, string(u.Role))
	if err != nil {
		return nil, err
	}
	refresh, err := s.jwt.GenerateRefreshToken(u.ID)
	if err != nil {
		return nil, err
	}
	return &dto.AuthResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    expSec,
		User:         userToResponse(u),
	}, nil
}

func (s *AuthService) Register(req dto.RegisterRequest) (*dto.AuthResponse, error) {
	_, err := s.userRepo.GetByEmail(req.Email)
	if err == nil {
		return nil, ErrEmailExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	// Superadmin cannot be created via self-registration; only via seed or by another superadmin.
	if req.Role == "superadmin" {
		return nil, errors.New("cannot self-register as superadmin")
	}
	role := models.RoleUser
	if req.Role == "admin" {
		role = models.RoleAdmin
	} else if req.Role == "owner" {
		role = models.RoleOwner
	}
	u := &models.User{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         role,
	}
	if err := s.userRepo.Create(u); err != nil {
		return nil, err
	}
	access, expSec, err := s.jwt.GenerateAccessToken(u.ID, u.Email, string(u.Role))
	if err != nil {
		return nil, err
	}
	refresh, err := s.jwt.GenerateRefreshToken(u.ID)
	if err != nil {
		return nil, err
	}
	return &dto.AuthResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    expSec,
		User:         userToResponse(u),
	}, nil
}

func (s *AuthService) Refresh(refreshToken string) (*dto.AuthResponse, error) {
	claims, err := s.jwt.ValidateToken(refreshToken)
	if err != nil {
		return nil, err
	}
	id, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, auth.ErrInvalidToken
	}
	u, err := s.userRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	access, expSec, err := s.jwt.GenerateAccessToken(u.ID, u.Email, string(u.Role))
	if err != nil {
		return nil, err
	}
	newRefresh, err := s.jwt.GenerateRefreshToken(u.ID)
	if err != nil {
		return nil, err
	}
	return &dto.AuthResponse{
		AccessToken:  access,
		RefreshToken: newRefresh,
		ExpiresIn:    expSec,
		User:         userToResponse(u),
	}, nil
}

// VerifyPassword checks that the given password matches the user's password. Returns nil if valid.
func (s *AuthService) VerifyPassword(userID uuid.UUID, password string) error {
	u, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return ErrInvalidCredentials
	}
	return nil
}

func userToResponse(u *models.User) dto.UserResponse {
	resp := dto.UserResponse{
		ID:    u.ID.String(),
		Name:  u.Name,
		Email: u.Email,
		Role:  string(u.Role),
	}
	if u.TeamID != nil {
		s := u.TeamID.String()
		resp.TeamID = &s
	}
	if u.DirectManagerID != nil {
		s := u.DirectManagerID.String()
		resp.DirectManagerID = &s
	}
	return resp
}

// UserToResponse converts a user model to DTO (for use by other handlers).
func UserToResponse(u *models.User) dto.UserResponse {
	return userToResponse(u)
}
