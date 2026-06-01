---
title: "Video CDN — HLS Segment Delivery (1B Requests/Day) — Capacity Estimation"
layer: capacity-scenario
section: interview-prep/capacity-estimation/streaming
difficulty: advanced
traffic_scale: 1B requests/day, 12K avg RPS / 40K peak RPS
components: [CloudFront, S3, EC2, Lambda@Edge, Route53, WAF, ElastiCache, RDS Aurora, Kinesis, SQS]
cost_tier: "$300K–$600K/month"
tags: [cdn, hls, video-streaming, cloudfront, s3, lambda-edge, origin-shield, adaptive-bitrate, segment-delivery]
---

# Video CDN — HLS Segment Delivery (1B Requests/Day) — Capacity Estimation

## Problem Statement

A video platform serves 1 billion HTTP Live Streaming (HLS) segment requests per day across a global CDN. Each request fetches a short MPEG-TS or fMP4 segment (2–6 seconds of video) or an HLS manifest file (.m3u8). The system must deliver segments with sub-100ms TTFB from cache, support adaptive bitrate (ABR) ladder switching (240p–4K), and sustain 40K peak RPS during prime-time viewing windows — all while keeping origin servers below 5% of total request load via aggressive CDN caching.

## Functional Requirements

- Deliver HLS `.m3u8` playlist files and `.ts` / `.fmp4` segment files globally with low latency
- Support multi-bitrate ABR ladders: 240p (400 Kbps) → 360p (800 Kbps) → 720p (2.5 Mbps) → 1080p (5 Mbps) → 4K (15 Mbps)
- Cache HLS segments at CDN edge for minimum 24 hours (segments are immutable once written)
- Geo-restrict content delivery via signed URLs / signed cookies enforced at CloudFront
- Invalidate manifests (`.m3u8`) within 60 seconds for live-to-VOD transitions and DRM key rotations
- Log every segment request for analytics, DRM enforcement, and billing reconciliation

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Segment TTFB (cache hit) | < 50 ms (P99) |
| Segment TTFB (cache miss / origin) | < 500 ms (P99) |
| Manifest refresh latency | < 200 ms (P99) |
| CDN cache hit ratio | ≥ 95% |
| Availability | 99.99% (< 52 min/year) |
| Durability (origin segments) | 99.999999999% (S3 11 nines) |
| Peak throughput | 40K RPS |
| Read/Write ratio | 100:0 (pure read path) |
| Egress bandwidth (peak) | ~200 Gbps |

## Traffic Estimation

### DAU → Peak QPS Calculation

HLS streams are driven by concurrent viewers, not DAU in the traditional sense. At 1B requests/day, the traffic is request-count-based. We derive peak QPS from request volume and peak-hour multipliers.

| Metric | Calculation | Result |
|--------|-------------|--------|
| Total daily requests | Given | 1,000,000,000 |
| Average QPS | 1B / 86,400 s | ~11,574 RPS ≈ **12K RPS** |
| Peak-hour multiplier | Prime time = 3.3× avg (empirical: 2–4× is typical for VOD) | ~3.3× |
| Peak QPS | 12K × 3.3 | **~40K RPS** |
| CDN edge requests (95% cache hit) | 40K × 0.95 | ~38K RPS served from PoPs |
| Origin requests (5% cache miss) | 40K × 0.05 | **~2K RPS to origin** |
| Read QPS (100% reads) | 40K | **40K RPS** |
| Write QPS (segments uploaded async) | Out-of-band transcoding pipeline | ~0 on delivery path |

### Request Type Breakdown

| Request Type | % of Total | Requests/Day | Avg Object Size | Daily Egress |
|---|---|---|---|---|
| HLS manifest (.m3u8) | 8% | 80M | 2 KB | 160 GB |
| Video segment 240p (.ts) | 12% | 120M | 300 KB | 36 TB |
| Video segment 720p (.ts) | 35% | 350M | 750 KB | 263 TB |
| Video segment 1080p (.ts) | 30% | 300M | 1.5 MB | 450 TB |
| Video segment 4K (.ts) | 15% | 150M | 4.5 MB | 675 TB |
| **Total** | **100%** | **1B** | **~1.4 MB avg** | **~1.42 PB/day** |

