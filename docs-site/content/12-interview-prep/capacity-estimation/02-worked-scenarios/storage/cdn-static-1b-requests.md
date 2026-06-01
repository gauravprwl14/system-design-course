---
title: "Static Assets CDN — 1B Requests/Day — Capacity Estimation"
layer: capacity-scenario
section: interview-prep/capacity-estimation/storage
difficulty: intermediate
traffic_scale: 1B requests/day
components: [CloudFront, S3, EC2, Lambda@Edge, WAF, Route53, ElastiCache, ALB]
cost_tier: "$150K–$300K/month"
tags: [cdn, static-assets, cloudfront, s3, image-optimization, edge-computing]
---

# Static Assets CDN — 1B Requests/Day — Capacity Estimation

## Problem Statement

Design a globally distributed CDN infrastructure to serve static assets (JS, CSS, images, fonts) for a large-scale web platform receiving 1 billion requests per day. The system must deliver sub-50ms latency to users worldwide, handle 50K peak RPS with 99.99% availability, and efficiently serve assets from 200+ CloudFront PoPs while minimizing origin load through aggressive caching.

## Functional Requirements

- Serve JS, CSS, image, font, and video thumbnail assets globally
- On-the-fly image optimization (resize, format conversion to WebP/AVIF)
- Cache invalidation within 60 seconds of asset deployment
- Versioned asset URLs for cache-busting (`/assets/app.abc123.js`)
- WAF protection against DDoS and bot traffic
- Real-time access logs and cache hit ratio metrics

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| P50 latency (cache hit) | < 10ms |
| P99 latency (cache hit) | < 50ms |
| P99 latency (cache miss / origin) | < 500ms |
| Availability | 99.99% (< 52 min downtime/year) |
| Durability (S3 origin) | 99.999999999% (11 nines) |
| Peak throughput | 50,000 RPS |
| Cache hit ratio | > 95% |
| Image optimization latency | < 200ms (Lambda@Edge) |

## Traffic Estimation

### Requests/Day → Peak QPS Calculation

| Metric | Calculation | Result |
|--------|-------------|--------|
| Total daily requests | Given | 1,000,000,000 |
| Avg QPS | 1B / 86,400 sec | ~11,574 RPS |
| Peak QPS (4.3× avg) | 11,574 × 4.3 | ~50,000 RPS |
| Cache hit QPS (97%) | 50,000 × 0.97 | ~48,500 RPS |
| Cache miss / origin QPS (3%) | 50,000 × 0.03 | ~1,500 RPS |
| Image optimization QPS (15% of all) | 50,000 × 0.15 | ~7,500 RPS |

**Peak factor rationale**: CDN traffic spikes sharply during business hours and app releases. 4.3× accounts for a 2-hour peak window receiving 33% of daily traffic.

### Asset Type Breakdown

| Asset Type | % of Requests | Avg Size | Peak RPS | Bandwidth (peak) |
|------------|--------------|----------|----------|-----------------|
| Images (JPG/PNG/WebP) | 65% | 80 KB | 32,500 | ~2.6 GB/s |
| JavaScript bundles | 15% | 250 KB | 7,500 | ~1.9 GB/s |
| CSS files | 8% | 40 KB | 4,000 | ~160 MB/s |
| Fonts (WOFF2) | 7% | 60 KB | 3,500 | ~210 MB/s |
| Video thumbnails | 5% | 120 KB | 2,500 | ~300 MB/s |
| **Total** | **100%** | **~90 KB avg** | **50,000** | **~5.2 GB/s** |

### Monthly Bandwidth

```
Avg request size = 90 KB
Monthly requests = 1B × 30 = 30B requests
Monthly egress   = 30B × 90 KB = 2,700 TB = 2.7 PB/month
```

## Storage Estimation

| Data Type | Per Item Size | Total Assets | Storage |
|-----------|--------------|--------------|---------|
| Original images | 200 KB avg | 50M unique | 10 TB |
| Optimized image variants (WebP/AVIF, 5 sizes each) | 60 KB avg | 250M variants | 15 TB |
| JS/CSS bundles | 300 KB avg | 500K files | 150 GB |
| Fonts | 80 KB avg | 50K files | 4 GB |
| Video thumbnails | 120 KB avg | 20M files | 2.4 TB |
| Access logs (compressed) | 200 bytes/req | 1B req/day | 200 GB/day → 6 TB/month |
| **Total S3 origin** | — | — | **~34 TB** |

