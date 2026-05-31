---
title: "Numbers Every Engineer Must Know for System Design Interviews"
layer: interview-q
section: "12-interview-prep/quick-reference"
difficulty: beginner
tags: [numbers, latency, throughput, storage, back-of-envelope, cheat-sheet, memorize]
category: interview-prep
---

# Numbers Every Engineer Must Know for System Design Interviews

> Memorize these. Interviewers hand you a blank whiteboard and expect you to derive estimates from first principles. These numbers are your axioms.

---

## 1. Latency Hierarchy (Jeff Dean's Numbers, Updated)

The canonical latency ladder. Round to nearest order of magnitude when estimating.

| Operation | Latency | Notes |
|-----------|---------|-------|
| L1 cache reference | **0.5 ns** | 1 cycle at 2 GHz |
| Branch misprediction | 5 ns | CPU pipeline flush |
| L2 cache reference | **7 ns** | 14× slower than L1 |
| Mutex lock/unlock | 25 ns | Kernel involvement |
| L3 cache reference | **~40 ns** | Shared across cores |
| Main memory (RAM) reference | **100 ns** | 20× slower than L2 |
| Compress 1 KB with Snappy | 3 µs | CPU-bound |
| Read 1 MB sequentially from RAM | 10 µs | ~100 GB/s bandwidth |
| SSD random read (4 KB) | **100–150 µs** | NVMe; SATA SSD ~500 µs |
| SSD sequential read (1 MB) | **1 ms** | NVMe; throughput ~3 GB/s |
| HDD random read (seek + rotate) | **5–10 ms** | Mechanical; 100–200 IOPS |
| HDD sequential read (1 MB) | **20 ms** | ~100 MB/s typical |
| Network: same datacenter RTT | **0.5–1 ms** | Same rack < 0.1 ms |
| Network: cross-continent (US East→West) | **40–60 ms** | Speed of light limit ~30 ms |
| Network: cross-ocean (US→Europe) | **80–150 ms** | Atlantic fiber; US→Asia ~180 ms |
| TCP handshake (same DC) | **1 ms** | 1 RTT |
| TLS 1.3 handshake | **1 RTT** | After TCP; TLS 1.2 = 2 RTT |
| DNS resolution (cached) | **< 1 ms** | Local resolver |
| DNS resolution (uncached) | **20–120 ms** | Recursive lookup |

### Key Ratios to Internalize

| Comparison | Ratio |
|------------|-------|
| RAM vs L1 cache | ~200× slower |
| SSD random vs RAM | ~1,000× slower |
| HDD random vs SSD random | ~50–100× slower |
| Cross-ocean vs same-DC network | ~150× slower |
| SSD sequential vs HDD sequential | ~3× faster |

---

## 2. Throughput by System

Single-node throughput on typical production hardware (2024 vintage). Scale horizontally beyond these.

### Databases

| System | Operation | Throughput | Hardware Assumption |
|--------|-----------|------------|---------------------|
| PostgreSQL | Simple SELECT (PK lookup) | **~10,000–20,000 QPS** | 8-core, 32 GB RAM, SSD |
| PostgreSQL | Complex JOIN, index scan | **1,000–5,000 QPS** | Same |
| PostgreSQL | Bulk INSERT | **~50,000 rows/s** | COPY command |
| MySQL (InnoDB) | Simple SELECT | **~15,000–25,000 QPS** | 8-core, 32 GB RAM, SSD |
| MySQL (InnoDB) | Write throughput | **~5,000–10,000 TPS** | With fsync |
| MongoDB | Read (indexed) | **~20,000–50,000 QPS** | Single node |
| MongoDB | Write (w:1) | **~10,000–30,000 ops/s** | Without journaling sync |
| Redis | GET/SET (in-memory) | **~100,000–500,000 ops/s** | Single-threaded; 6.0+ multi-threaded ~1M |
| Redis | Pipeline (batch) | **~1,000,000+ ops/s** | 100-command pipeline |
| DynamoDB | Per partition | **1,000 RCU / 1,000 WCU** | Hard partition limit |
| DynamoDB | Table (default) | **40,000 RCU / 40,000 WCU** | Soft limit, raiseable |
| Cassandra | Write | **~50,000–100,000 writes/s** | Per node, commit log + memtable |
| Elasticsearch | Index (document) | **~5,000–10,000 docs/s** | Per node, 5-shard index |
| Elasticsearch | Search query | **~1,000–5,000 QPS** | Depends on aggregation depth |

