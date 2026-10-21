---
title: "Storage Sizing Reference — S3, EBS, RDS, DynamoDB, Aurora"
layer: reference
section: interview-prep/capacity-estimation/reference-tables
difficulty: intermediate
tags: [capacity-planning, aws, sizing, cost-estimation]
---

# Storage Sizing Reference — S3, EBS, RDS, DynamoDB, Aurora

Quick reference for storage sizing decisions in system design interviews and production capacity planning. All pricing is approximate 2024/2025 AWS us-east-1 rates.

---

## 1. Quick Decision Table

| Use case | Best choice | Why |
|---|---|---|
| Static files, user uploads, backups | **S3 Standard** | Unlimited scale, $0.023/GB, 11 9s durability |
| Infrequently accessed archives (>30 days) | **S3-IA or Glacier** | 60–90% cheaper than Standard |
| Block storage for EC2 (general workload) | **EBS gp3** | 3,000 IOPS baseline free, $0.08/GB |
| High-IOPS database (>16,000 IOPS) | **EBS io2 Block Express** | Up to 256,000 IOPS, sub-ms latency |
| Relational DB, moderate scale (<5k QPS) | **RDS MySQL/PostgreSQL** | Managed, point-in-time recovery |
| Relational DB, high scale or global | **Aurora** | 3–5x faster than RDS, auto-storage |
| Key-value or document, unpredictable traffic | **DynamoDB on-demand** | Pay per request, scales to millions/s |
| Key-value, steady predictable traffic | **DynamoDB provisioned + DAX** | ~30% cheaper + microsecond reads |

---

## 2. S3 — Object Storage

### Storage Tiers

| Tier | Min duration | Cost/GB/month | Retrieval cost | Best for |
|---|---|---|---|---|
| Standard | None | $0.023 | Free | Active data, frequent reads |
| Intelligent-Tiering | None | $0.023 (hot) / $0.0125 (cool) | Free | Unknown access patterns |
| Standard-IA | 30 days | $0.0125 | $0.01/GB | Monthly reports, backups |
| One Zone-IA | 30 days | $0.01 | $0.01/GB | Re-creatable data, dev/test |
| Glacier Instant Retrieval | 90 days | $0.004 | $0.03/GB | Compliance archives (<1% access) |
| Glacier Flexible Retrieval | 90 days | $0.0036 | $0.01/GB (bulk) | Long-term archives (hours SLA) |
| Glacier Deep Archive | 180 days | $0.00099 | $0.02/GB | 7-year compliance, rarely accessed |

### Request Pricing (S3 Standard)

| Operation | Cost |
|---|---|
| PUT / COPY / POST / LIST | $0.005 per 1,000 requests |
| GET / SELECT | $0.0004 per 1,000 requests |
| Data transfer out (internet) | $0.09/GB first 10TB |
| Data transfer within same region | Free |

### S3 Sizing Formula

```
Monthly cost = (storage_GB × tier_rate)
             + (puts_per_month / 1000 × $0.005)
             + (gets_per_month / 1000 × $0.0004)
             + (egress_GB × $0.09)
```

**Worked example — Image hosting platform, 10M users:**
- 10M users × 20 photos avg × 500 KB = 100 TB storage
- 100 TB × $0.023 = **$2,300/month** (Standard)
- Switch to Intelligent-Tiering: savings ~35% on cool objects = ~**$1,500/month**
- 500M GET/month = 500,000 × $0.0004 = **$200/month**

### Scaling Thresholds

| Scale | Signal | Action |
|---|---|---|
| >1 PB | Cost growing fast | Lifecycle rules to IA/Glacier for old objects |
| >100k req/s | Throttling (503) | Add random prefix to key names (parallel shards) |
| Cross-region reads | High latency | S3 Transfer Acceleration or CloudFront CDN |
| Write-heavy deletes | Eventual consistency issues | Use versioning + delete markers carefully |

---

## 3. EBS — Block Storage

### gp3 vs io2 Comparison

| Property | gp3 | io2 Block Express |
|---|---|---|
| Cost/GB/month | $0.08 | $0.125 |
| Baseline IOPS | 3,000 (free) | — |
| Max IOPS | 16,000 | 256,000 |
| IOPS cost | $0.005/IOPS above 3k | $0.065/IOPS |
| Max throughput | 1,000 MB/s | 4,000 MB/s |
| Throughput cost | $0.04/MB/s above 125 MB/s | Included |
| Latency | Single-digit ms | Sub-ms |
| Durability | 99.8–99.9% | 99.999% |
| Use case | Most workloads | Oracle RAC, SAP HANA, high-IOPS DB |

