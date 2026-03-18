-- Schema for Hot Storage (Primary Database)
-- This runs automatically when postgres-hot container starts

-- Active orders table (optimized for writes)
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for active queries
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Archive tracking metadata (lives in hot DB for fast lookups)
CREATE TABLE IF NOT EXISTS archive_tracking (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id BIGINT NOT NULL,
    storage_tier VARCHAR(20) NOT NULL DEFAULT 'hot',
    archived_at TIMESTAMP,
    archive_location TEXT,
    UNIQUE(table_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_lookup ON archive_tracking(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_tracking_tier ON archive_tracking(storage_tier);

-- Archival job history
CREATE TABLE IF NOT EXISTS archive_jobs (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    records_archived INTEGER NOT NULL DEFAULT 0,
    bytes_archived BIGINT DEFAULT 0,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    error_message TEXT
);

-- Helper function: Get storage tier stats
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
    tier VARCHAR,
    record_count BIGINT,
    oldest_record TIMESTAMP,
    newest_record TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'hot'::VARCHAR, COUNT(*), MIN(created_at), MAX(created_at)
    FROM orders

    UNION ALL

    SELECT storage_tier, COUNT(*), MIN(archived_at), MAX(archived_at)
    FROM archive_tracking
    WHERE storage_tier != 'hot'
    GROUP BY storage_tier;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
    table_name TEXT,
    row_estimate BIGINT,
    total_size TEXT,
    index_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tablename::TEXT,
        c.reltuples::BIGINT,
        pg_size_pretty(pg_total_relation_size(t.tablename::regclass)),
        pg_size_pretty(pg_indexes_size(t.tablename::regclass))
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
      AND t.tablename IN ('orders', 'archive_tracking', 'archive_jobs')
    ORDER BY pg_total_relation_size(t.tablename::regclass) DESC;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Hot storage schema initialized successfully';
