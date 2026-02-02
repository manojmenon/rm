package dto

// HoldingCompany
type HoldingCompanyResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	CreatedAt   string  `json:"created_at"`
}
type HoldingCompanyCreateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}
type HoldingCompanyUpdateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

// Company
type CompanyResponse struct {
	ID               string `json:"id"`
	HoldingCompanyID string `json:"holding_company_id"`
	Name             string `json:"name"`
	CreatedAt        string `json:"created_at"`
}
type CompanyCreateRequest struct {
	HoldingCompanyID string `json:"holding_company_id" binding:"required"`
	Name             string `json:"name" binding:"required"`
}
type CompanyUpdateRequest struct {
	HoldingCompanyID *string `json:"holding_company_id"`
	Name             *string `json:"name"`
}

// Function
type FunctionResponse struct {
	ID        string `json:"id"`
	CompanyID string `json:"company_id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}
type FunctionCreateRequest struct {
	CompanyID string `json:"company_id" binding:"required"`
	Name      string `json:"name" binding:"required"`
}
type FunctionUpdateRequest struct {
	CompanyID *string `json:"company_id"`
	Name      *string `json:"name"`
}

// Department
type DepartmentResponse struct {
	ID         string `json:"id"`
	FunctionID string `json:"function_id"`
	Name       string `json:"name"`
	CreatedAt  string `json:"created_at"`
}
type DepartmentCreateRequest struct {
	FunctionID string `json:"function_id" binding:"required"`
	Name       string `json:"name" binding:"required"`
}
type DepartmentUpdateRequest struct {
	FunctionID *string `json:"function_id"`
	Name       *string `json:"name"`
}

// Team
type TeamResponse struct {
	ID           string  `json:"id"`
	DepartmentID string  `json:"department_id"`
	Name         string  `json:"name"`
	ManagerID    *string `json:"manager_id,omitempty"`
	CreatedAt    string  `json:"created_at"`
}
type TeamCreateRequest struct {
	DepartmentID string  `json:"department_id" binding:"required"`
	Name         string  `json:"name" binding:"required"`
	ManagerID    *string `json:"manager_id"`
}
type TeamUpdateRequest struct {
	DepartmentID *string `json:"department_id"`
	Name         *string `json:"name"`
	ManagerID    *string `json:"manager_id"`
}
