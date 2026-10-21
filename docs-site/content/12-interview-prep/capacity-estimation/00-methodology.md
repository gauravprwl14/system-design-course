---
title: "6-Step Capacity Estimation Methodology"
layer: concept
section: "12-interview-prep/capacity-estimation"
difficulty: intermediate
tags: [capacity-estimation, methodology, back-of-envelope, interview-prep, system-design]
category: architecture
prerequisites: []
see_poc: []
related_problems: []
references:
  - title: "Jeff Dean — Numbers Everyone Should Know"
    url: "https://static.googleusercontent.com/media/research.google.com/en//people/jeff/stanford-295-talk.pdf"
    type: article
  - title: "System Design Interview – An Insider's Guide (Alex Xu)"
    url: "https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119"
    type: article
  - title: "Latency Numbers Every Programmer Should Know"
    url: "https://colin-scott.github.io/personal_website/research/interactive_latency.html"
    type: article
---

# 🧮 6-Step Capacity Estimation Methodology

A universal, repeatable framework for any system design capacity question. Apply these six steps in order. Each step feeds into the next.

---

## The 6 Steps

```
Step 1: Anchor on DAU and Usage Patterns
Step 2: Calculate Traffic (QPS)
Step 3: Calculate Storage
Step 4: Calculate Compute (Server Count)
Step 5: Calculate Cache
Step 6: Estimate Monthly Cost
```

---

## Step 1: Anchor on DAU and Usage Patterns

**Goal**: Establish the raw scale before doing any math.

State your assumptions explicitly — interviewers give credit for clear assumptions, not for correct guesses.

**Questions to answer in Step 1**:
- How many Daily Active Users (DAU)?
- What percentage are readers vs. writers? (Typical: 90% read / 10% write)
- What is the average number of requests per user per day?
- Are there peak hours? (Assume peak = 3x average for consumer apps; 10x for live events)

**Example — Twitter 300M DAU**:
```
DAU: 300M
Read/write ratio: 95% read / 5% write
Avg tweet reads per user per day: 100
Avg tweet writes per active writer per day: 2 (20% of users write)
Tweet writes per day: 300M × 5% × 2 = 30M tweets/day
```

---

## Step 2: Calculate Traffic (QPS)

**Formula**:
```
avg QPS = total_requests_per_day ÷ 86,400

peak QPS = avg QPS × peak_multiplier
  - Consumer apps:   peak = avg × 3
  - Business apps:   peak = avg × 5 (9am-5pm weekday concentration)
  - Live events:     peak = avg × 10 to 50
  - Flash sales:     peak = orders_in_first_minute × 60
```

**Traffic Scale Quick-Reference** (memorize this table):

| DAU | Avg QPS (10 req/user/day) | Peak QPS (3x) | Rough Server Count |
|-----|---------------------------|----------------|-------------------|
| 1M | ~115 | ~350 | 1 (single server handles 1K RPS) |
| 10M | ~1,160 | ~3,500 | 3–4 app servers |
| 100M | ~11,600 | ~35,000 | 35 app servers |
| 1B | ~115,000 | ~350,000 | 350 app servers |

> Rule of thumb: A single commodity app server handles ~1,000 RPS for API-heavy workloads (DB-bound). A compute-heavy server (image processing, ML) handles 10–100 RPS.

**Read vs write QPS** — calculate separately:
```
read QPS  = read_requests_per_day ÷ 86,400
write QPS = write_requests_per_day ÷ 86,400
```

Most systems are read-heavy (10:1 to 100:1 read:write). Design the read path to scale independently from the write path.

---

## Step 3: Calculate Storage

**Formula**:
```
daily_storage = write_QPS × 86,400 × avg_object_size

total_storage = daily_storage × retention_days
```

**Storage size reference**:

| Object Type | Typical Size |
|------------|-------------|
| Tweet / short text message | 300 bytes |
| Chat message with metadata | 1 KB |
| User profile record | 1–5 KB |
| Photo (compressed, stored) | 200 KB–2 MB |
| Audio file (1 min, 128Kbps) | ~1 MB |
| Video (1 min, 720p) | ~50 MB |
| Log event (structured JSON) | 500 bytes–2 KB |
| ML embedding vector (1536 dims, float32) | 6 KB |
| GPS coordinate + timestamp | 30 bytes |