> Note: 1.42 PB/day ≈ **49 TB/hour**, **~16.5 TB/month** per 1M daily requests. At 1B requests/day, total monthly egress ≈ **42.6 PB/month** before cache. With 95% cache hit ratio, origin fetch ≈ **2.1 PB/month**.

## Storage Estimation

| Data Type | Per Item Size | Daily Volume | Growth/Year |
|-----------|--------------|--------------|-------------|
| HLS segments (new content) | 750 KB avg | 5M new segments/day (uploads) | ~1.4 PB/year |
| HLS manifests | 2 KB | 500K new manifests/day | ~365 GB/year |
| Access logs (CloudFront) | 400 bytes/request | 1B req/day = 400 GB/day | ~146 TB/year |
| Analytics events (Kinesis → S3) | 200 bytes/event | 1B events = 200 GB/day | ~73 TB/year |
| DRM license records (Aurora) | 200 bytes/record | 50M sessions/day = 10 GB/day | ~3.6 TB/year |
| **Total origin S3** | — | ~5 PB existing catalog | **~1.4 PB/year new** |

> The S3 catalog is write-once/read-many. Segments are immutable after transcoding. Cache invalidation is only required for manifests (`.m3u8`).

## Component Sizing

### Compute — EC2 Origin Shield + Lambda@Edge

| Component | Instance Type | vCPU | RAM | Count | Handles | Monthly Cost |
|-----------|--------------|------|-----|-------|---------|-------------|
| Origin Shield (EC2, us-east-1) | c6g.4xlarge | 16 | 32 GB | 8 | 2K RPS cache-miss fills | $1,100/mo each = $8,800 |
| Origin Shield (EC2, eu-west-1) | c6g.4xlarge | 16 | 32 GB | 4 | regional failover | $1,100/mo each = $4,400 |
| Origin Shield (EC2, ap-southeast-1) | c6g.4xlarge | 16 | 32 GB | 4 | APAC origin fill | $1,100/mo each = $4,400 |
| Signed URL auth service | m6g.xlarge | 4 | 16 GB | 6 | token validation | $150/mo each = $900 |
| Lambda@Edge (viewer request) | Lambda | — | 128 MB | auto | geo-check, URL signing | $0.60/M invocations |
| Lambda@Edge (origin request) | Lambda | — | 256 MB | auto | cache key normalization | $0.60/M invocations |
| **Subtotal Compute** | | | | | | **~$19,500** |

> Lambda@Edge: 1B requests/day × 30 days = 30B invocations/month. At $0.60/1M = **$18,000/month** for Lambda@Edge. Origin-request Lambda fires only on cache miss: 50M/month × $0.60/1M = **$30/month** negligible.

> Revised Lambda@Edge total: viewer-request Lambda = 30B × $0.60/1M = **$18,000/month**

### Database

| DB | Engine | Instance | Count | Capacity | IOPS | Monthly Cost |
|----|--------|----------|-------|----------|------|-------------|
| Session / DRM state | RDS Aurora MySQL | db.r6g.xlarge | 1W + 2R | 500 GB | 6K | $700/mo (writer) + $500/mo × 2 = $1,700 |
| Metadata / catalog | RDS Aurora PostgreSQL | db.r6g.2xlarge | 1W + 2R | 2 TB | 12K | $1,400/mo (writer) + $900/mo × 2 = $3,200 |
| Analytics (cold) | S3 + Athena | Serverless | — | 146 TB/year | — | $730/mo (storage) + $5/TB scanned |
| **Subtotal DB** | | | | | | **~$5,500** |

### Cache

| Cache | Engine | Instance | Nodes | Memory | Monthly Cost |
|-------|--------|----------|-------|--------|-------------|
| Manifest cache (hot .m3u8) | ElastiCache Redis | r6g.xlarge | 3 | 96 GB total | $450/mo each = $1,350 |
| Session token cache | ElastiCache Redis | r6g.large | 2 | 26 GB total | $225/mo each = $450 |
| **Subtotal Cache** | | | | | **$1,800** |

> CloudFront is the primary cache for segments — ElastiCache is only used for manifest files and auth tokens that must be served from origin with low latency.

### Object Storage — S3

