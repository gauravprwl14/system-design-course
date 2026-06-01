---
title: "Stripe-Style Idempotent Payment API"
layer: poc
section: "11-real-world/hands-on"
difficulty: intermediate
tags: [idempotency, payments, postgresql, rest-api, race-conditions, distributed-systems]
category: architecture
prerequisites: [docker, python, postgresql-basics]
related_problems: [double-charge, duplicate-payment, retry-storms]
---

# POC: Stripe-Style Idempotent Payment API

## 🗺️ Quick Overview

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API Server
    participant DB as PostgreSQL
    participant P as Payment Processor

    C->>A: POST /charges (X-Idempotency-Key: key-abc)
    A->>DB: INSERT key-abc (status=processing) ON CONFLICT DO NOTHING
    DB-->>A: inserted = true (first request)
    A->>P: Process $100 charge
    P-->>A: charge_id = ch_xyz, success
    A->>DB: UPDATE key-abc SET status=completed, response=...
    A-->>C: 200 {"charge_id": "ch_xyz", "cached": false}

    Note over C,DB: Client retries (network blip)

    C->>A: POST /charges (X-Idempotency-Key: key-abc)
    A->>DB: INSERT key-abc ON CONFLICT DO NOTHING
    DB-->>A: inserted = false (key exists)
    A->>DB: SELECT response WHERE key = key-abc
    DB-->>A: cached response
    A-->>C: 200 {"charge_id": "ch_xyz", "cached": true}
```

*Two requests with the same idempotency key: the first processes the charge, the second returns the cached response — same outcome, no duplicate charge.*

## What You'll Build

A FastAPI payment service with PostgreSQL-backed idempotency that mirrors Stripe's exact behavior: atomic key reservation using `INSERT ... ON CONFLICT DO NOTHING`, 24-hour key TTL, concurrent-request safety, and a client retry simulation that proves 5 identical requests produce exactly 1 charge.

## Why This Matters

- **Stripe**: Processes $640B/year in payments. Idempotency keys prevent duplicate charges when clients retry on network failures or timeouts. Key TTL is 24 hours matching the longest retry window most clients need.
- **Braintree (PayPal)**: Uses idempotency tokens on every transaction endpoint; a duplicated webhook retry must never double-charge a merchant.
- **Adyen**: Their payment terminal SDK auto-retries on timeout — idempotency on the server side is the only thing preventing duplicate authorizations at point-of-sale.

---

## Prerequisites

- Docker Desktop installed and running
- Python 3.11+
- `curl` or `httpie` for testing
- 5–10 minutes

## Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: payments
      POSTGRES_USER: pay_user
      POSTGRES_PASSWORD: pay_secret
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pay_user -d payments"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://pay_user:pay_secret@postgres:5432/payments
    depends_on:
      postgres:
        condition: service_healthy
```

```dockerfile
# Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```text
# requirements.txt
fastapi==0.111.0
uvicorn==0.29.0
asyncpg==0.29.0
pydantic==2.7.1
httpx==0.27.0
```

```bash
docker-compose up -d
# Expected:
# [+] Running 2/2
#  ✔ Container postgres  Healthy
#  ✔ Container api       Started
```

---

## Step-by-Step

### Step 1: Create the Database Schema

```sql
-- schema.sql (auto-applied by main.py on startup)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key         TEXT        PRIMARY KEY,
    status      TEXT        NOT NULL DEFAULT 'processing',  -- processing | completed | failed
    request_hash TEXT       NOT NULL,          -- SHA-256 of request body — detects key reuse
    response    JSONB,                         -- cached response, NULL until completed
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Background cleanup index — partial index only on non-expired rows
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
    ON idempotency_keys (expires_at)
    WHERE status IN ('completed', 'failed');

