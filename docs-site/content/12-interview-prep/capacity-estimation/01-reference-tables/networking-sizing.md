---
title: "Networking Sizing Reference — API Gateway, ALB/NLB, CloudFront, Route53"
layer: reference
section: interview-prep/capacity-estimation/reference-tables
difficulty: intermediate
tags: [capacity-planning, aws, sizing, cost-estimation, networking, api-gateway, alb, nlb, cloudfront, route53]
category: architecture
---

# Networking Sizing Reference — API Gateway, ALB/NLB, CloudFront, Route53

## Quick Decision Table

| Use this | When | Avoid when |
|----------|------|------------|
| **API Gateway REST** | You need request validation, API keys, usage plans, per-resource IAM | >10K sustained RPS without aggressive caching |
| **API Gateway HTTP** | Simple Lambda/HTTP proxy at 3x lower cost; no usage plans needed | You need per-resource authorizers or request transforms |
| **ALB** | HTTP/HTTPS routing; target groups (EC2, ECS, Lambda, IPs); WAF | Sub-millisecond TCP/UDP; you need static IPs |
| **NLB** | TCP/UDP/TLS; static IPs; ultra-low latency (<1ms); preserve source IP | Application-layer routing; WebSocket scale-out; per-path rules |
| **CloudFront** | Static/cacheable content; global users; DDoS shield via AWS Shield | Real-time streaming requiring <50ms origin push |
| **Route53** | AWS-native DNS, health checks, weighted/latency routing | You already run CoreDNS internally and don't need AWS integration |
| **VPC Endpoints** | High-volume S3/DynamoDB access from EC2 to eliminate NAT GW cost | Low-volume or external-only traffic |

---

## API Gateway

### REST vs HTTP Comparison

| Dimension | REST API | HTTP API |
|-----------|----------|----------|
| Price (first 333M req/mo) | **$3.50 / million** | **$1.00 / million** |
| Price (next 667M req/mo) | $2.80 / million | $1.00 / million |
| Price (>1B req/mo) | $1.51 / million | $1.00 / million |
| Default RPS quota | 10,000 RPS (soft limit) | 10,000 RPS (soft limit) |
| Max RPS (request limit increase) | ~29,000 RPS per region | ~29,000 RPS per region |
| Data transfer out | $0.09/GB (first 10 TB) | $0.09/GB (first 10 TB) |
| Cache (REST only) | $0.020–$3.84/hr (0.5 GB–237 GB) | Not available |
| WebSocket support | Yes | Yes |
| Usage plans / API keys | Yes | No |
| Per-resource IAM auth | Yes | No |
| JWT authorizer | No | Yes (native) |

### Sizing Formula

```
Monthly API GW cost = (Total requests / 1,000,000) × per-million price
                    + (Data out GB) × $0.09
                    + Cache cost (if REST caching enabled)
```

**Worked Example — 50M requests/month, HTTP API, 5 KB avg response:**
- Requests: 50M × $1.00/M = **$50.00**
- Data out: 50M × 5 KB = 250 GB × $0.09 = **$22.50**
- Total: **~$72.50/month**

**Worked Example — same traffic, REST API:**
- Requests: 50M × $3.50/M = **$175.00**
- Data out: **$22.50**
- Total: **~$197.50/month** (2.7x more expensive)

### Scaling Thresholds

| RPS | Action |
|-----|--------|
| <500 | Default quota fine; no changes |
| 500–5,000 | Monitor `4XXError` and `Latency` CloudWatch metrics |
| 5,000–10,000 | Submit quota increase request before hitting limit |
| >10,000 | Request account-level increase; consider caching at API GW layer or moving to ALB + Lambda URL |
| >50,000 | Evaluate direct ALB → Lambda or NLB → service mesh; API GW overhead becomes measurable |

---

## Application Load Balancer (ALB)

### LCU Pricing Model

ALB is billed per **Load Balancer Capacity Unit (LCU)** — you pay for the highest of four dimensions:

| LCU Dimension | Measurement | Per LCU Value |
|---------------|-------------|---------------|
| New connections | connections/second | 25 new connections/s |
| Active connections | concurrent connections | 3,000 active connections |
| Processed bytes (EC2/IP) | GB/hour | 1 GB/hour |
| Processed bytes (Lambda) | GB/hour | 0.4 GB/hour |
| Rule evaluations | rules/second | 1,000 rule evaluations/s |