New assets added per day: ~100K images + 50 deploys = ~20 GB/day growth.

## Component Sizing

### CDN — CloudFront

| Parameter | Value | Notes |
|-----------|-------|-------|
| PoPs used | 200+ | Global coverage via CloudFront standard |
| Cache TTL (versioned assets) | 1 year (31,536,000s) | Immutable — hash in filename |
| Cache TTL (index/manifest) | 60 seconds | Short for deployment agility |
| Cache hit ratio target | 97% | Achieved via versioned URLs + no query-string variance |
| Peak egress bandwidth | ~5.2 GB/s | Distributed across PoPs |
| Monthly data transfer | ~2.7 PB | Price tier: first 10TB at $0.085/GB, then drops |

CloudFront serves 97% of requests from edge cache. The remaining 3% (1,500 RPS) reach the origin shield.

### Origin Shield — EC2

Origin shield is a regional CloudFront layer that collapses cache misses before they reach S3 or Lambda@Edge.

| Component | Instance Type | vCPU | RAM | Count | Handles | Monthly Cost |
|-----------|--------------|------|-----|-------|---------|-------------|
| Origin shield (CloudFront managed) | — | — | — | 1 region | 1,500 RPS origin fetch | $2,500 |
| Image optimization (Lambda@Edge) | — | — | — | Auto-scale | 7,500 RPS | $12,000 |
| Cache invalidation API server | c5.large | 2 | 4 GB | 2 | Invalidation requests | $140 |
| Log aggregation / metrics | m5.xlarge | 4 | 16 GB | 2 | 1B events/day | $280 |
| **Subtotal Compute** | | | | | | **~$14,920** |

**Lambda@Edge pricing**: 7,500 req/s × 86,400s × 30 days = 19.44B invocations/month × $0.0000006/req = ~$11,664 + compute duration ~$500 = ~$12,164.

### Object Storage — S3

| Bucket | Use | Size | Requests/month | Monthly Cost |
|--------|-----|------|----------------|-------------|
| `assets-origin` | Source assets + variants | 34 TB | 1.5B GET (origin misses) | $3,100 |
| `assets-logs` | CloudFront access logs | 6 TB/month (rolling 90 days) | 30M PUT | $920 |
| `deploy-artifacts` | Build outputs staging | 500 GB | 5M PUT | $60 |
| **Subtotal S3** | | **~52 TB stored** | **~1.535B req** | **~$4,080** |

S3 pricing: storage $0.023/GB, GET $0.0004/1K, PUT $0.005/1K.

```
34 TB stored    = 34,000 GB × $0.023 = $782/month
1.5B GET reqs   = 1,500,000K × $0.0004 = $600/month
30M PUT reqs    = 30,000K × $0.005    = $150/month
Log storage 18TB= 18,000 GB × $0.023  = $414/month (90-day rolling)
Lifecycle/replication overhead         = ~$134/month
```

### Image Optimization — Lambda@Edge

| Function | Trigger | Memory | Timeout | Avg Duration | RPS | Monthly Invocations |
|----------|---------|--------|---------|-------------|-----|---------------------|
| Image resize/format | CloudFront origin request | 1,024 MB | 5s | 80ms | 7,500 | 19.4B |
| Cache-control header injection | CloudFront viewer response | 128 MB | 1s | 2ms | 50,000 | 129.6B |

Lambda@Edge runs in every CloudFront PoP — no cold start penalty for high-traffic functions.

### WAF — AWS WAF

| Rule Group | Purpose | Monthly Cost |
|------------|---------|-------------|
| AWS Managed Rules (Core) | OWASP Top 10 | $10 + $0.60/1M req |
| AWS Managed Rules (Bot Control) | Bot/scraper blocking | $10 + $1.00/1M req |
| Rate limiting rules | DDoS mitigation | $1 per rule |
| **WAF total** | 30B req/month | ~$6,520 |

```
WAF base: $20 (2 rule groups)
30B req × $0.60/1M = $18,000 (core) — but WAF samples, not all requests inspected
Actual inspected (sampled 10%): 3B × $0.60/1M = $1,800
Bot control (full inspection): 30B × $1.00/1M = $30,000
```

