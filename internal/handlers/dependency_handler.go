package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/middleware"
	"github.com/rm/roadmap/internal/services"
)

type DependencyHandler struct {
	dependencyService *services.DependencyService
}

func NewDependencyHandler(dependencyService *services.DependencyService) *DependencyHandler {
	return &DependencyHandler{dependencyService: dependencyService}
}

func (h *DependencyHandler) List(c *gin.Context) {
	var productID *string
	if id := c.Query("product_id"); id != "" {
		productID = &id
	}
	var parsed *uuid.UUID
	if productID != nil {
		p, err := uuid.Parse(*productID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_id"})
			return
		}
		parsed = &p
	}
	list, err := h.dependencyService.List(parsed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *DependencyHandler) Create(c *gin.Context) {
	var req dto.DependencyCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	meta := middleware.GetAuditMeta(c)
	resp, err := h.dependencyService.Create(c.Request.Context(), req, meta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *DependencyHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	meta := middleware.GetAuditMeta(c)
	if err := h.dependencyService.Delete(c.Request.Context(), id, meta); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