### Messaging & Streaming

| System | Throughput | Notes |
|--------|------------|-------|
| Kafka | **100–500 MB/s per broker** | Writes; replication overhead ~3× |
| Kafka | **~1–10 MB/s per partition** | Consumers can read at broker speed |
| Kafka | **~1M messages/s** | Cluster of 3 brokers, small messages |
| RabbitMQ | **~20,000–50,000 msgs/s** | Per node; durable queues ~10k |
| SQS | **~3,000 msgs/s per queue** | Standard queue; FIFO = 300/s per group |

### Object Storage & CDN

| System | Throughput | Notes |
|--------|------------|-------|
| S3 | **3,500 PUT/s per prefix** | **5,500 GET/s per prefix** |
| S3 | Unlimited prefixes | Add random prefix to bypass limit |
| S3 | **5 GB max single PUT** | Multipart for larger files |
| CloudFront | **~100 Gbps per edge** | Global distribution |

---

## 3. Storage Size Reference

### Message / Object Sizes

| Object | Size | Notes |
|--------|------|-------|
| Tweet (text only) | **~140–280 bytes** | UTF-8; 280 chars × 1–2 bytes/char |
| Tweet (with metadata) | **~500–1,000 bytes** | Timestamps, user ID, reply IDs |
| Log line (access log) | **~100–200 bytes** | Apache/nginx format |
| Database row (typical OLTP) | **~50–500 bytes** | Depends on columns; avg ~200 bytes |
| Web page (HTML only) | **~50–100 KB** | Median page ~75 KB |
| Web page (full, with assets) | **~1–3 MB** | Median 2023 page weight ~2.2 MB |
| Email (text) | **~5–20 KB** | Without attachments |
| JSON API response (list) | **~1–50 KB** | 10–100 objects |
| UUID / GUID | **36 bytes** (string) / **16 bytes** (binary) | Store as binary in DB |
| IPv4 address | **4 bytes** | As integer; string = 15 bytes |
| IPv6 address | **16 bytes** | As binary |
| Unix timestamp | **4 bytes** (32-bit) / **8 bytes** (64-bit) | 32-bit overflows 2038 |

### Media Sizes

| Media | Resolution / Quality | Size |
|-------|---------------------|------|
| Thumbnail image | 150×150 px, JPEG | **~5–15 KB** |
| Profile photo | 400×400 px, JPEG | **~30–80 KB** |
| Full photo (Instagram-style) | 1080×1080 px, JPEG | **~200–500 KB** |
| Full photo (DSLR raw) | 24 MP, RAW | **~25–50 MB** |
| Audio (Opus, voice) | 64 kbps | **~480 KB/min** |
| Audio (MP3, music) | 128 kbps | **~1 MB/min** |
| Audio (lossless FLAC) | ~900 kbps | **~6.8 MB/min** |
| Video (480p, H.264) | 500 kbps | **~3.75 MB/min** |
| Video (720p, H.264) | 1.5 Mbps | **~11 MB/min** |
| Video (1080p, H.264) | 3–5 Mbps | **~23–38 MB/min** |
| Video (4K, H.265) | 15–25 Mbps | **~112–190 MB/min** |
| Video (4K, H.265, streaming) | 7–10 Mbps | **~53–75 MB/min** |

### Storage Units Quick Reference

