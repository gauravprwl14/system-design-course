---
title: "Typeahead/Autocomplete — Capacity Estimation"
layer: capacity-scenario
section: interview-prep/capacity-estimation/search
difficulty: intermediate
traffic_scale: 100M DAU
components: [EC2 c5.2xlarge, ElastiCache Redis, DynamoDB, CloudFront, Lambda@Edge, ALB, SQS]
cost_tier: "$50K–$90K/month"
tags: [typeahead, autocomplete, search, redis, trie, dynamodb, cloudfront]
---

# Typeahead/Autocomplete — Capacity Estimation

## Problem Statement

Design the backend capacity for a typeahead/autocomplete service serving 100M DAU. Users type an average of 5 characters per query triggering a suggestion API call per keystroke, producing ~2M peak QPS. The system must return ranked suggestions in under 100ms P99, blending personalized history with globally trending terms boosted by recency and popularity signals.

## Functional Requirements

- Return top-10 autocomplete suggestions per keystroke (per-character query)
- Rank suggestions using a blend of global popularity, recency, and user-specific search history
- Surface trending terms within 60 seconds of a spike (near-real-time trending boost)
- Support prefix matching across 500M+ indexed terms (product names, queries, entities)
- Serve suggestions in multiple languages (Unicode prefix support)
- Degrade gracefully to global suggestions when personalization data is cold

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Read latency (suggestions API) | < 50ms P50 / < 100ms P99 |
| Write latency (query ingestion) | < 500ms P99 (async; best-effort) |
| Availability | 99.99% (< 52 min downtime/year) |
| Durability (query log) | 99.999% (eleven nines for analytics) |
| Throughput | 2M QPS peak read; 20K QPS peak write |
| Consistency | Eventually consistent (stale suggestions OK within 60s) |

## Traffic Estimation

### DAU → Peak QPS Calculation

| Metric | Calculation | Result |
|--------|-------------|--------|
| DAU | Given | 100M |
| Avg searches per user per day | ~4 searches/user (Google benchmark) | 4 |
| Avg keystrokes per search | ~5 chars typed before click | 5 |
| Autocomplete API calls/user/day | 4 searches × 5 keystrokes | 20 |
| Total daily autocomplete requests | 100M × 20 | 2B |
| Avg QPS (over 86,400s) | 2B / 86,400 | ~23,150 |
| Peak multiplier (3× avg; 8-hour active window) | avg × 3 (evening + lunch peak) | ~70K avg-peak |
| True burst peak (top 10-min spike; 30× avg) | 23,150 × 87 | **~2M QPS** |
| Read QPS (99% reads) | 2M × 0.99 | ~1.98M |
| Write QPS (1% — click/impression events) | 2M × 0.01 | ~20K |

**Derivation of 30× burst**: 100M users concentrated in prime-time (6–10 PM local) across 3–4 time zones create a 30–40 minute window where global concurrency is 30× the 24-hour average. This is the design target for cache + CDN.

### Query Fanout

Each user keystroke generates:
1. 1 autocomplete read (from Redis/CDN edge) — **~2M QPS**
2. 1 impression log write (async, SQS) — **~20K msg/s**
3. 1 click event (on selection) — **~8K events/s** (40% CTR × 20K writes)

## Storage Estimation

| Data Type | Per Item Size | Daily Volume | Growth/Year |
|-----------|--------------|--------------|-------------|
| Query index (trie terms) | 200 B avg (term + metadata) | +50K new terms/day | ~3.6 GB/year |
| Trending counters (Redis sorted sets) | 64 B per term (score + member) | 500M active prefixes | ~11 GB/year |
| User search history | 150 B per query (compressed) | 100M × 4 queries | ~60 GB/day raw |
| User history (hot 30 days) | 150 B × 120 queries/user | 100M users | **1.8 TB total** |
| Query log (DynamoDB / S3) | 300 B per raw event | 2B events/day | **220 TB/year** (S3 Glacier) |
| Trie snapshot (full, compressed) | — | 500M terms × 50 B compressed | **~25 GB** (fits in RAM) |
| **Total hot storage** | — | — | **~2 TB** |
| **Total cold/archive** | — | — | **~220 TB/year** |

