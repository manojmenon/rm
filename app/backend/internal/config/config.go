// Package config loads application configuration from environment variables.
// All env vars and defaults are documented below and in .env.example.
//
// Environment variables (backend):
//
//	PORT                    — HTTP listen port (default: 8080)
//	DB_HOST                 — PostgreSQL host (default: localhost)
//	DB_PORT                 — PostgreSQL port (default: 5432)
//	DB_USER                 — PostgreSQL user (default: postgres)
//	DB_PASSWORD             — PostgreSQL password (default: postgres)
//	DB_NAME                 — PostgreSQL database name (default: roadmap)
//	DB_SSLMODE              — PostgreSQL sslmode (default: disable)
//	JWT_SECRET               — JWT signing secret; must be set in production (default: change-me-in-production)
//	JWT_ACCESS_EXPIRY_MIN   — Access token expiry in minutes (default: 60)
//	JWT_REFRESH_EXPIRY_MIN  — Refresh token expiry in minutes (default: 10080)
//	LOG_LEVEL               — Log level: debug|info|warn|error (default: info)
//	LOG_FORMAT              — Log format: console|json (default: json)
//	OTEL_EXPORTER_OTLP_ENDPOINT — OpenTelemetry OTLP endpoint; empty = disabled (default: "")
package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server   Server
	Database Database
	JWT      JWT
	Log      Log
	Otel     Otel
}

type Server struct {
	Port string // PORT
}

type Database struct {
	Host     string // DB_HOST
	Port     string // DB_PORT
	User     string // DB_USER
	Password string // DB_PASSWORD
	DBName   string // DB_NAME
	SSLMode  string // DB_SSLMODE
}

type JWT struct {
	Secret           string // JWT_SECRET
	AccessExpiryMin  int    // JWT_ACCESS_EXPIRY_MIN (minutes)
	RefreshExpiryMin int    // JWT_REFRESH_EXPIRY_MIN (minutes)
}

// Log controls backend logging (internal/logger).
type Log struct {
	Level  string // LOG_LEVEL: debug | info | warn | error
	Format string // LOG_FORMAT: console | json
}

// Otel controls OpenTelemetry trace export.
type Otel struct {
	ExporterOtlpEndpoint string // OTEL_EXPORTER_OTLP_ENDPOINT; empty = disabled
}

func Load() *Config {
	return &Config{
		Server: Server{
			Port: getEnv("PORT", "8080"),
		},
		Database: Database{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			DBName:   getEnv("DB_NAME", "roadmap"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		JWT: JWT{
			Secret:           getEnv("JWT_SECRET", "change-me-in-production"),
			AccessExpiryMin:  getEnvInt("JWT_ACCESS_EXPIRY_MIN", 60),
			RefreshExpiryMin: getEnvInt("JWT_REFRESH_EXPIRY_MIN", 10080), // 7 days
		},
		Log: Log{
			Level:  getEnv("LOG_LEVEL", "info"),
			Format: getEnv("LOG_FORMAT", "json"),
		},
		Otel: Otel{
			ExporterOtlpEndpoint: getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
		},
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}