| Unit | Value |
|------|-------|
| 1 KB | 10³ bytes (1,000) |
| 1 MB | 10⁶ bytes (1,000,000) |
| 1 GB | 10⁹ bytes (~1 billion) |
| 1 TB | 10¹² bytes (~1 trillion) |
| 1 PB | 10¹⁵ bytes |
| 1 EB | 10¹⁸ bytes |
| **1 billion bytes** | **~1 GB** |
| **1 trillion bytes** | **~1 TB** |

---

## 4. Scale Numbers from Real Companies

Use these as sanity checks. If your estimate is 100× off from a real system, revisit your assumptions.

### Social Media

| Company | Metric | Number | Year |
|---------|--------|--------|------|
| Twitter/X | DAU | **~250M** | 2023 |
| Twitter/X | Tweets per day | **~500–600M** | 2023 |
| Twitter/X | Peak QPS (reads) | **~300,000** | (estimated) |
| Twitter/X | Timeline fanout (avg) | **~200 followers** | Long tail to 100M+ |
| Instagram | DAU | **~500M** | 2023 |
| Instagram | Photos uploaded per day | **~100M** | 2023 |
| Instagram | Stories views per day | **~500M** | 2023 |
| TikTok | DAU | **~1B** | 2023 |
| TikTok | Videos uploaded per day | **~34M** | (estimated) |
| Facebook | DAU | **~2B** | 2023 |
| LinkedIn | DAU | **~150M** | 2023 |

### Messaging

| Company | Metric | Number | Year |
|---------|--------|--------|------|
| WhatsApp | Messages per day | **~100B** | 2023 |
| WhatsApp | DAU | **~2B** | 2023 |
| WhatsApp | Peak connections | **~2B concurrent** | (approx) |
| Slack | Messages per day | **~1B+** | 2022 |
| iMessage/SMS | Messages/day (US) | **~2T/year ≈ 5.5B/day** | 2023 |

### Video

| Company | Metric | Number | Year |
|---------|--------|--------|------|
| YouTube | Hours uploaded per minute | **~500 hours** | 2022 |
| YouTube | Daily views | **~1B hours watched** | 2022 |
| Netflix | GB delivered per day | **~100–150 PB** | (estimated) |
| Netflix | % of US internet traffic (evening) | **~15%** | 2022 |
| Netflix | Titles in catalog | **~17,000** | 2023 |
| Netflix | Concurrent streams (peak) | **~200M** | (estimated) |

### Ride-sharing & Travel

| Company | Metric | Number | Year |
|---------|--------|--------|------|
| Uber | Trips per day | **~25–28M** | 2023 |
| Uber | Peak QPS (location updates) | **~1M/s** | (estimated) |
| Lyft | Trips per day | **~2–3M** | 2023 |
| Airbnb | Active listings | **~7–8M** | 2023 |
| Airbnb | Bookings per day | **~1–2M nights** | (estimated) |

### Payments & Commerce

| Company | Metric | Number | Year |
|---------|--------|--------|------|
| Stripe | Transactions per year | **~1T (estimated)** | 2023 |
| Stripe | Peak TPS | **~100,000** | Black Friday |
| Visa | Transactions per second (peak) | **~65,000 TPS** | 2022 |
| Visa | Transactions per year | **~192B** | 2022 |
| Amazon | Orders per day | **~30–35M** | (estimated) |
| Amazon | Prime Day peak orders/min | **~1,000+** | (estimated) |

### Search & Cloud

| Company | Metric | Number | Year |
|---------|--------|--------|------|
| Google | Searches per day | **~8.5B** | 2023 |
| Google | Searches per second | **~99,000** | 2023 |
| AWS | Servers | **~1M+** | (estimated) |
| GitHub | Repositories | **~330M+** | 2023 |
| GitHub | Pull requests per day | **~4M** | (estimated) |

---

## 5. Availability Math

The "nines" table. Interviewers ask: "What SLA do you need? What does that mean in downtime?"

