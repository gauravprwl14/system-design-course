---
title: "Cache Sizing Reference — ElastiCache Redis, Memcached, CloudFront, DAX"
layer: reference
section: interview-prep/capacity-estimation/reference-tables
difficulty: intermediate
tags: [capacity-planning, aws, sizing, cost-estimation]
---

# Cache Sizing Reference — ElastiCache Redis, Memcached, CloudFront, DAX

## Quick Decision Table

| Use Case | Choose | Reason |
|----------|--------|--------|
| Session store, leaderboards, pub/sub, sorted sets | **ElastiCache Redis** | Rich data structures, persistence, Lua scripting |
| Simple key/value, horizontal scale, multi-threaded | **ElastiCache Memcached** | Lower overhead, auto-discovery, no replication needed |
| DynamoDB read acceleration (microsecond latency) | **DAX** | Purpose-built for DynamoDB; no code change for reads |
| Static assets, HTML, API responses (global) | **CloudFront** | CDN edge caching, reduces origin load by 70-95% |
| Hot partition mitigation on DynamoDB | **DAX** | Absorbs repeated identical reads without thundering herd |
| Multi-AZ HA with automatic failover | **ElastiCache Redis (cluster mode off)** | Primary + replica, 60s failover SLA |
| >500 GB working set / >1M ops/s | **ElastiCache Redis cluster mode on** | Shard data across up to 500 shards |
| Batch jobs, short-lived cache (< 1 hr) | **Lambda + in-process LRU** | Avoid ElastiCache cold-start costs |

---

## ElastiCache Redis — Node Sizing

All prices are **us-east-1 on-demand** (2024/2025). Reserved 1yr saves ~30%, 3yr ~40%.

| Node Type | vCPU | RAM | Max Connections | Ops/s (est.) | On-Demand/hr | On-Demand/mo |
|-----------|------|-----|-----------------|--------------|--------------|--------------|
| r6g.medium | 1 | 6.38 GB | 65,000 | ~75K | $0.048 | ~$35 |
| r6g.large | 2 | 13.07 GB | 65,000 | ~150K | $0.096 | ~$70 |
| r6g.xlarge | 4 | 26.32 GB | 65,000 | ~300K | $0.192 | ~$140 |
| r6g.2xlarge | 8 | 52.82 GB | 65,000 | ~600K | $0.384 | ~$279 |
| r6g.4xlarge | 16 | 105.81 GB | 65,000 | ~1.2M | $0.768 | ~$559 |
| r6g.8xlarge | 32 | 209.55 GB | 65,000 | ~2M | $1.536 | ~$1,119 |
| r6g.12xlarge | 48 | 317.77 GB | 65,000 | ~3M | $2.304 | ~$1,678 |
| r6g.16xlarge | 64 | 419.09 GB | 65,000 | ~4M | $3.072 | ~$2,238 |

**Rules of thumb:**
- `r6g.xlarge` = 26 GB RAM, ~300K ops/s — covers most mid-size apps
- `r6g.2xlarge` = 52 GB RAM, ~600K ops/s — typical production workload
- Add replicas for read scaling; add shards (cluster mode) for write/memory scaling

---

## ElastiCache Memcached — Node Sizing

| Node Type | vCPU | RAM | Max Connections | On-Demand/hr | On-Demand/mo |
|-----------|------|-----|-----------------|--------------|--------------|
| r6g.large | 2 | 13.07 GB | 65,000 | $0.096 | ~$70 |
| r6g.xlarge | 4 | 26.32 GB | 65,000 | $0.192 | ~$140 |
| r6g.2xlarge | 8 | 52.82 GB | 65,000 | $0.384 | ~$279 |

Memcached scales horizontally by adding nodes to a cluster (no built-in replication). Use when you need simple multi-threaded caching and can tolerate data loss on node failure.

---

## Cluster Mode: Off vs. On

| | Cluster Mode OFF | Cluster Mode ON |
|---|-----------------|-----------------|
| Max nodes | 1 primary + 5 replicas | 500 shards × 5 replicas |
| Max RAM | ~420 GB (single shard) | ~500 × 420 GB |
| Failover | Automatic (60s) | Automatic per shard |
| Multi-key ops | Full support | Keys must hash to same slot |
| Use case | < 500 GB, single region | > 500 GB or > 1M writes/s |

**Cluster mode ON gotcha**: `MGET`/`MSET` with keys across slots requires client-side fan-out. Most Redis clients handle this, but latency doubles.

---

## Cache Hit Rate Impact on DB Load

