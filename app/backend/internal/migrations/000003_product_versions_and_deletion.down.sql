DROP TABLE IF EXISTS product_deletion_requests;
ALTER TABLE milestones DROP COLUMN IF EXISTS product_version_id;
DROP TABLE IF EXISTS product_versions;
ALTER TABLE products DROP COLUMN IF EXISTS lifecycle_status;