| SLA | Downtime / Year | Downtime / Month | Downtime / Week | Downtime / Day |
|-----|----------------|-----------------|-----------------|----------------|
| **90%** (one nine) | 36.5 days | 73 hours | 16.8 hours | 2.4 hours |
| **95%** | 18.3 days | 36.5 hours | 8.4 hours | 72 min |
| **99%** (two nines) | **3.65 days** | 7.3 hours | 1.68 hours | 14.4 min |
| **99.5%** | 1.83 days | 3.65 hours | 50.4 min | 7.2 min |
| **99.9%** (three nines) | **8.76 hours** | 43.8 min | 10.1 min | 1.44 min |
| **99.95%** | 4.38 hours | 21.9 min | 5.04 min | 43.2 sec |
| **99.99%** (four nines) | **52.6 min** | 4.38 min | 1.01 min | 8.64 sec |
| **99.999%** (five nines) | **5.26 min** | 26.3 sec | 6.05 sec | 0.864 sec |
| **99.9999%** (six nines) | **31.5 sec** | 2.63 sec | 0.605 sec | 86.4 ms |

### Availability of Composed Systems

If service A has SLA `p` and service B has SLA `q`, composed availability = `p × q`.

| Configuration | Combined SLA |
|---------------|-------------|
| 99.9% + 99.9% (serial) | **99.8%** (3.65 days/yr downtime) |
| 99.9% + 99.9% + 99.9% (serial) | **99.7%** (10.95 hours/yr) |
| Two 99% in parallel (either-or) | **99.99%** |
| Three 99.9% in parallel | **99.9999999%** |

> **Trap**: Correlated failures break independence assumption. Three nodes in the same AZ aren't truly independent.

---

## 6. Back-of-Envelope Formulas

### DAU → QPS

```
QPS = (DAU × requests_per_user_per_day) / 86,400

Peak QPS ≈ Average QPS × 2–3   (typical peak factor)
Write QPS ≈ Read QPS / read_write_ratio   (common ratios: 10:1 to 100:1)
```

**Example**: 100M DAU, 10 reads/day/user
- Average QPS = (100M × 10) / 86,400 ≈ **11,574 QPS**
- Peak QPS ≈ 11,574 × 3 ≈ **~35,000 QPS**

### Storage Estimation

```
Storage = objects_per_day × avg_object_size × retention_days × replication_factor

5-year storage = objects_per_day × avg_object_size × 365 × 5 × replication_factor
```

**Example**: Twitter-scale (500M tweets/day, 500 bytes each, 3× replication)
- Daily: 500M × 500 B × 3 = **750 GB/day**
- 5-year: 750 GB × 365 × 5 = **~1.37 PB**

### Bandwidth Estimation

```
Bandwidth = QPS × avg_response_size

Upload bandwidth = write_QPS × avg_upload_size
Download bandwidth = read_QPS × avg_response_size
```

**Example**: 50,000 read QPS, avg response 1 KB
- Bandwidth = 50,000 × 1,000 bytes = **50 MB/s = 400 Mbps**

### Read/Write Ratio Rules of Thumb

| System Type | Typical Read:Write |
|-------------|-------------------|
| Social feed (Twitter/Instagram) | **100:1** |
| E-commerce catalog | **50:1** |
| Messaging (WhatsApp) | **1:1** (every message is written once, read once) |
| Analytics / logs | **1:100** (write-heavy) |
| Gaming leaderboard | **10:1** |
| URL shortener | **100:1** |
| Search index | **1,000:1** (after indexing) |

### Common Approximations

| Approximation | Value |
|---------------|-------|
| Seconds per day | **86,400** (~10⁵) |
| Seconds per year | **3.15 × 10⁷** (~π × 10⁷) |
| Requests per month (1 RPS) | **~2.6M** |
| 1 Gbps sustained | **~10 TB/day** |
| 1 GB/s sustained | **~86 TB/day** |
| 1 server, 10 Gbps NIC | **~1 PB/day** (theoretical max) |

