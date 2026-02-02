package main

import (
	"fmt"
	"log"
	"time"

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
	var db *gorm.DB
	var err error
	for i := 0; i < 15; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("seed db connect retry %d: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)

	seedUser := func(name, email string, u *models.User) {
		_, err := userRepo.GetByEmail(email)
		if err == nil {
			log.Printf("%s already exists: %s", name, email)
			return
		}
		if err := userRepo.Create(u); err != nil {
			log.Printf("failed to create %s: %v", name, err)
			return
		}
		log.Printf("created %s: %s", name, email)
	}

	seedUser("superadmin", "superadmin@example.com", &models.User{
		Name:         "Superadmin",
		Email:        "superadmin@example.com",
		PasswordHash: string(hash),
		Role:         models.RoleSuperadmin,
	})
	seedUser("admin", "admin@example.com", &models.User{
		Name:         "Admin",
		Email:        "admin@example.com",
		PasswordHash: string(hash),
		Role:         models.RoleAdmin,
	})
	seedUser("owner", "owner@example.com", &models.User{
		Name:         "Product Owner",
		Email:        "owner@example.com",
		PasswordHash: string(hash),
		Role:         models.RoleOwner,
	})

	log.Println("seed done")
}
