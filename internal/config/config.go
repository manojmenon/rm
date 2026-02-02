package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server   Server
	Database Database
	JWT      JWT
}

type Server struct {
	Port string
}

type Database struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type JWT struct {
	Secret           string
	AccessExpiryMin  int
	RefreshExpiryMin int
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
