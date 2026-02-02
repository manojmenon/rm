package repositories

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

var ErrManagerHierarchyTooDeep = errors.New("manager hierarchy exceeds maximum depth")
var ErrManagerCycle = errors.New("manager hierarchy contains a cycle")

const MaxManagerHierarchyDepth = 16

type UserRepository interface {
	Create(user *models.User) error
	GetByID(id uuid.UUID) (*models.User, error)
	GetByEmail(email string) (*models.User, error)
	List(teamID, directManagerID *uuid.UUID) ([]models.User, error)
	ListByRole(role models.Role) ([]models.User, error)
	Update(user *models.User) error
	ManagerChainDepth(userID uuid.UUID) (int, error)
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *userRepository) GetByID(id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.db.Preload("Team").Preload("DirectManager").First(&u, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) GetByEmail(email string) (*models.User, error) {
	var u models.User
	err := r.db.First(&u, "email = ?", email).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepository) List(teamID, directManagerID *uuid.UUID) ([]models.User, error) {
	var users []models.User
	q := r.db.Order("name")
	if teamID != nil {
		q = q.Where("team_id = ?", *teamID)
	}
	if directManagerID != nil {
		q = q.Where("direct_manager_id = ?", *directManagerID)
	}
	err := q.Find(&users).Error
	return users, err
}

func (r *userRepository) ListByRole(role models.Role) ([]models.User, error) {
	var users []models.User
	err := r.db.Where("role = ?", role).Order("name").Find(&users).Error
	return users, err
}

func (r *userRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

// ManagerChainDepth returns the number of steps from user up the direct_manager chain (0 = no manager).
func (r *userRepository) ManagerChainDepth(userID uuid.UUID) (int, error) {
	seen := make(map[uuid.UUID]bool)
	depth := 0
	current := userID
	for depth <= MaxManagerHierarchyDepth {
		var u models.User
		if err := r.db.Select("direct_manager_id").First(&u, "id = ?", current).Error; err != nil {
			return 0, err
		}
		if u.DirectManagerID == nil {
			return depth, nil
		}
		if seen[*u.DirectManagerID] {
			return 0, ErrManagerCycle
		}
		seen[*u.DirectManagerID] = true
		current = *u.DirectManagerID
		depth++
	}
	return 0, fmt.Errorf("%w (max %d)", ErrManagerHierarchyTooDeep, MaxManagerHierarchyDepth)
}