**Key insight**: The hot working set (top-1M prefixes × top-10 results) fits in ~4 GB of Redis memory. Cold prefixes (long-tail) are served from DynamoDB with a ~5ms penalty — acceptable at P99.

## Component Sizing

### Compute — EC2 / Lambda@Edge

| Component | Instance Type | vCPU | RAM | Count | Handles | Monthly Cost |
|-----------|--------------|------|-----|-------|---------|-------------|
| Autocomplete API servers | c5.2xlarge | 8 | 16 GB | 60 | ~33K QPS/server; 60 servers → 2M | $7,344 |
| Trending aggregator workers | c5.xlarge | 4 | 8 GB | 10 | 20K events/s total | $612 |
| Lambda@Edge (prefix cache hit) | Lambda@Edge | — | 128–512 MB | auto | First-hit cache; ~200M req/day | $3,200 |
| **Subtotal Compute** | | | | | | **$11,156** |

**c5.2xlarge capacity math**: 1 autocomplete request costs ~0.2ms CPU (Redis lookup + merge + JSON encode). At 8 vCPU × 1000ms / 0.2ms = 40,000 req/s theoretical; with 80% util target → **32K req/s per server**. 2M QPS / 32K = 63 servers → round to **60 with 5% headroom + auto-scaling**.

**c5.2xlarge on-demand (us-east-1, 2024)**: $0.34/hr × 730 hr × 60 = **$14,892/month**. With 50% Savings Plans (3-year): ~**$7,446/month**.

### Database

| DB | Engine | Instance | Count | Capacity | IOPS | Monthly Cost |
|----|--------|----------|-------|----------|------|-------------|
| Term index + user history | DynamoDB (on-demand) | — | — | ~2 TB | ~50K RCU + 5K WCU | $12,400 |
| Query log archive | S3 Standard-IA | — | — | 220 TB/year | — | $2,750/yr → $229/mo |
| **Subtotal DB** | | | | | | **$12,629** |

**DynamoDB cost breakdown**:
- Storage: 2 TB × $0.25/GB = $512/mo
- On-demand reads: 1.98M QPS × 0.03 RCU avg (1 KB items) × $0.00013 per RCU = ~$7,700/mo (80% served from Redis cache, so 20% hit DynamoDB) → 396K actual DDB reads/s × 3600 × 730 × $0.00013 / 1M RCUs = ~$3,100/mo
- On-demand writes: 20K WCU/s × 3600 × 730 × $0.00065 / 1M WCUs = ~$34/mo (mostly async batched)
- Total: ~**$4,000/mo** (realistic with 80% cache hit rate)

*Revised subtotal with cache offload: $4,000 + $229 = **$4,229/month***.

### Cache

| Cache | Engine | Instance | Nodes | Memory | Monthly Cost |
|-------|--------|----------|-------|--------|-------------|
| Prefix suggestion cache (hot trie) | ElastiCache Redis 7 | r6g.2xlarge | 6 (3 primary + 3 replica) | 52 GB each → 156 GB usable | $10,950 |
| Trending sorted sets | ElastiCache Redis 7 | r6g.xlarge | 2 (1P + 1R) | 26 GB each | $1,460 |
| User session / personalization | ElastiCache Redis 7 | r6g.large | 4 (2P + 2R) | 13 GB each | $1,460 |
| **Subtotal Cache** | | | | | **$13,870** |

**r6g.2xlarge on-demand (us-east-1, 2024)**: $0.498/hr × 730 hr × 6 nodes = $2,183 × 5 nodes correction → **$10,950/month**.

**Why 156 GB Redis?**: Top-1M prefixes × 10 suggestions × 150 B per suggestion = 1.5 GB for pure suggestions. Add sorted-set overhead (trending scores per prefix), user-prefix bitmaps, and 3× replication headroom → **~50 GB working set**. Over-provision to 156 GB to avoid eviction on traffic spikes.

### Object Storage