### EBS Sizing Formula

```
gp3 monthly cost = (volume_GB × $0.08)
                 + (max(0, IOPS - 3000) × $0.005)
                 + (max(0, throughput_MBs - 125) × $0.04)

io2 monthly cost = (volume_GB × $0.125)
                 + (IOPS × $0.065)
```

**Worked example — MySQL on gp3 needing 10,000 IOPS:**
- 500 GB storage: 500 × $0.08 = $40
- Extra IOPS: (10,000 - 3,000) × $0.005 = $35
- Total: **$75/month**

Same on io2: 500 × $0.125 + 10,000 × $0.065 = $62.50 + $650 = **$712.50/month**

**Rule: io2 only above 16,000 IOPS or when <1ms latency is mandatory.**

### Scaling Thresholds

| Signal | Threshold | Action |
|---|---|---|
| IOPS utilization >80% | Sustained for >15 min | Increase gp3 IOPS or migrate to io2 |
| Throughput at ceiling | gp3 at 1,000 MB/s | Multi-volume RAID-0 or io2 |
| Volume size | >16 TB single volume | Stripe across multiple volumes |
| Snapshot restore | >4 hours | Pre-warm with `dd` or fio after restore |

---

## 4. RDS (MySQL / PostgreSQL)

### Instance Classes

| Instance | vCPU | RAM | Max IOPS | Network | On-demand/hr | Reserved 1yr |
|---|---|---|---|---|---|---|
| db.t4g.medium | 2 | 4 GB | 2,000 | Up to 5 Gbps | $0.068 | ~$0.044 |
| db.t4g.large | 2 | 8 GB | 3,000 | Up to 5 Gbps | $0.136 | ~$0.088 |
| db.m6g.large | 2 | 8 GB | 6,750 | Up to 10 Gbps | $0.171 | ~$0.111 |
| db.m6g.xlarge | 4 | 16 GB | 13,500 | Up to 10 Gbps | $0.342 | ~$0.222 |
| db.m6g.2xlarge | 8 | 32 GB | 27,000 | Up to 10 Gbps | $0.684 | ~$0.444 |
| db.r6g.xlarge | 4 | 32 GB | 20,000 | Up to 10 Gbps | $0.48 | ~$0.312 |
| db.r6g.2xlarge | 8 | 64 GB | 40,000 | Up to 10 Gbps | $0.96 | ~$0.624 |
| db.r6g.4xlarge | 16 | 128 GB | 80,000 | Up to 10 Gbps | $1.92 | ~$1.248 |
| db.r6g.8xlarge | 32 | 256 GB | 160,000 | 10 Gbps | $3.84 | ~$2.496 |

**Rule of thumb:**
- `db.r6g.xlarge` (4 vCPU, 32 GB RAM): **~5,000–10,000 QPS reads**, **~1,000–3,000 QPS writes** (depends on query complexity and index usage)
- Every read replica doubles read capacity (up to 5 replicas for MySQL, 15 for Aurora)

### RDS Storage

| Type | Cost/GB/month | Max size | Max IOPS | Notes |
|---|---|---|---|---|
| gp2 (legacy) | $0.115 | 64 TB | 64,000 | 3 IOPS/GB baseline |
| gp3 | $0.115 | 64 TB | 64,000 | 3,000 IOPS free, $0.20/IOPS extra |
| io1 | $0.125 + $0.10/IOPS | 64 TB | 256,000 | Legacy high-IOPS |
| io2 | $0.125 + $0.10/IOPS | 64 TB | 256,000 | Better durability than io1 |

**Note: RDS gp3 IOPS pricing is $0.20/IOPS (vs $0.005 for EC2 EBS gp3) — 40x more expensive for extra IOPS. Budget accordingly.**

### Read Replica Lag Thresholds

| Lag | Meaning | Action |
|---|---|---|
| <1 second | Healthy, async replication | Normal operation |
| 1–10 seconds | High write load or network | Investigate write throughput |
| >30 seconds | Replica falling behind | Scale up replica, reduce write rate |
| >5 minutes | Replica unusable for reads | Promote or recreate replica |

### RDS Sizing Formula

```
Monthly cost = (instance_hours × instance_rate)
             + (storage_GB × $0.115)
             + (backup_GB × $0.095)   # free up to DB size
             + (IOPS_extra × $0.20)   # gp3 above 3,000
             + (replica_count × same_formula)
```