---

## 7. Database Limits

### PostgreSQL

| Limit | Value | Notes |
|-------|-------|-------|
| Max database size | **Unlimited** | Filesystem-bound |
| Max table size | **32 TB** | Single relation |
| Max row size | **~1.6 GB** | TOAST for large values |
| Max column count | **1,600** | Practical limit ~100 |
| Max index key size | **2,712 bytes** | Multi-column B-tree |
| Default max connections | **100** | `max_connections` param |
| Connection overhead | **~5–10 MB/connection** | Use PgBouncer |
| Connection pool rule of thumb | **2–4× CPU cores** | For transaction pooling |
| B-tree height (1B rows) | **3–4 levels** | ~4 I/Os per lookup |
| B-tree height (10B rows) | **4–5 levels** | |
| Autovacuum trigger | **20% + 50 rows modified** | Default threshold |
| MVCC dead tuple bloat | **>10% dead tuples → vacuum** | |

### MySQL / InnoDB

| Limit | Value | Notes |
|-------|-------|-------|
| Max row size | **65,535 bytes** | Excluding BLOBs/TEXTs |
| Max index key size | **3,072 bytes** | With innodb_large_prefix |
| Default max connections | **151** | `max_connections` |
| InnoDB buffer pool | **60–80% of RAM** | Rule of thumb |
| InnoDB page size | **16 KB** | Default |
| Max partitions per table | **8,192** | MySQL 8.0+ |

### MongoDB

| Limit | Value | Notes |
|-------|-------|-------|
| Max document size | **16 MB** | BSON limit |
| Max index key size | **1,024 bytes** | |
| Max indexes per collection | **64** | |
| WiredTiger cache | **50% of RAM - 1 GB** | Default |
| Max write concern timeout | **0** (no timeout by default) | Set explicitly |

### Redis

| Limit | Value | Notes |
|-------|-------|-------|
| Max key size | **512 MB** | Not recommended beyond a few KB |
| Max value size | **512 MB** | Any type |
| Max hash fields | **2³² - 1 (~4B)** | |
| Max list length | **2³² - 1** | |
| Max sorted set members | **2³² - 1** | |
| Ziplist threshold (hash) | **128 entries / 64 bytes** | Compact encoding |
| Default max memory policy | **noeviction** | Change for caches |
| AOF fsync every second | **~1 second data loss** | |

---

## 8. Network

### Protocol Overhead

| Protocol | Header Size | Notes |
|----------|-------------|-------|
| Ethernet frame | **26 bytes** | Header + CRC |
| IPv4 header | **20 bytes** | Without options |
| IPv6 header | **40 bytes** | Fixed size |
| TCP header | **20 bytes** | Without options |
| UDP header | **8 bytes** | |
| HTTP/1.1 request (minimal) | **~200–500 bytes** | Headers |
| HTTP/2 (after HPACK compression) | **~10–50 bytes** | Compressed headers |
| HTTP/3 (QUIC) | **~20 bytes** | QUIC header |
| TLS 1.3 record overhead | **~5 bytes** | Per record |
| WebSocket frame | **2–10 bytes** | Header only |

### Connection Models

| Protocol Version | Connection Reuse | Multiplexing | Head-of-line blocking |
|-----------------|-----------------|--------------|----------------------|
| HTTP/1.0 | No | No | Yes |
| HTTP/1.1 | Yes (keep-alive) | No (6 parallel) | Yes |
| HTTP/2 | Yes | **Yes** (streams) | Yes (TCP level) |
| HTTP/3 (QUIC) | Yes | **Yes** | **No** |

### TLS Handshake Cost

