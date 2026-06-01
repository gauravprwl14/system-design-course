---
title: "Image Processing CDN — Capacity Estimation"
layer: capacity-scenario
section: interview-prep/capacity-estimation/storage
difficulty: advanced
traffic_scale: 500M transforms/day
components: [Lambda, CloudFront, S3, SQS, EC2, ElastiCache Redis, RDS Aurora, ALB]
cost_tier: "$300K–$500K/month"
tags: [image-processing, cdn, lambda, sharp, cloudfront, s3, on-demand-resize, transforms]
---

# Image Processing CDN — Capacity Estimation

## Problem Statement

Design an on-demand image processing CDN that performs 500M image transforms per day — including resize, compress, and format conversion (JPEG → WebP/AVIF). Transforms are triggered by URL parameters (e.g., `?w=800&h=600&fmt=webp`) and results are cached at the edge. The system must handle a 5× traffic spike during flash sales and deliver transformed images in under 200ms P99.

## Functional Requirements

- On-demand image resize (width/height/crop) via URL parameters
- Format conversion: JPEG, PNG → WebP, AVIF
- Quality/compression control (e.g., `?q=80`)
- Transformed image caching at CloudFront edge (TTL-based)
- Original image upload and storage (S3)
- Cache invalidation API for updated originals
- Batch transformation job queue for pre-warming popular variants

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Transform latency (cache miss) | < 200ms (P99) |
| Transform latency (cache hit) | < 20ms (P99) |
| Availability | 99.99% |
| Durability (originals) | 99.999999999% (S3 11 9s) |
| Throughput | 6,000 transforms/s avg / 30,000 peak |
| Cache hit rate | ≥ 85% at edge |
| Max image input size | 50 MB |
| Max output dimensions | 8,000 × 8,000 px |

## Traffic Estimation

### DAU → Peak QPS Calculation

| Metric | Calculation | Result |
|--------|-------------|--------|
| Daily transforms | Given | 500,000,000 |
| Avg QPS | 500M / 86,400 s | ~5,787 ≈ **6,000/s** |
| Peak QPS (5× avg for flash sales) | 6,000 × 5 | **~30,000/s** |
| Cache hit rate | 85% served from CloudFront | ~25,500/s from cache |
| Cache miss QPS (Lambda / EC2) | 30,000 × 15% | **~4,500/s** |
| Read QPS (95%) | 30,000 × 0.95 | ~28,500/s |
| Write QPS — uploads (5%) | 30,000 × 0.05 | ~1,500/s |

**Key insight on cache hits**: A typical e-commerce site requests the same 10–20 variants of each product image (thumbnail, medium, large, WebP vs JPEG). With 85% cache hit rate, only 4,500 transforms/s reach compute on peak. Without caching, you'd need 10× the Lambda/EC2 capacity.

### Upload Volume Estimation

| Metric | Calculation | Result |
|--------|-------------|--------|
| New originals/day | 500M × 5% writes | 25M uploads/day |
| Avg original size | JPEG @ 3 MB | 3 MB |
| Raw upload volume/day | 25M × 3 MB | **75 TB/day** |
| Unique images in system | ~5B total (3-year corpus) | 5B |

## Storage Estimation

| Data Type | Per Item Size | Daily Volume | Annual Growth |
|-----------|--------------|--------------|---------------|
| Original images (S3) | 3 MB avg | 75 TB/day | **27 PB/year** |
| Transformed cache (S3 + CloudFront) | 150 KB avg | 3.75 TB/day (new variants) | **1.4 PB/year** |
| Transform metadata (RDS) | 500 B | 500M rows/day | ~180 GB/year |
| Job queue state (SQS) | 1 KB msg | 25M msgs/day | Negligible (TTL) |
| Redis cache index | 200 B/key | ~500M active keys | ~100 GB |
| **Total net-new/year** | — | — | **~28.8 PB/year** |

**Storage cost note**: S3 Intelligent-Tiering automatically moves originals older than 30 days to cheaper tiers. After 90 days of no access, objects move to Glacier Instant Retrieval at $0.004/GB vs $0.023/GB for S3 Standard — a 83% reduction for the long tail.

## Component Sizing

### Compute — Lambda (On-Demand Transform)

Lambda handles cache misses at 4,500 transforms/s peak. Using sharp.js (libvips), a single Lambda execution:
- 1,024 MB memory, 512 MB ephemeral storage
- Avg execution: 120ms for a 3 MB → WebP 800px resize
- Concurrency needed: 4,500 × 0.12s = **540 concurrent executions**
- With 20% headroom: **650 reserved concurrency**

