package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/middleware"
	"github.com/rm/roadmap/internal/services"
)

type AuditHandler struct {
	auditService *services.AuditService
	authService  *services.AuthService
}

func NewAuditHandler(auditService *services.AuditService, authService *services.AuthService) *AuditHandler {
	return &AuditHandler{auditService: auditService, authService: authService}
}

func (h *AuditHandler) getCaller(c *gin.Context) (uuid.UUID, string) {
	userID, _ := c.Get(middleware.UserIDKey)
	role, _ := c.Get(middleware.UserRoleKey)
	roleStr := "owner"
	if r, ok := role.(string); ok && r != "" {
		roleStr = r
	}
	var id uuid.UUID
	if userID != nil {
		if s, ok := userID.(string); ok {
			id, _ = uuid.Parse(s)
		}
	}
	return id, roleStr
}

func (h *AuditHandler) List(c *gin.Context) {
	callerID, callerRole := h.getCaller(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit < 1 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	entityType := c.Query("entity_type")
	action := c.Query("action")
	sortBy := c.DefaultQuery("sort_by", "timestamp")
	order := c.DefaultQuery("order", "desc")
	if order != "asc" {
		order = "desc"
	}
	// Default to main (non-archived) logs when archived param is omitted
	archived := new(bool)
	*archived = false
	if a := c.Query("archived"); a == "true" {
		*archived = true
	}
	var dateFrom, dateTo *time.Time
	if df := c.Query("date_from"); df != "" {
		if t, err := time.Parse("2006-01-02", df); err == nil {
			dateFrom = &t
		}
	}
	if dt := c.Query("date_to"); dt != "" {
		if t, err := time.Parse("2006-01-02", dt); err == nil {
			t = t.Add(24*time.Hour - time.Nanosecond) // end of day
			dateTo = &t
		}
	}

	list, total, err := h.auditService.List(c.Request.Context(), limit, offset, entityType, action, dateFrom, dateTo, archived, sortBy, order, callerID, callerRole)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.PageResult[dto.AuditLogResponse]{
		Items:  list,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

type archiveRequest struct {
	IDs []string `json:"ids"`
}

func (h *AuditHandler) Archive(c *gin.Context) {
	var req archiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body: ids array required"})
		return
	}
	if len(req.IDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"archived": 0})
		return
	}
	ids := make([]uuid.UUID, 0, len(req.IDs))
	for _, s := range req.IDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id: " + s})
			return
		}
		ids = append(ids, id)
	}
	if err := h.auditService.Archive(c.Request.Context(), ids); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"archived": len(ids)})
}

type deleteArchivedRequest struct {
	IDs      []string `json:"ids" binding:"required"`
	Password string   `json:"password" binding:"required"`
}

func (h *AuditHandler) DeleteArchived(c *gin.Context) {
	var req deleteArchivedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids and password are required"})
		return
	}
	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ids cannot be empty"})
		return
	}
	callerID, callerRole := h.getCaller(c)
	if callerRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can delete archived logs"})
		return
	}
	if err := h.authService.VerifyPassword(callerID, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid password"})
		return
	}
	ids := make([]uuid.UUID, 0, len(req.IDs))
	for _, s := range req.IDs {
		id, err := uuid.Parse(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id: " + s})
			return
		}
		ids = append(ids, id)
	}
	if err := h.auditService.DeleteArchived(c.Request.Context(), ids); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": len(ids)})
}
