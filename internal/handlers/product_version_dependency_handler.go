package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/middleware"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/services"
)

type ProductVersionDependencyHandler struct {
	svc *services.ProductVersionDependencyService
}

func NewProductVersionDependencyHandler(svc *services.ProductVersionDependencyService) *ProductVersionDependencyHandler {
	return &ProductVersionDependencyHandler{svc: svc}
}

func (h *ProductVersionDependencyHandler) getCaller(c *gin.Context) (uuid.UUID, models.Role) {
	userID, _ := c.Get(middleware.UserIDKey)
	role, _ := c.Get(middleware.UserRoleKey)
	var id uuid.UUID
	if userID != nil {
		if s, ok := userID.(string); ok {
			id, _ = uuid.Parse(s)
		}
	}
	roleStr := "owner"
	if role != nil {
		if r, ok := role.(string); ok {
			roleStr = r
		}
	}
	return id, models.Role(roleStr)
}

func (h *ProductVersionDependencyHandler) ListByProductVersion(c *gin.Context) {
	versionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product version id"})
		return
	}
	callerID, callerRole := h.getCaller(c)
	list, err := h.svc.ListByProductVersionID(c.Request.Context(), versionID, callerID, callerRole)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ProductVersionDependencyHandler) Create(c *gin.Context) {
	var req dto.ProductVersionDependencyCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, callerRole := h.getCaller(c)
	meta := middleware.GetAuditMeta(c)
	resp, err := h.svc.Create(c.Request.Context(), req, callerID, callerRole, meta)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *ProductVersionDependencyHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	callerID, callerRole := h.getCaller(c)
	meta := middleware.GetAuditMeta(c)
	if err := h.svc.Delete(c.Request.Context(), id, callerID, callerRole, meta); err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