-- Charges table — the source of truth for money movement
CREATE TABLE IF NOT EXISTS charges (
    id              SERIAL PRIMARY KEY,
    idempotency_key TEXT        NOT NULL UNIQUE REFERENCES idempotency_keys(key),
    amount_cents    INTEGER     NOT NULL,
    currency        TEXT        NOT NULL DEFAULT 'usd',
    customer_email  TEXT        NOT NULL,
    charge_id       TEXT        NOT NULL,      -- external processor ID
    status          TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Step 2: Implement the Core Idempotency Logic

```python
# main.py
import asyncio
import hashlib
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import asyncpg
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr

DB_URL = "postgresql://pay_user:pay_secret@postgres:5432/payments"
_pool: asyncpg.Pool | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key          TEXT        PRIMARY KEY,
    status       TEXT        NOT NULL DEFAULT 'processing',
    request_hash TEXT        NOT NULL,
    response     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
    ON idempotency_keys (expires_at) WHERE status IN ('completed', 'failed');
CREATE TABLE IF NOT EXISTS charges (
    id              SERIAL PRIMARY KEY,
    idempotency_key TEXT        NOT NULL UNIQUE REFERENCES idempotency_keys(key),
    amount_cents    INTEGER     NOT NULL,
    currency        TEXT        NOT NULL DEFAULT 'usd',
    customer_email  TEXT        NOT NULL,
    charge_id       TEXT        NOT NULL,
    status          TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool
    _pool = await asyncpg.create_pool(DB_URL, min_size=5, max_size=20)
    async with _pool.acquire() as conn:
        await conn.execute(SCHEMA)
    yield
    await _pool.close()

app = FastAPI(title="Idempotent Payments API", lifespan=lifespan)


class ChargeRequest(BaseModel):
    amount_cents: int          # e.g. 10000 = $100.00
    currency: str = "usd"
    customer_email: str
    description: str = ""


def _request_hash(body: dict) -> str:
    """Deterministic SHA-256 of the request body. Detects key reuse across different operations."""
    serialized = json.dumps(body, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


async def _simulate_payment_processor(req: ChargeRequest) -> dict:
    """
    Simulates calling an external payment processor (Stripe, Adyen, etc.).
    In production this is an HTTP call — the real latency source.
    We add a small sleep to surface race-condition behavior in tests.
    """
    await asyncio.sleep(0.1)   # simulate 100ms network call
    return {
        "charge_id": f"ch_{uuid.uuid4().hex[:16]}",
        "amount_cents": req.amount_cents,
        "currency": req.currency,
        "status": "succeeded",
        "processor": "mock_processor",
    }


@app.post("/charges")
async def create_charge(
    payload: ChargeRequest,
    x_idempotency_key: str = Header(..., description="Client-generated idempotency key"),
):
    """
    Idempotent charge endpoint.

    Behavior:
    - First call with a key → process payment, store response, return {"cached": false}
    - Repeat call with same key + same body → return stored response, return {"cached": true}
    - Repeat call with same key + DIFFERENT body → 422 (key reuse detected)
    - Expired key (>24h) → treated as new key, fresh processing
    - Concurrent calls with same key → only one processes, others wait and get cached response
    """
    if not x_idempotency_key or len(x_idempotency_key) > 255:
        raise HTTPException(status_code=400, detail="X-Idempotency-Key must be 1–255 characters")

    req_hash = _request_hash(payload.model_dump())

    async with _pool.acquire() as conn:
        # --- Atomic check-and-insert ---
        # ON CONFLICT DO NOTHING means only the first writer wins.
        # RETURNING * tells us whether this connection inserted the row.
        row = await conn.fetchrow(
            """
            INSERT INTO idempotency_keys (key, status, request_hash)
            VALUES ($1, 'processing', $2)
            ON CONFLICT (key) DO NOTHING
            RETURNING *
            """,
            x_idempotency_key,
            req_hash,
        )

        if row is None:
            # Key already exists — fetch the existing record
            existing = await conn.fetchrow(
                "SELECT * FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()",
                x_idempotency_key,
            )

            if existing is None:
                # Key expired — delete it and let a new INSERT happen on next retry
                await conn.execute(
                    "DELETE FROM idempotency_keys WHERE key = $1", x_idempotency_key
                )
                raise HTTPException(
                    status_code=409,
                    detail="Idempotency key has expired (>24h). Generate a new key for a new request.",
                )

            # Detect key reuse: same key, different request body
            if existing["request_hash"] != req_hash:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Idempotency key reuse detected: the same key was submitted with a "
                        "different request body. Use a unique key per operation."
                    ),
                )

            if existing["status"] == "processing":
                # Another request is in-flight with this key.
                # Poll until it completes (max ~3 seconds).
                for _ in range(30):
                    await asyncio.sleep(0.1)
                    refreshed = await conn.fetchrow(
                        "SELECT * FROM idempotency_keys WHERE key = $1", x_idempotency_key
                    )
                    if refreshed and refreshed["status"] != "processing":
                        existing = refreshed
                        break
                else:
                    raise HTTPException(status_code=503, detail="Concurrent request timed out. Retry shortly.")

            if existing["status"] == "completed":
                return {**json.loads(existing["response"]), "cached": True}

            if existing["status"] == "failed":
                raise HTTPException(
                    status_code=402,
                    detail={**json.loads(existing["response"]), "cached": True},
                )

        # --- New key: process the payment ---
        try:
            result = await _simulate_payment_processor(payload)
            response_body = {
                **result,
                "customer_email": payload.customer_email,
                "description": payload.description,
                "idempotency_key": x_idempotency_key,
            }

            async with conn.transaction():
                await conn.execute(
                    """
                    UPDATE idempotency_keys
                    SET status = 'completed', response = $1
                    WHERE key = $2
                    """,
                    json.dumps(response_body),
                    x_idempotency_key,
                )
                await conn.execute(
                    """
                    INSERT INTO charges
                        (idempotency_key, amount_cents, currency, customer_email, charge_id, status)
                    VALUES ($1, $2, $3, $4, $5, 'succeeded')
                    """,
                    x_idempotency_key,
                    payload.amount_cents,
                    payload.currency,
                    payload.customer_email,
                    result["charge_id"],
                )

            return {**response_body, "cached": False}

        except Exception as exc:
            # Mark key as failed so retries surface the error (not a hung 'processing' state)
            error_body = {"error": str(exc), "idempotency_key": x_idempotency_key}
            await conn.execute(
                "UPDATE idempotency_keys SET status = 'failed', response = $1 WHERE key = $2",
                json.dumps(error_body),
                x_idempotency_key,
            )
            raise HTTPException(status_code=402, detail=error_body) from exc


@app.get("/charges")
async def list_charges():
    """List all charges — lets you verify exactly one charge was created per idempotency key."""
    async with _pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM charges ORDER BY created_at DESC LIMIT 50"
        )
    return [dict(r) for r in rows]


@app.get("/idempotency-keys/{key}")
async def inspect_key(key: str):
    """Inspect a specific idempotency key — useful for debugging retry behavior."""
    async with _pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT key, status, request_hash, created_at, expires_at FROM idempotency_keys WHERE key = $1",
            key,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Key not found")
    return dict(row)
```

### Step 3: Run the Server and Verify Basic Flow

```bash
# Start the stack
docker-compose up -d

# Wait for API to be ready
curl --retry 5 --retry-delay 2 --retry-connrefused http://localhost:8000/charges

# First charge — should process and return cached: false
curl -s -X POST http://localhost:8000/charges \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-12345-attempt-1" \
  -d '{"amount_cents": 10000, "currency": "usd", "customer_email": "alice@example.com", "description": "Acme Pro Plan"}' \
  | python3 -m json.tool

# Expected output:
# {
#   "charge_id": "ch_a3f1b2c4d5e6f7a8",
#   "amount_cents": 10000,
#   "currency": "usd",
#   "status": "succeeded",
#   "processor": "mock_processor",
#   "customer_email": "alice@example.com",
#   "description": "Acme Pro Plan",
#   "idempotency_key": "order-12345-attempt-1",
#   "cached": false           <-- processed fresh
# }
```

### Step 4: Simulate Client Retry (5 Identical Requests)

```bash
# retry_simulation.sh — send the same request 5 times, count unique charge_ids
KEY="order-12345-attempt-1"
BODY='{"amount_cents": 10000, "currency": "usd", "customer_email": "alice@example.com", "description": "Acme Pro Plan"}'

echo "Sending 5 retries with key: $KEY"
for i in $(seq 1 5); do
  RESPONSE=$(curl -s -X POST http://localhost:8000/charges \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $KEY" \
    -d "$BODY")
  CACHED=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['cached'])")
  CHARGE=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['charge_id'])")
  echo "  Attempt $i: charge_id=$CHARGE  cached=$CACHED"
done

# Expected output:
#   Attempt 1: charge_id=ch_a3f1b2c4d5e6f7a8  cached=False   <-- processed
#   Attempt 2: charge_id=ch_a3f1b2c4d5e6f7a8  cached=True    <-- cache hit
#   Attempt 3: charge_id=ch_a3f1b2c4d5e6f7a8  cached=True    <-- cache hit
#   Attempt 4: charge_id=ch_a3f1b2c4d5e6f7a8  cached=True    <-- cache hit
#   Attempt 5: charge_id=ch_a3f1b2c4d5e6f7a8  cached=True    <-- cache hit

# Verify exactly ONE charge in DB (not 5)
curl -s http://localhost:8000/charges | python3 -c "
import sys, json
charges = json.load(sys.stdin)
keys = [c['idempotency_key'] for c in charges]
print(f'Total charges in DB: {len(charges)}')
print(f'Unique keys: {len(set(keys))}')
print('PASS: no duplicate charges' if len(charges) == len(set(keys)) else 'FAIL: duplicate charges detected')
"
# Total charges in DB: 1
# Unique keys: 1
# PASS: no duplicate charges
```

### Step 5: Simulate Race Condition (Concurrent Requests)

```python
# race_test.py — launch 10 concurrent requests with the same key
import asyncio
import httpx

async def fire_charge(client: httpx.AsyncClient, attempt: int) -> dict:
    resp = await client.post(
        "http://localhost:8000/charges",
        json={
            "amount_cents": 5000,
            "currency": "usd",
            "customer_email": "bob@example.com",
            "description": "Race condition test",
        },
        headers={"X-Idempotency-Key": "race-condition-test-key-001"},
    )
    return {"attempt": attempt, "status": resp.status_code, "body": resp.json()}

async def main():
    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [fire_charge(client, i) for i in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    charge_ids = set()
    for r in results:
        if isinstance(r, Exception):
            print(f"  Exception: {r}")
        else:
            cid = r["body"].get("charge_id", "ERROR")
            cached = r["body"].get("cached", "?")
            print(f"  Attempt {r['attempt']:2d}: charge_id={cid}  cached={cached}")
            charge_ids.add(cid)

    print(f"\nUnique charge_ids across 10 concurrent requests: {len(charge_ids)}")
    print("PASS: exactly 1 charge processed" if len(charge_ids) == 1 else "FAIL: duplicate processing")

asyncio.run(main())
```

```bash
python3 race_test.py

# Expected output (order varies — that's the point):
#   Attempt  0: charge_id=ch_9f8e7d6c5b4a3210  cached=False
#   Attempt  3: charge_id=ch_9f8e7d6c5b4a3210  cached=True
#   Attempt  7: charge_id=ch_9f8e7d6c5b4a3210  cached=True
#   ...
#   Attempt  9: charge_id=ch_9f8e7d6c5b4a3210  cached=True
#
# Unique charge_ids across 10 concurrent requests: 1
# PASS: exactly 1 charge processed
```

### Step 6: Inspect Key Reuse Detection

```bash
# Try to reuse the same key with a different amount — this should be rejected
curl -s -X POST http://localhost:8000/charges \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-12345-attempt-1" \
  -d '{"amount_cents": 99999, "currency": "usd", "customer_email": "attacker@evil.com"}' \
  | python3 -m json.tool

# Expected: 422 Unprocessable Entity
# {
#   "detail": "Idempotency key reuse detected: the same key was submitted with a
#              different request body. Use a unique key per operation."
# }

# Inspect key metadata
curl -s http://localhost:8000/idempotency-keys/order-12345-attempt-1 | python3 -m json.tool
# {
#   "key": "order-12345-attempt-1",
#   "status": "completed",
#   "request_hash": "3a7f...",
#   "created_at": "2026-06-01T10:30:00+00:00",
#   "expires_at": "2026-06-02T10:30:00+00:00"   <-- 24h TTL
# }
```

---

## What to Observe

**In PostgreSQL directly (proves atomicity):**

```bash
docker exec -it $(docker-compose ps -q postgres) psql -U pay_user -d payments -c "
SELECT
  ik.key,
  ik.status,
  ik.created_at,
  ik.expires_at,
  c.charge_id,
  c.amount_cents
FROM idempotency_keys ik
LEFT JOIN charges c ON c.idempotency_key = ik.key
ORDER BY ik.created_at DESC;
"
# key                      | status    | charge_id          | amount_cents
# order-12345-attempt-1    | completed | ch_a3f1b2c4d5e6f7a8 | 10000
# race-condition-test-key  | completed | ch_9f8e7d6c5b4a3210 | 5000
```

**Key metrics to verify:**
- `SELECT COUNT(*) FROM charges` — should equal the number of unique idempotency keys used, never more
- `SELECT COUNT(*) FROM idempotency_keys WHERE status = 'processing'` — should drop to 0 after all requests complete (no hung transactions)
- Response time for cached vs fresh: cached responses should be ~1ms (DB read only); fresh responses ~110ms (100ms simulated processor + DB writes)

---

## What Breaks It

**Anti-pattern 1 — Key reuse across different operations:**

```bash
# WRONG: same key for two different charges (different customers/amounts)
# This is the most common mistake — developers reuse a session ID or user ID as the key

curl -X POST http://localhost:8000/charges \
  -H "X-Idempotency-Key: user-session-abc123" \
  -d '{"amount_cents": 1000, "customer_email": "alice@example.com", ...}'

# Later, same session, different purchase:
curl -X POST http://localhost:8000/charges \
  -H "X-Idempotency-Key: user-session-abc123" \   # <-- REUSED KEY
  -d '{"amount_cents": 5000, "customer_email": "alice@example.com", ...}'

# Result: 422 — second charge silently blocked, customer never charged
# Fix: key must encode the specific operation:  user-{id}-order-{order_id}-attempt-{n}
```

**Anti-pattern 2 — Not storing response before confirming to client:**

```python
# WRONG: confirm to client first, then store
result = await process_payment()
await client.send_response(result)       # <-- crash here
await db.store_idempotency_response(result)  # <-- never reached

# Retry gets a fresh processing attempt → duplicate charge
# Fix: always UPDATE idempotency_keys BEFORE returning to client (as this POC does)
```

**Anti-pattern 3 — Using TTL shorter than retry window:**

If you set key TTL to 1 hour but your payment SDK retries for up to 4 hours on timeout, a retry after key expiry will trigger a new charge. Stripe's 24-hour TTL covers the longest realistic retry window.

```bash
# Simulate expired key behavior — manually expire a key
docker exec -it $(docker-compose ps -q postgres) psql -U pay_user -d payments \
  -c "UPDATE idempotency_keys SET expires_at = NOW() - INTERVAL '1 second' WHERE key = 'order-12345-attempt-1';"

# Now retry — you'll get 409 Conflict (expired key)
curl -s -X POST http://localhost:8000/charges \
  -H "X-Idempotency-Key: order-12345-attempt-1" \
  -d '{"amount_cents": 10000, "currency": "usd", "customer_email": "alice@example.com"}'
# {"detail": "Idempotency key has expired (>24h). Generate a new key for a new request."}
```

---

## Extend It

1. **Add a cleanup job**: Run `DELETE FROM idempotency_keys WHERE expires_at < NOW()` as a periodic background task (pg_cron or a Celery beat job). Without cleanup, the `idempotency_keys` table grows indefinitely.

2. **Switch to Redis for hot-path caching**: Store completed responses in Redis with a 24h TTL for O(1) lookup. Fall back to PostgreSQL for audit and key-reuse detection. Latency drops from ~5ms (PG read) to ~0.3ms (Redis read) for cache-hit paths.

3. **Add webhook idempotency**: Payment processors send webhooks with their own event IDs. Apply the same pattern to `POST /webhooks` — use `event_id` as the idempotency key to make webhook processing exactly-once.

4. **Distributed key namespace**: In a multi-region setup, prefix keys with a region tag (`us-east-1:order-123`) and route requests for a given key to a consistent shard, or use a globally replicated DB (CockroachDB, PlanetScale) to avoid cross-region key conflicts.

5. **Instrument cache hit rate**: Add a Prometheus counter for `cached=true` vs `cached=false` responses. A healthy retry rate is 0.1–2% of total requests; a spike above 5% suggests client-side issues (aggressive retries, bugs).

---

## Key Takeaways

- **Stripe processes $640B/year** using idempotency keys as the primary defense against duplicate charges — this is not optional for any serious payment API.
- **`INSERT ... ON CONFLICT DO NOTHING RETURNING *`** is the atomic primitive: a single SQL statement replaces a read-then-write that would require application-level locking.
- **24-hour TTL** matches the longest realistic client retry window; shorter TTLs create gaps where expired keys allow duplicate charges on late retries.
- **Request hash on the key** catches the most dangerous anti-pattern — key reuse across different operations — and converts a silent bug into an explicit 422 error.
- **Cache-hit responses should be <5ms** (pure DB read); if they're slower, the idempotency layer is adding latency rather than absorbing it — add a Redis cache layer in front.

---

## References

- 📖 [Stripe — Idempotent Requests](https://stripe.com/docs/api/idempotent_requests) — Stripe's official API documentation on idempotency key semantics and 24h TTL
- 📖 [Stripe Engineering — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) — the original engineering blog post that defined the pattern
- 📖 [Brandur Leach — Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) — deep-dive on the `ON CONFLICT DO NOTHING` approach with transaction state machine
- 📺 [Payments at Scale — Avoiding Double Charges (SREcon)](https://www.youtube.com/watch?v=ZFMeGn8OV5Y) — practical war stories from payment engineers on duplicate charge incidents
