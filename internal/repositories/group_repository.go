package repositories

import (
	"github.com/google/uuid"
	"github.com/rm/roadmap/internal/models"
	"gorm.io/gorm"
)

type GroupRepository interface {
	Create(group *models.Group) error
	GetByID(id uuid.UUID) (*models.Group, error)
	List(createdBy *uuid.UUID) ([]models.Group, error)
	Update(group *models.Group) error
	Delete(id uuid.UUID) error
	GetProductIDs(groupID uuid.UUID) ([]uuid.UUID, error)
	GetAllProductIDsInAnyGroup() ([]uuid.UUID, error)
	SetProducts(groupID uuid.UUID, productIDs []uuid.UUID) error
}

type groupRepository struct {
	db *gorm.DB
}

func NewGroupRepository(db *gorm.DB) GroupRepository {
	return &groupRepository{db: db}
}

func (r *groupRepository) Create(group *models.Group) error {
	return r.db.Create(group).Error
}

func (r *groupRepository) GetByID(id uuid.UUID) (*models.Group, error) {
	var g models.Group
	if err := r.db.Preload("Products").First(&g, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *groupRepository) List(createdBy *uuid.UUID) ([]models.Group, error) {
	var list []models.Group
	q := r.db.Preload("Products").Order("name ASC")
	if createdBy != nil {
		q = q.Where("created_by = ?", *createdBy)
	}
	err := q.Find(&list).Error
	return list, err
}

func (r *groupRepository) Update(group *models.Group) error {
	return r.db.Save(group).Error
}

func (r *groupRepository) Delete(id uuid.UUID) error {
	if err := r.db.Exec("DELETE FROM group_products WHERE group_id = ?", id).Error; err != nil {
		return err
	}
	return r.db.Delete(&models.Group{}, "id = ?", id).Error
}

func (r *groupRepository) GetProductIDs(groupID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.Table("group_products").Where("group_id = ?", groupID).Pluck("product_id", &ids).Error
	return ids, err
}

func (r *groupRepository) GetAllProductIDsInAnyGroup() ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.Table("group_products").Distinct("product_id").Pluck("product_id", &ids).Error
	return ids, err
}

func (r *groupRepository) SetProducts(groupID uuid.UUID, productIDs []uuid.UUID) error {
	if err := r.db.Exec("DELETE FROM group_products WHERE group_id = ?", groupID).Error; err != nil {
		return err
	}
	if len(productIDs) == 0 {
		return nil
	}
	for _, pid := range productIDs {
		if err := r.db.Exec("INSERT INTO group_products (group_id, product_id) VALUES (?, ?)", groupID, pid).Error; err != nil {
			return err
		}
	}
	return nil
}
