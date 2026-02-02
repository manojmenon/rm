package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/middleware"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/services"
	"go.uber.org/zap"
)

type ProductHandler struct {
	productService *services.ProductService
	log            *zap.Logger
}

func NewProductHandler(productService *services.ProductService, log *zap.Logger) *ProductHandler {
	if log == nil {
		log = zap.NewNop()
	}
	return &ProductHandler{productService: productService, log: log}
}

func (h *ProductHandler) getCaller(c *gin.Context) (uuid.UUID, models.Role) {
	userID, _ := c.Get(middleware.UserIDKey)
	role, _ := c.Get(middleware.UserRoleKey)
	id, _ := uuid.Parse(userID.(string))
	return id, models.Role(role.(string))
}

func (h *ProductHandler) Create(c *gin.Context) {
	var req dto.ProductCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, callerRole := h.getCaller(c)
	var ownerID *uuid.UUID
	if callerRole.IsAdminOrAbove() || callerRole == models.RoleOwner {
		ownerID = &callerID
	}
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productService.Create(c.Request.Context(), req, ownerID, callerRole.IsAdminOrAbove(), meta)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *ProductHandler) List(c *gin.Context) {
	callerID, callerRole := h.getCaller(c)
	var ownerID *uuid.UUID
	if o := c.Query("owner_id"); o != "" {
		parsed, err := uuid.Parse(o)
		if err == nil {
			ownerID = &parsed
		}
	}
	var status *models.ProductStatus
	if s := c.Query("status"); s != "" {
		st := models.ProductStatus(s)
		status = &st
	}
	var lifecycleStatus *models.LifecycleStatus
	if ls := c.Query("lifecycle_status"); ls != "" {
		lst := models.LifecycleStatus(ls)
		lifecycleStatus = &lst
	}
	var category1, category2, category3 *string
	if c1 := c.Query("category_1"); c1 != "" {
		category1 = &c1
	}
	if c2 := c.Query("category_2"); c2 != "" {
		category2 = &c2
	}
	if c3 := c.Query("category_3"); c3 != "" {
		category3 = &c3
	}
	var groupID *uuid.UUID
	if g := c.Query("group_id"); g != "" {
		if parsed, err := uuid.Parse(g); err == nil {
			groupID = &parsed
		}
	}
	ungroupedOnly := c.Query("ungrouped_only") == "true" || c.Query("ungrouped_only") == "1"
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
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	sortBy := c.DefaultQuery("sort_by", "name")
	order := c.DefaultQuery("order", "asc")
	if order != "desc" {
		order = "asc"
	}
	pr := dto.PageRequest{Limit: limit, Offset: offset}
	pr.Normalize(20, 100)
	result, err := h.productService.List(ownerID, status, lifecycleStatus, category1, category2, category3, groupID, ungroupedOnly, dateFrom, dateTo, sortBy, order, callerID, callerRole, pr.Limit, pr.Offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *ProductHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	resp, err := h.productService.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *ProductHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req dto.ProductUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Warn("product update bind error", zap.String("product_id", id.String()), zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	callerID, callerRole := h.getCaller(c)
	meta := middleware.GetAuditMeta(c)
	resp, err := h.productService.Update(c.Request.Context(), id, req, callerID, callerRole, meta)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if err == services.ErrInvalidOwnerID {
			h.log.Warn("product update invalid owner_id", zap.String("product_id", id.String()))
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid owner_id"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *ProductHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	_, callerRole := h.getCaller(c)
	meta := middleware.GetAuditMeta(c)
	if err := h.productService.Delete(c.Request.Context(), id, callerRole, meta); err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin only"})
			return
		}
		if err == services.ErrProductHasVersions {
			c.JSON(http.StatusBadRequest, gin.H{"error": "delete all versions first"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
