package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/dto"
)

func GetAuditMeta(c *gin.Context) dto.AuditMeta {
	meta := dto.AuditMeta{
		IP:       getString(c, AuditIPKey),
		UserAgent: getString(c, AuditUserAgentKey),
		TraceID:   getString(c, TraceIDKey),
	}
	if uid, ok := c.Get(UserIDKey); ok && uid != nil {
		if id, err := uuid.Parse(uid.(string)); err == nil {
			meta.UserID = &id
		}
	}
	return meta
}

func getString(c *gin.Context, key string) string {
	if v, ok := c.Get(key); ok && v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
