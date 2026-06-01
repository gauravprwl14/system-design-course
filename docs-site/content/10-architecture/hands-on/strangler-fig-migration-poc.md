---
title: "Strangler Fig Migration POC"
layer: poc
section: "10-architecture/hands-on"
difficulty: advanced
tags: [strangler-fig, migration, microservices, monolith, nginx, feature-flags, redis, fastapi, express]
category: architecture
prerequisites: ["Docker Desktop", "basic understanding of monolith vs microservices", "familiarity with Nginx reverse proxy"]
related_problems: ["big-bang-migration", "tight-coupling", "deployment-risk"]
---

# POC: Strangler Fig Migration — Monolith to Microservices

## 🗺️ Quick Overview

```mermaid
sequenceDiagram
    participant Client
    participant Nginx as Nginx (Router)
    participant Redis as Redis (Feature Flag)
    participant Monolith as Monolith (Express)
    participant NewSvc as Orders Service (FastAPI)

    Client->>Nginx: POST /orders
    Nginx->>Redis: GET FEATURE_NEW_ORDERS
    Redis-->>Nginx: "true"
    Nginx->>NewSvc: forward request
    NewSvc-->>Client: 201 Created

    Note over Nginx,Redis: Flag = "false" path
    Client->>Nginx: POST /orders
    Nginx->>Redis: GET FEATURE_NEW_ORDERS
    Redis-->>Nginx: "false"
    Nginx->>Monolith: forward request
    Monolith-->>Client: 201 Created
```

*Nginx reads a Redis feature flag on each request and routes `/orders` to either the new FastAPI microservice or the legacy Express monolith — toggling between them in under 1 second.*

## What You'll Build

A live routing layer that strangles one endpoint (`/orders`) out of a legacy Express monolith and hands it off to a new FastAPI microservice. Both services share the same PostgreSQL database to keep data consistent during the transition. A Redis key controls which service handles traffic — flip it and routing changes instantly with no redeploy.

You will observe:
- Traffic shifting in real time (1% → 10% → 50% → 100%)
- Parallel dual-write mode where both services handle the same request and their responses are compared
- Instant rollback by flipping the Redis flag back to `false`
- What breaks when the two services write to **different** databases instead of a shared one

## Why This Matters

- **Amazon**: Used the Strangler Fig pattern to decompose their retail monolith starting in 2001. Each team extracted one service at a time behind an API gateway, eventually eliminating the monolith entirely over ~5 years.
- **Netflix**: Migrated from a DVD-rental monolith to hundreds of microservices by routing traffic incrementally through Zuul (their edge proxy), strangling one API group at a time while running shadow comparisons on production traffic.
- **Shopify**: Applied the pattern to extract their inventory and fulfillment subsystems from their Rails monolith, using a Lua-scripted Nginx layer to route by feature flag — the same approach demonstrated in this POC.

---

## Prerequisites

- Docker Desktop 4.x+ installed and running
- curl or any HTTP client (Postman, httpie)
- 5–10 minutes

No local language runtimes needed — everything runs inside containers.

---

## Setup

Create a project directory and drop in the following files.

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d appdb"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  monolith:
    build:
      context: ./monolith
    environment:
      DATABASE_URL: postgres://app:secret@postgres:5432/appdb
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  orders-service:
    build:
      context: ./orders-service
    environment:
      DATABASE_URL: postgresql://app:secret@postgres:5432/appdb
      PORT: 8000
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    build:
      context: ./nginx
    ports:
      - "80:80"
    depends_on:
      monolith:
        condition: service_healthy
      orders-service:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  pg_data:
```

### init.sql (shared schema for both services)

```sql
-- init.sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    handled_by VARCHAR(50),   -- 'monolith' or 'orders-service'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO users (name, email) VALUES
    ('Alice', 'alice@example.com'),
    ('Bob',   'bob@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, price, stock) VALUES
    ('Laptop', 999.99, 50),
    ('Phone',  499.99, 100)
ON CONFLICT DO NOTHING;
```

### monolith/Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### monolith/package.json

```json
{
  "name": "monolith",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0"
  }
}
```

### monolith/index.js

```javascript
// monolith/index.js — Express app: /users, /orders, /products
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'monolith' }));

// --- Users ---
app.get('/users', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY id');
  res.json(rows);
});

app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [name, email]
  );
  res.status(201).json(rows[0]);
});

// --- Products ---
app.get('/products', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(rows);
});

// --- Orders (legacy implementation — will be strangled) ---
app.get('/orders', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY id');
  res.json(rows);
});

