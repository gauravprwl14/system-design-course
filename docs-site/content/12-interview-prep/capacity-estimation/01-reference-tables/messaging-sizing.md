---
title: "Messaging Sizing Reference — SQS, MSK (Kafka), Kinesis, SNS, EventBridge"
layer: reference
section: interview-prep/capacity-estimation/reference-tables
difficulty: intermediate
tags: [capacity-planning, aws, sizing, cost-estimation]
---

# Messaging Sizing Reference — SQS, MSK (Kafka), Kinesis, SNS, EventBridge

## Quick Decision Table

| Use when... | Service | Avoid when... |
|-------------|---------|---------------|
| Simple task queue, decoupling, retries | **SQS Standard** | Strict ordering required |
| Strict message ordering (FIFO), deduplication | **SQS FIFO** | >3,000 TPS per queue |
| High-throughput event streaming, replay, long retention | **MSK (Kafka)** | You want serverless ops |
| Time-series streaming, real-time analytics, ordered shards | **Kinesis Data Streams** | >500 shards (cost explodes) |
| Fan-out to multiple subscribers (email/SMS/HTTP/SQS/Lambda) | **SNS** | You need message persistence |
| Event routing between AWS services, SaaS integrations | **EventBridge** | >10 KB events or <1s latency |
| Fully managed Kafka, no broker ops | **MSK Serverless** | Cost predictability matters at scale |
| On-demand scaling, sub-ms intra-service eventing | **EventBridge Pipes** | Complex filtering logic needed |

---

## 1. SQS — Standard vs FIFO

### Throughput & Limits

| Attribute | Standard | FIFO |
|-----------|----------|------|
| Throughput | **Unlimited** | 3,000 TPS with batching; 300 TPS without |
| Ordering | Best-effort | Strict per MessageGroupId |
| Deduplication | No (at-least-once) | 5-minute dedup window |
| Message size | 256 KB max | 256 KB max |
| Retention | 1 min – 14 days | 1 min – 14 days |
| In-flight messages | 120,000 | 20,000 |
| Delay queue | 0–900 s | 0–900 s |
| Long poll max wait | 20 s | 20 s |

### SQS Pricing (us-east-1, 2024)

| Tier | Standard | FIFO |
|------|----------|------|
| First 1M requests/month | Free | Free |
| Next 100B requests | **$0.40 / million** | **$0.50 / million** |
| Data transfer out | $0.09 / GB | $0.09 / GB |

> **Rule of thumb**: SQS Standard = $0.40/million requests. FIFO adds 25% overhead.

### SQS Sizing Formula

```
Daily requests = (messages/sec) × 86,400
Monthly requests = daily × 30
Monthly cost = (monthly_requests / 1,000,000) × $0.40
```

**Worked Example — E-commerce order queue:**
- 500 orders/sec peak, avg 3 SQS calls per order (send + receive + delete)
- Monthly calls = 500 × 3 × 86,400 × 30 = 3.888B
- Cost = (3,888 / 1,000) × $0.40 = **$1,555/month**
- Use batching (10 msg/call) → reduces to $155/month

---

## 2. Amazon MSK (Managed Kafka)

### Broker Instance Types

| Instance | vCPU | RAM | Network | Throughput (est.) | On-Demand/hr | Monthly/broker |
|----------|------|-----|---------|-------------------|--------------|----------------|
| kafka.t3.small | 2 | 2 GB | Low | ~5 MB/s | $0.054 | ~$39 |
| kafka.m5.large | 2 | 8 GB | Up to 10 Gbps | **~30 MB/s** | $0.216 | ~$155 |
| kafka.m5.xlarge | 4 | 16 GB | Up to 10 Gbps | ~60 MB/s | $0.432 | ~$311 |
| kafka.m5.2xlarge | 8 | 32 GB | Up to 10 Gbps | ~120 MB/s | $0.864 | ~$622 |
| kafka.m5.4xlarge | 16 | 64 GB | Up to 10 Gbps | ~240 MB/s | $1.728 | ~$1,244 |
| kafka.m5.8xlarge | 32 | 128 GB | 10 Gbps | ~480 MB/s | $3.456 | ~$2,488 |
| kafka.m5.16xlarge | 64 | 256 GB | 25 Gbps | ~960 MB/s | $6.912 | ~$4,977 |

> **Rule of thumb**: kafka.m5.large ≈ 30 MB/s per broker. Scale horizontally before vertically.

### Partition Sizing

| Metric | Value |
|--------|-------|
| Max throughput per partition | **~10 MB/s** write |
| Recommended partitions per broker | 100–4,000 |
| Max partitions per cluster (practical) | ~200,000 |
| Replication overhead | 2x–3x write amplification (RF=2 or 3) |

