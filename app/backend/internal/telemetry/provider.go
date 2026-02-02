package telemetry

import (
	"context"
	"net/url"
	"os"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// hostPortFromEndpoint returns "host:port" for WithEndpoint (no scheme/path).
// WithEndpoint expects "example.com:4318"; full URLs like "http://otel-collector:4318" cause invalid URL parse errors.
func hostPortFromEndpoint(endpoint string) string {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return "localhost:4318"
	}
	if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
		u, err := url.Parse(endpoint)
		if err == nil && u.Host != "" {
			return u.Host
		}
	}
	return endpoint
}

func InitTracerProvider(ctx context.Context) (*sdktrace.TracerProvider, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		return sdktrace.NewTracerProvider(), nil
	}
	hostPort := hostPortFromEndpoint(endpoint)
	// Unset so the SDK does not use the full URL when building export request URLs (it can misparse "http://host:port").
	// WithEndpoint(hostPort) expects "host:port" only.
	os.Unsetenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	os.Unsetenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(hostPort),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes("", attribute.String("service.name", "roadmap-service"))),
	)
	otel.SetTracerProvider(tp)
	return tp, nil
}
