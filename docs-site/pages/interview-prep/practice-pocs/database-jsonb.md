# POC #19: JSONB in PostgreSQL - Flexible Schema at Scale

## What You'll Build

**JSONB for schema flexibility** without sacrificing performance:
- ✅ **JSONB vs JSON** - Binary format for speed
- ✅ **GIN indexes** - Index JSON fields for fast queries
- ✅ **JSON operators** - Query nested data efficiently
- ✅ **Partial updates** - Modify nested fields
- ✅ **Real examples** - User preferences, product attributes

**Time**: 20 min | **Difficulty**: ⭐⭐ Intermediate

---

## Why This Matters

| Company | Use Case | JSONB Strategy |
|---------|----------|----------------|
| **Stripe** | Event metadata | JSONB with GIN indexes |
| **Uber** | Trip details | JSONB for flexible attributes |
| **Shopify** | Product metafields | JSONB for merchant customization |
| **Notion** | Page properties | JSONB for dynamic schemas |
| **Segment** | Event properties | JSONB for analytics |

---

## JSON vs JSONB

| Feature | JSON | JSONB |
|---------|------|-------|
| **Storage** | Text | Binary |
| **Write speed** | Fast | Slower (parse overhead) |
| **Read speed** | Slow | **Fast** (no parsing) |
| **Indexing** | No | **Yes** (GIN, B-Tree) |
| **Operators** | Basic | **Rich** (?, @>, etc.) |
| **Use case** | Logs | **Queryable data** |

**Rule**: Always use JSONB, never JSON!

---

## Quick Examples

### Schema

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  price DECIMAL(10,2),
  attributes JSONB,  -- Flexible product attributes
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

-- Sample data
INSERT INTO products (name, price, attributes) VALUES
('iPhone 15', 999.99, '{"color": "black", "storage": "128GB", "features": ["5G", "Face ID"]}'),
('MacBook Pro', 2499.99, '{"screen": "14-inch", "cpu": "M3 Pro", "ram": "16GB"}'),
('AirPods', 199.99, '{"color": "white", "noise_cancellation": true}');
```

### Querying JSONB

```sql
-- Get specific field
SELECT name, attributes->>'color' AS color FROM products;

-- Filter by JSONB field
SELECT * FROM products WHERE attributes->>'color' = 'black';

-- Check if key exists
SELECT * FROM products WHERE attributes ? 'storage';

-- Contains check
SELECT * FROM products WHERE attributes @> '{"color": "black"}';

-- Array contains
SELECT * FROM products WHERE attributes->'features' ? '5G';

-- Nested access
SELECT name, attributes#>>'{cpu}' AS processor FROM products;
```

---

## Use Cases

### 1. User Preferences

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  preferences JSONB DEFAULT '{}'::jsonb
);

-- Update nested preference
UPDATE users
SET preferences = jsonb_set(preferences, '{notifications,email}', 'true')
WHERE id = 1;

-- Merge preferences
UPDATE users
SET preferences = preferences || '{"theme": "dark", "language": "en"}'::jsonb
WHERE id = 1;

-- Query users with specific preference
SELECT * FROM users WHERE preferences->>'theme' = 'dark';
```

### 2. Product Catalog (E-commerce)

```sql
-- Electronics have different attributes than clothing
INSERT INTO products (name, category, attributes) VALUES
('Laptop', 'electronics', '{"cpu": "i7", "ram": "16GB", "ports": ["USB-C", "HDMI"]}'),
('T-Shirt', 'clothing', '{"size": "M", "material": "cotton", "colors": ["red", "blue"]}');

-- Search laptops with i7 CPU
SELECT * FROM products
WHERE category = 'electronics'
  AND attributes->>'cpu' = 'i7';

-- Search shirts available in red
SELECT * FROM products
WHERE category = 'clothing'
  AND attributes->'colors' ? 'red';
```

### 3. Event Logging

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50),
  user_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_metadata ON events USING GIN (metadata);

