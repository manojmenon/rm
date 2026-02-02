package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/middleware"
	"github.com/rm/roadmap/backend/internal/models"
	"github.com/rm/roadmap/backend/internal/services"
)

type ProductDeletionRequestHandler struct {
	productDeletionRequestService *services.ProductDeletionRequestService
}

func NewProductDeletionRequestHandler(productDeletionRequestService *services.ProductDeletionRequestService) *ProductDeletionRequestHandler {
	return &ProductDeletionRequestHandler{productDeletionRequestService: productDeletionRequestService}
}

func (h *ProductDeletionRequestHandler) getCallerID(c *gin.Context) uuid.UUID {
	userID, _ := c.Get(middleware.UserIDKey)
	id, _ := uuid.Parse(userID.(string))
	return id
}

func (h *ProductDeletionRequestHandler) Create(c *gin.Context) {
	productIDStr := c.Param("id")
	if productIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "product id required"})
		return
	}
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
		return
	}
	callerID := h.getCallerID(c)
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productDeletionRequestService.Create(c.Request.Context(), productID, callerID, meta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *ProductDeletionRequestHandler) List(c *gin.Context) {
	callerID := h.getCallerID(c)
	callerRole, _ := c.Get(middleware.UserRoleKey)
	roleStr := "owner"
	if r, ok := callerRole.(string); ok && r != "" {
		roleStr = r
	}
	var status *models.RequestStatus
	if s := c.Query("status"); s != "" {
		st := models.RequestStatus(s)
		status = &st
	}
	var ownerID *uuid.UUID
	if o := c.Query("owner_id"); o != "" {
		parsed, err := uuid.Parse(o)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid owner_id"})
			return
		}
		ownerID = &parsed
	}
	var fromDate, toDate *time.Time
	if f := c.Query("from_date"); f != "" {
		t, err := time.Parse("2006-01-02", f)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid from_date (use YYYY-MM-DD)"})
			return
		}
		fromDate = &t
	}
	if t := c.Query("to_date"); t != "" {
		parsed, err := time.Parse("2006-01-02", t)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid to_date (use YYYY-MM-DD)"})
			return
		}
		toDate = &parsed
	}
	list, err := h.productDeletionRequestService.List(status, callerID, roleStr, ownerID, fromDate, toDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ProductDeletionRequestHandler) Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req dto.ProductDeletionApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productDeletionRequestService.Approve(c.Request.Context(), id, req.Approved, meta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}