| Component | Config | Count | Handles | Monthly Cost |
|-----------|--------|-------|---------|-------------|
| Transform Lambda | 1024 MB, arm64 | 650 concurrent | 4,500 transforms/s peak | ~$42,000 |
| Upload Lambda | 512 MB, arm64 | 100 concurrent | 1,500 uploads/s peak | ~$8,000 |
| Invalidation Lambda | 256 MB | 10 concurrent | Cache purge events | ~$500 |
| **Subtotal Lambda** | | | | **~$50,500** |

**Lambda cost math**: 500M transforms/day × 30 days = 15B invocations/month. At 120ms avg duration, 1024 MB: 15B × 0.12s × 1 GB = 1.8B GB-seconds. At $0.0000133/GB-s (arm64) = **$23,940**. Plus $0.20/1M requests × 15,000M = **$3,000**. Plus data transfer from S3 within region (~free). Cache miss transforms only = 15B × 15% = 2.25B invocations ≈ **~$7,000 Lambda compute** for transforms. Total Lambda including uploads ~$50K.

### Compute — EC2 (Batch Pre-warming)

Pre-warm popular image variants (top 10K SKUs × 20 variants = 200K transforms) before peak hours.

| Component | Instance Type | vCPU | RAM | Count | Handles | Monthly Cost |
|-----------|--------------|------|-----|-------|---------|-------------|
| Batch transform workers | c6g.2xlarge | 8 | 16 GB | 20 | ~500 batch transforms/s | ~$4,400 |
| Upload processors | m6g.xlarge | 4 | 8 GB | 10 | S3 event fan-out | ~$1,100 |
| Admin / API servers | t4g.medium | 2 | 4 GB | 4 | Internal APIs | ~$440 |
| **Subtotal EC2** | | | | **34** | | **~$5,940** |

### Database — RDS Aurora

Stores transform job metadata, cache key index, user/tenant configs, and audit logs.

| DB | Engine | Instance | Count | Capacity | IOPS | Monthly Cost |
|----|--------|----------|-------|----------|------|-------------|
| Metadata primary | RDS Aurora MySQL | db.r6g.2xlarge | 1W + 2R | 5 TB | 50,000 | ~$18,000 |
| Config/tenant DB | RDS Aurora Serverless v2 | 2–32 ACUs | 1 | 100 GB | Auto | ~$3,500 |
| **Subtotal DB** | | | | | | **~$21,500** |

**Why Aurora over DynamoDB here**: Transform metadata has relational join patterns (tenant → image → variant → cache_status). DynamoDB would require denormalization. Aurora Serverless v2 for config scales to zero when admin traffic drops at night.

### Cache — ElastiCache Redis

Redis stores: (1) transform result cache keys (to avoid re-computing), (2) rate limiting counters per tenant, (3) hot-path config lookups.

| Cache | Engine | Instance | Nodes | Memory | Monthly Cost |
|-------|--------|----------|-------|--------|-------------|
| Transform key index | ElastiCache Redis 7 | r6g.2xlarge | 6 (3 primary + 3 replica) | 192 GB total | ~$13,200 |
| Rate limiting | ElastiCache Redis 7 | r6g.large | 2 | 26 GB | ~$2,200 |
| **Subtotal Cache** | | | | **218 GB** | **~$15,400** |

**Memory sizing**: 500M active cache keys × 200 bytes/key = 100 GB. 192 GB gives 90% headroom for hash overhead and hot-key clustering.

### Object Storage — S3

| Bucket | Use | Size | PUT/month | GET/month | Monthly Cost |
|--------|-----|------|-----------|-----------|-------------|
| originals-prod | Raw uploaded images | 2.7 PB (3-yr corpus) | 750M | 450M | ~$68,000 |
| transforms-cache | Cached transform outputs | 420 TB | 675M | 6.75B | ~$18,000 |
| batch-jobs | SQS DLQ overflow, manifests | 5 TB | 25M | 25M | ~$200 |
| **Subtotal S3** | | **~3.1 PB** | | | **~$86,200** |

**S3 cost breakdown for originals**:
- Storage: 2,700 TB × $0.023/GB = $62,100
- PUT requests: 750M × $0.005/1K = $3,750
- GET requests: 450M × $0.0004/1K = $180
- S3 Intelligent-Tiering fee: ~$2,000
- Total: ~$68,000

### Networking / CDN — CloudFront

85% of 30,000 peak transforms/s = 25,500 cache hits/s served from CloudFront. Avg transformed image = 150 KB.

