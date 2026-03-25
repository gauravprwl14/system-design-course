-- Schema for Archive Storage (Warm Database)
-- This runs automatically when postgres-archive container starts

-- Archived orders table (optimized for reads, compressed)
CREATE TABLE IF NOT EXISTS orders_archive (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Minimal indexes for historical queries
CREATE INDEX IF NOT EXISTS idx_archive_user_date ON orders_archive(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_created ON orders_archive(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_archived_at ON orders_archive(archived_at DESC);

-- Partition by month for efficient queries (optional, for large datasets)
-- In production, you'd use TimescaleDB or partition by time

-- Helper function: Get archive stats
CREATE OR REPLACE FUNCTION get_archive_stats()
RETURNS TABLE (
    total_records BIGINT,
    oldest_record TIMESTAMP,
    newest_record TIMESTAMP,
    total_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        MIN(created_at),
        MAX(created_at),
        pg_size_pretty(pg_total_relation_size('orders_archive'))
    FROM orders_archive;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Archive storage schema initialized successfully';