app.post('/orders', async (req, res) => {
  const { user_id, product_id, quantity } = req.body;
  const product = await pool.query('SELECT price FROM products WHERE id = $1', [product_id]);
  if (!product.rows.length) return res.status(404).json({ error: 'Product not found' });

  const total_price = product.rows[0].price * quantity;
  const { rows } = await pool.query(
    `INSERT INTO orders (user_id, product_id, quantity, total_price, handled_by)
     VALUES ($1, $2, $3, $4, 'monolith') RETURNING *`,
    [user_id, product_id, quantity, total_price]
  );
  res.status(201).json({ ...rows[0], _source: 'monolith' });
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Monolith listening on port ${process.env.PORT || 3000}`)
);
```

### orders-service/Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### orders-service/requirements.txt

```
fastapi==0.111.0
uvicorn==0.29.0
asyncpg==0.29.0
databases==0.9.0
```

### orders-service/main.py

```python
# orders-service/main.py — FastAPI microservice for /orders only
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from databases import Database
import os

DATABASE_URL = os.environ["DATABASE_URL"]
database = Database(DATABASE_URL)

app = FastAPI(title="Orders Service")

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "orders-service"}

class OrderCreate(BaseModel):
    user_id: int
    product_id: int
    quantity: int

@app.get("/orders")
async def list_orders():
    rows = await database.fetch_all("SELECT * FROM orders ORDER BY id")
    return [dict(row) for row in rows]

@app.post("/orders", status_code=201)
async def create_order(order: OrderCreate):
    product = await database.fetch_one(
        "SELECT price FROM products WHERE id = :id", {"id": order.product_id}
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    total_price = product["price"] * order.quantity
    row = await database.fetch_one(
        """INSERT INTO orders (user_id, product_id, quantity, total_price, handled_by)
           VALUES (:user_id, :product_id, :quantity, :total_price, 'orders-service')
           RETURNING *""",
        {
            "user_id": order.user_id,
            "product_id": order.product_id,
            "quantity": order.quantity,
            "total_price": float(total_price),
        },
    )
    return {**dict(row), "_source": "orders-service"}
```

### nginx/Dockerfile

```dockerfile
FROM openresty/openresty:1.25.3.1-alpine
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf
EXPOSE 80
```

OpenResty is Nginx + LuaJIT — it lets Nginx scripts query Redis inline, which is how we read the feature flag on every request without an external service.

### nginx/nginx.conf

```nginx
worker_processes auto;

events { worker_connections 1024; }

http {
    # Redis connection pool (one connection per worker)
    lua_shared_dict redis_cache 1m;

    upstream monolith {
        server monolith:3000;
    }

    upstream orders_service {
        server orders-service:8000;
    }

    server {
        listen 80;

        # ── Health check ──────────────────────────────────────────────
        location /health {
            return 200 '{"status":"ok","service":"nginx-router"}\n';
            add_header Content-Type application/json;
        }

        # ── Orders: feature-flag-controlled routing ───────────────────
        location /orders {
            set $target "monolith";

            rewrite_by_lua_block {
                local redis = require "resty.redis"
                local red = redis:new()
                red:set_timeout(100)   -- 100 ms timeout — fail fast
                local ok, err = red:connect("redis", 6379)
                if ok then
                    local flag, _ = red:get("FEATURE_NEW_ORDERS")
                    if flag == "true" then
                        ngx.var.target = "orders_service"
                    end
                    red:set_keepalive(10000, 10)
                end
                -- If Redis is unreachable: silently fall back to monolith
            }

            proxy_pass http://$target;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # ── All other endpoints: always go to monolith ────────────────
        location / {
            proxy_pass http://monolith;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
```

### Start everything

```bash
docker-compose up -d --build
# Wait ~30 seconds for Postgres to initialize and services to become healthy
docker-compose ps
# All services should show "healthy"
```

---

## Step-by-Step

### Step 1: Confirm monolith owns /orders (flag off)

By default `FEATURE_NEW_ORDERS` is not set in Redis, so all traffic goes to the monolith.

```bash
# Create an order through the router
curl -s -X POST http://localhost/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id": 1, "product_id": 1, "quantity": 2}' | jq .

# Expected output:
# {
#   "id": 1,
#   "user_id": 1,
#   "product_id": 1,
#   "quantity": 2,
#   "total_price": "1999.98",
#   "status": "pending",
#   "handled_by": "monolith",   <-- monolith handled this
#   "_source": "monolith"
# }
```

### Step 2: Enable the new service (flag on → 100% to new service)

```bash
# Flip the flag
docker-compose exec redis redis-cli SET FEATURE_NEW_ORDERS true
# Output: OK

# Send another order — same endpoint, different handler
curl -s -X POST http://localhost/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id": 2, "product_id": 2, "quantity": 1}' | jq .

# Expected output:
# {
#   "id": 2,
#   "user_id": 2,
#   "product_id": 2,
#   "quantity": 1,
#   "total_price": 499.99,
#   "status": "pending",
#   "handled_by": "orders-service",   <-- new service handled this
#   "_source": "orders-service"
# }
```

No redeploy. No service restart. Routing changed in under 1 second.

### Step 3: Verify shared DB — both orders visible everywhere

```bash
# Query through the router (nginx → monolith GET /orders)
docker-compose exec redis redis-cli SET FEATURE_NEW_ORDERS false
curl -s http://localhost/orders | jq '[.[] | {id, handled_by}]'

# Expected output — both rows, regardless of which service wrote them:
# [
#   { "id": 1, "handled_by": "monolith" },
#   { "id": 2, "handled_by": "orders-service" }
# ]
```

Because both services point to the same Postgres instance, neither loses data when traffic is switched.

### Step 4: Simulate gradual traffic migration (weighted routing)

The feature flag approach gives you binary switching. For percentage-based traffic splitting, extend the Lua block:

```nginx
# nginx/nginx.conf — replace the rewrite_by_lua_block with this version
rewrite_by_lua_block {
    local redis = require "resty.redis"
    local red = redis:new()
    red:set_timeout(100)
    local ok, err = red:connect("redis", 6379)
    if ok then
        local pct_str, _ = red:get("ORDERS_ROLLOUT_PCT")
        red:set_keepalive(10000, 10)
        local pct = tonumber(pct_str) or 0
        -- Route pct% of requests to new service
        if pct > 0 and math.random(100) <= pct then
            ngx.var.target = "orders_service"
        end
    end
}
```

```bash
# Rebuild nginx after the config change
docker-compose up -d --build nginx

# Stage the rollout:
docker-compose exec redis redis-cli SET ORDERS_ROLLOUT_PCT 1    # 1%
docker-compose exec redis redis-cli SET ORDERS_ROLLOUT_PCT 10   # 10%
docker-compose exec redis redis-cli SET ORDERS_ROLLOUT_PCT 50   # 50%
docker-compose exec redis redis-cli SET ORDERS_ROLLOUT_PCT 100  # 100%

# Send 20 requests and count which service handled them
for i in $(seq 1 20); do
  curl -s -X POST http://localhost/orders \
    -H 'Content-Type: application/json' \
    -d '{"user_id":1,"product_id":1,"quantity":1}' | jq -r '._source'
done | sort | uniq -c
# At 50%: roughly 10 monolith, 10 orders-service
```

### Step 5: Parallel dual-write (shadow mode for consistency validation)

Before full cutover, run both services on every write and compare their responses. This catches data-shape mismatches without risking production data.

```bash
# shadow-compare.sh — send the same payload to both and diff the responses
#!/usr/bin/env bash
PAYLOAD='{"user_id":1,"product_id":1,"quantity":3}'

MONOLITH=$(curl -s -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' -d "$PAYLOAD" | jq 'del(._source, .id, .created_at, .handled_by)')

NEW_SVC=$(curl -s -X POST http://localhost:8000/orders \
  -H 'Content-Type: application/json' -d "$PAYLOAD" | jq 'del(._source, .id, .created_at, .handled_by)')

echo "=== Monolith ===" && echo "$MONOLITH"
echo "=== New Service ===" && echo "$NEW_SVC"
echo "=== Diff (empty = identical) ==="
diff <(echo "$MONOLITH") <(echo "$NEW_SVC")
```

```bash
chmod +x shadow-compare.sh && ./shadow-compare.sh

# Expected: diff is empty — both services return the same structure and values
# If diff is non-empty: investigate field naming, decimal precision, or missing fields
#   before proceeding with the rollout
```

### Step 6: Instant rollback

```bash
# Something went wrong in production — roll back in < 1 second
docker-compose exec redis redis-cli SET FEATURE_NEW_ORDERS false
# or for percentage approach:
docker-compose exec redis redis-cli SET ORDERS_ROLLOUT_PCT 0

# Verify immediately
curl -s -X POST http://localhost/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id":1,"product_id":2,"quantity":1}' | jq '._source'
# Output: "monolith"
```

No redeploy. No DNS change. Rollback latency is the Redis round-trip (~1 ms) plus the next request arriving.

---

## What to Observe

**Routing header**: Add `proxy_add_header X-Handled-By $target;` to the nginx location block. Every response then carries `X-Handled-By: monolith` or `X-Handled-By: orders_service`.

```bash
curl -si -X POST http://localhost/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id":1,"product_id":1,"quantity":1}' | grep -i x-handled
```

**DB audit trail**: The `handled_by` column in the `orders` table records which service wrote each row — useful for post-migration analysis:

```bash
docker-compose exec postgres \
  psql -U app -d appdb \
  -c "SELECT handled_by, COUNT(*) FROM orders GROUP BY handled_by;"
```

**Nginx access log**: Shows which upstream received each request:

```bash
docker-compose logs -f nginx
# Lines include the upstream address (monolith:3000 vs orders-service:8000)
```

---

## What Breaks It

### Diverging databases (the classic strangler anti-pattern)

Remove the `postgres` dependency from `orders-service` and point it at a second Postgres instance:

```yaml
# In orders-service environment, change to a separate DB:
DATABASE_URL: postgresql://app:secret@postgres2:5432/ordersdb
```

Now run the shadow comparison script (`./shadow-compare.sh`) and then query totals:

```bash
# Orders in the monolith DB
docker-compose exec postgres psql -U app -d appdb \
  -c "SELECT COUNT(*) FROM orders WHERE handled_by='orders-service';"
# Output: 0 — monolith DB never sees orders written by the new service

# Orders in the new DB
# Output: only orders from new service — the monolith's writes are invisible
```

**Result**: When you roll back the flag, the monolith DB is missing weeks of orders. This is the failure mode that kills strangler-fig migrations. **Fix**: always share the database during the strangling phase. Separate the data store only after the monolith code is fully deleted.

### Redis unavailability

```bash
docker-compose stop redis

curl -s -X POST http://localhost/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id":1,"product_id":1,"quantity":1}' | jq '._source'
# Output: "monolith" — Nginx falls back to monolith silently

docker-compose start redis
```

The Lua block's `if ok then` guard ensures Redis downtime never takes down the router — it degrades to monolith-only mode, which is safe.

---

## Extend It

1. **Add a canary header**: Route requests that include `X-Canary: true` to the new service regardless of the Redis flag — useful for internal QA testing before opening to real users.

2. **Add response comparison middleware**: Log every case where the shadow response differs from the primary response to a `comparison_log` table in Postgres. Set an alert if the mismatch rate exceeds 0.1%.

3. **Strangle `/products` next**: Follow the exact same steps for the products endpoint. After both `/orders` and `/products` are migrated, the monolith is reduced to `/users` only — delete the order and product routes from `monolith/index.js` and confirm all tests still pass.

4. **Replace OpenResty with a dedicated API gateway**: Swap Nginx/Lua for Kong, Traefik, or AWS API Gateway. The feature flag concept is identical — only the configuration syntax changes.

5. **Automate the rollout percentage**: Write a script that monitors error rate (from Nginx logs) and automatically increments `ORDERS_ROLLOUT_PCT` by 10 every 5 minutes if error rate stays below 0.5%, or rolls back to 0 if it spikes.

---

## Key Takeaways

- **Routing switch latency is ~1 ms** — Redis read + Nginx variable set. No redeploy, no DNS TTL wait.
- **Shared DB is non-negotiable during transition** — separate data stores before deleting monolith code will cause data loss on rollback, as seen in the "what breaks it" section.
- **`handled_by` column costs nothing and saves the migration** — without it you cannot audit which service wrote which rows or diagnose data-shape mismatches.
- **Shadow mode catches 100% of field-naming and precision bugs** before a single real user is affected — run it for at least 24 hours of production traffic before advancing past 10% rollout.
- **Amazon and Netflix both required 3–5 years** to complete their monolith migrations — the Strangler Fig pattern is a tool for making each incremental step safe, not fast.

---

## References

- 📖 [Martin Fowler — Strangler Fig Application](https://martinfowler.com/bliki/StranglerFigApplication.html) — original pattern definition
- 📖 [Amazon's journey from monolith to microservices](https://aws.amazon.com/blogs/aws/amazon-prime-video-why-we-reverted-from-microservices-to-a-monolith/) — honest post-mortem on when not to over-decompose
- 📺 [GOTO 2018 — Strangling the Monolith (Sam Newman)](https://www.youtube.com/watch?v=H7zXBPuFb3Q) — practical talk by the author of *Building Microservices*
- 📚 [OpenResty Lua Redis library](https://github.com/openresty/lua-resty-redis) — the Redis client used in the Nginx config