| Metric | Calculation | Result |
|--------|-------------|--------|
| Cache-hit bandwidth/s (peak) | 25,500 × 150 KB | 3.8 GB/s |
| Monthly cache-hit data transfer | 500M × 85% × 150 KB | **63.75 TB/month** |
| Cache-miss origin fetch | 500M × 15% × 150 KB | 11.25 TB/month |
| Total CF data transfer | ~75 TB/month | 75 TB |

| Component | Throughput | Monthly Cost |
|-----------|-----------|-------------|
| CloudFront data transfer (first 10 TB) | 10 TB × $0.085/GB | $850 |
| CloudFront data transfer (next 40 TB) | 40 TB × $0.080/GB | $3,200 |
| CloudFront data transfer (next 25 TB) | 25 TB × $0.060/GB | $1,500 |
| CloudFront HTTPS requests (500M × 85%) | 425M × $0.0100/10K | $4,250 |
| CloudFront origin requests (cache miss) | 75M × $0.0085/10K | $638 |
| ALB (internal) | 4,500 req/s × 30 days | ~$3,500 |
| **Subtotal Network** | | **~$13,938** |

### Message Queue — SQS

| Queue | Use | Throughput | Monthly Cost |
|-------|-----|-----------|-------------|
| upload-events | Trigger transform pre-warm on new upload | 1,500 msg/s peak | ~$1,800 |
| batch-transform | Pre-warm jobs for top-K images | 500 msg/s | ~$600 |
| invalidation | CloudFront cache purge requests | 50 msg/s | ~$100 |
| dlq-* | Dead letter queues for each above | Low volume | ~$50 |
| **Subtotal SQS** | | | **~$2,550** |

**SQS cost math**: upload-events = 1,500/s × 86,400 × 30 = 3.9B messages/month. At $0.40/1M after first 1M free = 3,899M × $0.40 = **$1,560** + API calls ~$240 = $1,800.

### Other Services

| Service | Use | Monthly Cost |
|---------|-----|-------------|
| Lambda@Edge | URL parameter parsing at edge | ~$3,000 |
| WAF | Rate limiting, bot protection | ~$2,500 |
| Route 53 | DNS failover, health checks | ~$500 |
| CloudWatch / X-Ray | Metrics, tracing, dashboards | ~$2,000 |
| Secrets Manager | API keys, S3 credentials | ~$200 |
| **Subtotal Other** | | **~$8,200** |

## Monthly Cost Summary

| Component | Monthly Cost | % of Total |
|-----------|-------------|-----------|
| Lambda (transform + upload) | $50,500 | 12.8% |
| EC2 (batch + admin) | $5,940 | 1.5% |
| RDS Aurora | $21,500 | 5.5% |
| ElastiCache Redis | $15,400 | 3.9% |
| S3 Storage + Requests | $86,200 | 21.9% |
| CloudFront CDN | $13,938 | 3.5% |
| SQS Messaging | $2,550 | 0.6% |
| Lambda@Edge + WAF + Other | $8,200 | 2.1% |
| Data Transfer (inter-region, egress) | $12,000 | 3.0% |
| Reserved Instance discounts (−30%) | −$32,000 | −8.1% |
| Support + misc (5%) | $18,000 | 4.6% |
| **Total** | **~$202,228** | **100%** |

**Note on $300K–$500K range**: The baseline above (~$202K) represents an optimized Reserved Instance deployment. The $300K–$500K range reflects:
- On-demand pricing (no RI commitment): +50% = ~$303K
- Multi-region active-active (2× compute): +$100K
- Enterprise support tier: +$30K
- Compliance tooling (Macie, Config, GuardDuty): +$15K
- Realistic $300K–$500K for full production with redundancy.

## Traffic Scale Tiers

| Tier | Daily Transforms | Peak QPS | Lambda Concurrency | EC2 Batch | S3 | Cache | Monthly Cost | Key Bottleneck |
|------|-----------------|----------|--------------------|-----------|----|----|-------------|----------------|
| 🟢 Startup | 5M/day | ~175/s | 50 concurrent | 2× c6g.large | 10 TB | 1 Redis r6g.large | ~$4,000 | Cold start latency on Lambda burst |
| 🟡 Growing | 50M/day | ~1,750/s | 200 concurrent | 5× c6g.xlarge | 100 TB | Redis cluster 3-node | ~$25,000 | S3 GET request costs; need CF |
| 🔴 Scale-up | 200M/day | ~7,000/s | 400 concurrent | 10× c6g.2xlarge | 500 TB | Redis cluster 6-node | ~$100,000 | Lambda concurrency limits (1000 default) |
| ⚫ Production | 500M/day | ~30,000/s peak | 650 concurrent | 20× c6g.2xlarge | 3 PB | Redis cluster 12-node | ~$300,000 | S3 storage cost (largest line item) |
| 🚀 Hyperscale | 5B/day | ~300,000/s peak | 6,500+ concurrent | Custom image servers | 30 PB | Distributed Redis / KeyDB | ~$2.5M | Regional CloudFront capacity; multi-PoP needed |