| Hit Rate | DB Load (relative) | Description |
|----------|--------------------|-------------|
| 50% | 2× baseline | Cache barely helping; DB still struggling |
| 80% | 1.25× baseline | Noticeable relief, still heavy |
| 90% | 10% of baseline | **10× DB traffic reduction** — standard target |
| 95% | 5% of baseline | 20× DB traffic reduction |
| 99% | 1% of baseline | DB nearly idle; cache is primary data path |

**Formula**: `DB_RPS = Total_RPS × (1 - hit_rate)`

Example: 100K RPS, 90% hit rate → DB sees 10K RPS. Moving to 95% hit rate drops DB to 5K RPS — halved again for the same traffic.

---

## Memory Sizing Formulas

### Formula 1: Working Set Sizing

```
cache_ram = working_set_bytes / (1 - target_hit_rate)
```

**Worked example:**
- Working set: 20 GB of hot data
- Target hit rate: 95%
- Required cache RAM: `20 GB / (1 - 0.95)` = **400 GB**
- Node choice: 8× r6g.2xlarge in cluster mode, or 2× r6g.16xlarge with replicas

### Formula 2: Object Count Sizing

```
cache_ram = avg_object_size_bytes × num_hot_objects × overhead_factor
```

- `overhead_factor` = 1.3 for Redis (key + metadata overhead per entry)

**Worked example:**
- 10M hot objects × 1 KB avg size = 10 GB raw
- With 1.3 overhead: **13 GB** — fits on r6g.xlarge (26 GB, 50% utilization)

### Formula 3: TTL-Based Retention

```
cache_slots_needed = write_rate_per_sec × TTL_seconds
```

**Worked example:**
- 5K writes/sec, TTL = 300s (5 min)
- Slots: `5,000 × 300` = 1.5M objects
- At 500 bytes/object: 750 MB — trivially small; node selection driven by ops/s

---

## Scaling Thresholds

| Signal | Action |
|--------|--------|
| Memory utilization > 70% | Scale up node or add shards |
| Evictions > 0 in production | Working set exceeds RAM; scale up immediately |
| CPU > 80% sustained | Scale up (Redis is single-threaded per shard) |
| Connections > 60K | Add read replicas or increase max connection limit |
| Replication lag > 100ms | Replica under load; consider dedicated replica nodes |
| Cache hit rate < 85% | Review TTL strategy, key eviction policy, pre-warming |

---

## CloudFront Caching

### Pricing by Region (per 10TB/month, 2024)

| Region | Price/GB |
|--------|----------|
| US, Mexico, Canada | $0.0085 |
| Europe, Israel | $0.0085 |
| South Africa, Kenya | $0.0110 |
| South America | $0.0160 |
| Japan | $0.0120 |
| Australia, New Zealand | $0.0114 |
| India | $0.0100 |

First 1 TB/month free (always-free tier).

### Cache Behaviors — When to Use

| Behavior | TTL | Use Case |
|----------|-----|----------|
| Static assets (JS/CSS/images) | 86400s (24hr) | Immutable files with hash in filename |
| HTML pages | 300s (5min) | Near-real-time content updates acceptable |
| API responses (public) | 60s | Product listings, catalog data |
| API responses (private/auth) | 0 (no cache) | User-specific data; never cache |
| Video/large blobs | 604800s (7d) | Rarely changes; high bandwidth savings |

### Origin Shield

Enable Origin Shield when:
- Traffic comes from 3+ CloudFront regions hitting the same origin
- Origin is rate-limited or expensive (e.g., Lambda, EC2)
- Origin shield adds ~$0.0075/10K requests but reduces origin hits by 60-80%

**Origin Shield pricing**: ~$0.0075 per 10,000 HTTP requests (additional layer charge).

---

## DAX (DynamoDB Accelerator)

### When to Use DAX

| Use DAX | Skip DAX |
|---------|----------|
| Read-heavy workloads (> 80% reads) | Write-heavy workloads |
| Repeated identical queries (hot keys) | Strongly consistent reads required |
| Microsecond latency requirement | Already using ElastiCache for DynamoDB |
| Burst read traffic (flash sales, events) | Eventual consistency is not acceptable |

### DAX Node Pricing (us-east-1, 2024)

| Node Type | RAM | vCPU | On-Demand/hr | On-Demand/mo |
|-----------|-----|------|--------------|--------------|
| dax.r5.large | 15.25 GB | 2 | $0.171 | ~$124 |
| dax.r5.xlarge | 30.5 GB | 4 | $0.342 | ~$249 |
| dax.r5.2xlarge | 61 GB | 8 | $0.684 | ~$498 |
| dax.r5.4xlarge | 122 GB | 16 | $1.368 | ~$997 |