| Bucket | Use | Size | Requests/month | Monthly Cost |
|--------|-----|------|----------------|-------------|
| Query logs (raw) | Analytics / training data | 18 TB/month | 60M PUT | $414 |
| Trie snapshots | Daily backups for cold start | 25 GB × 30 = 750 GB | 30 GET | $17 |
| Lambda@Edge bundles | Edge deployment artifacts | 5 GB | 10K | $0.12 |
| **Subtotal S3** | | | | **$431** |

### Networking / CDN

| Component | Throughput | Monthly Cost |
|-----------|-----------|-------------|
| CloudFront (suggestions JSON) | ~5 TB/month (avg 2.5 KB per response × 2B req/day) | $450 |
| Lambda@Edge invocations | ~200M req/month (cache misses only) | $400 |
| ALB (API tier) | 2M QPS peak; ~3B req/month | $1,200 |
| Data transfer out (EC2 → Internet) | ~15 TB/month | $1,350 |
| **Subtotal Network** | | **$3,400** |

**CloudFront pricing (2024)**: First 10 TB/month = $0.085/GB → 5 TB × $0.085 = **$425/mo**.
**ALB**: $0.008/LCU × 375M LCUs/month (estimate at 2M QPS) ≈ $1,200/mo. CloudFront absorbs ~70% of requests; ALB only sees cache-miss traffic (~600K QPS effective) → actual LCU load lower; **$600/mo** realistic.

### Message Queue

| Queue | Engine | Throughput | Monthly Cost |
|-------|--------|-----------|-------------|
| Impression events | SQS Standard | 20K msg/s → 1.7B msg/month | $680 |
| Click events | SQS Standard | 8K msg/s → 690M msg/month | $276 |
| Trending aggregation | SQS Standard | 28K msg/s combined | $0 (included above) |
| **Subtotal Messaging** | | | **$956** |

**SQS pricing (2024)**: First 1M requests free; $0.40 per million after. 1.7B impressions × $0.40/M = **$680/mo**.

## Monthly Cost Summary

| Component | Monthly Cost | % of Total |
|-----------|-------------|-----------|
| EC2 Compute (c5 servers) | $7,446 | 11% |
| Lambda@Edge | $3,200 | 5% |
| DynamoDB | $4,229 | 6% |
| ElastiCache Redis | $13,870 | 21% |
| S3 Storage | $431 | 1% |
| CloudFront CDN | $450 | 1% |
| ALB | $600 | 1% |
| SQS Messaging | $956 | 1% |
| Data Transfer | $1,350 | 2% |
| Lambda@Edge (compute) | $400 | 1% |
| **Subtotal (on-demand)** | **$32,932** | **50%** |
| Reserved/Savings Plans discount (approx 40%) | -$13,173 | -20% |
| Support + monitoring (CloudWatch, X-Ray) | $3,000 | 5% |
| Redundancy / multi-AZ overhead | $8,000 | 12% |
| Engineering buffer (misc services) | $5,000 | 8% |
| **Total Estimated** | **~$55,759** | **100%** |

*Range: $50K (lean, high reserved coverage) → $90K (on-demand, full redundancy, multi-region active-active).*

## Traffic Scale Tiers

| Tier | DAU | Peak QPS | Servers | DB | Cache | Monthly Cost | Key Bottleneck |
|------|-----|----------|---------|----|----|-------------|----------------|
| 🟢 Startup | 1M | ~20K | 2× c5.large | 1 RDS MySQL (db.t3.medium) | 1 Redis node (r6g.large) | $1,200 | Single Redis node; no replication |
| 🟡 Growing | 10M | ~200K | 8× c5.xlarge | DynamoDB on-demand | Redis cluster 3-node | $8,500 | Hot prefix contention in Redis; need sharding |
| 🔴 Scale-up | 100M | ~2M | 60× c5.2xlarge | DynamoDB + DAX | Redis cluster 6-node | $55K | Lambda@Edge cache ratio; trending lag |
| ⚫ Production | 500M | ~10M | 200× c5.4xlarge + ASG | DynamoDB global tables | Redis cluster 12-node + replica | $220K | Multi-region consistency; trending fanout |
| 🚀 Hyperscale | 1B+ | ~20M | 400×+ c5.4xlarge + k8s | DynamoDB global / Cassandra | Distributed Redis + local L1 | $500K+ | Inter-region trie sync; real-time ML reranking latency |

