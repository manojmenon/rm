package services

import (
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/dto"
	"github.com/rm/roadmap/backend/internal/models"
	"github.com/rm/roadmap/backend/internal/repositories"
)

type NotificationService struct {
	repo repositories.NotificationRepository
}

func NewNotificationService(repo repositories.NotificationRepository) *NotificationService {
	return &NotificationService{repo: repo}
}

func (s *NotificationService) Create(recipientUserID uuid.UUID, notifType, title, message string, relatedEntityType string, relatedEntityID *uuid.UUID) (*dto.NotificationResponse, error) {
	n := &models.Notification{
		UserID:            recipientUserID,
		Type:              notifType,
		Title:             title,
		Message:           message,
		RelatedEntityType: relatedEntityType,
		RelatedEntityID:   relatedEntityID,
	}
	if err := s.repo.Create(n); err != nil {
		return nil, err
	}
	return notificationToResponse(n), nil
}

func (s *NotificationService) List(userID uuid.UUID, includeArchived bool, limit, offset int) (*dto.NotificationListResponse, error) {
	list, err := s.repo.List(userID, includeArchived, limit, offset)
	if err != nil {
		return nil, err
	}
	items := make([]dto.NotificationResponse, len(list))
	for i := range list {
		items[i] = *notificationToResponse(&list[i])
	}
	total, _ := s.repo.Count(userID, includeArchived)
	return &dto.NotificationListResponse{
		Items:  items,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	}, nil
}

func (s *NotificationService) UnreadCount(userID uuid.UUID) (int64, error) {
	return s.repo.UnreadCount(userID)
}

func (s *NotificationService) MarkRead(id, userID uuid.UUID) error {
	return s.repo.MarkRead(id, userID)
}

func (s *NotificationService) MarkReadAll(userID uuid.UUID) error {
	return s.repo.MarkReadAll(userID)
}

func (s *NotificationService) Archive(id, userID uuid.UUID) error {
	return s.repo.Archive(id, userID)
}

func (s *NotificationService) Delete(id, userID uuid.UUID) error {
	return s.repo.Delete(id, userID)
}

func notificationToResponse(n *models.Notification) *dto.NotificationResponse {
	resp := &dto.NotificationResponse{
		ID:                n.ID.String(),
		UserID:            n.UserID.String(),
		Type:              n.Type,
		Title:             n.Title,
		Message:           n.Message,
		RelatedEntityType: n.RelatedEntityType,
		CreatedAt:         n.CreatedAt.Format(time.RFC3339),
	}
	if n.RelatedEntityID != nil {
		resp.RelatedEntityID = n.RelatedEntityID.String()
	}
	if n.ReadAt != nil {
		s := n.ReadAt.Format(time.RFC3339)
		resp.ReadAt = &s
	}
	if n.ArchivedAt != nil {
		s := n.ArchivedAt.Format(time.RFC3339)
		resp.ArchivedAt = &s
	}
	return resp
}
