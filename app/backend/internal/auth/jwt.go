package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var ErrInvalidToken = errors.New("invalid token")

type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type JWTService struct {
	secret           []byte
	accessExpiry     time.Duration
	refreshExpiry    time.Duration
}

func NewJWTService(secret string, accessMin, refreshMin int) *JWTService {
	return &JWTService{
		secret:        []byte(secret),
		accessExpiry:  time.Duration(accessMin) * time.Minute,
		refreshExpiry: time.Duration(refreshMin) * time.Minute,
	}
}

func (s *JWTService) GenerateAccessToken(userID uuid.UUID, email, role string) (string, int, error) {
	exp := time.Now().Add(s.accessExpiry)
	claims := &Claims{
		UserID: userID.String(),
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	str, err := token.SignedString(s.secret)
	if err != nil {
		return "", 0, err
	}
	return str, int(s.accessExpiry.Seconds()), nil
}

func (s *JWTService) GenerateRefreshToken(userID uuid.UUID) (string, error) {
	claims := &Claims{
		UserID: userID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.refreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return s.secret, nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
