package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/middleware"
	"github.com/rm/roadmap/backend/internal/models"
	"github.com/rm/roadmap/backend/internal/services"
)

type GroupHandler struct {
	groupService *services.GroupService
}

func NewGroupHandler(groupService *services.GroupService) *GroupHandler {
	return &GroupHandler{groupService: groupService}
}

func (h *GroupHandler) getCaller(c *gin.Context) (uuid.UUID, models.Role) {
	userID, _ := c.Get(middleware.UserIDKey)
	role, _ := c.Get(middleware.UserRoleKey)
	roleStr := "owner"
	if r, ok := role.(string); ok && r != "" {
		roleStr = r
	}
	id, _ := uuid.Parse(userID.(string))
	return id, models.Role(roleStr)
}

func (h *GroupHandler) Create(c *gin.Context) {
	var req dto.GroupCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, _ := h.getCaller(c)
	resp, err := h.groupService.Create(req, callerID)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		if err == services.ErrGroupDescTooShort {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *GroupHandler) List(c *gin.Context) {
	callerID, callerRole := h.getCaller(c)
	list, err := h.groupService.List(callerID, callerRole)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *GroupHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	callerID, callerRole := h.getCaller(c)
	resp, err := h.groupService.GetByID(id, callerID, callerRole)
	if err != nil {
		if err == services.ErrGroupNotFound || err == services.ErrForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *GroupHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req dto.GroupUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, callerRole := h.getCaller(c)
	resp, err := h.groupService.Update(id, req, callerID, callerRole)
	if err != nil {
		if err == services.ErrGroupNotFound || err == services.ErrForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		if err == services.ErrGroupDescTooShort {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *GroupHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	callerID, callerRole := h.getCaller(c)
	if err := h.groupService.Delete(id, callerID, callerRole); err != nil {
		if err == services.ErrGroupNotFound || err == services.ErrForbidden {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