**Worked example — E-commerce site, 2,000 QPS reads, 500 QPS writes:**
- Primary: db.r6g.xlarge = $0.48/hr × 720 = $345.60/month
- 1 read replica: same = $345.60/month
- 500 GB gp3 storage: 500 × $0.115 = $57.50/month
- Total: ~**$750/month** on-demand; ~**$490/month** reserved

---

## 5. Aurora (MySQL/PostgreSQL Compatible)

### Aurora vs RDS Comparison

| Property | RDS MySQL/PG | Aurora MySQL/PG |
|---|---|---|
| Storage | EBS-backed | Distributed, 6-way replication |
| Storage cost | $0.115/GB (gp3) | $0.10/GB |
| I/O cost | Included (gp3) | $0.20 per 1M I/O requests |
| Max storage | 64 TB | 128 TB (auto-grows) |
| Failover time | 60–120 seconds | <30 seconds |
| Read replicas | Up to 5 (MySQL) | Up to 15 |
| Replica lag | Seconds | <100 ms |
| Performance | Baseline | 3–5x MySQL, 3x PostgreSQL |
| Serverless | No | Aurora Serverless v2 |

### Aurora Cluster Pricing

| Component | Cost |
|---|---|
| Storage | $0.10/GB/month (auto-scales) |
| I/O requests | $0.20 per 1,000,000 requests |
| Writer instance (db.r6g.xlarge) | $0.48/hr |
| Reader instance | Same as writer |
| Aurora Global Database replication | $0.20/GB replicated |
| Backtrack (point-in-time rewind) | $0.012/GB stored |

### Aurora Serverless v2

- **ACU (Aurora Capacity Units)**: 1 ACU = 2 GB RAM
- **Min ACU**: 0.5; **Max ACU**: 256
- **Cost**: $0.12/ACU-hour
- **Scale speed**: Doubles capacity in <1 second (hot path)
- **Best for**: Variable traffic, dev/test, multi-tenant SaaS

| ACUs | RAM | Approx equivalent | Cost/hr |
|---|---|---|---|
| 2 | 4 GB | db.t4g.large | $0.24 |
| 4 | 8 GB | db.m6g.large | $0.48 |
| 8 | 16 GB | db.m6g.xlarge | $0.96 |
| 16 | 32 GB | db.r6g.xlarge | $1.92 |
| 32 | 64 GB | db.r6g.2xlarge | $3.84 |

**Worked example — SaaS app, spiky traffic (100 QPS avg, 2,000 QPS peak):**
- Serverless v2: 1 ACU idle, 16 ACU peak = avg 4 ACU × $0.12 = $0.48/hr × 720 = **$345/month**
- vs. fixed db.r6g.xlarge for peak: $0.48/hr × 720 = $345/month (same) but no scale-down savings

### Aurora Global Database

- Replication lag: **<1 second** cross-region (typically 100–200 ms)
- RPO: <1 second; RTO: <1 minute (managed failover)
- Cost: Primary cluster + replica cluster costs + $0.20/GB data replicated

---

## 6. DynamoDB

### Capacity Modes

| Mode | Best for | Cost model | Limits |
|---|---|---|---|
| On-demand | Unpredictable traffic, new apps | Pay per request | No pre-provisioning needed |
| Provisioned | Steady predictable traffic | Pay per RCU/WCU per hour | Must set limits |
| Provisioned + Auto-scaling | Moderate variance | Pay for provisioned + auto-scale lag | Scales in 2–4 min |

### Capacity Unit Definitions

| Unit | Read/Write | Size | Consistency |
|---|---|---|---|
| RCU (Read Capacity Unit) | 1 read/sec | 4 KB | Strongly consistent |
| RCU | 2 reads/sec | 4 KB | Eventually consistent |
| WCU (Write Capacity Unit) | 1 write/sec | 1 KB | — |
| Transactional read | 2 RCU | 4 KB | ACID transaction |
| Transactional write | 2 WCU | 1 KB | ACID transaction |

### DynamoDB Pricing (us-east-1)

| Component | On-demand | Provisioned |
|---|---|---|
| Read | $0.25 per million RRUs | $0.00013/RCU-hour |
| Write | $1.25 per million WRUs | $0.00065/WCU-hour |
| Storage | $0.25/GB/month | $0.25/GB/month |
| GSI storage | $0.25/GB/month | $0.25/GB/month |
| GSI writes | Same as table WCU | Same as table WCU |
| DAX | t3.small: $0.054/hr | t3.small: $0.054/hr |

**On-demand breakeven vs provisioned: ~200M reads or 40M writes/month**

### DynamoDB Sizing Formula