-- Insert various events
INSERT INTO events (event_type, user_id, metadata) VALUES
('page_view', 123, '{"page": "/products", "referrer": "google", "device": "mobile"}'),
('purchase', 123, '{"product_id": 456, "amount": 99.99, "payment_method": "credit_card"}'),
('signup', 789, '{"source": "facebook", "plan": "premium"}');

-- Analytics: Count page views by device
SELECT
  metadata->>'device' AS device,
  COUNT(*) AS views
FROM events
WHERE event_type = 'page_view'
GROUP BY metadata->>'device';
```

---

## Performance with GIN Index

### Without Index

```sql
EXPLAIN ANALYZE
SELECT * FROM products WHERE attributes->>'color' = 'black';

-- Seq Scan on products (cost=0.00..25.00 rows=1 width=128) (time=12.5ms)
--   Filter: ((attributes ->> 'color') = 'black')
```

### With GIN Index

```sql
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);

EXPLAIN ANALYZE
SELECT * FROM products WHERE attributes @> '{"color": "black"}';

-- Bitmap Index Scan on idx_products_attributes (cost=4.00..8.00 rows=1 width=128) (time=0.8ms)
--   Index Cond: (attributes @> '{"color": "black"}'::jsonb)
```

**15x faster!**

---

## JSONB Functions

```sql
-- Extract field
SELECT attributes->>'color' FROM products;

-- Extract nested field
SELECT attributes#>>'{cpu, cores}' FROM products;

-- Get array element
SELECT attributes->'features'->0 FROM products;

-- Check existence
SELECT * FROM products WHERE attributes ? 'storage';

-- Contains
SELECT * FROM products WHERE attributes @> '{"color": "black"}';

-- Merge JSON
UPDATE products
SET attributes = attributes || '{"warranty": "2 years"}'::jsonb;

-- Set nested value
UPDATE products
SET attributes = jsonb_set(attributes, '{cpu, cores}', '8');

-- Remove key
UPDATE products
SET attributes = attributes - 'old_field';

-- Get all keys
SELECT jsonb_object_keys(attributes) FROM products;
```

---

## When to Use JSONB

✅ **Good use cases**:
- User preferences/settings
- Product attributes (vary by category)
- Event metadata
- API responses (store and query)
- A/B test configurations

❌ **Bad use cases**:
- Frequently queried core data (use columns)
- Data with fixed schema
- Data requiring complex joins
- Large binary blobs (use bytea)

---

## Performance Tips

1. **Use GIN indexes** for JSONB queries
2. **Extract hot fields** to columns for better performance
3. **Limit JSONB size** (<10KB per row)
4. **Use containment operators** (@>) instead of equality (->>')
5. **Don't store everything in JSONB** - hybrid is best

---

## Hybrid Approach (Best Practice)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),           -- Frequently queried → column
  name VARCHAR(100),            -- Frequently queried → column
  preferences JSONB,            -- Rarely queried, flexible → JSONB
  metadata JSONB                -- Analytics only → JSONB
);

-- Fast queries on columns
SELECT * FROM users WHERE email = 'user@example.com';

-- Flexible queries on JSONB
SELECT * FROM users WHERE preferences->>'theme' = 'dark';
```

---

## Key Takeaways

1. **Always JSONB, never JSON** - Binary format is faster
2. **GIN indexes are essential** - Without them, JSONB queries are slow
3. **Use containment operators** - @> is faster than ->>
4. **Hybrid schema** - Columns for hot data, JSONB for flexible data
5. **Limit JSONB size** - Keep under 10KB for best performance

---

## Related POCs

- **POC #12: Indexes** - GIN indexes for JSONB
- **POC #14: EXPLAIN** - Analyze JSONB query performance
- **POC #11: CRUD** - Foundation

---

**Production examples**:
- **Stripe**: Event metadata in JSONB (millions/day)
- **Uber**: Trip details with flexible attributes
- **Shopify**: Product metafields for merchants
- **Notion**: Page properties with dynamic schemas

**Remember**: JSONB gives NoSQL flexibility with SQL guarantees!
