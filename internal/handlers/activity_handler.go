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

type ActivityHandler struct {
	activityService *services.ActivityService
}

func NewActivityHandler(activityService *services.ActivityService) *ActivityHandler {
	return &ActivityHandler{activityService: activityService}
}

func (h *ActivityHandler) List(c *gin.Context) {
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

	list, total, err := h.activityService.List(c.Request.Context(), limit, offset, action, dateFrom, dateTo, sortBy, order)
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
