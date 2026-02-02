package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/models"
	"github.com/rm/roadmap/backend/internal/repositories"
	"go.uber.org/zap"
)

type ActivityEntry struct {
	UserID     *uuid.UUID
	Action     string // login, login_failed, logout, create, save, delete
	EntityType string
	EntityID   string
	Details    string
	IPAddress  string
	UserAgent  string
}

type ActivityService struct {
	repo repositories.ActivityRepository
	log  *zap.Logger
}


func NewActivityService(repo repositories.ActivityRepository, log *zap.Logger) *ActivityService {
	return &ActivityService{repo: repo, log: log}
}

// Log writes an activity entry asynchronously.
func (s *ActivityService) Log(ctx context.Context, entry ActivityEntry) {
	entryCopy := ActivityEntry{
		UserID:     entry.UserID,
		Action:     entry.Action,
		EntityType: entry.EntityType,
		EntityID:   entry.EntityID,
		Details:    entry.Details,
		IPAddress:  entry.IPAddress,
		UserAgent:  entry.UserAgent,
	}
	go func() {
		rec := &models.ActivityLog{
			UserID:     entryCopy.UserID,
			Action:     entryCopy.Action,
			EntityType: entryCopy.EntityType,
			EntityID:   entryCopy.EntityID,
			Details:    entryCopy.Details,
			IPAddress:  entryCopy.IPAddress,
			UserAgent:  entryCopy.UserAgent,
		}
		writeCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := s.repo.Create(writeCtx, rec); err != nil {
			s.log.Error("activity log write failed", zap.Error(err), zap.String("action", entryCopy.Action))
		}
	}()
}

// List returns paginated activity logs. For admin: all logs. For non-admin: only the caller's logs (handler should require date range for non-admin).
func (s *ActivityService) List(ctx context.Context, limit, offset int, action string, dateFrom, dateTo *time.Time, sortBy, order string, callerID uuid.UUID, callerRole string) ([]dto.ActivityLogResponse, int64, error) {
	var userID *uuid.UUID
	if !models.Role(strings.ToLower(callerRole)).IsAdminOrAbove() {
		userID = &callerID
	}
	list, total, err := s.repo.List(ctx, limit, offset, action, dateFrom, dateTo, sortBy, order, userID)
	if err != nil {
		return nil, 0, err
	}
	out := make([]dto.ActivityLogResponse, len(list))
	for i := range list {
		out[i] = activityLogToResponse(&list[i])
	}
	return out, total, nil
}

func activityLogToResponse(a *models.ActivityLog) dto.ActivityLogResponse {
	resp := dto.ActivityLogResponse{
		ID:         a.ID.String(),
		Timestamp:  a.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
		Action:     a.Action,
		EntityType: a.EntityType,
		EntityID:   a.EntityID,
		Details:    a.Details,
		IPAddress:  a.IPAddress,
		UserAgent:  a.UserAgent,
	}
	if a.UserID != nil {
		s := a.UserID.String()
		resp.UserID = &s
	}
	if a.User != nil && a.User.ID != uuid.Nil {
		ur := UserToResponse(a.User)
		resp.User = &ur
	}
	return resp
}
