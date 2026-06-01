---
title: "Design a Hotel Booking System"
layer: case-study
section: "16-system-design-problems/04-reservation-scheduling"
difficulty: intermediate
tags: [inventory, booking, concurrency, idempotency, double-booking, hotel, reservation]
category: scalability
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "System Design Interview – Alex Xu Vol 2"
    url: "https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119"
    type: article
  - title: "Booking.com Engineering Blog"
    url: "https://medium.com/booking-com-development"
    type: article
  - title: "Airbnb Engineering — Payments at Scale"
    url: "https://medium.com/airbnb-engineering/avoiding-double-payments-in-a-distributed-payments-system-2981f6b070bb"
    type: article
---

# Design a Hotel Booking System

**Difficulty**: 🟡 Intermediate
**Reading Time**: ~18 minutes
**Interview Frequency**: High

---

## The Core Problem

Preventing double-booking across 100,000 hotels with 10 million concurrent search users requires solving a classic inventory reservation problem: room availability must be consistent (can't oversell), reads massively outnumber writes (search vs book), and the window between "check availability" and "complete booking" must be atomic to prevent race conditions.

## Functional Requirements

- Search for available rooms by hotel, dates, room type
- Book a specific room for specific dates (atomic reservation)
- Cancel bookings with refund processing
- Support for hotel managers to manage room inventory
- View booking confirmation and history

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Availability | 99.99% (52 min/year) |
| Search latency | p99 < 500ms |
| Booking latency | p99 < 2 seconds |
| Scale | 100K hotels, 10M searches/day, 1M bookings/day |

## Back-of-Envelope Estimates

- **Search queries**: 10M searches/day ÷ 86,400 = ~116 searches/sec (peak 10x = 1,160/sec)
- **Booking writes**: 1M bookings/day ÷ 86,400 = ~12 bookings/sec — low write rate
- **Room inventory records**: 100K hotels × 200 rooms avg × 365 days = 7.3B availability slots/year

## Key Design Decisions

1. **Optimistic Locking for Booking** — check availability → begin booking → DB check-and-set with version number; if version changed (another booking snuck in), retry; optimistic locking works well when conflicts are rare (<1% collision rate at 12 bookings/sec).
2. **Room Inventory Model** — store availability as a count per (hotel_id, room_type, date) rather than per individual room; reduces record count from millions to thousands; use DB row-level locking during booking transaction.
3. **Idempotent Booking with Booking ID** — generate booking_id client-side before calling API; API uses booking_id as idempotency key; if network fails and client retries, server recognizes duplicate and returns original result — no double charge.

## High-Level Architecture

```mermaid
graph TD
    Customer[Customer App] --> SearchSvc[Search Service]
    SearchSvc --> SearchCache[Search Cache\nRedis — availability snapshots]
    SearchCache --> Customer
    Customer --> BookingSvc[Booking Service]
    BookingSvc --> InventoryDB[(Inventory DB\nPostgres row-level lock)]
    BookingSvc --> PaymentSvc[Payment Service]
    PaymentSvc --> PaymentGW[Payment Gateway]
    BookingSvc --> NotifySvc[Notification Service\nConfirmation Email]
    HotelMgmt[Hotel Manager] --> HotelSvc[Hotel Management\nService]
    HotelSvc --> InventoryDB
```

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| How do you prevent two users from booking the last room simultaneously? | Optimistic locking, atomic operations |
| How do you handle a payment failure after inventory has been reserved? | Saga pattern, compensating transactions |
| How would you show accurate availability during a search without locking? | Eventual consistency, snapshot reads |

## Related Concepts

- [Ticketmaster for similar inventory contention](../04-reservation-scheduling/ticketmaster)
- [Shopify flash sales for similar concurrency problems](../02-social-platforms/shopify)

---

## Level 1 — Surface (2-Minute Read)

**What it is**: A system that lets users search available hotel rooms, reserve them atomically, and pay — while guaranteeing no two users can book the same room for the same night.

**When you need this**: Any reservation system where inventory is finite and time-bound — hotel rooms, rental cars, airline seats. The pattern applies whenever "check availability" and "confirm reservation" must be atomic.

**Core concepts:**
- Availability is stored as a count per `(hotel, room_type, date)` — not per physical room
- Search reads from a cache (stale by up to 60s); booking reads from the live DB
- Row-level locking (pessimistic) or version-column (optimistic) prevents double-booking
- Payments use the Saga pattern with compensating transactions — not 2PC
- Idempotency key (`booking_id`) generated client-side prevents double charges on retry

**Use this when / don't use this when:**

| Use this when | Don't use this when |
|--------------|---------------------|
| Finite, time-bound inventory | Unlimited-supply digital goods |
| Reservation must be exclusive (one room = one booking) | Soft reservations acceptable (e.g., waitlists) |
| Multi-step booking (reserve → pay → confirm) | Single-step atomic purchase |

---

## Level 2 — Deep Dive

---

## Component Deep Dive 1: Inventory Reservation and Concurrency Control

The inventory reservation component is the most critical and most failure-prone part of a hotel booking system. Its job is deceptively simple: atomically decrement an availability counter when a booking is confirmed and atomically restore it on cancellation. In practice, it must handle thousands of concurrent requests racing over the same (hotel, room_type, date) inventory record.

**Why naive approaches fail at scale**

The most obvious naive approach is a read-check-write pattern: read current availability, check if count > 0, then write a new booking row. This has a classic TOCTOU (time-of-check-to-time-of-use) race condition. Two users both read `available_rooms = 1`, both see it is non-zero, and both proceed to write a booking — result: two bookings for one room. At 12 bookings/sec this collision is rare, but at peak (major holidays, flash sales), it becomes unavoidable.

A second naive approach is to use application-level locks (Redis SET NX with TTL). This works for simple cases but has failure modes: the process holding the lock crashes before releasing it (TTL helps but introduces latency overhead), clock drift across Redis replicas causes lock inconsistency, and Redlock-style distributed locking adds complexity without eliminating all edge cases.

**The correct approach: database row-level locking with SELECT FOR UPDATE**

The production-grade pattern is to use `SELECT ... FOR UPDATE` within a database transaction on the `room_inventory` row keyed by `(hotel_id, room_type_id, date)`. This acquires an exclusive row lock that blocks concurrent writers until the transaction commits or rolls back. The lock scope is exactly one row, so it does not block reads or writes to other hotels or dates.

For optimistic locking (fewer blocked reads), use a `version` column. The booking transaction reads the row with its current version, then updates with a `WHERE version = :read_version` clause. If another booking committed between the read and the write, the row version will have changed and the UPDATE affects 0 rows — the application retries with fresh data.

```mermaid
sequenceDiagram
    participant UserA
    participant UserB
    participant BookingSvc
    participant InventoryDB

    UserA->>BookingSvc: Book room 101, Jan 15
    UserB->>BookingSvc: Book room 101, Jan 15

    BookingSvc->>InventoryDB: BEGIN TRANSACTION
    BookingSvc->>InventoryDB: SELECT available_count, version WHERE hotel=1, room_type=101, date=Jan15 FOR UPDATE
    InventoryDB-->>BookingSvc: available_count=1, version=42

    note over InventoryDB: Row locked — UserB's SELECT FOR UPDATE blocks here

    BookingSvc->>InventoryDB: UPDATE room_inventory SET available_count=0, version=43 WHERE version=42
    BookingSvc->>InventoryDB: INSERT INTO bookings (booking_id, room_type_id, ...)
    BookingSvc->>InventoryDB: COMMIT

    note over InventoryDB: Row lock released — UserB's query proceeds

    BookingSvc->>InventoryDB: (UserB) SELECT ... FOR UPDATE
    InventoryDB-->>BookingSvc: available_count=0, version=43
    BookingSvc->>InventoryDB: ROLLBACK
    BookingSvc-->>UserB: 409 No Availability
    BookingSvc-->>UserA: 200 Booking Confirmed
```

**Trade-off table: three locking strategies**

| Approach | Latency (p99) | Throughput | Trade-off |
|----------|--------------|------------|-----------|
| SELECT FOR UPDATE (pessimistic) | 50–200ms | ~500 concurrent bookings/hotel | Serializes writes; safe but blocks under high contention |
| Optimistic locking (version column) | 10–40ms (no conflict) | High for low-conflict workloads | Retry storms if many users race for the last room |
| Redis distributed lock (Redlock) | 5–20ms + lock RTT | ~2,000 concurrent across cluster | Network partition risk; complex failure modes; not ACID |

For hotel booking the recommendation is **pessimistic locking** (`SELECT FOR UPDATE`) at the inventory row level. Hotel booking is low-write (12 bookings/sec globally), the lock is held for <100ms, and correctness is non-negotiable.

---

## Component Deep Dive 2: Search and Availability Caching

The search service handles 10–100x more traffic than the booking service (1,160 searches/sec at peak vs 12 bookings/sec). Search must return results in <500ms p99 across 100K hotels, 200 room types, and a rolling 365-day date window. Querying the live `room_inventory` table for every search is infeasible — it would require range scans over billions of rows with sub-second latency.

**Internal mechanics: snapshot-based availability cache**

The solution is a two-tier availability snapshot. The live inventory DB stores ground truth. A background job (or CDC stream via Debezium) writes aggregated availability snapshots to Redis every 60 seconds per hotel. The search service reads exclusively from Redis. The booking service writes to the inventory DB and also invalidates the Redis key for that hotel after every committed booking.

At scale this means search sees at most 60-second-stale data — acceptable because availability flips from "available" to "unavailable" only when a booking commits. Users searching for rooms and seeing a stale "available" result who then click "book" will hit the real availability check at booking time. This is the same pattern used at Booking.com: search shows stale counts, the booking flow enforces real availability.

**What happens at 10x load (11,600 searches/sec)**

At 10x load the Redis cluster is the bottleneck. A single Redis node handles ~100,000 GET/sec, so 11,600 searches/sec with each search touching 5–10 hotel keys is well within a single Redis node's capacity. The real concern is cache invalidation thundering herd: if 100 hotels all complete bookings in the same second, 100 Redis invalidations fire simultaneously. The search cache rebuild for each hotel requires a DB read — 100 concurrent DB reads spike the primary. Mitigation: use lazy cache rebuild (read-through) with jitter on TTL (e.g., TTL = 60 ± random(10) seconds), and rate-limit invalidation fanout.

| Layer | Handles | Limit | Failure Mode |
|-------|---------|-------|--------------|
| Redis search cache | 100K hotel snapshots | ~100K GET/sec per node | Stale reads during invalidation lag |
| Postgres inventory DB | Booking transactions | ~500 concurrent row locks | Lock contention on hot inventory rows |
| CDN (static hotel data) | Hotel metadata, images | Millions of req/sec | Cache miss rate spike on new hotels |

---

## Component Deep Dive 3: Saga Pattern for Payment-Booking Consistency

A hotel booking is a multi-step transaction spanning at least three services: inventory reservation, payment charge, and booking confirmation. If payment fails after inventory is reserved, or if the confirmation email fails after payment succeeds, the system is in an inconsistent state. Traditional two-phase commit (2PC) across services is impractical — it creates distributed locks that span network hops and external payment gateways.

**The Saga pattern with compensating transactions**

A Saga breaks the multi-step workflow into a sequence of local transactions, each with a corresponding compensating transaction that undoes it if a later step fails. For hotel booking:

1. `ReserveInventory` → compensating: `ReleaseInventory`
2. `ChargePayment` → compensating: `RefundPayment`
3. `CreateBookingRecord` → compensating: `DeleteBookingRecord`
4. `SendConfirmation` → (no compensation needed — idempotent retry)

If `ChargePayment` fails, the Saga orchestrator calls `ReleaseInventory` to free the room. If `CreateBookingRecord` fails after a successful payment, the orchestrator calls `RefundPayment` then `ReleaseInventory`.

**Choreography vs orchestration**

Choreography (event-based: each service emits events and reacts to others' events) scales well but is hard to debug when a booking gets stuck mid-saga. Orchestration (a central Saga coordinator service issues commands to each participant) makes the flow explicit and observable. For hotel booking, orchestration is preferred because: payments require synchronous confirmation from the gateway, the number of steps is small (4–5), and tracing a failed booking to root cause requires a clear audit log that an orchestrator naturally provides.

**Idempotency is mandatory at every step**

Every Saga step must be idempotent. The booking service generates a `booking_id` UUID client-side before the first API call. This UUID flows through every downstream call as an idempotency key. The payment gateway receives `booking_id` as the payment reference — duplicate retries return the original charge result. The DB upserts on `booking_id` as primary key. Without idempotency, network retries cause double charges — the most user-visible failure mode.

---

## Component Deep Dive 4: Availability Calendar — Bitmap Representation

At Booking.com scale (150M+ listings, 1.5M room-nights sold per day), the availability calendar cannot be a simple SQL table scan. The naive approach — querying `room_inventory` for each date in a search window — requires 30 rows per hotel per search for a 30-night window. At 500,000 search QPS, that is 15 million DB reads per second for calendar lookups alone. The solution is to compress each hotel's availability into a compact bitmap structure served from cache.

### Bitmap per room type per date range

Instead of one row per `(hotel, room_type, date)`, the cache stores a **64-bit integer bitmap** representing 64 consecutive days of availability for each `(hotel_id, room_type_id, start_week)` bucket. Bit position `i` = 1 means at least one room of that type is available on day `i`. Bit position `i` = 0 means fully booked.

To check availability for a 5-night stay starting day `D`, you compute:
```
mask = ((1 << 5) - 1) << D_offset   # bits D through D+4
available = (bitmap & mask) == mask  # all 5 bits must be 1
```

This reduces a 30-row DB scan to a single 64-bit integer AND operation — O(1) in cache.

```mermaid
graph TD
    subgraph "Availability Bitmap (64-bit, 8 weeks)"
        BM["hotel_id=42, room_type=KNG, week=2026-W01\nBitmap: 1111101111111011111111111111111111111111111111111111111111111111"]
        BM --> BITS["Bit 0=Jan1=1 available\nBit 1=Jan2=1 available\nBit 4=Jan5=0 SOLD OUT\nBit 7=Jan8=0 SOLD OUT\n..."]
    end

    subgraph "Search Path"
        SEARCH["Search: Jan 3–6 (4 nights)"] --> MASK["mask = 0b...001111 << 2 = bits 2,3,4,5"]
        MASK --> AND["bitmap AND mask == mask ?"]
        AND --> |"Bit 4 = 0 — fails"| NOPE["NOT AVAILABLE"]
        AND --> |"All bits = 1"| AVAIL["AVAILABLE"]
    end

    subgraph "Update Path"
        BOOKING["Booking confirmed: Jan 5"] --> CLR["Clear bit 4: bitmap = bitmap AND ~(1 << 4)"]
        CLR --> WRITE["Write updated bitmap to Redis\nInvalidate affected search cache keys"]
    end
```

### Handling partial availability

A bitmap bit = 1 means "at least 1 room available" — it does not encode the count. To answer "how many rooms are available?", the search layer uses a separate **count array** (one byte per day, values 0–255) stored alongside the bitmap. The bitmap is used for fast boolean filtering; the count array is used for display ("3 rooms left").

For multi-room bookings (e.g., "reserve 3 Standard Twin rooms for a conference"), the system checks that `count[day] >= 3` for every day in the stay. The count decrement on booking is atomic: `WATCH bitmap_key` + Lua script in Redis, or a DB transaction updating `room_inventory.available_count`.

### Cache population and invalidation

The bitmap cache is populated by two mechanisms:
1. **Initial bulk load**: when a hotel updates its inventory (e.g., marking rooms as out-of-service), a batch job recomputes all bitmaps for that hotel and writes them to Redis. TTL = 24 hours.
2. **Incremental invalidation**: when a booking commits, the Booking Service sends a `BITMAP_UPDATE` event to a Kafka topic. A Bitmap Updater consumer reads the event, clears the appropriate bit in Redis, and writes the updated bitmap. End-to-end latency < 500ms.

**Failure mode**: If the Kafka consumer lags during a traffic spike, cached bitmaps stay stale for longer than 500ms. Users searching will see "available" for a room already booked. This is acceptable — the booking service enforces real availability at reservation time. The bitmap is an optimization for search UX, not a consistency boundary.

---

## Component Deep Dive 5: Double-Booking Prevention — Optimistic vs Pessimistic Locking

This is the most technically nuanced part of the design and the question interviewers focus on most. The choice between optimistic and pessimistic locking depends on contention level, not on which is "newer" or "more scalable."

### The race condition in detail

The classic double-booking race condition:

1. User A and User B both search for the last available Standard King room on Dec 25.
2. Both see `available_count = 1`.
3. Both click "Book."
4. Both proceed to the booking transaction.
5. Both execute: `UPDATE room_inventory SET available_count = 0 WHERE ... AND available_count > 0`.
6. Without coordination, both updates succeed — two bookings for one room.

The "AND available_count > 0" clause is a partial defense but is not atomic in a concurrent environment without an explicit lock — two transactions can both read `available_count = 1`, both pass the check, and both issue the UPDATE before either commits.

### Approach A: Pessimistic Locking (SELECT FOR UPDATE)

```sql
BEGIN;

-- Acquire exclusive row lock — concurrent writers block here
SELECT available_count, version
  FROM room_inventory
 WHERE hotel_id = :hotel_id
   AND room_type_id = :room_type_id
   AND stay_date    = :date
   FOR UPDATE;

-- If available_count > 0, proceed with booking
INSERT INTO bookings (...) VALUES (...);
UPDATE room_inventory
   SET available_count = available_count - 1
 WHERE hotel_id = :hotel_id
   AND room_type_id = :room_type_id
   AND stay_date    = :date;

COMMIT;
-- Lock released on COMMIT
```

User B's `SELECT FOR UPDATE` blocks until User A's transaction commits or rolls back. After User A commits, User B's query re-reads `available_count = 0` and aborts. No double booking.

**Lock hold duration**: The lock is held from `SELECT FOR UPDATE` to `COMMIT`. If the booking service makes a synchronous payment API call inside the transaction, the lock is held for potentially 2–5 seconds — blocking every other thread trying to book that room type for that date. This is why payment should happen outside the DB transaction (see Saga pattern above).

### Approach B: Optimistic Locking (version column)

```sql
-- Step 1: Read without lock
SELECT available_count, version
  FROM room_inventory
 WHERE hotel_id = :hotel_id
   AND room_type_id = :room_type_id
   AND stay_date    = :date;
-- Returns: available_count=1, version=42

-- Step 2: Attempt conditional update
BEGIN;
UPDATE room_inventory
   SET available_count = available_count - 1,
       version         = version + 1
 WHERE hotel_id    = :hotel_id
   AND room_type_id = :room_type_id
   AND stay_date   = :date
   AND version     = 42;          -- <-- optimistic check
-- rows_affected = 1 → success, commit
-- rows_affected = 0 → conflict, rollback and retry
COMMIT;
```

If User A and User B both read `version = 42` and both issue the conditional UPDATE, only one will see `rows_affected = 1`. The other sees 0 and retries with the fresh row (which now has `available_count = 0`), and aborts.

### Comparison table

| Dimension | Pessimistic (SELECT FOR UPDATE) | Optimistic (version column) |
|-----------|---------------------------------|-----------------------------|
| Lock held during payment? | Yes, if payment is inside tx | No — lock is implicit |
| Blocking on contention? | Yes — second user blocks | No — second user retries immediately |
| Performance at low contention | Slightly slower (lock overhead ~2–5ms) | Faster (no blocking) |
| Performance at high contention | Degrades — queue forms | Degrades — retry storm |
| Correctness guarantee | Strong (serializable) | Strong (compare-and-swap) |
| Complexity | Lower | Higher (retry logic required) |
| Recommended for | Last room, high-demand dates, peak events | Most normal bookings (low contention) |
| Retry storms? | No — waiters are queued | Yes — if 50 users race for 1 room |

### When to use which

**Use pessimistic locking when:**
- `available_count <= 2` — the last 1–2 rooms have a high probability of contention
- The date is a known peak (New Year's Eve, sold-out event nearby)
- The hotel_id is flagged as "high demand" based on recent booking velocity

**Use optimistic locking when:**
- `available_count >= 10` — collision probability is low
- Normal weekday dates, off-season hotels
- You want to minimize lock wait time for the common case

**Booking.com's approach**: They use pessimistic locking (`SELECT FOR UPDATE` in MySQL) as the default, with a 100ms statement timeout. If a lock cannot be acquired within 100ms, the booking returns a "temporarily unavailable, please retry" response rather than waiting indefinitely. This bounds the worst-case user experience.

```mermaid
flowchart TD
    START["User clicks Book"] --> READ["Read room_inventory\n(available_count, version)"]
    READ --> CHECK{available_count > 0?}
    CHECK --> |No| SOLD["Return 409 Sold Out"]
    CHECK --> |Yes| CONTENTION{High contention?\navailable_count <= 2\nor peak date?}

    CONTENTION --> |Yes — last rooms| PESSIMISTIC["SELECT FOR UPDATE\n(acquire row lock)"]
    CONTENTION --> |No — normal| OPTIMISTIC["Attempt conditional UPDATE\nWHERE version = :read_version"]

    PESSIMISTIC --> LOCK_CHECK{Lock acquired\nwithin 100ms?}
    LOCK_CHECK --> |No| TIMEOUT["Return 503 Retry\n(lock timeout)"]
    LOCK_CHECK --> |Yes| LOCK_UPDATE["UPDATE available_count - 1\nINSERT booking row\nCOMMIT (releases lock)"]
    LOCK_UPDATE --> SUCCESS["Return 200 Booking Confirmed"]

    OPTIMISTIC --> OPT_CHECK{rows_affected = 1?}
    OPT_CHECK --> |Yes| SUCCESS
    OPT_CHECK --> |No — conflict| RETRY["Retry with fresh data\n(max 3 attempts)"]
    RETRY --> READ
```

---

## Component Deep Dive 6: Dynamic Pricing — Caching Strategy for Rate Queries

Hotel room rates are not static. Booking.com and Expedia apply yield management algorithms that adjust prices based on:
- **Occupancy level**: prices rise as rooms fill up (typically: >70% occupied → +15–30%)
- **Days until check-in**: last-minute discounts or premiums depending on hotel category
- **Demand signals**: local events, competitor pricing, seasonal patterns
- **Channel**: direct booking vs OTA vs corporate account

This means the `price_usd` field in `room_inventory` is rewritten frequently — potentially every few minutes for high-demand hotels. At 500,000 price queries per second (same as availability queries), reading live prices from Postgres on every request is infeasible.

### Three-tier pricing cache

```
Tier 1 — Browser/CDN cache: 5-minute TTL
    └── Acceptable for initial price display in search results (may be stale)

Tier 2 — Redis price cache: 2-minute TTL, keyed by (hotel_id, room_type_id, date)
    └── Used by search service for sub-second price lookups
    └── Invalidated by pricing engine on every price change event

Tier 3 — Postgres room_inventory: Ground truth, <50ms read
    └── Used at booking confirmation to get the authoritative price
    └── Price displayed to user at checkout is always a fresh DB read
```

**Cache invalidation flow**: The pricing engine runs as a separate service. When it recalculates prices for a hotel (event-driven, triggered by occupancy changes), it:
1. Writes new `price_usd` to `room_inventory` (DB update)
2. Publishes a `PRICE_UPDATED` event to Kafka
3. The Redis cache invalidator consumer deletes the affected Redis keys

Because Tier 2 has a 2-minute TTL anyway, even if the invalidation event is delayed, the cache self-heals within 2 minutes. Tier 1 (browser cache) means users may see a 5-minute-old price in search results — but the booking page always shows the fresh price.

**The price guarantee problem**: If a user sees price X in search results (from Tier 1 cache), then the price changes to X+20 before they click "Book," they will see the higher price at checkout. This is the same behavior as airline booking sites. The alternative — holding the displayed price for the user — requires a "price lock" record in the DB with an expiry (similar to the soft room hold), which adds complexity only justified for premium booking flows.

### Price query SQL pattern

The booking confirmation page fetches price directly from the source of truth:

```sql
SELECT price_usd
  FROM room_inventory
 WHERE hotel_id    = :hotel_id
   AND room_type_id = :room_type_id
   AND stay_date   BETWEEN :check_in AND :check_out - INTERVAL '1 day'
 ORDER BY stay_date;
-- Sum prices across all nights; multi-night stays may have different per-night rates
```

For a 5-night stay, this returns 5 rows — one price per night. The booking total is the sum. This allows the pricing engine to set different prices per night (e.g., Friday night priced higher than Monday).

### Dynamic pricing numbers

| Scenario | Typical price change | Frequency |
|----------|---------------------|-----------|
| Hotel reaches 70% occupancy | +15–30% on remaining rooms | Once per significant booking |
| T-7 days before check-in | ±10% (last-minute algorithm) | Daily re-evaluation |
| Local event detected (concert, conference) | +20–80% | Set once, persists until event |
| Competitor price drop (if tracked) | -5–10% response | Within 1–4 hours |

---

## Data Model

The data model uses a count-per-slot approach for inventory (not a row per physical room) to keep the hot table small and lockable at a predictable granularity.

```sql
-- Core hotel inventory
CREATE TABLE hotels (
    hotel_id        BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    country_code    CHAR(2) NOT NULL,
    star_rating     SMALLINT CHECK (star_rating BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE room_types (
    room_type_id    BIGSERIAL PRIMARY KEY,
    hotel_id        BIGINT NOT NULL REFERENCES hotels(hotel_id),
    name            VARCHAR(100) NOT NULL,   -- "Deluxe King", "Standard Twin"
    capacity        SMALLINT NOT NULL,       -- max guests
    base_price_usd  NUMERIC(10, 2) NOT NULL,
    total_rooms     SMALLINT NOT NULL        -- physical room count for this type
);

-- One row per (hotel, room_type, date) — 7.3B rows for 100K hotels × 200 types × 365 days
-- Partition by date range (monthly partitions) to keep scans fast
CREATE TABLE room_inventory (
    hotel_id        BIGINT NOT NULL,
    room_type_id    BIGINT NOT NULL,
    stay_date       DATE NOT NULL,
    available_count SMALLINT NOT NULL DEFAULT 0,
    price_usd       NUMERIC(10, 2) NOT NULL,  -- dynamic pricing may differ from base
    version         BIGINT NOT NULL DEFAULT 0, -- optimistic lock version
    PRIMARY KEY (hotel_id, room_type_id, stay_date)
) PARTITION BY RANGE (stay_date);

-- Index for search: "all available room types in city X for date range"
CREATE INDEX idx_inventory_search
    ON room_inventory (hotel_id, stay_date, available_count)
    WHERE available_count > 0;

-- Bookings table
CREATE TABLE bookings (
    booking_id      UUID PRIMARY KEY,          -- client-generated idempotency key
    user_id         BIGINT NOT NULL,
    hotel_id        BIGINT NOT NULL REFERENCES hotels(hotel_id),
    room_type_id    BIGINT NOT NULL REFERENCES room_types(room_type_id),
    check_in_date   DATE NOT NULL,
    check_out_date  DATE NOT NULL,
    total_price_usd NUMERIC(12, 2) NOT NULL,
    status          VARCHAR(20) NOT NULL        -- PENDING, CONFIRMED, CANCELLED, REFUNDED
                    CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','REFUNDED')),
    payment_ref     VARCHAR(255),              -- external payment gateway reference
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_user ON bookings (user_id, check_in_date DESC);
CREATE INDEX idx_bookings_hotel ON bookings (hotel_id, check_in_date);

-- Saga state machine for booking workflow
CREATE TABLE booking_sagas (
    saga_id         UUID PRIMARY KEY,
    booking_id      UUID NOT NULL REFERENCES bookings(booking_id),
    current_step    VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('IN_PROGRESS','COMPLETED','COMPENSATING','FAILED')),
    step_payload    JSONB,                     -- step-specific context for retry/compensation
    attempts        SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## Scale Bottlenecks

| Traffic Level | Component That Breaks | Symptoms | Mitigation |
|---------------|----------------------|----------|------------|
| 10x baseline (1,160 searches/sec, 120 bookings/sec) | Redis search cache | Cache miss rate spikes on invalidation bursts; DB read pressure | Increase Redis cluster nodes; add read replicas; stagger TTL with jitter |
| 100x baseline (11,600 searches/sec, 1,200 bookings/sec) | Postgres inventory DB | Row lock wait times spike from <10ms to 500ms+; booking p99 breaches 2s SLA | Shard inventory DB by `hotel_id % N`; promote read replicas for search; migrate hot inventory to CockroachDB for distributed row locks |
| 1000x baseline (116,000 searches/sec, 12,000 bookings/sec) | Everything | Full DB saturation; cache CPU saturation; Saga orchestrator becomes bottleneck | Migrate to a globally distributed DB (Spanner, YugabyteDB); move search to Elasticsearch with Kafka-fed index; move Saga orchestration to a durable workflow engine (Temporal, Conductor) |

**The 100x threshold is the critical inflection point.** Below it, a single Postgres primary with read replicas and a Redis cache handles load comfortably. Above it, the inventory DB sharding decision must be made — and the sharding key (`hotel_id`) means cross-hotel queries (e.g., "find all available 5-star rooms in Paris") require scatter-gather across shards. This is why Booking.com separates its search index (Elasticsearch) from its booking database (sharded Postgres) — they are optimized for completely different access patterns.

---

## How Booking.com Built This

Booking.com is the world's largest online travel platform, handling over **28 million bookings per day** across 28 million reported accommodation listings. Their engineering challenge is the clearest real-world analog to this design problem.

**Technology choices**

Booking.com runs on a PHP monolith that was incrementally decomposed into services over a decade. The core inventory system is backed by **MySQL** (not Postgres) with heavy use of `SELECT ... FOR UPDATE` at the room availability row level — the same pessimistic locking pattern described above. They use **Memcached** (not Redis) for their availability snapshot cache, with cache keys structured as `avail:{hotel_id}:{date_range_hash}`. Cache TTL is 60 seconds by default but drops to 15 seconds when a hotel is within 80% occupancy — they dynamically tighten freshness as rooms become scarce.

**Specific numbers**

Their search infrastructure handles approximately **500,000 availability queries per second** at peak (New Year's Eve, summer holidays). Their booking write path processes approximately **300 booking writes per second** at peak. The inventory cache layer serves 99.5% of availability reads; the database handles the remaining 0.5% (cache misses and booking-time consistency checks).

**The non-obvious architectural decision: split availability vs bookability**

Booking.com distinguishes between *availability* (can the room be shown in search?) and *bookability* (can the room actually be booked right now?). Search uses the cached availability snapshot. The moment a user clicks "Book Now," a separate synchronous availability check hits the live database before the payment form is shown. This pre-booking check — which they call the "hold" step — reserves a soft lock on the room for 15 minutes while the user completes payment. The soft lock is implemented as a DB row with an expiry timestamp; a background job releases expired holds every 60 seconds.

This two-phase "show availability from cache, hold before payment" design decouples the 500K/sec search load from the live inventory database, while still preventing double-booking at the critical payment step.

Source: Booking.com Engineering Blog — [How we improved our booking system](https://medium.com/booking-com-development), and engineering talks at GOTO Conference 2019.

---

## Interview Angle

**What the interviewer is testing:** Whether you understand that the hard problem is not the happy path (one user books a room) but the concurrency edge cases — what happens when two users race for the last room, and what happens when payment fails midway through a booking. The interviewer wants to see you identify the TOCTOU race condition and propose a correct atomic solution.

### The locking question: why candidates get it wrong

The most common candidate mistake on this problem is to propose **pessimistic locking everywhere**, reasoning that "we can't risk double-booking, so we must lock everything." This fails at scale for two reasons:

1. **Pessimistic locks held across payment calls** block concurrent writers for 2–5 seconds. At 300 bookings/sec for a popular hotel, a queue forms behind every payment call — booking latency spikes to 10–60 seconds for users unlucky enough to start a booking while the previous one's payment is in flight.

2. **Lock contention on normal dates is unnecessary**. If a hotel has 50 Standard King rooms available for a Tuesday in October, the probability of two users racing for the last room is near zero. Acquiring an exclusive row lock for every booking on that date serializes all 50 bookings unnecessarily.

**The correct nuanced answer**: Use optimistic locking as the default (low contention, common case) and fall back to pessimistic locking for the last 1–2 rooms.

```
if available_count >= 3:
    → Optimistic locking (version column compare-and-swap)
    → Retry up to 3 times on conflict
    → < 1% conflict rate for available_count >= 3

elif available_count <= 2:
    → Pessimistic locking (SELECT FOR UPDATE)
    → 100ms timeout to acquire lock
    → Return 503 retry if timeout exceeded (don't queue indefinitely)
```

This adaptive strategy gives you O(1) throughput for normal bookings (no waiting) while preventing the double-booking race condition for the genuinely scarce inventory cases.

**Why optimistic locking is correct for most hotel bookings**: Hotel booking writes occur at ~12/sec globally and ~0.1/sec per room type per date for a given hotel. At this write rate, the probability of two users submitting a booking for the same `(hotel, room_type, date)` within the same 50ms transaction window is ~0.005%. Pessimistic locking for this case is pure overhead. Optimistic locking's retry cost — one extra DB round-trip on conflict — is paid only in the rare collision case.

**When pessimistic wins**: New Year's Eve in a boutique hotel. Available rooms: 1. Users racing: potentially hundreds. Optimistic locking would cause a retry storm — all users retry simultaneously, hit the updated `available_count = 0`, and fail. But in this case, the failure is the correct outcome anyway. The only user who should succeed is the first one to commit. Pessimistic locking ensures exactly one winner; optimistic locking also ensures exactly one winner (everyone else gets `rows_affected = 0`). The difference is that pessimistic locking serializes the attempts in a predictable queue, while optimistic locking causes a thundering herd of retries. For the last-room scenario, pessimistic locking is cleaner.

### Common mistakes candidates make

1. **Application-level locking with Redis SET NX** — candidates often reach for Redis distributed locks because they feel modern. This is wrong for inventory: Redis locks are advisory, not enforced by the inventory DB. A process crash, a Redis failover, or clock drift can cause two bookings for one room. The DB transaction is the enforcement boundary.

2. **Forgetting idempotency on the booking API** — candidates design the booking flow but skip what happens when the client retries after a timeout. Without a client-generated `booking_id` as an idempotency key, a retry creates a second booking (and a second payment charge). This is the most common real-world bug in booking systems.

3. **Using 2PC across services** — some candidates propose two-phase commit between the booking service and payment service to guarantee consistency. 2PC is impractical across service boundaries (payment gateways do not implement 2PC) and creates distributed locks that span external network calls. The correct answer is the Saga pattern with compensating transactions.

4. **Proposing pessimistic locking globally** — as described above, holding DB row locks during payment calls (which take 500ms–2s) creates a serialization bottleneck that destroys throughput at scale. The lock must be released before the payment API call, not after.

5. **Confusing bitmap availability with ground-truth availability** — the bitmap cache is a search optimization. Candidates sometimes say "check the bitmap at booking time to prevent double-booking." Wrong: the bitmap can be stale by up to 500ms. Always check the live `room_inventory` table — with a lock — at booking time.

### The insight that separates good from great answers

Recognizing that search and booking have fundamentally incompatible consistency requirements. Search can tolerate stale data (60-second-old cache) because the cost of showing a stale "available" result is just a failure at booking time — not a data corruption. But booking must be strictly consistent because the cost of overselling is a real customer harm. A great candidate explicitly separates these two subsystems, gives each its own consistency model, and explains why eventual consistency is safe for search but unsafe for the booking transaction.

An exceptional answer also mentions **dynamic TTL based on occupancy** (Booking.com's technique): when a hotel reaches 80% occupancy, the search cache TTL drops from 60 seconds to 15 seconds, trading cache efficiency for freshness as the hotel approaches sell-out. This demonstrates understanding that consistency requirements are not binary — they exist on a spectrum that should adapt to the current state of the system.

---

## Key Numbers to Remember

| Metric | Value | Context |
|--------|-------|---------|
| Search-to-booking ratio | ~100:1 | 1,160 searches/sec vs 12 bookings/sec at baseline |
| Availability cache TTL | 60 seconds (normal) / 15 seconds (near-full hotel) | Booking.com dynamic TTL strategy |
| Inventory table size | 7.3 billion rows | 100K hotels × 200 room types × 365 days |
| Row lock hold duration | <100ms | SELECT FOR UPDATE during booking transaction |
| Booking.com peak search QPS | ~500,000/sec | Served 99.5% from Memcached |
| Booking.com peak booking writes | ~300/sec | Against live MySQL with row locks |
| Soft hold TTL | 15 minutes | Time to complete payment before hold expires |
| Saga compensation window | <5 minutes | Maximum time for a compensating transaction to execute |

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [System Design Interview Vol 2 — Alex Xu](https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119) | 📚 Book | Chapter on hotel reservation system design |
| [ByteByteGo — Design a Hotel Booking System](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Search "hotel booking design" — inventory management and double-booking prevention |
| [Booking.com Engineering: Availability Search](https://medium.com/booking-com-development/how-we-re-improving-our-booking-system-8b4d54a34e2f) | 📖 Blog | How Booking.com handles 28M+ bookings/day with inventory consistency |
| [Airbnb Engineering: Listing Availability](https://medium.com/airbnb-engineering/scaling-airbnbs-architecture-cba7f28fef84) | 📖 Blog | How Airbnb manages calendar availability and booking conflicts |
| [Two-Phase Commit for Booking Transactions](https://docs.yugabyte.com/preview/explore/transactions/distributed-transactions-ysql/) | 📚 Docs | Distributed transaction patterns for cross-service booking operations |
