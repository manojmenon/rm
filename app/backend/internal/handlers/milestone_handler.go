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

type MilestoneHandler struct {
	milestoneService *services.MilestoneService
}

func NewMilestoneHandler(milestoneService *services.MilestoneService) *MilestoneHandler {
	return &MilestoneHandler{milestoneService: milestoneService}
}

func (h *MilestoneHandler) getCallerRole(c *gin.Context) models.Role {
	role, _ := c.Get(middleware.UserRoleKey)
	return models.Role(role.(string))
}

func (h *MilestoneHandler) Create(c *gin.Context) {
	var req dto.MilestoneCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, _ := c.Get(middleware.UserIDKey)
	callerIDUUID, _ := uuid.Parse(callerID.(string))
	meta := middleware.GetAuditMeta(c)
	resp, err := h.milestoneService.Create(c.Request.Context(), req, callerIDUUID, h.getCallerRole(c), meta)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only active products can be edited"})
			return
		}
		if err == services.ErrEndDateBeforeStart || err == services.ErrCertifyRequiresTestedSuccessfully {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *MilestoneHandler) ListByProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
		return
	}
	list, err := h.milestoneService.ListByProductID(productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *MilestoneHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req dto.MilestoneUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, _ := c.Get(middleware.UserIDKey)
	callerIDUUID, _ := uuid.Parse(callerID.(string))
	meta := middleware.GetAuditMeta(c)
	resp, err := h.milestoneService.Update(c.Request.Context(), id, req, callerIDUUID, h.getCallerRole(c), meta)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only active products can be edited"})
			return
		}
		if err == services.ErrEndDateBeforeStart || err == services.ErrCertifyRequiresTestedSuccessfully {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *MilestoneHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	callerID, _ := c.Get(middleware.UserIDKey)
	callerIDUUID, _ := uuid.Parse(callerID.(string))
	meta := middleware.GetAuditMeta(c)
	if err := h.milestoneService.Delete(c.Request.Context(), id, callerIDUUID, h.getCallerRole(c), meta); err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only product owner or admin can edit when product is active"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