**Partition Count Formula:**

```
partitions_needed = max(
  target_throughput_MB_s / 10,     # throughput ceiling
  num_consumers,                    # parallelism ceiling
  retention_GB / (partition_size_GB)
)
```

**Worked Example — 500 MB/s ingest, RF=3, 3-day retention:**
- Throughput partitions = 500 / 10 = 50
- Write amplification = 500 × 3 = 1,500 MB/s total broker write
- Brokers needed = 1,500 / 30 = **50 m5.large brokers**
- Retention storage = 500 MB/s × 86,400 × 3 × 3 (RF) = ~389 TB

### MSK Storage Pricing

| Resource | Cost |
|----------|------|
| EBS storage (per GB/month) | $0.10 |
| Broker hours (m5.large, us-east-1) | $0.216/hr |
| Data transfer between AZs | $0.01/GB |
| MSK Connect (worker capacity unit) | $0.11/hr |

**MSK Serverless:**
- $0.75/GB of data written (includes replication)
- $0.05/GB of data retained per month
- No broker management, auto-scales to 200 MB/s

### MSK Scaling Thresholds

| Signal | Action |
|--------|--------|
| CPU > 60% sustained | Add brokers (partition rebalance) |
| Disk > 85% | Expand EBS or reduce retention |
| Consumer lag growing | Add partitions or increase consumer count |
| Network > 70% of NIC | Upgrade instance type |
| Partition count > 4,000/broker | Scale out cluster |

---

## 3. Kinesis Data Streams

### Shard Capacity Model

| Direction | Capacity per Shard |
|-----------|--------------------|
| Write | **1 MB/s** or 1,000 records/s |
| Read | **2 MB/s** (shared across all consumers) |
| Read (Enhanced Fan-Out) | 2 MB/s **per consumer** |
| Record size max | 1 MB |
| Retention | 24 hr (default) – 365 days |

### Kinesis Pricing (us-east-1, 2024)

| Resource | Cost |
|----------|------|
| Shard hour | **$0.015/hr** ($10.80/month/shard) |
| PUT payload unit (25 KB) | $0.014 per million |
| Extended retention (7–365 days) | $0.023/GB/month |
| Enhanced Fan-Out consumer | $0.015/hr + $0.013/GB retrieved |
| On-Demand mode (no shard management) | $0.08/million records written; $0.04/GB retrieved |

### Kinesis Sizing Formula

```
shards_write = ceil(write_MB_s / 1)
shards_read  = ceil(read_MB_s / 2)           # standard consumers
shards_read  = read_MB_s / 2                  # with enhanced fan-out (per consumer)
shards_needed = max(shards_write, shards_read)

monthly_cost = shards × 24 × 30 × $0.015
             + (records_per_month / 40,000) × $0.014   # 25KB units
```

**Worked Example — IoT telemetry: 200 devices, 50 records/s each, 1 KB/record:**
- Write rate = 200 × 50 × 1 KB = 10,000 KB/s = ~10 MB/s → **10 shards**
- 3 downstream consumers → enhanced fan-out to avoid 2 MB/s shared limit
- Monthly shard cost = 10 × 720 × $0.015 = **$108/month**
- PUT units = 200 × 50 × 86,400 × 30 / 40,000 = 648,000 units × $0.014 = **$9/month**
- Total ≈ **$117/month**

### Kinesis vs SQS vs MSK Decision

| Factor | SQS | Kinesis | MSK |
|--------|-----|---------|-----|
| Ordering | FIFO queue only | Per-shard ordered | Per-partition ordered |
| Replay | No | Yes (up to 365 days) | Yes (configurable) |
| Fan-out | No native | Limited | Yes (consumer groups) |
| Throughput ceiling | Unlimited | ~1 MB/s/shard | ~10 MB/s/partition |
| Ops burden | None | Low | Medium–High |
| Cost at low volume | Cheapest | Moderate | Expensive (broker hours) |
| Cost at high volume | Scales linearly | Shard costs add up | Fixed broker cost |

---

## 4. SNS — Simple Notification Service

### Fan-Out Patterns

```
Publisher → SNS Topic → SQS Queue 1  (processing)
                      → SQS Queue 2  (analytics)
                      → Lambda        (real-time)
                      → HTTP endpoint (webhook)
                      → Email/SMS     (alerts)
```

### SNS Pricing (us-east-1, 2024)

