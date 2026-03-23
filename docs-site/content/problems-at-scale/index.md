---
title: "Problems at Scale"
description: "Real production failure scenarios — what breaks, why it breaks, and how to fix it"
---

# Problems at Scale

> **Learn from production failures before they happen to you.** Every article here starts with a real incident story, shows you exactly what broke and why, then walks through the fix with working code.

## Why This Section Exists

Textbooks teach you how systems work when everything goes right. Production teaches you what breaks when things go wrong — but that lesson costs you sleep, customers, and revenue.

This section bridges the gap: structured post-mortems on the failure patterns that take down real systems, with the architectural knowledge to prevent them.

---

## Failure Categories

### [⚡ Concurrency & Race Conditions](concurrency)
When multiple processes touch shared state simultaneously.

| Problem | The Pain |
|---------|----------|
| [Double Booking](concurrency/double-booking) | Two users confirm the same hotel room |
| [Inventory Overselling](concurrency/race-condition-inventory) | 47 orders for 1 iPhone |
| [Double Charge](concurrency/double-charge-payment) | Retry causes duplicate payment |
| [Lost Counter Updates](concurrency/counter-race) | 37,153 views silently lost |
| [Duplicate Orders](concurrency/duplicate-orders) | Flaky network creates 2 shipments |

### [🔴 Availability & Cascading Failures](availability)
When one failure becomes many.

| Problem | The Pain |
|---------|----------|
| [Cascading Failures](availability/cascading-failures) | One slow DB query takes down 23 services |
| [Thundering Herd](availability/thundering-herd) | Cache expiry DDoSes your own database |
| [Retry Storm](availability/retry-storm) | Retries amplify a 30s hiccup into 45min outage |
| [Timeout Domino Effect](availability/timeout-domino-effect) | Nested timeouts that multiply latency |
| [Split-Brain](availability/split-brain) | Two primaries, 8 minutes of conflicting writes |

### [🐢 Performance Bottlenecks](performance)
When your system slows to a crawl at scale.

| Problem | The Pain |
|---------|----------|
| [N+1 Query Problem](performance/n-plus-one-query) | 1 page load → 50,001 database queries |
| [Connection Pool Starvation](performance/connection-pool-starvation) | 500 pods, 100 DB connections, infinite wait |
| [Database Hotspots](performance/database-hotspots) | 31 shards idle, 1 at 99% CPU |

### [🔄 Consistency & Stale Data](consistency)
When reads don't reflect recent writes.

| Problem | The Pain |
|---------|----------|
| [Stale Read After Write](consistency/stale-read-after-write) | User updates profile, still sees old data |
| [Cache Invalidation Race](consistency/cache-invalidation-race) | Stale value overwrites fresh value |

### [📈 Scalability & Hot Spots](scalability)
When distribution creates concentration instead of spreading load.

| Problem | The Pain |
|---------|----------|
| [Hot Partition](scalability/hot-partition) | Celebrity post routes 100M requests to 1 node |
| [Write Amplification](scalability/write-amplification) | One INSERT triggers 10x physical disk writes |

### [💰 Cost & Storage](cost-optimization)
When technical debt becomes a $18K/month storage bill.

| Problem | The Pain |
|---------|----------|
| [Storage Bloat](cost-optimization/storage-bloat) | 50GB grew to 2.4TB — 70% is garbage |

---

## How to Read These Articles

Each article follows the same structure:

1. **The Hook** — a vivid failure story (this happened to real teams)
2. **Why It Happens** — the exact technical mechanism, with sequence diagrams
3. **The Wrong Fix** — the naive solution that doesn't work at scale
4. **The Right Solution** — step-by-step, from simple to production-grade
5. **Detection** — how to know you're heading toward this failure
6. **Prevention** — how to design it out from the start

---

## Quick Diagnosis Guide

**System appears frozen / all requests queuing?**
→ [Connection Pool Starvation](performance/connection-pool-starvation) or [Cascading Failures](availability/cascading-failures)

**One node at 100%, others idle?**
→ [Hot Partition](scalability/hot-partition) or [Database Hotspots](performance/database-hotspots)

**Users getting charged or booked twice?**
→ [Double Charge](concurrency/double-charge-payment) or [Double Booking](concurrency/double-booking)

**Cache miss causing DB to melt?**
→ [Thundering Herd](availability/thundering-herd)

**Service recovery making things worse?**
→ [Retry Storm](availability/retry-storm)

**Users seeing stale data after updating?**
→ [Stale Read After Write](consistency/stale-read-after-write)

**Storage costs exploding with no traffic growth?**
→ [Storage Bloat](cost-optimization/storage-bloat)