| Bucket | Use | Size | Requests/Month | Monthly Cost |
|--------|-----|------|----------------|-------------|
| `segments-origin` | HLS .ts / .fmp4 segments (catalog) | 5 PB | 1.5B (5% miss rate) | $115,000 (storage $0.023/GB × 5M GB) + $750 (GET) |
| `manifests-origin` | .m3u8 playlists | 10 TB | 120M | $230 (storage) + $60 (GET) |
| `access-logs` | CloudFront access logs | 146 TB/year | write-only | $3,358/mo (storage) |
| `analytics-raw` | Kinesis firehose → Parquet | 73 TB/year | — | $1,679/mo |
| **Subtotal S3** | | **~5 PB** | **~1.6B/month** | **~$121,000** |

> S3 storage dominates: 5 PB × $0.023/GB = **$115,000/month**. Intelligent-Tiering would reduce this to ~$90,000/month after frequent → infrequent transitions on old content.

### Networking / CDN

| Component | Throughput / Volume | Monthly Cost |
|-----------|---------------------|-------------|
| CloudFront egress (1.42 PB/day × 30 days = 42.6 PB/month) | 42.6 PB/month | $0.0085/GB first 10 PB + $0.008/GB next 40 PB ≈ **$340,000** |
| CloudFront HTTP requests (1B/day × 30 = 30B/month) | 30B HTTPS GETs | $0.0100/10K = **$30,000** |
| S3 origin egress to CloudFront (2.1 PB/month cache misses) | 2.1 PB/month | Free (S3 → CloudFront same-region = $0) |
| EC2 origin to CloudFront (origin shield) | 105 TB/month | $0.08/GB = **$8,400** |
| Route 53 DNS queries | 30B queries/month | $0.40/1M = **$12,000** |
| WAF (30B requests/month) | 30B web requests | $1.00/1M = **$30,000** + $5/rule/month |
| **Subtotal Network** | | **~$421,000** |

### Message Queue / Analytics Pipeline

| Queue / Stream | Engine | Throughput | Monthly Cost |
|---------------|--------|-----------|-------------|
| Playback events | Kinesis Data Streams | 12K events/s avg (40K peak), 24 shards | $0.015/shard-hr × 24 × 720 = **$259** |
| CDN log delivery | Kinesis Firehose → S3 | 400 GB/day | $0.029/GB = **$348/month** |
| Invalidation jobs | SQS FIFO | 500K msgs/month | < **$1** |
| **Subtotal Messaging** | | | **~$610** |

## Monthly Cost Summary

| Component | Monthly Cost | % of Total |
|-----------|-------------|-----------|
| CloudFront Egress | $340,000 | 56.7% |
| CloudFront Requests | $30,000 | 5.0% |
| S3 Storage (5 PB catalog) | $115,000 | 19.2% |
| S3 Requests & Logs | $6,000 | 1.0% |
| Route 53 | $12,000 | 2.0% |
| WAF | $30,000 | 5.0% |
| EC2 Origin Shield | $19,500 | 3.3% |
| Lambda@Edge | $18,000 | 3.0% |
| RDS Aurora (DB) | $5,500 | 0.9% |
| ElastiCache | $1,800 | 0.3% |
| Kinesis / SQS | $610 | 0.1% |
| Data Transfer (misc) | $8,400 | 1.4% |
| Other (CloudWatch, IAM, etc.) | $2,000 | 0.3% |
| **Total** | **~$588,810** | **100%** |

> **Cost range: $300K–$600K/month** depending on S3 Intelligent-Tiering savings, CloudFront reserved capacity pricing (up to 30% discount with 1-year commit), and actual cache hit ratio. At 97% cache hit ratio instead of 95%, egress drops ~40%, saving ~$136K/month.

## Traffic Scale Tiers