| Delivery Type | Cost |
|---------------|------|
| First 1M publishes/month | Free |
| Additional publishes | **$0.50 / million** |
| SQS/Lambda/HTTP deliveries | **$0.50 / million** |
| Email/Email-JSON | $2.00 / 100,000 |
| SMS (US) | $0.00645 per message |
| Mobile push (Apple/Google) | $1.00 / million |
| Data transfer | $0.09 / GB out |

### SNS Limits

| Attribute | Value |
|-----------|-------|
| Message size | 256 KB max |
| Topics per account | 100,000 |
| Subscriptions per topic | 12,500,000 |
| Publish throughput | No hard limit (throttled at account level) |
| Message filtering | Yes (subscription filter policies) |
| Message archiving (FIFO topics) | Yes |

**SNS FIFO Topics**: Ordered delivery, deduplication — but only to SQS FIFO queues. Throughput limited to 300 publishes/s.

**Worked Example — Notification platform: 10M users, 5% daily active, 2 notifications/day:**
- Daily publishes = 10M × 0.05 × 2 = 1M SNS publishes
- Fan-out to 3 subscribers (SQS + Lambda + mobile push) = 3M deliveries/day
- Monthly cost = 90M publishes × $0.50/M = **$45** + 270M deliveries = **$135** + push = **$270/month total**

---

## 5. EventBridge

### Pricing

| Resource | Cost |
|----------|------|
| Custom/partner events published | **$1.00 / million events** |
| Default bus (AWS service events) | Free |
| Cross-account event bus | $1.00 / million events |
| Schema discovery | $0.10 / million events scanned |
| EventBridge Pipes | $0.40 / million events |
| EventBridge Scheduler | $1.00 / million invocations (first 14M/month free) |
| Archive storage | $0.10 / GB / month |
| Replay | $0.10 / million events replayed |

### EventBridge Limits

| Attribute | Value |
|-----------|-------|
| Event size | **256 KB max** |
| Rules per event bus | 300 (soft, can increase) |
| Targets per rule | 5 |
| Invocation rate | 18,750 events/s per bus (default) |
| Schema registry size | Unlimited |

### When to Use EventBridge vs SNS vs SQS

| Pattern | Best Service |
|---------|-------------|
| AWS service → AWS service routing | EventBridge (default bus) |
| SaaS event ingestion (Shopify, Zendesk) | EventBridge (partner event bus) |
| Simple pub-sub fan-out | SNS |
| Durable queued work | SQS |
| Complex content-based routing | EventBridge (rules + patterns) |
| Event replay / audit | EventBridge Archive |
| Scheduled tasks (cron) | EventBridge Scheduler |

**Worked Example — Microservices event mesh: 50 services, 10K events/s average:**
- Monthly events = 10K × 86,400 × 30 = 25.9B
- Cost = 25,920 × $1.00 = **$25,920/month**
- At this scale, consider MSK — 10K msg/s is only ~10 MB/s, fits 2 kafka.m5.large brokers at ~$310/month

---

## 6. Cost Comparison at Scale

### 100 MB/s sustained throughput, 7-day retention

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Kinesis (100 shards) | ~$1,080 | +storage extra |
| MSK m5.large x 4 brokers | ~$620 + $500 storage | RF=2 |
| MSK m5.xlarge x 2 brokers | ~$622 + $500 storage | RF=2 |
| SQS Standard | ~$17,000 | 100 MB/s × 86400 × 30 / 256 KB × $0.40 |
| EventBridge | Not suited | 256 KB limit, cost prohibitive |

> SQS is not designed for high-throughput streaming. At 100 MB/s, use Kinesis or MSK.

### 10,000 events/s (1 KB avg), fan-out to 5 subscribers

| Service | Monthly Cost |
|---------|-------------|
| SNS + SQS (5 queues) | ~$30 (publishes) + $150 (deliveries) = $180 |
| Kinesis (10 shards) + Lambda | ~$108 + Lambda cost |
| EventBridge | ~$26,000 (too expensive at this rate) |
| MSK m5.large x 3 | ~$465/month |

---

## 7. Cost Optimization Tips

| Tip | Savings |
|-----|---------|
| **SQS batching** (10 msgs/call) | Up to 90% reduction in API calls |
| **MSK Reserved Instances** (1yr) | ~30% vs on-demand broker hours |
| **MSK Reserved Instances** (3yr) | ~40–45% vs on-demand |
| **Kinesis On-Demand** for spiky workloads | Avoids over-provisioning shards |
| **Kinesis standard consumers** vs Enhanced Fan-Out | Saves $0.015/hr per consumer when latency > 1s tolerable |
| **SNS message filtering** (filter policies) | Reduces downstream SQS/Lambda invocations |
| **EventBridge Scheduler** for cron (first 14M free) | $0 for most use cases |
| **MSK Tiered Storage** | Move old data to S3 at $0.023/GB vs EBS $0.10/GB |
| **SQS message retention** tuning | Reduce from 14 days to actual need; no direct cost but reduces in-flight waste |
| **Kinesis extended retention** only when needed | $0.023/GB/month; 7-day = significant cost at scale |