Realistic: Apply Bot Control only to non-versioned/dynamic endpoints, core rules on all. ~$6,500/month.

### Networking / CDN

| Component | Volume | Unit Price | Monthly Cost |
|-----------|--------|-----------|-------------|
| CloudFront data transfer (first 10 TB) | 10 TB | $0.085/GB | $850 |
| CloudFront data transfer (next 40 TB) | 40 TB | $0.080/GB | $3,200 |
| CloudFront data transfer (next 100 TB) | 100 TB | $0.060/GB | $6,000 |
| CloudFront data transfer (next 350 TB) | 350 TB | $0.040/GB | $14,000 |
| CloudFront data transfer (next 524 TB) | 524 TB | $0.030/GB | $15,720 |
| CloudFront data transfer (next 1,724 TB) | 1,676 TB | $0.025/GB | $41,900 |
| CloudFront HTTPS requests (30B/month) | 30B | $0.0100/10K | $30,000 |
| Route 53 DNS queries | 15B/month | $0.400/1M | $6,000 |
| S3 to CloudFront transfer (free) | 2.7 PB | $0.000 | $0 |
| **Subtotal Network** | **2.7 PB** | | **~$117,670** |

Note: S3 → CloudFront origin fetch is free (no inter-service egress charge).

### Monitoring / Observability

| Component | Use | Monthly Cost |
|-----------|-----|-------------|
| CloudWatch metrics + dashboards | Cache hit ratio, error rates, latency | $1,500 |
| CloudWatch Logs Insights | Log querying on 200 GB/day | $2,000 |
| X-Ray (Lambda@Edge traces) | Image optimization tracing | $800 |
| SNS alerts | Deployment and incident alerts | $50 |
| **Subtotal Observability** | | **~$4,350** |

## Monthly Cost Summary

| Component | Monthly Cost | % of Total |
|-----------|-------------|-----------|
| CloudFront CDN (transfer + requests) | $117,670 | 55.6% |
| WAF (Bot Control + Core Rules) | $6,520 | 3.1% |
| Lambda@Edge (image optimization) | $12,164 | 5.7% |
| S3 Storage + Requests | $4,080 | 1.9% |
| EC2 Compute (origin, logging) | $14,920 | 7.1% |
| Route 53 DNS | $6,000 | 2.8% |
| CloudWatch / Observability | $4,350 | 2.1% |
| Reserved capacity buffer (10%) | $16,570 | 7.8% |
| Support (Business tier) | $15,000 | 7.1% |
| Data transfer misc | $14,226 | 6.7% |
| **Total** | **~$211,500** | **100%** |

**Range: $150K–$300K/month** depending on:
- Reserved vs. on-demand pricing (Reserved savings plan cuts CloudFront ~20%)
- Geographic traffic distribution (US/EU cheaper than APAC/LATAM)
- Image optimization volume (Lambda@Edge is the variable cost lever)
- Actual cache hit ratio (each 1% miss costs ~$3K/month in origin + transfer)

## Traffic Scale Tiers

| Tier | Requests/Day | Peak QPS | CloudFront | S3 | Lambda@Edge | Monthly Cost | Key Bottleneck |
|------|-------------|----------|------------|-----|-------------|-------------|----------------|
| 🟢 Startup | 10M | ~500 | 1 distribution, 10 PoPs | 100 GB | None | ~$1,200 | S3 origin cost if no CDN caching |
| 🟡 Growing | 100M | ~5K | Standard distribution, 100 PoPs | 1 TB | Basic resize | ~$12,000 | Cache invalidation at deploy time |
| 🔴 Scale-up | 500M | ~25K | + Origin Shield | 10 TB | Full optimization | ~$75,000 | Lambda@Edge cold starts at new PoPs |
| ⚫ Production | 1B | ~50K | 200+ PoPs, WAF, Shield | 34 TB | 7.5K RPS | ~$211,500 | CloudFront egress cost (55% of bill) |
| 🚀 Hyperscale | 10B+ | ~500K | Multi-CDN (CloudFront + Fastly) | S3 + regional replicas | Distributed edge workers | ~$1.5M+ | Single CDN vendor lock-in, egress pricing |