## Architecture Diagram

```mermaid
graph TD
    A[User Browser / Mobile App] --> B[CloudFront CDN\nEdge Cache - 70% hit rate]
    B --> C[Lambda@Edge\nPrefix normalization\nCache-key generation]
    C --> D[ALB\nHTTP/2 + connection pool]
    D --> E[EC2 c5.2xlarge\nAutocomplete API Servers x60\nAuto Scaling Group]

    E --> F[ElastiCache Redis Cluster\nHot Trie - Sorted Sets\n6 nodes / 156 GB]
    E --> G[DynamoDB\nCold prefix index\nUser history table]
    E --> H[SQS Standard\nImpression + Click events\n20K msg/s]

    F --> F1[Primary Shard 1\nPrefixes A-H]
    F --> F2[Primary Shard 2\nPrefixes I-P]
    F --> F3[Primary Shard 3\nPrefixes Q-Z]

    H --> I[EC2 c5.xlarge\nTrending Aggregator Workers x10]
    I --> F
    I --> J[S3 / Query Log Archive\n220 TB/year]

    G --> K[DynamoDB Global Tables\nMulti-AZ replication]

    style B fill:#FF9900,color:#000
    style F fill:#DC382D,color:#fff
    style G fill:#4053D6,color:#fff
    style E fill:#232F3E,color:#fff
    style I fill:#232F3E,color:#fff
```

## Interview Tips

- **Key insight — Redis sorted sets are the trie**: Instead of implementing a custom trie, store each prefix as a Redis sorted set key (e.g., `prefix:go`) with members being suggestion strings and scores being popularity × recency. A `ZREVRANGE prefix:go 0 9` returns top-10 in O(log N). This eliminates custom data structure complexity and leverages Redis's built-in atomic increment for trending scores. The hot working set (~4 GB for top-1M prefixes) fits in a single r6g.xlarge — sharding is only needed at 200M+ DAU.

- **Key insight — CDN is your first-level cache**: For a 100-character alphabet, top-3 prefix lengths cover 97%+ of popular queries. These responses are static for ~60 seconds. Pushing CloudFront TTL to 60s with a `Vary: Accept-Language` header absorbs 70–80% of traffic at the edge. This drops your origin QPS from 2M to ~400K — the single most impactful optimization. Lambda@Edge normalizes the prefix (lowercase, trim whitespace) before cache key generation to maximize hit rate.

- **Common mistake — Under-sizing the write path**: Candidates focus on read QPS (2M) and forget that 100M users × 4 searches/day = 400M events/day hitting the trending pipeline. At 20K writes/s, a synchronous write to DynamoDB would be $34K/month in WCUs. The correct answer is async batching via SQS + a Flink/Lambda aggregator that writes aggregated delta-scores to Redis every 5 seconds. This reduces DynamoDB writes by 99.9% and keeps trending latency under 60s.

- **Follow-up question — "How do you prevent query injection / abuse?"**: Interviewers test whether you think about adversarial inputs. Answer: (1) Lambda@Edge enforces 50-char max prefix, strips non-printable Unicode, rate-limits per IP to 50 req/s using a CloudFront WAF rule; (2) The trending aggregator uses a sliding-window count-min-sketch (not a naive counter) to detect sudden spikes from a single IP cluster before they pollute global suggestions; (3) Suggestions are filtered through a blocklist stored in a 100MB Bloom filter on each API server, checked before Redis.

- **Scale threshold**: At 10M DAU, a single Redis node with 26 GB RAM handles the hot trie comfortably (~500K active prefixes). At 100M DAU, you need a 6-node Redis cluster because (a) the hot prefix keyspace grows to ~5M prefixes, (b) peak QPS exceeds single-node throughput (~100K ops/s). At 1B DAU, you need a local L1 in-process cache (LRU, 512 MB per API server) in front of Redis, because even 400K Redis ops/s across 400 servers creates ~160M Redis ops/s — far beyond cluster capacity without L1 offload.
