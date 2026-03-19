# Back-of-Envelope Estimation

System design interviews expect you to estimate scale. Memorize these numbers — they are the building blocks of every estimation.

---

## Core Numbers

### Time

| Operation | Latency |
|-----------|---------|
| L1 cache reference | 1 ns |
| L2 cache reference | 4 ns |
| Main memory (RAM) access | 100 ns |
| SSD random read | 16 µs (0.016 ms) |
| HDD random seek | 10 ms |
| Network round trip (same datacenter) | 0.5 ms |
| Network round trip (cross-country) | 40 ms |
| Network round trip (cross-ocean) | 150 ms |

### Throughput

| Medium | Bandwidth |
|--------|-----------|
| SSD sequential read | 500 MB/s |
| HDD sequential read | 100 MB/s |
| Gigabit network | 125 MB/s |
| 1 Gbps NIC | ~800 Mbps effective |
| 10 Gbps NIC | ~8 Gbps effective |

### Storage

| Unit | Size |
|------|------|
| 1 KB | 1,000 bytes |
| 1 MB | 1,000,000 bytes |
| 1 GB | 10^9 bytes |
| 1 TB | 10^12 bytes |
| 1 PB | 10^15 bytes |

---

## Traffic Calculations

### Requests Per Second

- 1 million requests/day = **~12 req/sec**
- 10 million requests/day = **~116 req/sec**
- 100 million requests/day = **~1,160 req/sec**
- 1 billion requests/day = **~11,600 req/sec**

**Formula**: requests/day ÷ 86,400 seconds ≈ req/sec

### Read/Write Splits

Most systems are read-heavy. Common ratios:
- Social media: 100:1 read:write
- E-commerce: 10:1 read:write
- Analytics: 1:10 write:read (write-heavy)

---

## Storage Calculations

### Database Row Sizes

| Data Type | Size |
|-----------|------|
| Integer (int32) | 4 bytes |
| Integer (int64) | 8 bytes |
| UUID | 16 bytes |
| Timestamp | 8 bytes |
| Short string (50 chars) | ~50 bytes |
| Long string (500 chars) | ~500 bytes |
| Boolean | 1 byte |

**Typical row**: 100-500 bytes

### Example: 1 Billion Users

- User record: ~1 KB per user
- 1 billion users × 1 KB = **1 TB** just for users table

### Example: Twitter-Scale Tweets

- Tweet: ~300 bytes
- 100 million tweets/day × 300 bytes = **30 GB/day**
- 30 GB/day × 365 = **~10 TB/year**
- 5 years = **~50 TB**

---

## Cache Sizing

**Rule of thumb**: Cache 20% of daily requests (80/20 rule — 20% of data serves 80% of requests)

- If 1M requests/day, cache top 200K objects
- If average object is 1 KB, cache needs 200 MB

**Redis memory**: A Redis instance can hold ~10-50 GB depending on instance size.

---

## Database Capacity

| Database | Typical Write Throughput |
|----------|------------------------|
| PostgreSQL (single node) | 10K-50K writes/sec |
| MySQL (single node) | 10K-30K writes/sec |
| Cassandra (cluster) | 100K-1M writes/sec |
| DynamoDB | Scales to any throughput |

**Read replicas multiply read capacity by the number of replicas.**

---

## Common System Estimates

### URL Shortener

- 100 write RPS, 10,000 read RPS (100:1 read:write)
- URL record: ~500 bytes
- 100 writes/sec × 86,400 sec × 365 days = 3.1 billion URLs/year
- 3.1 billion × 500 bytes = **1.5 TB/year**

### Twitter/X

- 300 million users, 50 million active daily
- 100 million tweets/day = 1,150 tweets/sec
- Peak: ~3x average = ~3,500 tweets/sec
- Tweet size: ~300 bytes
- Storage: 30 GB/day

### Instagram

- 1 billion users, 100 million daily active
- 100 million photos uploaded/day
- Photo: average 5 MB
- 100M × 5 MB = **500 TB/day** (before compression and CDN)

---

## The Numbers You Must Know

| Fact | Value |
|------|-------|
| Seconds in a day | 86,400 |
| Seconds in a year | ~31.5 million |
| Bytes in a GB | ~10^9 |
| Bytes in a TB | ~10^12 |
| 1 million users × 1 action/day | 12 req/sec |
| Average webpage | ~1-2 MB |
| Average photo | 1-5 MB |
| Average 1-minute video (compressed) | 50-200 MB |

---

## Estimation Framework

When asked "how would you size this system?", use this framework:

1. **Clarify scale** — How many users? What's the read/write ratio?
2. **Estimate RPS** — Peak RPS = average × 2-3x
3. **Estimate storage** — Records/day × record size × retention period
4. **Estimate bandwidth** — RPS × response size
5. **Estimate cache** — Cache 20% of hot data
6. **Estimate servers** — (RPS) / (RPS per server) — a basic server handles 1,000-10,000 RPS depending on workload
