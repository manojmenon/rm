-- users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    description TEXT,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'approved',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_products_owner_id ON products(owner_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);

-- milestones
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type VARCHAR(50),
    color VARCHAR(50),
    extra JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_milestones_product_id ON milestones(product_id);
CREATE INDEX idx_milestones_start_date ON milestones(start_date);
CREATE INDEX idx_milestones_end_date ON milestones(end_date);
CREATE INDEX idx_milestones_deleted_at ON milestones(deleted_at);

-- dependencies
CREATE TABLE IF NOT EXISTS dependencies (
    id UUID PRIMARY KEY,
    source_milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    target_milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    type VARCHAR(5) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_dep_type CHECK (type IN ('FS', 'SS', 'FF'))
);
CREATE INDEX idx_dependencies_source ON dependencies(source_milestone_id);
CREATE INDEX idx_dependencies_target ON dependencies(target_milestone_id);
CREATE INDEX idx_dependencies_deleted_at ON dependencies(deleted_at);

-- product_requests
CREATE TABLE IF NOT EXISTS product_requests (
    id UUID PRIMARY KEY,
    requested_by UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_product_requests_requested_by ON product_requests(requested_by);
CREATE INDEX idx_product_requests_status ON product_requests(status);
CREATE INDEX idx_product_requests_deleted_at ON product_requests(deleted_at);
