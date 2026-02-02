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

type ProductVersionHandler struct {
	productVersionService *services.ProductVersionService
}

func NewProductVersionHandler(productVersionService *services.ProductVersionService) *ProductVersionHandler {
	return &ProductVersionHandler{productVersionService: productVersionService}
}

func (h *ProductVersionHandler) getCaller(c *gin.Context) (uuid.UUID, models.Role) {
	userID, _ := c.Get(middleware.UserIDKey)
	role, _ := c.Get(middleware.UserRoleKey)
	id, _ := uuid.Parse(userID.(string))
	return id, models.Role(role.(string))
}

func (h *ProductVersionHandler) ListByProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
		return
	}
	list, err := h.productVersionService.ListByProductID(productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ProductVersionHandler) Create(c *gin.Context) {
	var req dto.ProductVersionCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, callerRole := h.getCaller(c)
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productVersionService.Create(c.Request.Context(), req, callerID, callerRole, meta)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only product owner or admin can add versions when product is active"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *ProductVersionHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req dto.ProductVersionUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, callerRole := h.getCaller(c)
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productVersionService.Update(c.Request.Context(), id, req, callerID, callerRole, meta)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only product owner or admin can modify versions when product is active"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *ProductVersionHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	callerID, callerRole := h.getCaller(c)
	meta := middleware.GetAuditMeta(c)
	if err := h.productVersionService.Delete(c.Request.Context(), id, callerID, callerRole, meta); err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only product owner or admin can modify versions when product is active"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
