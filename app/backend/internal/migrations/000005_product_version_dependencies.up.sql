-- Product version dependencies: a version can depend on another product (and optional version) having a required status
CREATE TABLE IF NOT EXISTS product_version_dependencies (
    id UUID PRIMARY KEY,
    source_product_version_id UUID NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
    target_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    target_product_version_id UUID REFERENCES product_versions(id) ON DELETE SET NULL,
    required_status VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_product_version_deps_source ON product_version_dependencies(source_product_version_id);
CREATE INDEX idx_product_version_deps_target ON product_version_dependencies(target_product_id);
CREATE INDEX idx_product_version_deps_deleted_at ON product_version_dependencies(deleted_at);
