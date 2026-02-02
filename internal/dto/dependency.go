package dto

type DependencyCreateRequest struct {
	SourceMilestoneID string `json:"source_milestone_id" binding:"required"`
	TargetMilestoneID string `json:"target_milestone_id" binding:"required"`
	Type              string `json:"type" binding:"required,oneof=FS SS FF"`
}

type DependencyResponse struct {
	ID                 string `json:"id"`
	SourceMilestoneID  string `json:"source_milestone_id"`
	TargetMilestoneID  string `json:"target_milestone_id"`
	Type               string `json:"type"`
	CreatedAt          string `json:"created_at"`
}
