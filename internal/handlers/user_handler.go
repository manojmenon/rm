package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
	"github.com/rm/roadmap/internal/services"
)

type UserHandler struct {
	userRepo     repositories.UserRepository
	dottedRepo   repositories.UserDottedLineRepository
}

func NewUserHandler(userRepo repositories.UserRepository, dottedRepo repositories.UserDottedLineRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo, dottedRepo: dottedRepo}
}

func (h *UserHandler) List(c *gin.Context) {
	var teamID, directManagerID *uuid.UUID
	if t := c.Query("team_id"); t != "" {
		if id, err := uuid.Parse(t); err == nil {
			teamID = &id
		}
	}
	if m := c.Query("direct_manager_id"); m != "" {
		if id, err := uuid.Parse(m); err == nil {
			directManagerID = &id
		}
	}
	users, err := h.userRepo.List(teamID, directManagerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]dto.UserResponse, len(users))
	for i := range users {
		out[i] = services.UserToResponse(&users[i])
	}
	c.JSON(http.StatusOK, out)
}

func (h *UserHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	u, err := h.userRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, services.UserToResponse(u))
}

func (h *UserHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req dto.UserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := h.userRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if req.Name != nil {
		u.Name = *req.Name
	}
	if req.Role != nil {
		u.Role = models.Role(*req.Role)
	}
	if req.TeamID != nil {
		if *req.TeamID == "" {
			u.TeamID = nil
		} else {
			tid, err := uuid.Parse(*req.TeamID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid team_id"})
				return
			}
			u.TeamID = &tid
		}
	}
	if req.DirectManagerID != nil {
		if *req.DirectManagerID == "" {
			u.DirectManagerID = nil
		} else {
			mid, err := uuid.Parse(*req.DirectManagerID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid direct_manager_id"})
				return
			}
			if mid == id {
				c.JSON(http.StatusBadRequest, gin.H{"error": "user cannot be their own manager"})
				return
			}
			depth, err := h.userRepo.ManagerChainDepth(mid)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if depth >= repositories.MaxManagerHierarchyDepth {
				c.JSON(http.StatusBadRequest, gin.H{"error": "manager hierarchy would exceed maximum depth (16)"})
				return
			}
			u.DirectManagerID = &mid
		}
	}
	// Clear associations so GORM persists team_id and direct_manager_id columns
	u.Team = nil
	u.DirectManager = nil
	if err := h.userRepo.Update(u); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Validate manager chain (depth and cycle) after update
	if u.DirectManagerID != nil {
		if _, err := h.userRepo.ManagerChainDepth(id); err != nil {
			u.DirectManagerID = nil
			u.DirectManager = nil
			_ = h.userRepo.Update(u)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, services.UserToResponse(u))
}

func (h *UserHandler) ListDottedLineManagers(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	list, err := h.dottedRepo.ListByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]dto.UserDottedLineManagerResponse, len(list))
	for i := range list {
		out[i] = dto.UserDottedLineManagerResponse{
			ID:        list[i].ID.String(),
			UserID:    list[i].UserID.String(),
			ManagerID: list[i].ManagerID.String(),
			CreatedAt: list[i].CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		if list[i].Manager.ID != uuid.Nil {
			ur := services.UserToResponse(&list[i].Manager)
			out[i].Manager = &ur
		}
	}
	c.JSON(http.StatusOK, out)
}

func (h *UserHandler) AddDottedLineManager(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var body struct {
		ManagerID string `json:"manager_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "manager_id required"})
		return
	}
	managerID, err := uuid.Parse(body.ManagerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid manager_id"})
		return
	}
	if userID == managerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user cannot have themselves as dotted-line manager"})
		return
	}
	ok, err := h.dottedRepo.Exists(userID, managerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if ok {
		c.JSON(http.StatusConflict, gin.H{"error": "already added"})
		return
	}
	ud := &models.UserDottedLineManager{UserID: userID, ManagerID: managerID}
	if err := h.dottedRepo.Create(ud); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dto.UserDottedLineManagerResponse{
		ID:        ud.ID.String(),
		UserID:    ud.UserID.String(),
		ManagerID: ud.ManagerID.String(),
		CreatedAt: ud.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

func (h *UserHandler) RemoveDottedLineManager(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	managerID, err := uuid.Parse(c.Param("manager_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid manager_id"})
		return
	}
	if err := h.dottedRepo.Delete(userID, managerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