---

## 8. Common Mistakes

### Mistake 1: Using SQS for event streaming
**Symptom**: High polling costs, no replay capability, consumers falling behind.
**Root cause**: SQS deletes messages after consumption — no replay. Consumer receives and deletes.
**Fix**: Switch to Kinesis or MSK for streaming; use SQS only for task queues where replay isn't needed.

### Mistake 2: Under-partitioning Kafka topics
**Symptom**: Single consumer can't keep up; throughput plateaus at ~10 MB/s.
**Root cause**: Partition count limits parallelism. 1 consumer per partition max.
**Fix**: Set `partitions = max(throughput_MB_s / 10, expected_consumer_count, 6)`. Pre-create with headroom — adding partitions later breaks key-ordering for keyed topics.

### Mistake 3: Kinesis shards for low-volume, high-fan-out
**Symptom**: $100+/month for 100 events/s with 10 consumers hitting the 2 MB/s shared read limit.
**Root cause**: Default consumers share 2 MB/s per shard. 10 consumers × 100 records × 1KB = 1 MB/s read load.
**Fix**: Use Enhanced Fan-Out ($0.015/hr/consumer) or switch to SNS+SQS for < 10 MB/s fan-out workloads.

### Mistake 4: EventBridge for high-frequency events
**Symptom**: Unexpected $10K+ bill for a microservices mesh at 5K events/s.
**Root cause**: $1.00/million means 5K events/s = 12.96B/month = $12,960/month.
**Fix**: Use SNS/SQS or Kafka for high-frequency internal events. Reserve EventBridge for service integrations and cron scheduling.

### Mistake 5: Not accounting for Kafka replication factor in throughput math
**Symptom**: Broker CPU/network saturates at 1/3 of expected throughput.
**Root cause**: RF=3 means every 1 MB written consumes 3 MB of broker network (1 leader + 2 follower replicas).
**Fix**: Always multiply write throughput by RF when sizing brokers. `broker_throughput = ingress_MB_s × RF`.

### Mistake 6: SQS FIFO at scale
**Symptom**: Queue backlog grows; throughput limited to 300 TPS without batching.
**Root cause**: FIFO enforces ordering per MessageGroupId — hard cap at 3,000 TPS with batching.
**Fix**: Partition work across multiple FIFO queues by key range, or use Kafka with ordered partitions for >3K TPS ordered workloads.

---

## 9. Sizing Cheat Sheet

| Service | Key Number | Monthly Cost Formula |
|---------|------------|---------------------|
| SQS Standard | $0.40 / million requests | `(msg/s × 3 × 86400 × 30 / 1M) × $0.40` |
| SQS FIFO | $0.50 / million requests | Same + 25% premium |
| Kinesis | $0.015/shard/hr | `shards × 720 × $0.015` |
| MSK m5.large | ~$155/broker/month | `brokers × $155` + EBS |
| SNS | $0.50 / million notifications | `(publishes + deliveries) / 1M × $0.50` |
| EventBridge | $1.00 / million custom events | `events/s × 2.592B/month / 1M × $1.00` |

> **Memory anchors**: SQS = $0.40/M, Kinesis shard = $11/month, MSK m5.large = $155/month, EventBridge = $1/M (2.5x SQS).

---

## References

- 📖 [Amazon SQS Pricing](https://aws.amazon.com/sqs/pricing/) — Official AWS pricing page
- 📖 [Amazon MSK Pricing](https://aws.amazon.com/msk/pricing/) — Broker, storage, and connector costs
- 📖 [Amazon Kinesis Pricing](https://aws.amazon.com/kinesis/data-streams/pricing/) — Shard and PUT unit costs
- 📖 [Amazon SNS Pricing](https://aws.amazon.com/sns/pricing/) — Per notification type breakdown
- 📖 [Amazon EventBridge Pricing](https://aws.amazon.com/eventbridge/pricing/) — Custom events and scheduler
- 📖 [Kafka Partition Sizing Guide — Confluent](https://www.confluent.io/blog/how-choose-number-topics-partitions-kafka-cluster/) — Partitioning strategy
- 📺 [AWS re:Invent 2023 — Choosing the Right Messaging Service](https://www.youtube.com/watch?v=4-JmX6MID_Y) — SQS vs SNS vs Kinesis vs EventBridge decision framework