**Storage growth calculation — Instagram example**:
```
DAU: 500M; 20% post 1 photo/day = 100M photos/day
Avg photo size: 3MB original → store 3 resolutions: 3MB + 500KB + 100KB ≈ 4MB/photo
Daily storage: 100M × 4MB = 400TB/day
Monthly:       400TB × 30  = 12 PB/month
5-year total:  400TB × 1825 ≈ 730 PB → ~1 EB
```

**Retention policy** — always ask in the interview: "Should we keep all data forever?" Common patterns:
- Hot tier (0–30 days): SSD (NVMe/EBS gp3)
- Warm tier (30–180 days): HDD or S3 Standard-IA
- Cold tier (180 days–7 years): S3 Glacier, at ~$0.004/GB/month

---

## Step 4: Calculate Compute (Server Count)

**Formula**:
```
server_count = peak_QPS ÷ RPS_per_server

RPS_per_server baselines:
  - CRUD API server (DB-bound):     1,000 RPS
  - Compute-heavy (image/video):    10–100 RPS
  - ML inference (CPU):             50–200 RPS
  - ML inference (GPU, A100):       500–3,000 RPS (model-dependent)
  - WebSocket server (connections): 10,000–100,000 concurrent connections
  - Kafka broker:                   100,000 msgs/sec
```

**Scale decision rules** — present these in the interview to show architectural reasoning:

| Peak QPS | Architecture Decision |
|----------|----------------------|
| < 1,000 | Single server + vertical scaling |
| 1,000 – 10,000 | Multiple app servers + load balancer + 1 primary DB with read replicas |
| 10,000 – 100,000 | DB sharding or move to DynamoDB/Cassandra; CDN for static assets |
| 100,000 – 1,000,000 | Microservices; auto-scaling groups; multi-region; Kafka for async writes |
| > 1,000,000 | Custom hardware (Google-scale); global CDN; edge compute |

**Memory for stateful services** (Redis, in-memory DB):
```
memory_needed = working_set_size × avg_object_size × replication_factor

Working set: top 20% of keys get 80% of traffic (Pareto principle)
Replication: Redis minimum 3 nodes (1 primary + 2 replica)
```

---

## Step 5: Calculate Cache

**Goal**: Determine how much cache is needed to achieve the target hit ratio (typically 80–99%).

**Formula**:
```
cache_size = hot_requests_per_day × avg_cached_object_size × TTL_in_days

Hot requests = top 20% of unique resources (Pareto)
```

**Cache sizing example — YouTube thumbnails**:
```
2B DAU × 50 thumbnail views/day = 100B thumbnail requests/day
Unique thumbnails viewed: 100B × 20% unique = 20B unique thumbnails/day
But Pareto: top 1% of videos = 99% of views → hot set ≈ 200M thumbnails
Average thumbnail size: 15KB
Cache needed: 200M × 15KB = 3TB
Redis r6g.4xlarge (105GB RAM) → need ~29 nodes for 3TB
Tip: Use CDN (CloudFront) instead — cache at edge for $0.0085/GB egress
```

**Cache hit ratio math**:
```
If 90% hit ratio and 10K QPS:
  - Cache handles: 9,000 QPS
  - Origin DB sees: 1,000 QPS
  
If 99% hit ratio:
  - Cache handles: 9,900 QPS
  - Origin DB sees: 100 QPS (10x reduction)

Going from 90% → 99% hit ratio cuts DB load by 10x.
This is almost always worth the extra memory cost.
```

---

## Step 6: Estimate Monthly Cost

**AWS Quick-Reference Pricing** (use these in interviews — accurate as of 2024):