## Architecture Diagram

```mermaid
graph TD
    Client[Client Browser / Mobile App]
    CF[CloudFront Edge - 85% cache hit]
    WAF[AWS WAF + Shield]
    LE[Lambda@Edge - URL param parse]
    ALB[Application Load Balancer]
    TL[Transform Lambda - sharp.js arm64]
    S3O[S3 originals-prod - 3 PB]
    S3C[S3 transforms-cache - 420 TB]
    Redis[ElastiCache Redis Cluster - 192 GB]
    SQS[SQS - upload-events + batch-transform]
    Batch[EC2 Batch Workers - c6g.2xlarge x20]
    RDS[RDS Aurora - transform metadata]
    Upload[Upload Lambda - S3 multipart]
    Admin[Admin EC2 - config API]

    Client -->|HTTPS image request| WAF
    WAF --> CF
    CF -->|cache miss| LE
    LE -->|forward to origin| ALB
    ALB --> TL
    TL -->|check key exists| Redis
    Redis -->|miss - fetch original| S3O
    TL -->|transform with sharp| TL
    TL -->|store result| S3C
    TL -->|write cache key| Redis
    TL -->|log metadata| RDS
    S3C -->|serve result| CF
    CF -->|cached edge response| Client

    Client -->|upload original| Upload
    Upload -->|store| S3O
    Upload -->|notify| SQS
    SQS -->|batch pre-warm job| Batch
    Batch -->|read original| S3O
    Batch -->|write variants| S3C
    Batch -->|update metadata| RDS

    Admin -->|cache invalidation| CF
    Admin -->|config CRUD| RDS
```

## Interview Tips

- **Key insight — cache key design**: The cache key must encode every transform parameter: `md5(original_key + "?w=800&h=600&fmt=webp&q=80")`. If you use a naive URL hash, a single pixel difference in crop coordinates creates a new cache entry, destroying your hit rate. Canonicalize parameter order before hashing.

- **Key insight — Lambda cold starts**: At 6,000 transforms/s avg with 500ms cold starts on JVM-based alternatives, you'd add 3B seconds of cold-start latency/day. This is why the stack uses Node.js + sharp.js on arm64 — cold start is 200–400ms vs 2–8s for Java. Provision Concurrency on Lambda (keeping 200 instances warm) costs ~$8K/month but eliminates cold starts for 95% of traffic.

- **Key insight — S3 is 43% of cost**: At scale, object storage dominates. Optimizations: (1) S3 Intelligent-Tiering for originals older than 30 days saves ~60% on storage, (2) storing only the top-50 most-requested variants per image in S3 cache instead of every unique combination, (3) setting transform-cache TTL to 7 days with LRU eviction policy through S3 lifecycle rules.

- **Common mistake — not accounting for the origin fetch**: Candidates say "CloudFront handles 85% of traffic so Lambda only does 15%." True — but they forget the origin fetch path: CloudFront still has to pull the original from S3 to pass to Lambda on a cache miss. S3 → Lambda data transfer within the same region is free, but Lambda must be in the same region as S3 to avoid $0.09/GB cross-region charges. This doubles your effective Lambda data transfer cost if placed naively.

- **Follow-up question — multi-tenant isolation**: "How do you prevent one tenant's bulk upload from starving other tenants' real-time transforms?" Answer: SQS FIFO queues per tenant tier (free-tier vs paid), Lambda reserved concurrency split per tier (200 for paid, 50 for free), and token bucket rate limiting in Redis per `tenant_id` at the ALB layer before Lambda invocation.

- **Scale threshold**: At 1B transforms/day (~11,500 avg QPS), Lambda concurrency limits (default 1,000 per region, max 10,000 with quota increase) become the ceiling. At that scale, migrate the hot transform path to a persistent fleet of c6gn.4xlarge instances with libvips running as a daemon — removing Lambda cold start overhead and achieving 3× throughput per dollar. Lambda unit cost at scale: $0.10/1K transforms vs $0.03/1K on EC2 fleet.
