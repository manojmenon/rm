DROP INDEX IF EXISTS idx_audit_logs_archived;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS archived_at;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS archived;
