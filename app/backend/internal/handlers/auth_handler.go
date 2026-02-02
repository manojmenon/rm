package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/services"
	"go.uber.org/zap"
)

type AuthHandler struct {
	authService     *services.AuthService
	activityService *services.ActivityService
	log             *zap.Logger
}

func NewAuthHandler(authService *services.AuthService, activityService *services.ActivityService, log *zap.Logger) *AuthHandler {
	if log == nil {
		log = zap.NewNop()
	}
	return &AuthHandler{authService: authService, activityService: activityService, log: log}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.authService.Login(req)
	if err != nil {
		// Log every failed login attempt for audit
		details := "error"
		if err == services.ErrInvalidCredentials {
			details = "invalid credentials"
		}
		h.activityService.Log(c.Request.Context(), services.ActivityEntry{
			UserID:    nil,
			Action:    "login_failed",
			Details:   details,
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
		})
		if err == services.ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		h.log.Error("login failed", zap.String("email", req.Email), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Log every successful login
	uid, _ := uuid.Parse(resp.User.ID)
	h.activityService.Log(c.Request.Context(), services.ActivityEntry{
		UserID:    &uid,
		Action:    "login",
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})
	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role == "" {
		req.Role = "user"
	}
	resp, err := h.authService.Register(req)
	if err != nil {
		if err == services.ErrEmailExists {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		h.log.Error("register failed", zap.String("email", req.Email), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.authService.Refresh(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}
	c.JSON(http.StatusOK, resp)
}
