package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/middleware"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/services"
)

type ProductRequestHandler struct {
	productRequestService *services.ProductRequestService
}

func NewProductRequestHandler(productRequestService *services.ProductRequestService) *ProductRequestHandler {
	return &ProductRequestHandler{productRequestService: productRequestService}
}

func (h *ProductRequestHandler) getCallerID(c *gin.Context) uuid.UUID {
	userID, _ := c.Get(middleware.UserIDKey)
	id, _ := uuid.Parse(userID.(string))
	return id
}

func (h *ProductRequestHandler) Create(c *gin.Context) {
	var req dto.ProductRequestCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userID := h.getCallerID(c)
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productRequestService.Create(c.Request.Context(), req, userID, meta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *ProductRequestHandler) List(c *gin.Context) {
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
	list, err := h.productRequestService.List(status, callerID, roleStr, ownerID, fromDate, toDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ProductRequestHandler) Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req dto.ProductRequestApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var ownerID *uuid.UUID
	if req.Approved && req.OwnerID != "" {
		parsed, err := uuid.Parse(req.OwnerID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid owner_id"})
			return
		}
		ownerID = &parsed
	}
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productRequestService.Approve(c.Request.Context(), id, req.Approved, ownerID, meta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}