| Service | Instance/Tier | Monthly Cost |
|---------|-------------|-------------|
| EC2 m5.xlarge (4 vCPU, 16GB) | On-demand | ~$140/month |
| EC2 c5.2xlarge (8 vCPU, 16GB) | On-demand | ~$245/month |
| EC2 p3.2xlarge (1× V100 GPU) | On-demand | ~$2,200/month |
| EC2 p4d.24xlarge (8× A100 GPU) | On-demand | ~$32,000/month |
| RDS db.r6g.xlarge (4 vCPU, 32GB) | Multi-AZ | ~$400/month |
| RDS db.r6g.4xlarge (16 vCPU, 128GB) | Multi-AZ | ~$1,600/month |
| ElastiCache r6g.xlarge (4 vCPU, 32GB) | 1 node | ~$163/month |
| ElastiCache r6g.4xlarge (16 vCPU, 128GB) | 1 node | ~$650/month |
| S3 Standard | per GB | ~$0.023/GB/month |
| S3 Glacier Instant | per GB | ~$0.004/GB/month |
| EBS gp3 (SSD) | per GB | ~$0.08/GB/month |
| CloudFront CDN | per GB egress | ~$0.0085/GB (first 10TB) |
| Data Transfer OUT | EC2 → Internet | ~$0.09/GB |
| Lambda | per 1M invocations | ~$0.20 |
| SQS | per 1M requests | ~$0.40 |
| SNS | per 1M publishes | ~$0.50 |
| Kinesis | per shard-hour | ~$0.015/shard/hour |
| DynamoDB | per WCU (1 write/s) | ~$0.47/month |
| DynamoDB | per RCU (1 strong read/s) | ~$0.09/month |

**Monthly cost estimation — Twitter example (300M DAU)**:
```
App servers:    350 × m5.xlarge × $140   =  $49,000
DB (primary):   2 × db.r6g.4xlarge RDS   =  $3,200
Read replicas:  4 × db.r6g.4xlarge       =  $6,400
Redis cache:    6 × r6g.4xlarge          =  $3,900
S3 storage:     50 PB total (5 yr) → 50,000TB × $0.023 = $1.15M/month — actually amortized; daily write 1TB → +$23/day
CDN (CloudFront): 500TB egress/day × 30 × $0.0085 = $127,500
────────────────────────────────────────────────────
Rough total:    ~$200K–$300K/month
Real Twitter (pre-2022): ~$100M/year → ~$8.3M/month
Difference: custom hardware, on-prem colocation, reserved instances (~70% discount vs on-demand)
```

> In interviews, being within 3–5x of real cost is excellent. The key is showing you can identify the dominant cost driver (usually: bandwidth > compute > storage, or GPU compute for ML).

---

## Traffic Scale Tiers {#traffic-scale-tiers}

Use this table as your anchor when starting any estimation. Find the DAU tier, read across for ballpark numbers.

| DAU | Avg QPS | Peak QPS | App Servers | DB Primary | Cache (Redis) | CDN Egress/day | Monthly Infra (rough) |
|-----|---------|----------|-------------|-----------|---------------|----------------|-----------------------|
| 1M | 115 | 350 | 1 | 1× db.r6g.large | 1× r6g.large | 1 TB | ~$5K |
| 10M | 1,160 | 3,500 | 4 | 1× db.r6g.xlarge + 2 replicas | 2× r6g.xlarge | 10 TB | ~$30K |
| 100M | 11,600 | 35,000 | 35 | Sharded: 10× db.r6g.xlarge | 10× r6g.xlarge | 100 TB | ~$200K |
| 500M | 58,000 | 175,000 | 175 | Sharded: 40× db.r6g.2xlarge | 40× r6g.2xlarge | 500 TB | ~$1M |
| 1B | 115,000 | 350,000 | 350 | DynamoDB or Cassandra cluster | 100× r6g.2xlarge or CDN | 1 PB | ~$2M+ |

> These are rough order-of-magnitude numbers assuming: 50% CPU utilization target, read:write = 10:1, 80% cache hit ratio. Adjust based on your specific read/write ratio and object sizes.

---

## Key Formulas

### DAU to QPS
```
avg_QPS = DAU × requests_per_user_per_day ÷ 86,400
peak_QPS = avg_QPS × peak_factor   (3 for consumer, 10 for live events)
```

