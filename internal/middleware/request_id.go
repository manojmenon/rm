package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDKey = "request_id"
const TraceIDKey = "trace_id"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = requestID
		}
		c.Set(RequestIDKey, requestID)
		c.Set(TraceIDKey, traceID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}