Minimum recommended: 3-node cluster for HA (Multi-AZ). DAX cache TTL defaults: item cache 5 min, query cache 5 min.

---

## Cost Optimization Tips

| Strategy | Savings | Notes |
|----------|---------|-------|
| 1yr Reserved Instances | ~30% | Commit to node family, not exact type |
| 3yr Reserved Instances | ~40% | Best for stable baseline workloads |
| Right-size after 1 week of metrics | 20-50% | Most teams over-provision 2× |
| Cluster mode: fewer large nodes vs. many small | Varies | Fewer nodes = less per-node overhead |
| CloudFront reserved capacity (>10TB/mo) | 10-15% | Volume pricing tiers kick in automatically |
| Increase TTLs (where tolerable) | Reduces DB costs | Even 30s → 60s TTL halves DB fan-out |
| DAX reserved nodes | ~30% | Same RI model as ElastiCache |
| Turn off dev/staging caches overnight | ~60% on off-hours | Use Lambda to start/stop via schedule |

---

## Common Mistakes and Fixes

### Mistake 1: Sizing cache to total dataset, not working set

**Problem**: Team caches 500 GB of data but only 20 GB is "hot" (accessed in last 24hr). They buy r6g.8xlarge × 2 unnecessarily.

**Fix**: Profile access patterns with CloudWatch `CacheHits`/`CacheMisses`. Size to the working set + 30% headroom. Working set is typically 5-20% of total data.

---

### Mistake 2: Ignoring Redis single-threaded CPU limit

**Problem**: App does 800K ops/s on a single r6g.xlarge (4 vCPU). Latency degrades. Team assumes 4 vCPUs = 4× capacity. Redis uses **1 thread for commands**.

**Fix**: Max reliable ops/s per shard is ~80-90% of the published figure. At 300K ops/s capacity, run at <270K ops/s sustained. Enable cluster mode to distribute across shards, not just replicas (replicas don't share write load).

---

### Mistake 3: Not pre-warming cache before traffic spikes

**Problem**: New deployment or cache flush causes thundering herd — all traffic hits DB simultaneously. DB overwhelmed. Cache hit rate: 0% for first 5-10 minutes.

**Fix**: Pre-warm cache before shifting traffic. Options: (a) run a warming script that reads top N keys from DB before go-live, (b) use blue/green with old cache intact, (c) set conservative DB connection pool limits + circuit breaker so cold-start doesn't cascade.

---

### Mistake 4: Using DAX for write-heavy or strongly consistent reads

**Problem**: Team enables DAX on an order-management table expecting speedup. Write latency increases (DAX adds a hop). Strongly consistent reads bypass DAX entirely — no benefit, just added cost.

**Fix**: Reserve DAX for read-heavy, eventually consistent access patterns (product catalog, user profiles, leaderboards). For write-heavy tables or financial consistency requirements, use ElastiCache with explicit application-layer cache invalidation.

---

### Mistake 5: CloudFront caching authenticated/user-specific API responses

**Problem**: Cache-Control header missing on `/api/user/profile`. CloudFront caches one user's response and serves it to others.

**Fix**: Always set `Cache-Control: private, no-store` on authenticated endpoints. Use CloudFront cache behaviors to explicitly set TTL=0 for `/api/user/*` paths. Audit cache behaviors quarterly.

---

## Key Numbers to Memorize

| Number | Meaning |
|--------|---------|
| r6g.xlarge = 26 GB, ~300K ops/s | Standard sizing anchor |
| r6g.2xlarge = 52 GB, ~600K ops/s | Typical production node |
| 90% hit rate = 10× DB traffic reduction | Core cache value prop |
| 1yr Reserved saves ~30%, 3yr ~40% | RI savings |
| Redis max connections: 65K per node | Connection pool sizing |
| DAX item cache TTL default: 5 min | Staleness baseline |
| CloudFront US: $0.0085/GB | CDN cost anchor |
| Evictions > 0 = immediate scale trigger | Operational alert threshold |

---

## References

- 📚 [Amazon ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/) — official node type and RI pricing
- 📚 [Amazon DAX Pricing](https://aws.amazon.com/dynamodb/dax/) — DAX node types and use-case guidance
- 📚 [Amazon CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/) — regional CDN pricing tiers
- 📖 [ElastiCache Best Practices — AWS Documentation](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/best-practices.html) — official sizing and HA recommendations
- 📖 [Caching Strategies and How to Choose the Right One](https://aws.amazon.com/caching/best-practices/) — AWS whitepaper on cache patterns