### Storage Growth Rate
```
daily_storage_GB = write_QPS × 86,400 × avg_object_size_bytes ÷ 1e9
annual_storage_TB = daily_storage_GB × 365 ÷ 1000
```

### Cache Size (Working Set)
```
hot_object_count = total_unique_objects × 0.20   (Pareto 80/20)
cache_size_GB = hot_object_count × avg_object_size_bytes ÷ 1e9
redis_node_count = ceil(cache_size_GB × replication_factor ÷ node_RAM_GB)
```

### Bandwidth
```
ingress_bandwidth_Gbps = write_QPS × avg_object_size_bytes × 8 ÷ 1e9
egress_bandwidth_Gbps  = read_QPS  × avg_object_size_bytes × 8 ÷ 1e9
```

### Server Count
```
server_count = peak_QPS ÷ RPS_per_server
               where RPS_per_server = 1,000 for API, 100 for compute-heavy
```

### Replication Overhead
```
total_storage_with_replication = raw_storage × replication_factor
  - S3 Standard: 3x (automatic, across 3 AZs)
  - MySQL RDS Multi-AZ: 2x
  - Cassandra typical: 3x
  - Kafka default: 3x
```

---

## The Blank Estimation Template

Copy this into your notepad or whiteboard at the start of every capacity question.

```
System: ________________________
Scale:  ______M DAU  |  ______M monthly users

───── STEP 1: ASSUMPTIONS ─────
Read:write ratio: ___:1
Requests/user/day: ______
Peak multiplier:   ___x

───── STEP 2: TRAFFIC ─────
Write req/day:  DAU × __% × __ req = ______M/day
Read  req/day:  DAU × __ req       = ______M/day

Write QPS avg:  ___M / 86400 = ______ QPS
Read  QPS avg:  ___M / 86400 = ______ QPS
Peak  QPS:      ______ × ___x      = ______ QPS

───── STEP 3: STORAGE ─────
Avg object size: ______ bytes
Daily write:     ______ QPS × 86400 × ______ bytes = ______ GB/day
5-year total:    ______ GB × 1825               = ______ TB

───── STEP 4: COMPUTE ─────
RPS/server assumption: 1,000 (API) / 100 (compute)
App server count:  ______ peak QPS ÷ ______ RPS = ______ servers
DB primary:        ______ (size tier)
DB replicas:       ______ (read QPS ÷ replica RPS)

───── STEP 5: CACHE ─────
Hot working set:   ______ objects × 20% = ______ objects
Avg cached size:   ______ bytes
Cache needed:      ______ GB → ______ Redis nodes

───── STEP 6: COST ─────
Compute:   ______ servers × $140/mo = $______
DB:        ______ nodes   × $400/mo = $______
Cache:     ______ nodes   × $163/mo = $______
Storage:   ______ GB      × $0.023  = $______
Bandwidth: ______ TB/mo   × $8.50   = $______
─────────────────────────────────────────────
TOTAL: ~$______ / month
```

---

## Common Mistakes

### Mistake 1: Using Total Registered Users Instead of DAU

**What goes wrong**: A system with 1B registered users but only 100M DAU is a 100M-DAU system. Using 1B gives every subsequent estimate a 10x error.

**Fix**: Always confirm or estimate DAU. Assume DAU ≈ 20–50% of MAU. Never use total registered users for traffic calculations.

---

### Mistake 2: Forgetting Peak Multiplier

**What goes wrong**: Designing for average QPS. A system averaging 1,000 QPS will spike to 3,000 QPS at 9pm on a Friday. Provisioning for average means dropping 66% of requests at peak.

**Fix**: Always multiply avg QPS by 3 for consumer apps. Say explicitly: "I'll design for 3x peak, which means ___K QPS, to avoid cascading failures at peak hours."

---

### Mistake 3: Ignoring Fan-Out Multiplier

**What goes wrong**: You calculate "1M tweets/day = 12 write QPS" and stop there. But a tweet from a celebrity with 10M followers generates 10M notification/feed writes. The actual write QPS can be 1,000x the naive number.

**Fix**: For social networks, always ask "what is the maximum follower count?" and calculate:
```
fan_out_write_QPS = write_QPS × avg_fanout
Hybrid approach (used by Twitter): async fan-out for users < 1M followers; pull-on-read for celebrities
```

