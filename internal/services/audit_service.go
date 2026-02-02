package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
	"go.uber.org/zap"
)

type AuditEntry struct {
	UserID    *uuid.UUID
	Action    string
	EntityType string
	EntityID   string
	OldData   models.JSONB
	NewData   models.JSONB
	Metadata  models.JSONB
	IPAddress string
	UserAgent string
	TraceID   string
}

type AuditService struct {
	repo       repositories.AuditRepository
	productRepo repositories.ProductRepository
	log        *zap.Logger
}

func NewAuditService(repo repositories.AuditRepository, productRepo repositories.ProductRepository, log *zap.Logger) *AuditService {
	return &AuditService{repo: repo, productRepo: productRepo, log: log}
}

// Log writes an audit entry asynchronously. Business logic must not depend on its success.
// Uses a fresh context with timeout so the write is never tied to the request context (avoids "context canceled" when client disconnects).
func (s *AuditService) Log(ctx context.Context, entry AuditEntry) {
	// Copy entry into the goroutine so we don't retain request-scoped references (e.g. context).
	entryCopy := AuditEntry{
		UserID:     entry.UserID,
		Action:     entry.Action,
		EntityType: entry.EntityType,
		EntityID:   entry.EntityID,
		OldData:    entry.OldData,
		NewData:    entry.NewData,
		Metadata:   entry.Metadata,
		IPAddress:  entry.IPAddress,
		UserAgent:  entry.UserAgent,
		TraceID:    entry.TraceID,
	}
	go func() {
		rec := &models.AuditLog{
			UserID:     entryCopy.UserID,
			Action:     entryCopy.Action,
			EntityType: entryCopy.EntityType,
			EntityID:   entryCopy.EntityID,
			OldData:    entryCopy.OldData,
			NewData:    entryCopy.NewData,
			Metadata:   entryCopy.Metadata,
			IPAddress:  entryCopy.IPAddress,
			UserAgent:  entryCopy.UserAgent,
			TraceID:    entryCopy.TraceID,
		}
		// Fresh context with timeout so write is never canceled by request lifecycle (client disconnect, etc.)
		writeCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := s.repo.Create(writeCtx, rec); err != nil {
			s.log.Error("audit log write failed", zap.Error(err), zap.String("action", entryCopy.Action), zap.String("entity_type", entryCopy.EntityType))
		}
	}()
}

// List returns paginated audit logs. For admin: all logs. For others: only logs for products the caller owns.
// archived: nil or false = main (non-archived), true = archive only.
func (s *AuditService) List(ctx context.Context, limit, offset int, entityType, action string, dateFrom, dateTo *time.Time, archived *bool, sortBy, order string, callerID uuid.UUID, callerRole string) ([]dto.AuditLogResponse, int64, error) {
	if models.Role(strings.ToLower(callerRole)).IsAdminOrAbove() {
		list, total, err := s.repo.List(ctx, limit, offset, entityType, action, dateFrom, dateTo, archived, sortBy, order)
		if err != nil {
			return nil, 0, err
		}
		out := make([]dto.AuditLogResponse, len(list))
		for i := range list {
			out[i] = auditLogToResponse(&list[i])
			enrichProductNameVersion(ctx, s.productRepo, &out[i])
		}
		return out, total, nil
	}
	// Non-admin: only logs for products they own
	products, _, err := s.productRepo.List(&callerID, nil, nil, nil, nil, nil, nil, nil, nil, nil, "created_at", "desc", 2000, 0)
	if err != nil {
		return nil, 0, err
	}
	productIDs := make([]uuid.UUID, 0, len(products))
	for _, p := range products {
		productIDs = append(productIDs, p.ID)
	}
	list, total, err := s.repo.ListForOwner(ctx, productIDs, limit, offset, entityType, action, dateFrom, dateTo, archived, sortBy, order)
	if err != nil {
		return nil, 0, err
	}
	out := make([]dto.AuditLogResponse, len(list))
	for i := range list {
		out[i] = auditLogToResponse(&list[i])
		enrichProductNameVersion(ctx, s.productRepo, &out[i])
	}
	return out, total, nil
}

// Archive marks the given log IDs as archived. Only non-archived rows are updated. Admin only in handler.
func (s *AuditService) Archive(ctx context.Context, ids []uuid.UUID) error {
	return s.repo.Archive(ctx, ids)
}

// DeleteArchived permanently deletes archived audit log rows. Only rows with archived=true are deleted. Admin only in handler.
func (s *AuditService) DeleteArchived(ctx context.Context, ids []uuid.UUID) error {
	return s.repo.DeleteArchived(ctx, ids)
}

// enrichProductNameVersion sets ProductName and ProductVersion on the response when the log relates to a product.
func enrichProductNameVersion(ctx context.Context, productRepo repositories.ProductRepository, resp *dto.AuditLogResponse) {
	getStr := func(m map[string]interface{}, key string) string {
		if m == nil {
			return ""
		}
		v, ok := m[key]
		if !ok || v == nil {
			return ""
		}
		return fmt.Sprint(v)
	}
	var productID uuid.UUID
	switch resp.EntityType {
	case "product":
		// Prefer name/version from new_data or old_data (product create/update/delete payloads)
		resp.ProductName = getStr(resp.NewData, "name")
		resp.ProductVersion = getStr(resp.NewData, "version")
		if resp.ProductName == "" && resp.ProductVersion == "" {
			resp.ProductName = getStr(resp.OldData, "name")
			resp.ProductVersion = getStr(resp.OldData, "version")
		}
		if resp.ProductName != "" && resp.ProductVersion != "" {
			return
		}
		productID, _ = uuid.Parse(resp.EntityID)
	case "milestone", "product_version", "product_deletion_request":
		pid := getStr(resp.NewData, "product_id")
		if pid == "" {
			pid = getStr(resp.OldData, "product_id")
		}
		productID, _ = uuid.Parse(pid)
	default:
		return
	}
	if productID == uuid.Nil {
		return
	}
	p, err := productRepo.GetByID(productID)
	if err != nil || p == nil {
		return
	}
	if resp.ProductName == "" {
		resp.ProductName = p.Name
	}
	if resp.ProductVersion == "" {
		resp.ProductVersion = p.Version
	}
}

func auditLogToResponse(a *models.AuditLog) dto.AuditLogResponse {
	resp := dto.AuditLogResponse{
		ID:         a.ID.String(),
		Timestamp:  a.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
		Action:     a.Action,
		EntityType: a.EntityType,
		EntityID:   a.EntityID,
		IPAddress:  a.IPAddress,
		UserAgent:  a.UserAgent,
		TraceID:    a.TraceID,
	}
	if a.UserID != nil {
		s := a.UserID.String()
		resp.UserID = &s
	}
	if a.User != nil && a.User.ID != uuid.Nil {
		ur := UserToResponse(a.User)
		resp.User = &ur
	}
	if a.OldData != nil {
		resp.OldData = a.OldData
	}
	if a.NewData != nil {
		resp.NewData = a.NewData
	}
	return resp
}

func ToJSONB(v interface{}) models.JSONB {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var out map[string]interface{}
	if err := json.Unmarshal(b, &out); err != nil {
		return nil
	}
	return models.JSONB(out)
}
