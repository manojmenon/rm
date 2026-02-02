package main

import (
	"fmt"
	"log"

	"github.com/rm/roadmap/internal/config"
	"github.com/rm/roadmap/internal/models"
	"github.com/rm/roadmap/internal/repositories"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host, cfg.Database.Port, cfg.Database.User,
		cfg.Database.Password, cfg.Database.DBName, cfg.Database.SSLMode,
	)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	admin := &models.User{
		Name:         "Admin",
		Email:        "admin@example.com",
		PasswordHash: string(hash),
		Role:         models.RoleAdmin,
	}
	if err := userRepo.Create(admin); err != nil {
		log.Printf("admin user may already exist: %v", err)
	} else {
		log.Printf("created admin: %s", admin.Email)
	}

	owner := &models.User{
		Name:         "Product Owner",
		Email:        "owner@example.com",
		PasswordHash: string(hash),
		Role:         models.RoleOwner,
	}
	if err := userRepo.Create(owner); err != nil {
		log.Printf("owner user may already exist: %v", err)
	} else {
		log.Printf("created owner: %s", owner.Email)
	}

	log.Println("seed done")
}