**Price: $0.008 per LCU-hour** (~$5.76/month per sustained LCU)

ALB fixed cost: **$0.0225/hour** (~$16.20/month per ALB)

### ALB Capacity Reference

| Metric | Value |
|--------|-------|
| Max new connections/s | **60,000** (auto-scales) |
| Max concurrent connections | Scales with LCUs (no hard ceiling) |
| Max targets per target group | 1,000 |
| Max rules per ALB | 100 (default) / 200 (limit increase) |
| Max listeners | 50 |
| Max target groups | 100 |
| WAF integration | Yes — $5/month + $0.60/million requests |
| Slow-start duration | 30–900 seconds (gradual traffic ramp) |
| Deregistration delay | 0–3,600 seconds (default 300s) |

### Sizing Formula

```
LCU/hour = MAX(
  new_connections_per_s / 25,
  active_connections / 3000,
  processed_GB_per_hour / 1,         # EC2 targets
  rule_evaluations_per_s / 1000
)

Monthly ALB cost = $16.20 (fixed)
                 + LCU/hour × $0.008 × 730 hours
```

**Worked Example — 2,000 RPS, 10 rules, 500-byte avg request/response, 10ms avg conn duration:**
- New connections/s ≈ 2,000 (assuming short-lived HTTP/1.1)
  - LCU dimension: 2,000 / 25 = **80 LCUs**
- Active connections: 2,000 × 0.01s = 20 concurrent → 20 / 3,000 = **0.007 LCUs**
- Processed bytes: 2,000 × 1 KB × 3,600 = 7.2 GB/hr → 7.2 / 1 = **7.2 LCUs**
- Rule evaluations: 2,000 × 10 = 20,000/s → 20,000 / 1,000 = **20 LCUs**
- Dominant: **80 LCUs** (new connections)
- Monthly: $16.20 + 80 × $0.008 × 730 = $16.20 + $467.20 = **~$483/month**

> Tip: HTTP/2 multiplexing dramatically reduces new-connection LCUs. Enable HTTP/2 to cut ALB costs 5–20x for browser workloads.

### ALB Scaling Thresholds

| RPS | Recommendation |
|-----|---------------|
| <1,000 | Single ALB; default settings |
| 1,000–10,000 | Enable access logs; set up CloudWatch alarms on `TargetResponseTime` |
| 10,000–50,000 | Enable HTTP/2; tune keep-alive; consider connection pooling on targets |
| >50,000 | Pre-warm request if traffic spike is predictable (contact AWS support) |
| >100,000 | Multi-region; Route53 latency routing; CDN layer for static |

---

## Network Load Balancer (NLB)

### NLB vs ALB Summary

| Dimension | NLB | ALB |
|-----------|-----|-----|
| Protocol | TCP, UDP, TLS, TCP_UDP | HTTP, HTTPS, gRPC |
| Latency | **<1 ms** | ~1–5 ms |
| Static IPs | Yes (1 per AZ) | No (use Global Accelerator) |
| Preserve client IP | Yes (by default) | Requires X-Forwarded-For header |
| WAF integration | No | Yes |
| Price per LCU-hour | **$0.006** | $0.008 |
| Fixed cost/month | ~$16.20 | ~$16.20 |
| Target types | EC2, IP, ALB | EC2, IP, Lambda |

### NLB LCU Dimensions

| LCU Dimension | Per LCU Value |
|---------------|---------------|
| New TCP connections/s | 800 |
| Active TCP connections | 100,000 |
| Processed bytes (TCP) | 1 GB/hour |
| New UDP flows/s | 400 |
| Active UDP flows | 50,000 |
| Processed bytes (UDP) | 1 GB/hour |

**Price: $0.006 per LCU-hour**

### When to Choose NLB Over ALB

