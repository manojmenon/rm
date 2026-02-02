-- Product lifecycle status
ALTER TABLE products ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Product versions
CREATE TABLE IF NOT EXISTS product_versions (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    version VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_product_versions_product_id ON product_versions(product_id);
CREATE INDEX idx_product_versions_deleted_at ON product_versions(deleted_at);

-- Milestones: optional link to product version
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS product_version_id UUID REFERENCES product_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_product_version_id ON milestones(product_version_id);

-- Product deletion requests
CREATE TABLE IF NOT EXISTS product_deletion_requests (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_product_deletion_requests_product_id ON product_deletion_requests(product_id);
CREATE INDEX idx_product_deletion_requests_status ON product_deletion_requests(status);
CREATE INDEX idx_product_deletion_requests_deleted_at ON product_deletion_requests(deleted_at);