---

### Mistake 4: Conflating Read and Write Scaling

**What goes wrong**: Candidate says "I'll add more DB servers." Read scaling (replicas) and write scaling (sharding) are completely different operations with different complexity and cost.

**Fix**: Calculate read QPS and write QPS separately. State explicitly which path is the bottleneck. Read replicas are cheap; sharding is expensive and operationally complex. Propose read replicas first; only move to sharding if write QPS exceeds ~10K/second on a single primary.

---

### Mistake 5: Forgetting Replication and Encoding Overhead

**What goes wrong**: Candidate calculates raw storage correctly but forgets:
- S3 stores 3 copies (3x storage multiplier)
- MySQL RDS Multi-AZ keeps a synchronous replica (2x)
- Video is transcoded into 5 quality variants (5x storage for video)
- Indexes for searchable data can be 20–50% of raw data size

**Fix**: Add a replication multiplier explicitly. For video platforms: "raw storage × 5 variants × 3 geographic copies = 15x raw upload size."

---

### Mistake 6: Not Connecting Numbers to Architecture

**What goes wrong**: Candidate produces correct numbers but then recommends a single PostgreSQL database for a 100K write QPS system (single PostgreSQL handles ~5K-10K write TPS under ideal conditions).

**Fix**: Use the scale decision table. Every time you calculate peak QPS > 10K writes/sec, explicitly say: "This exceeds what a single relational DB can handle — I'll propose [sharding / DynamoDB / Cassandra]." Let your numbers drive your architecture choices out loud.

---

### Mistake 7: Ignoring the Dominant Cost Driver

**What goes wrong**: Candidate optimizes compute cost ($50K/month) while ignoring CDN bandwidth cost ($500K/month) for a media platform.

**Fix**: For each system type, the dominant cost driver is usually:
- **Media platforms** (video/photo): CDN egress bandwidth
- **ML/AI systems**: GPU compute
- **High-write transactional**: Database write throughput (DynamoDB WCUs)
- **Log/analytics systems**: Storage + data transfer for the pipeline
- **Pure API services**: Compute (EC2/Lambda)

Identify the dominant driver first and optimize it.

---

## Latency Reference (Jeff Dean Numbers)

These are the numbers every engineer should internalize. Use them to justify architectural decisions.

| Operation | Latency | Notes |
|-----------|---------|-------|
| L1 cache reference | 1 ns | |
| L2 cache reference | 4 ns | |
| Main memory (RAM) read | 100 ns | 100x slower than L1 |
| SSD random read (NVMe) | 100 μs (0.1ms) | 1,000x slower than RAM |
| HDD seek | 10 ms | 100,000x slower than RAM |
| Read 1MB from RAM | 0.25 ms | |
| Read 1MB from SSD | 1 ms | |
| Read 1MB from HDD | 20 ms | |
| Round-trip within same DC | 0.5 ms | |
| Packet: US East → West | 40 ms | |
| Packet: US → Europe | 150 ms | |
| Packet: US → Singapore | 200 ms | |
| TCP connection setup | 1 ms (LAN) | |
| TLS handshake | 10–30 ms | Use TLS session resumption |
| Redis GET (local) | 0.5 ms | |
| DB query (indexed, local) | 1–5 ms | |
| DB query (un-indexed, 1M rows) | 100–1,000 ms | Never do this in hot path |

---

## References

- 📖 [Jeff Dean — Numbers Everyone Should Know](https://static.googleusercontent.com/media/research.google.com/en//people/jeff/stanford-295-talk.pdf) — The original latency reference, still valid at the order-of-magnitude level
- 📖 [System Design Interview – An Insider's Guide (Alex Xu)](https://www.amazon.com/System-Design-Interview-Insiders-Guide/dp/1736049119) — Chapter 2 is specifically about back-of-envelope estimation
- 📺 [Latency Numbers Every Programmer Should Know (Interactive)](https://colin-scott.github.io/personal_website/research/interactive_latency.html) — Interactive visualization of how latency numbers have changed over the years