## Architecture Diagram

```mermaid
graph TD
    User[Browser / Mobile Client] --> CF[CloudFront 200+ PoPs]
    CF --> WAF[AWS WAF\nBot Control + Core Rules]
    WAF --> CF

    CF -->|Cache HIT 97%| CFCache[Edge Cache\nTTL: 1yr versioned\n60s for manifests]
    CF -->|Cache MISS 3%| OS[Origin Shield\nRegional Cache Layer]

    OS -->|Miss| S3[S3 Origin Bucket\n34 TB assets]
    OS -->|Image request| LE[Lambda@Edge\nImage Optimization\nResize + WebP/AVIF]
    LE --> S3

    CF -->|Viewer Response| HI[Lambda@Edge\nCache-Control Header Injection]

    S3 --> S3Log[S3 Access Logs Bucket\n6 TB/month rolling]

    Deploy[CI/CD Pipeline] -->|Upload versioned assets| S3
    Deploy -->|Invalidate /manifest.json| CFInv[CloudFront\nInvalidation API]

    S3Log --> CW[CloudWatch Logs Insights\nCache Hit Ratio\nLatency P50/P99]
    CF --> CW
    LE --> XR[AWS X-Ray\nTrace image optimization]

    DNS[Route 53\n15B queries/month] --> CF

    subgraph "Edge Layer"
        CF
        WAF
        CFCache
        HI
    end

    subgraph "Origin Layer"
        OS
        LE
        S3
    end

    subgraph "Observability"
        CW
        XR
        S3Log
    end
```

## Interview Tips

- **Key insight — versioned URLs eliminate invalidation cost**: Using content-hash filenames (`app.abc123.js`) lets you set TTL=1 year on all versioned assets. This drives cache hit ratio to 97%+, cutting origin load by 33× vs. short TTLs. Only manifest/index files need short TTLs. Candidates who propose short TTLs on all assets will see 10× higher origin costs.

- **Key insight — egress is 55% of the bill**: CloudFront data transfer costs dominate. The optimization levers are: (1) maximize cache hit ratio, (2) serve WebP/AVIF instead of PNG/JPG (saves 30–60% bandwidth), (3) negotiate Enterprise Discount Program with AWS at >1 PB/month (up to 50% off list). At 2.7 PB/month you qualify for custom pricing.

- **Common mistake — underestimating Lambda@Edge cost**: Lambda@Edge runs in every PoP, not one region. At 7,500 RPS of image optimization requests, you get 19.4B invocations/month. Candidates often model Lambda cost as a regional function. Lambda@Edge pricing is identical per-invocation but the geographic fan-out means every miss across 200 PoPs counts separately.

- **Common mistake — ignoring WAF Bot Control cost**: At 30B requests/month, Bot Control at $1.00/1M = $30,000/month if applied universally. Scope Bot Control only to non-versioned paths (HTML, API calls). Versioned assets with hash-based URLs are inherently unpredictable to scrapers; applying full bot control there burns budget without benefit.

- **Follow-up question — how do you handle cache invalidation at deploy time?**: Use versioned asset filenames (hash in filename = no invalidation needed for assets). Only invalidate `/manifest.json`, `/index.html`, and service worker files. CloudFront charges $0.005 per path after the first 1,000 paths/month — bulk invalidations of thousands of files are expensive and slow (15+ minutes). Correct answer: deploy new hash, update manifest, zero invalidations needed.

- **Scale threshold — at 10B+ requests/day, consider multi-CDN**: Single-CDN dependency creates a vendor lock-in risk and CloudFront's list pricing becomes painful at petabyte scale. At 10 PB+/month, a multi-CDN strategy (CloudFront + Fastly + Cloudflare) enables cost arbitrage and eliminates single-provider outage risk. Netflix and Cloudflare's own blog show multi-CDN saving 20–40% at hyperscale.

- **Key number to memorize**: CloudFront charges $0.030/GB at the 1–10 PB tier (2025 pricing). At 2.7 PB/month, blended rate is ~$0.033/GB = ~$90,000 for transfer alone. Add $30,000 for HTTPS request charges. These two line items alone = $120K/month — the single biggest cost driver in the entire system.