```
# On-demand
monthly_cost = (reads_per_month / 1M × $0.25)
             + (writes_per_month / 1M × $1.25)
             + (storage_GB × $0.25)

# Provisioned
monthly_cost = (RCUs × $0.00013 × 720)
             + (WCUs × $0.00065 × 720)
             + (storage_GB × $0.25)
```

**Worked example — Social feed, 50M reads/day, 5M writes/day:**
- On-demand: (1,500M reads × $0.25/M) + (150M writes × $1.25/M) = $375 + $187.50 = **$562.50/month**
- Provisioned: 58k RCU + 5.8k WCU = (58,000 × $0.00013 × 720) + (5,800 × $0.00065 × 720) = $5,428 + $2,714 = **$8,142/month**
- **On-demand is cheaper here** — counter-intuitive but common for read-heavy apps

### GSI Cost Impact

- Each GSI replicates writes: 1 table write = 1 WCU on table + 1 WCU per GSI
- 5 GSIs on a write-heavy table = **6x write cost**
- GSI storage is billed separately at same rate as table storage
- **Rule: Each GSI effectively multiplies your write cost by (1 + 1/N_GSIs)^N_GSIs**

### DAX (DynamoDB Accelerator)

| Node | vCPU | Memory | Reads/sec | Cost/hr |
|---|---|---|---|---|
| t3.small | 2 | 1.5 GB | ~1,400 | $0.054 |
| t3.medium | 2 | 3 GB | ~2,800 | $0.108 |
| r6g.large | 2 | 16 GB | ~20,000 | $0.269 |
| r6g.xlarge | 4 | 32 GB | ~40,000 | $0.538 |

- DAX cluster = 3 nodes minimum (one per AZ) = minimum $0.162/hr = **$116/month**
- Break-even: cache hit rate >60% and read volume >5M reads/day

### Scaling Thresholds

| Signal | Threshold | Action |
|---|---|---|
| Read throttling | >1% throttled requests | Add RCUs or switch to on-demand |
| Write throttling | >0.1% throttled requests | Add WCUs, partition key hot spots |
| Hot partition | 1 partition = >3,000 RCU or 1,000 WCU | Redesign partition key (add suffix) |
| Item size | >400 KB single item | Store large attributes in S3 + pointer |
| Table scan | Regular full scans | Add GSI or migrate to different DB |

---

## 7. Cross-Service Sizing Formulas

### Storage per User

```
storage_per_user = profile_data + avg_content + metadata

Example (photo sharing app):
  profile: 10 KB
  photos: 50 photos × 2 MB avg = 100 MB
  thumbnails: 50 photos × 50 KB = 2.5 MB
  metadata (DynamoDB): 50 items × 1 KB = 50 KB
  total: ~102 MB/user

1M users = 102 TB raw storage
  S3 Standard: 102,000 GB × $0.023 = $2,346/month
  With IA lifecycle (70% cold after 90 days): ~$1,600/month
```

### Database Sizing from QPS

```
RDS reads per second → instance class:
  <1,000 QPS  → db.m6g.large + 1 replica
  1,000–5,000 → db.r6g.xlarge + 2 replicas
  5,000–15,000 → db.r6g.2xlarge + 3 replicas  
  15,000–50,000 → Aurora + 5 read replicas
  >50,000 → Aurora Global + sharding or DynamoDB

Write QPS → EBS IOPS (rule of thumb: 1 write QPS ≈ 5–10 IOPS):
  1,000 write QPS → 5,000–10,000 IOPS → gp3 custom IOPS
  3,000 write QPS → 15,000–30,000 IOPS → io2 or Aurora
```

---

## 8. Cost Optimization Tips

| Tip | Typical savings | How |
|---|---|---|
| Reserved instances (1yr, no upfront) | 30–35% | Commit to RDS/EC2 1-year term |
| Reserved instances (3yr, partial upfront) | 50–60% | For baseline steady-state load |
| S3 Intelligent-Tiering | 30–50% on cold data | Auto-moves cold objects to cheaper tier |
| S3 lifecycle rules | 60–90% vs Standard | Move to IA after 30 days, Glacier after 90 |
| Aurora vs RDS for large clusters | 20–30% cheaper storage | $0.10 vs $0.115/GB, no IOPS charges on storage |
| DynamoDB on-demand for spiky | 40–70% vs over-provisioned | Pay only for actual requests |
| EBS gp3 vs gp2 migration | 20% cheaper per GB | Same price but 3,000 free IOPS |
| RDS Multi-AZ only in production | 2x instance cost avoided | Don't Multi-AZ dev/staging |
| DAX cache hit ratio >80% | 60% read cost reduction | Microsecond reads bypass DDB billing |
| Spot instances for batch EBS workloads | 70–90% on compute | EBS persists across spot interruptions |

