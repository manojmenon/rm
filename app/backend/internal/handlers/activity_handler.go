package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/middleware"
	"github.com/rm/roadmap/backend/internal/models"
	"github.com/rm/roadmap/backend/internal/services"
)

type ActivityHandler struct {
	activityService *services.ActivityService
}

func NewActivityHandler(activityService *services.ActivityService) *ActivityHandler {
	return &ActivityHandler{activityService: activityService}
}

func (h *ActivityHandler) getCaller(c *gin.Context) (uuid.UUID, string) {
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

func (h *ActivityHandler) List(c *gin.Context) {
	callerID, callerRole := h.getCaller(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit < 1 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	action := c.Query("action")
	sortBy := c.DefaultQuery("sort_by", "timestamp")
	order := c.DefaultQuery("order", "desc")
	if order != "asc" {
		order = "desc"
	}
	var dateFrom, dateTo *time.Time
	if df := c.Query("date_from"); df != "" {
		if t, err := time.Parse("2006-01-02", df); err == nil {
			dateFrom = &t
		}
	}
	if dt := c.Query("date_to"); dt != "" {
		if t, err := time.Parse("2006-01-02", dt); err == nil {
			t = t.Add(24*time.Hour - time.Nanosecond)
			dateTo = &t
		}
	}
	// Non-admin users must provide a date range (restrict to their activity within dates).
	if !models.Role(callerRole).IsAdminOrAbove() {
		if dateFrom == nil || dateTo == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "date_from and date_to are required for user activity"})
			return
		}
	}

	list, total, err := h.activityService.List(c.Request.Context(), limit, offset, action, dateFrom, dateTo, sortBy, order, callerID, callerRole)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.PageResult[dto.ActivityLogResponse]{
		Items:  list,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// Logout logs the logout activity and returns 200. Requires Auth. Token invalidation is client-side.
// Every logout request is logged (with user id when authenticated, otherwise with nil user for audit).
func (h *ActivityHandler) Logout(c *gin.Context) {
	meta := middleware.GetAuditMeta(c)
	var userID *uuid.UUID
	if userIDVal, _ := c.Get(middleware.UserIDKey); userIDVal != nil {
		if userIDStr, ok := userIDVal.(string); ok && userIDStr != "" {
			if uid, err := uuid.Parse(userIDStr); err == nil {
				userID = &uid
			}
		}
	}
	h.activityService.Log(c.Request.Context(), services.ActivityEntry{
		UserID:    userID,
		Action:    "logout",
		IPAddress: meta.IP,
		UserAgent: meta.UserAgent,
	})
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