| Scenario | RTTs | Latency (same DC) | Latency (cross-country) |
|----------|------|-------------------|------------------------|
| TLS 1.2 (full) | TCP(1) + TLS(2) = **3 RTT** | ~3 ms | ~150 ms |
| TLS 1.2 (resumption) | TCP(1) + TLS(1) = **2 RTT** | ~2 ms | ~100 ms |
| TLS 1.3 (full) | TCP(1) + TLS(1) = **2 RTT** | ~2 ms | ~100 ms |
| TLS 1.3 (0-RTT) | TCP(1) + TLS(0) = **1 RTT** | ~1 ms | ~50 ms |

### DNS TTL Impact

| TTL | Trade-off |
|-----|-----------|
| **60 seconds** | Fast failover; high DNS query load |
| **300 seconds (5 min)** | Balanced; common for SaaS |
| **3,600 seconds (1 hr)** | Low DNS load; slow failover |
| **86,400 seconds (1 day)** | Minimal load; failover next day |

> **Interview tip**: For zero-downtime deployments, lower TTL to 60s one day before DNS change, then change, then raise TTL back.

### Bandwidth Rules of Thumb

| Link | Bandwidth |
|------|-----------|
| 1 GbE NIC | **1 Gbps = 125 MB/s** |
| 10 GbE NIC | **10 Gbps = 1.25 GB/s** |
| 100 GbE NIC | **100 Gbps = 12.5 GB/s** |
| AWS EC2 (m5.xlarge) | **~10 Gbps** (network) |
| AWS EC2 (c5n.18xlarge) | **~100 Gbps** (network) |
| S3 per-request bandwidth | **Unlimited aggregate** (partitioned by prefix) |

---

## 9. Cloud Pricing Rules of Thumb

> Use these for cost estimates in interviews. Round aggressively — order of magnitude is sufficient.

### AWS EC2 (on-demand, us-east-1, 2024)

| Instance | vCPU | RAM | $/hr | $/month |
|----------|------|-----|------|---------|
| t3.micro | 2 | 1 GB | **$0.01** | ~$7 |
| t3.medium | 2 | 4 GB | **$0.04** | ~$29 |
| t3.large | 2 | 8 GB | **$0.08** | ~$60 |
| m5.xlarge | 4 | 16 GB | **$0.19** | ~$140 |
| m5.4xlarge | 16 | 64 GB | **$0.77** | ~$560 |
| c5.2xlarge | 8 | 16 GB | **$0.34** | ~$245 |
| r5.2xlarge (memory) | 8 | 64 GB | **$0.50** | ~$365 |
| Reserved (1-yr, no upfront) | — | — | **~40% off** | — |
| Spot instances | — | — | **~70–90% off** | — |

### Storage

| Service | Price | Notes |
|---------|-------|-------|
| S3 Standard | **$0.023/GB/month** | ~$23/TB/month |
| S3 Infrequent Access | **$0.0125/GB/month** | +$0.01/GB retrieval |
| S3 Glacier Instant | **$0.004/GB/month** | Millisecond retrieval |
| S3 Glacier Deep Archive | **$0.00099/GB/month** | Hours to restore |
| EBS gp3 | **$0.08/GB/month** | 3,000 IOPS included |
| EBS io2 | **$0.125/GB/month + $0.065/IOPS** | Provisioned IOPS |
| RDS PostgreSQL (db.m5.large) | **~$0.16/hr** | ~$115/month |
| ElastiCache Redis (cache.m5.large) | **~$0.13/hr** | ~$95/month |

### Data Transfer

| Direction | Cost | Notes |
|-----------|------|-------|
| Ingress (into AWS) | **Free** | |
| Egress to internet (first 10 TB/mo) | **$0.09/GB** | ~$90/TB |
| Egress to internet (next 40 TB/mo) | **$0.085/GB** | |
| Between AZs (same region) | **$0.01/GB** | Each direction |
| Between regions | **$0.02/GB** | |
| CloudFront egress | **$0.0085/GB** | After first 1 TB free |

