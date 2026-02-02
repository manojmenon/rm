package middleware

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const tracerName = "github.com/rm/roadmap"

func Telemetry() gin.HandlerFunc {
	tracer := otel.Tracer(tracerName)
	return func(c *gin.Context) {
		ctx, span := tracer.Start(c.Request.Context(), c.FullPath(),
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.url", c.Request.URL.Path),
			),
		)
		defer span.End()
		c.Request = c.Request.WithContext(ctx)
		if span.SpanContext().HasTraceID() {
			c.Set(TraceIDKey, span.SpanContext().TraceID().String())
		}
		c.Next()
		if c.Writer.Status() >= 400 {
			span.SetStatus(codes.Error, "request failed")
			span.SetAttributes(attribute.Int("http.status_code", c.Writer.Status()))
		}
	}
}