| Tier | Daily Requests | Peak QPS | Origin Shield | DB | Cache | Monthly Cost | Key Bottleneck |
|------|----------------|----------|---------------|----|-------|-------------|----------------|
| 🟢 Startup | 10M req/day | ~400 RPS | 1× c6g.large | 1 RDS t3.medium | 1 Redis node | ~$5,000 | S3 egress costs at low scale |
| 🟡 Growing | 50M req/day | ~2K RPS | 2× c6g.xlarge | RDS r6g.large + 1 read | Redis 2-node | ~$25,000 | Cache hit ratio — need CloudFront |
| 🔴 Scale-up | 200M req/day | ~8K RPS | 4× c6g.2xlarge | Aurora r6g.xlarge cluster | Redis 3-node cluster | ~$120,000 | S3 storage + CloudFront requests |
| ⚫ Production | 1B req/day | ~40K RPS | 16× c6g.4xlarge (3 regions) | Aurora r6g.2xlarge multi-AZ | Redis r6g.xlarge 5-node | ~$590,000 | CDN egress cost (56% of bill) |
| 🚀 Hyperscale | 10B req/day | ~400K RPS | Custom PoP hardware + ISP embed | DynamoDB global tables | Distributed edge cache | ~$4M+ | Last-mile bandwidth; must negotiate ISP peering (Netflix model) |

## Architecture Diagram

```mermaid
graph TD
    A[Viewer Device<br/>HLS Player] --> B[Route53<br/>Latency-based routing]
    B --> C[CloudFront CDN<br/>700+ PoPs globally]
    C -->|Cache HIT 95%| A
    C -->|Cache MISS 5%| D[WAF<br/>Rate limiting / geo-block]
    D --> E[Origin Shield<br/>EC2 c6g.4xlarge<br/>us-east-1 / eu-west-1 / ap-se-1]
    E -->|Segment fetch| F[S3 Origin<br/>5 PB catalog<br/>segments + manifests]
    E --> G[ElastiCache Redis<br/>Manifest cache]
    C --> H[Lambda@Edge<br/>Viewer Request<br/>Signed URL validation]
    H --> C
    C --> I[Lambda@Edge<br/>Origin Request<br/>Cache key normalization]
    I --> E
    E --> J[RDS Aurora<br/>DRM state / sessions]
    F --> K[S3 Intelligent-Tiering<br/>Auto cost optimization]
    A --> L[Playback Events<br/>Kinesis Data Streams]
    L --> M[S3 Analytics<br/>Parquet via Firehose]
    N[Transcoding Pipeline<br/>MediaConvert / EC2] -->|Write segments| F
```

## Interview Tips

- **Key insight — segments are immutable**: HLS `.ts` and `.fmp4` segments never change after upload. Set `Cache-Control: max-age=31536000, immutable` on segments and `Cache-Control: no-cache, max-age=5` on `.m3u8` manifests. This drives cache hit ratios above 99% for segments at the cost of manifest freshness, which is the correct trade-off.

- **Key insight — egress dominates cost**: CDN egress is 56% of the total bill. At 1B requests/day and average segment size of 1.4 MB, monthly egress is 42 PB. A 1% improvement in cache hit ratio (95% → 96%) reduces origin fill by 20% and saves ~$27K/month. Push interviewers to ask "what's your cache hit ratio?" — this is the single biggest cost lever.

- **Common mistake — sizing for QPS not bandwidth**: Candidates size servers for 40K RPS and forget that each request is 750 KB–4.5 MB. At 40K RPS × 1.4 MB avg = **56 GB/s = 448 Gbps** total egress bandwidth. CloudFront distributes this across 700+ PoPs, but you must verify your CloudFront distribution's bandwidth limit (default 150 Gbps per distribution — request a limit increase early).

- **Follow-up question — how do you handle a viral surge?**: A single viral video can 10× peak RPS in minutes. Answer: (1) CloudFront auto-scales, (2) S3 origin scales automatically, (3) the key risk is origin-shield EC2 fleet being overwhelmed by cache misses for the new hot object. Mitigation: request collapsing in CloudFront (single origin fetch for concurrent cache misses on same object), plus pre-warming S3 objects via CloudFront before publishing.

- **Scale threshold**: At 100M requests/day (~4K avg RPS), a single-region Origin Shield fleet of 2–4 instances handles load. Beyond 500M requests/day, deploy multi-region origin shield (us-east-1, eu-west-1, ap-southeast-1) with Route 53 latency routing to cut cross-region data transfer costs and reduce P99 TTFB for APAC/EMEA viewers from 300ms to under 80ms.

- **DRM and signed URL overhead**: Lambda@Edge adds 1–5 ms for signed URL validation on every cache miss. On cache hits, CloudFront validates the signature itself without invoking Lambda. Design your token expiry to match segment duration (e.g., 6-second tokens for 6-second segments) to prevent replay attacks without hammering Lambda on every request.