> **Trap**: Data transfer costs often dominate at scale. A system moving 1 PB/month off S3 pays ~$90,000/month in egress alone.

### Serverless & Managed Services

| Service | Unit | Price | Free Tier |
|---------|------|-------|-----------|
| Lambda | Per million invocations | **$0.20** | 1M/month |
| Lambda | Per GB-second | **$0.0000166635** | 400,000 GB-sec/month |
| DynamoDB | Per million RCU | **$0.25** | 25 RCU/WCU free |
| DynamoDB | Per million WCU | **$1.25** | |
| SQS | Per million requests | **$0.40** | 1M/month |
| SNS | Per million notifications | **$0.50** | 1M/month |
| API Gateway (REST) | Per million API calls | **$3.50** | 1M/month (12 months) |
| CloudWatch Logs | Per GB ingested | **$0.50** | 5 GB/month |

### Cost Estimation Formula

```
Monthly cost ≈ (compute) + (storage) + (data transfer) + (managed services)

Compute: EC2_hourly_rate × 730 hours × instance_count
Storage: GB_stored × storage_rate
Transfer: GB_egressed × $0.09
Services: API_calls/M × per-million-rate
```

---

## 10. Key Numbers Summary (One-Page Cheat Sheet)

| Category | Number | What It Means |
|----------|--------|---------------|
| L1 cache | **0.5 ns** | Fastest memory |
| RAM access | **100 ns** | 200× L1 |
| SSD random read | **100 µs** | 1,000× RAM |
| HDD seek | **10 ms** | 100× SSD |
| Same DC RTT | **1 ms** | |
| Cross-ocean RTT | **150 ms** | |
| Redis single-node | **500K ops/s** | |
| PostgreSQL single-node | **10–20K QPS** | Simple queries |
| Kafka partition | **10 MB/s** | |
| S3 GET | **5,500/s per prefix** | |
| Tweet size | **500 bytes** | With metadata |
| Photo (full) | **300 KB** | JPEG 1080p |
| Video (1080p) | **30 MB/min** | H.264 |
| 99.9% uptime | **8.76 hr/yr downtime** | |
| 99.99% uptime | **52 min/yr downtime** | |
| Seconds per day | **86,400** | |
| S3 storage | **$23/TB/month** | |
| EC2 egress | **$90/TB** | |
| DynamoDB per partition | **1,000 RCU / 1,000 WCU** | Hard limit |
| TCP + TLS 1.3 | **2 RTT to first byte** | |

---

## References

- 📺 [Latency Numbers Every Programmer Should Know](https://gist.github.com/jboner/2841832) — Jeff Dean / Peter Norvig reference card
- 📖 [AWS Pricing Calculator](https://calculator.aws/pricing/2/home) — Official AWS cost estimator
- 📖 [Numbers Every Programmer Should Know About Networking](https://wiesmann.codiferes.net/wordpress/archives/15208) — Extended latency reference
- 📖 [Designing Data-Intensive Applications](https://dataintensive.net/) — Martin Kleppmann; Chapters 1 and 5 for throughput/latency numbers
- 📺 [Building Software Systems at Google and Lessons Learned](https://www.youtube.com/watch?v=modXC5IWTJI) — Jeff Dean, Stanford 2007
- 📖 [The Datacenter as a Computer](https://research.google/pubs/pub41606/) — Google; warehouse-scale computing numbers
- 📖 [Amazon S3 Request Rate Performance Guidelines](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html) — Official S3 throughput limits
- 📖 [PostgreSQL Configuration Tuning](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server) — Official wiki; connection and memory limits
- 📖 [Redis Benchmarks](https://redis.io/docs/management/optimization/benchmarks/) — Official Redis throughput numbers
- 📖 [Kafka Performance Benchmarks](https://engineering.linkedin.com/kafka/benchmarking-apache-kafka-2-million-writes-second-three-cheap-machines) — LinkedIn Engineering; 2M writes/sec on 3 nodes