- Need static Elastic IPs (firewall allowlisting by IP)
- Sub-millisecond latency requirements (gaming, trading, VoIP)
- Non-HTTP protocols: MQTT, FTP, custom TCP binary
- Very high connection rates (800 new TCP/s per LCU vs ALB's 25/s — NLB is 32x cheaper per connection)
- Preserving source IP without proxy headers

---

## CloudFront

### Data Transfer Pricing (2024 — "Pay As You Go")

| Region | First 10 TB/mo | Next 40 TB/mo | Next 100 TB/mo |
|--------|----------------|----------------|-----------------|
| United States / Europe | $0.085/GB | $0.080/GB | $0.060/GB |
| Asia Pacific (excl. India) | $0.120/GB | $0.110/GB | $0.090/GB |
| South America | $0.160/GB | $0.150/GB | $0.140/GB |
| India | $0.109/GB | $0.098/GB | $0.094/GB |
| Australia | $0.114/GB | $0.098/GB | $0.094/GB |

> **Free tier**: 1 TB data transfer out + 10 million HTTP/HTTPS requests/month (first 12 months or always with CloudFront Free Tier).

### Request Pricing

| Request type | Price |
|-------------|-------|
| HTTP requests | $0.0075 / 10,000 requests |
| HTTPS requests | $0.0100 / 10,000 requests |
| Invalidation requests (first 1,000 paths/mo) | Free |
| Additional invalidation paths | $0.005 per path |
| Origin shield requests | $0.010 / 10,000 requests |
| Real-time log delivery | $0.01 / 1M log lines |

### Cache Hit Economics

| Cache Hit Rate | Effective cost per GB | Savings vs no CDN |
|----------------|----------------------|--------------------|
| 0% (all origin) | Origin cost + full CF request cost | 0% |
| 80% | ~$0.017/GB (US) | ~80% origin reduction |
| 95% | ~$0.009/GB (US) | ~95% origin reduction |
| 99% | ~$0.086/GB (US, data transfer only) | Minimal origin hits |

**Rule of Thumb:** CloudFront at 95%+ cache hit rate is effectively free at scale — the data transfer savings from reduced origin bandwidth and the EC2/ALB cost reduction outweigh the CDN fee.

### CloudFront Capacity Reference

| Metric | Value |
|--------|-------|
| Max throughput (single distribution) | **300+ Gbps** |
| Max requests/second | **500,000+ RPS** |
| Edge locations | 600+ PoPs in 100+ countries |
| Availability SLA | **99.99%** |
| TLS termination | Yes (free with ACM) |
| HTTP/3 (QUIC) support | Yes |
| Max cache object size | 30 GB |
| Default TTL | 24 hours |
| Minimum TTL | 0 seconds |

### Sizing Formula

```
Monthly CloudFront cost =
  (Data out GB by region) × (regional rate)
  + (HTTP requests / 10,000) × $0.0075
  + (HTTPS requests / 10,000) × $0.0100
  + (Origin Shield requests / 10,000) × $0.010  [optional]
```

**Worked Example — 100M pageviews/month, 500 KB avg page, 80% cache hit, US users:**
- Total bytes: 100M × 500 KB = 50 TB
- CF serves 50 TB × $0.080/GB (tier 2) = **$4,000** data transfer
- Requests (HTTPS): 100M × $0.010/10K = **$100**
- Origin requests (20% miss): 20M requests → negligible
- Total: **~$4,100/month**

---

## Route53

### Pricing Reference

| Resource | Price |
|----------|-------|
| Hosted zone (public or private) | **$0.50/month** |
| Standard queries (first 1B/mo) | **$0.40 / million** |
| Standard queries (>1B/mo) | $0.20 / million |
| Latency-based routing queries | $0.60 / million |
| Geo DNS queries | $0.70 / million |
| Health check (AWS endpoint) | $0.50/month |
| Health check (non-AWS endpoint) | $0.75/month |
| Health check (HTTPS + string match) | +$1.00/month each |
| Traffic policy record | $50/month per policy record |
| Domain registration | $9–$12/year (.com) |

### Route53 Routing Policies

| Policy | Use case | Cost |
|--------|----------|------|
| Simple | Single-resource mapping | Standard query rate |
| Weighted | Blue/green, A/B traffic split | Standard |
| Latency | Multi-region lowest-latency routing | $0.60/M queries |
| Geolocation | Country/continent-based routing | $0.70/M queries |
| Geoproximity | Distance-based with bias shift | $0.70/M queries |
| Failover | Active-passive HA | Standard + health check |
| Multivalue | Returns up to 8 healthy IPs | Standard |

### Route53 Capacity

| Metric | Value |
|--------|-------|
| Queries per second | Effectively unlimited (globally distributed) |
| Max records per hosted zone | 10,000 (default) / unlimited with limit increase |
| Health check interval | 10s or 30s |
| Health check failure threshold | 1–10 consecutive failures |
| DNS TTL recommendation | 60–300s for dynamic; 3,600s for static |

---

## VPC Data Transfer Costs (Often Overlooked)

These costs are frequently missed in capacity estimates and can dwarf compute costs at scale.

| Transfer type | Price |
|---------------|-------|
| **Same AZ (private IP)** | **Free** |
| **Cross-AZ (same region)** | **$0.01/GB each direction** = **$0.02/GB round-trip** |
| Cross-region (varies) | $0.02–$0.09/GB |
| Internet egress (first 10 TB) | $0.09/GB |
| NAT Gateway processing | $0.045/GB |
| NAT Gateway hourly | $0.045/hour (~$32.85/month) |
| PrivateLink endpoint | $0.01/GB + $0.01/hour per AZ |
| VPC Endpoint (S3/DynamoDB) | **Free** (gateway type) |

### Cross-AZ Cost Example

A 3-AZ setup with 10 TB/month inter-service traffic (common in microservices):
- 10 TB × $0.02/GB × 1,024 = **$204.80/month** just in cross-AZ transfer
- Easy fix: co-locate tightly coupled services in same AZ, or use availability zone affinity in EKS/ECS

---

## Sizing Formulas — Combined Networking Stack

### Formula: Monthly Networking Cost Estimate

```
networking_monthly =
  api_gateway_cost          # (requests × rate) + data_out
  + alb_cost                # $16.20 + (LCU × $0.008 × 730)
  + cloudfront_cost         # data_out × regional_rate + requests
  + route53_cost            # ($0.50 × zones) + (queries/M × rate) + health_checks
  + cross_az_transfer_cost  # GB × $0.02
  + nat_gw_cost             # $32.85/mo + GB × $0.045
```

### Quick Reference: 10K RPS Production Stack

| Component | Config | Monthly Cost |
|-----------|--------|-------------|
| API Gateway HTTP | 10K RPS, 25.9B req/mo | ~$25,920 |
| ALB | 10K new conn/s, 400 LCU | ~$2,358 |
| CloudFront | 100 TB US data out | ~$8,000 |
| Route53 | 3 zones, 1B queries | ~$402 |
| Cross-AZ transfer | 50 TB/mo | ~$1,024 |
| NAT Gateway | 10 TB/mo | ~$492 |
| **Total** | | **~$38,196/mo** |

> At this scale, evaluate CloudFront Security Savings Bundle ($360/month = 10% savings) and Compute Savings Plans for the underlying compute.

---

## Cost Optimization Tips

### 1. Switch REST API Gateway to HTTP API
- **Savings**: 71% reduction ($3.50 → $1.00 per million)
- **When safe**: No usage plans, per-resource IAM, or request transforms required
- **Effort**: Low — usually a config change if using Lambda

### 2. Enable HTTP/2 on ALB
- Multiplexing reduces new connections, the dominant LCU driver
- **Savings**: 50–80% LCU reduction for browser traffic
- **When safe**: Always — HTTP/2 is backward compatible

### 3. CloudFront Reserved Capacity (Security Savings Bundle)
- **Price**: $360/month commitment
- **Includes**: 10 TB data transfer + 10M HTTPS requests in US/Europe
- **Savings**: ~10% vs on-demand at 10 TB scale; rises to 30%+ at 50+ TB

### 4. Use VPC Endpoints for S3 and DynamoDB
- Eliminates NAT Gateway processing fee ($0.045/GB) for S3/DynamoDB traffic
- **Gateway endpoints are free** — no reason not to use them
- **Savings at 100 TB/month S3 traffic**: $4,500/month saved

### 5. Reduce Cross-AZ Traffic
- Run services in AZ-aware mode (EKS topology spread, ECS placement constraints)
- Use read replicas in the same AZ as the app tier
- **Savings at 100 TB/month cross-AZ**: $2,048/month

### 6. CloudFront Origin Shield
- Centralizes cache requests before hitting origin
- Reduces origin load and can improve cache hit rate by 10–20%
- Cost: $0.010/10K requests — worth it when origin is expensive (Lambda, RDS)

### 7. Route53 Resolver DNS Firewall
- Replaces expensive per-query Geo/Latency policies with static records for internal services
- Use latency routing only for external-facing endpoints, not internal service discovery

---

## Common Mistakes

### Mistake 1: Using REST API Gateway for High-Volume Microservices
**Problem**: Teams default to REST API because it's more familiar, but pay 3.5x the price.
**Root Cause**: REST API was launched before HTTP API; older tutorials use it.
**Fix**: Audit existing REST APIs — if you're not using usage plans, API keys, or request transforms, migrate to HTTP API. Savings compound at scale: at 1B req/month, you save ~$2,500/month.

### Mistake 2: Ignoring Cross-AZ Data Transfer in Cost Models
**Problem**: Estimates show $5K/month; actual bill is $8K because of unmodeled cross-AZ traffic.
**Root Cause**: AWS pricing pages don't prominently feature cross-AZ egress; it only appears on the EC2 pricing page.
**Fix**: Add cross-AZ transfer as a line item. Estimate: microservices typically generate 2–5x their request payload in internal traffic. Add $0.02/GB to every GB of internal service traffic.

### Mistake 3: Not Pre-Warming ALB Before Traffic Spikes
**Problem**: ALB scales in ~5-minute increments; sudden 10x traffic spike causes 502s for 2–5 minutes.
**Root Cause**: ALB auto-scales but not instantaneously.
**Fix**: For known spikes (product launch, Black Friday), submit an AWS support ticket for ALB pre-warm at least 24 hours in advance. Alternatively, use CloudFront in front of ALB to absorb the spike edge-side.

### Mistake 4: Setting CloudFront TTL to 0 "To Be Safe"
**Problem**: Every request hits origin; you lose all CDN economics and pay full origin cost.
**Root Cause**: Fear of stale content during deploys.
**Fix**: Set TTL to 300s (5 minutes) minimum. Use cache invalidation (`aws cloudfront create-invalidation`) on deploy for changed paths. Even 5-minute caching gives you 83% hit rate on typical traffic patterns (Pareto distribution of popular assets).

### Mistake 5: Forgetting NAT Gateway Costs for Outbound Traffic
**Problem**: Lambda functions calling external APIs through NAT Gateway cost $0.045/GB in processing — often exceeding the Lambda invocation cost.
**Root Cause**: NAT Gateway is invisible in architecture diagrams; it's assumed to be "free infrastructure."
**Fix**: For Lambda → AWS services (S3, DynamoDB, SQS), use VPC Endpoints (free for gateway type). For Lambda → internet, consider removing VPC placement if not needed — Lambda without VPC uses AWS-managed NAT at no extra charge.

---

## Key Numbers to Memorize

| Fact | Value |
|------|-------|
| API GW REST price | $3.50/million requests |
| API GW HTTP price | $1.00/million requests |
| API GW default RPS limit | 10,000 RPS per region |
| ALB max new connections | **60,000/s** (auto-scales) |
| ALB LCU price | $0.008/LCU-hour |
| NLB LCU price | $0.006/LCU-hour |
| NLB latency | **<1 ms** |
| CloudFront max throughput | **300+ Gbps per distribution** |
| CloudFront US data transfer | $0.085/GB (first 10 TB) |
| Route53 hosted zone | $0.50/month |
| Route53 standard query | $0.40/million |
| Cross-AZ transfer | **$0.01/GB each direction** |
| NAT Gateway processing | $0.045/GB |
| VPC Gateway Endpoint (S3/DDB) | **Free** |

---

## References

- 📚 [Amazon API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/) — Official AWS pricing for REST and HTTP APIs
- 📚 [Elastic Load Balancing Pricing](https://aws.amazon.com/elasticloadbalancing/pricing/) — ALB/NLB LCU pricing model
- 📚 [Amazon CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/) — Regional data transfer and request pricing
- 📚 [Amazon Route 53 Pricing](https://aws.amazon.com/route53/pricing/) — Hosted zone and query pricing
- 📖 [AWS Cost Explorer: Understanding Data Transfer Costs](https://aws.amazon.com/blogs/aws/aws-data-transfer-costs-and-data-transfer-free-tier/) — Cross-AZ and egress breakdown
- 📖 [Optimizing costs with API Gateway HTTP APIs](https://aws.amazon.com/blogs/compute/building-better-apis-http-apis-now-generally-available/) — REST vs HTTP API migration guide
- 📺 [AWS re:Invent 2023 — Cost Optimization Deep Dive](https://www.youtube.com/watch?v=YDzJ9rqJMQA) — Networking cost patterns at scale
