-- Seed test data spanning 2 years
-- Creates ~100K orders for testing

DO $$
DECLARE
    batch_size INTEGER := 10000;
    total_records INTEGER := 100000;
    i INTEGER;
BEGIN
    RAISE NOTICE 'Seeding % orders...', total_records;

    FOR i IN 1..total_records/batch_size LOOP
        INSERT INTO orders (user_id, product_id, quantity, total_amount, status, created_at, updated_at)
        SELECT
            (random() * 1000)::BIGINT + 1 as user_id,
            (random() * 500)::BIGINT + 1 as product_id,
            (random() * 5)::INTEGER + 1 as quantity,
            (random() * 500 + 10)::DECIMAL(10,2) as total_amount,
            CASE (random() * 4)::INTEGER
                WHEN 0 THEN 'pending'
                WHEN 1 THEN 'processing'
                WHEN 2 THEN 'shipped'
                WHEN 3 THEN 'delivered'
                ELSE 'cancelled'
            END as status,
            -- Distribute across 2 years with more recent data
            NOW() - (
                CASE
                    WHEN random() < 0.3 THEN (random() * 90)::INTEGER  -- 30% in last 90 days
                    WHEN random() < 0.6 THEN (random() * 365)::INTEGER -- 30% in last year
                    ELSE (random() * 730)::INTEGER                      -- 40% older
                END
            ) * INTERVAL '1 day' as created_at,
            NOW() as updated_at
        FROM generate_series(1, batch_size);

        RAISE NOTICE 'Inserted batch %/%', i, total_records/batch_size;
    END LOOP;

    -- Update statistics
    ANALYZE orders;

    RAISE NOTICE 'Seed data complete!';
END $$;

-- Show distribution
SELECT
    CASE
        WHEN created_at > NOW() - INTERVAL '90 days' THEN '1. Hot (< 90 days)'
        WHEN created_at > NOW() - INTERVAL '365 days' THEN '2. Warm (90-365 days)'
        ELSE '3. Cold (> 1 year)'
    END as tier,
    COUNT(*) as order_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM orders
GROUP BY 1
ORDER BY 1;