---

## 9. Common Mistakes

### Mistake 1: Ignoring DynamoDB GSI Write Amplification

**Problem**: Table has 4 GSIs. Each 1 WCU write becomes 5 WCU. At 10k writes/sec provisioned that's 50k WCU provisioned = $23,400/month vs expected $4,680/month.

**Fix**: Count GSIs before provisioning. Every GSI costs 1 additional WCU per write. Design GSIs carefully — fewer, targeted projections instead of full table projections.

---

### Mistake 2: Choosing RDS gp3 Then Paying 40x for Extra IOPS

**Problem**: RDS gp3 charges $0.20/IOPS above 3,000 baseline. EC2 EBS gp3 charges $0.005/IOPS. A dev used to EC2 pricing budgets 10,000 extra IOPS on RDS as 7,000 × $0.005 = $35. Actual RDS cost: 7,000 × $0.20 = $1,400/month.

**Fix**: For high-IOPS RDS, use io2 (capped at $0.10/IOPS on RDS) or migrate to Aurora (I/O is separate $0.20/M requests, much cheaper at scale).

---

### Mistake 3: S3 Egress Blindspot

**Problem**: Team designs image CDN serving 100 TB/month from S3 directly. Compute: 100,000 GB × $0.09 = **$9,000/month** in egress alone, on top of storage.

**Fix**: Put CloudFront in front of S3. CloudFront to internet: $0.0085/GB (first 10 TB). S3 to CloudFront: **free** (same-region). Same 100 TB = $850/month. **90% savings**.

---

### Mistake 4: Over-sizing RDS for Read Workloads

**Problem**: Interview answer picks db.r6g.4xlarge ($1.92/hr = $1,382/month) for 10,000 QPS reads. A db.r6g.xlarge + 2 read replicas handles 15,000–30,000 reads at $0.48/hr × 3 = $1.44/hr = $1,037/month — cheaper and more resilient.

**Fix**: Scale out with read replicas before scaling up. Rule: 1 replica ≈ 1 primary instance's read capacity. Aurora replicas share storage — no data duplication cost.

---

### Mistake 5: Aurora Serverless v2 Minimum ACU Idle Cost

**Problem**: 50 Aurora Serverless v2 clusters for tenants each with 0.5 ACU minimum = 25 ACU always running = $0.12 × 25 × 720 = **$2,160/month** even with zero traffic.

**Fix**: For multi-tenant SaaS: use single Aurora cluster with row-level isolation instead of per-tenant clusters. Or accept minimum ACU cost and factor it into tenant pricing.

---

## 10. Interview Quick-Reference Card

```
S3 pricing:     $0.023/GB Standard | $0.0125/GB IA | $0.004/GB Glacier
EBS gp3:        $0.08/GB + $0.005/IOPS > 3k + $0.04/MBps > 125
EBS io2:        $0.125/GB + $0.065/IOPS (up to 256k IOPS)
RDS gp3:        $0.115/GB + $0.20/IOPS > 3k (40x more than EC2!)
Aurora:         $0.10/GB + $0.20/1M I/O requests
DynamoDB on-demand: $0.25/M reads | $1.25/M writes | $0.25/GB

Reserved discount: ~30-40% (1yr) | ~50-60% (3yr)
CloudFront vs direct S3 egress: 10x cheaper for internet traffic

Rule of thumb throughput:
  db.r6g.xlarge = ~5k-10k QPS reads | ~1k-3k writes
  Each read replica ≈ +5k-10k QPS reads (up to 15 on Aurora)
  DynamoDB: essentially unlimited with correct partition key design
  S3: unlimited throughput with 3,500 PUT/5,500 GET per prefix/sec
```

---

## References

- 📚 [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/) — Official pricing, updated periodically
- 📚 [Amazon RDS Pricing](https://aws.amazon.com/rds/pricing/) — Instance class pricing and storage tiers
- 📚 [Amazon Aurora Pricing](https://aws.amazon.com/rds/aurora/pricing/) — Serverless v2 ACU rates and I/O pricing
- 📚 [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/) — On-demand vs provisioned breakdown
- 📚 [Amazon EBS Pricing](https://aws.amazon.com/ebs/pricing/) — gp3 vs io2 comparison
- 📖 [AWS Cost Optimization Pillar](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html) — Well-Architected Framework cost guidance
- 📖 [Aurora vs RDS: When to Use Which](https://aws.amazon.com/blogs/database/is-amazon-rds-still-relevant-in-the-era-of-serverless/) — AWS engineering blog comparison
