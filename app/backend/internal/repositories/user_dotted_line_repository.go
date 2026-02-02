package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/backend/internal/models"
	"gorm.io/gorm"
)

type UserDottedLineRepository interface {
	Create(ud *models.UserDottedLineManager) error
	ListByUserID(userID uuid.UUID) ([]models.UserDottedLineManager, error)
	Delete(userID, managerID uuid.UUID) error
	Exists(userID, managerID uuid.UUID) (bool, error)
}

type userDottedLineRepository struct {
	db *gorm.DB
}

func NewUserDottedLineRepository(db *gorm.DB) UserDottedLineRepository {
	return &userDottedLineRepository{db: db}
}

func (r *userDottedLineRepository) Create(ud *models.UserDottedLineManager) error {
	return r.db.Create(ud).Error
}

func (r *userDottedLineRepository) ListByUserID(userID uuid.UUID) ([]models.UserDottedLineManager, error) {
	var list []models.UserDottedLineManager
	err := r.db.Preload("Manager").Where("user_id = ?", userID).Find(&list).Error
	return list, err
}

func (r *userDottedLineRepository) Delete(userID, managerID uuid.UUID) error {
	return r.db.Where("user_id = ? AND manager_id = ?", userID, managerID).
		Delete(&models.UserDottedLineManager{}).Error
}

func (r *userDottedLineRepository) Exists(userID, managerID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.UserDottedLineManager{}).
		Where("user_id = ? AND manager_id = ?", userID, managerID).Count(&count).Error
	return count > 0, err
}
