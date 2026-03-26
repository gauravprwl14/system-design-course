---
title: "Design a Metrics & Monitoring System"
layer: interview-q
section: interview-prep/question-bank/system-design
difficulty: advanced
tags: [system-design, observability, prometheus, tsdb, alerting]
---

# Design a Metrics & Monitoring System

---

## Q1: Design a metrics and monitoring system for 1,000 microservices

**Role:** Senior, SRE, DevOps | **Difficulty:** 🔴 Senior | **Priority:** P0 | **Format:** Scenario
**Real Company:** Datadog, Prometheus, AWS CloudWatch, Google Monarch

### The Brief
> "Design a metrics collection and monitoring system for 1,000 microservices emitting 1M data points per minute. The system must support real-time dashboards with <1 min metric freshness, alerting with <30 sec detection latency, 13 months data retention with 1-second granularity for recent data and 1-minute for older data."

### Clarifying Questions to Ask First
1. Pull model (Prometheus scrapes) or push model (services push metrics)?
2. What metric types are needed? (counters, gauges, histograms)
3. What is the cardinality limit? (labels/tags per metric)
4. Multi-region or single region? (affects federation strategy)

### Back-of-Envelope Estimation
| Metric | Calculation | Result |
|--------|-------------|--------|
| Services | 1,000 services | — |
| Metrics per service | 1,000 time series | 1M total time series |
| Scrape interval | 15 seconds | 4 scrapes/min |
| Data points/min | 1M × 4 | 4M data points/min |
| Storage per point | 16 bytes (timestamp + value) | — |
| Raw storage/day | 4M × 1440min × 16B | ~92 GB/day |
| 13-month retention | 92GB × 400 days (after downsampling) | ~5 TB total |

### High-Level Architecture

```mermaid
graph TD
  S1[Service 1\n/metrics endpoint] --> P1[Prometheus\nRegion A]
  S2[Service 2] --> P1
  SN[Service N] --> P2[Prometheus\nRegion B]
  P1 --> RM[Remote Write\nThanos Receive]
  P2 --> RM
  RM --> ObjStore[(Object Storage\nS3/GCS — long-term)]
  P1 --> QF[Thanos Query Frontend\nfederated queries]
  P2 --> QF
  ObjStore --> QF
  QF --> Grafana[Grafana\nDashboards]
  QF --> AM[Alertmanager\n<30sec detection]
  AM --> PD[PagerDuty\nSlack]
```

### Deep Dive: TSDB Storage Model

```mermaid
graph LR
  DP[Data Point\ntimestamp+value] --> Head[In-memory Head Block\n2hr window, WAL]
  Head -->|every 2hr| Chunk[Compressed Chunk\n120 samples = 2hr]
  Chunk --> Block[Block on disk\n2hr → 6hr → 24hr compaction]
  Block -->|>13 days| Downsample[Downsample\n5min resolution]
  Block -->|>50 days| Downsample2[Downsample\n1hr resolution]
  Block --> ObjStore[(S3\nlong-term retention)]
```

### Cardinality Problem

```mermaid
graph TD
  Label[High-cardinality label\nuser_id in metric] --> Explosion[Cardinality Explosion\n1M users = 1M time series]
  Explosion --> OOM[TSDB OOM\n500GB RAM for index]
  Solution1[Solution: Drop user_id label\naggreggate to service level] --> Safe[Safe cardinality\n<10K series per metric]
  Solution2[Solution: Record rules\npre-aggregate before storage] --> Safe
```

### Trade-off Decisions
| Decision | Option A | Option B | Chosen | Why |
|----------|----------|----------|--------|-----|
| Collection model | Push (StatsD) | Pull (Prometheus) | Pull | Self-healing; Prometheus discovers dead services |
| Long-term storage | Prometheus local | Thanos + S3 | Thanos + S3 | Unlimited retention; multi-region federation |
| Downsampling | Manual | Automatic (Thanos) | Automatic | Reduce 1-second data to 5-min after 2 weeks |
| Alert evaluation | Per-Prometheus | Centralized | Per-Prometheus | Reduces single point of failure; each Prometheus evaluates its own rules |

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Prometheus OOM | All metrics from that cluster lost | Shard by team/namespace; limit series per Prometheus to 2M |
| Cardinality explosion | Ingestion stops, OOM | Hard limit labels; reject metrics >10K unique label combinations |
| Alert flap | Alert fires/resolves every 30sec | Add `for: 5m` to alert rules — must be failing for 5min before firing |
| TSDB compaction delay | Query slowdown | Monitor compaction lag; dedicate separate goroutines |

### What a great answer includes
- [ ] Push vs pull trade-off (pull = self-healing discovery, push = works through firewalls)
- [ ] TSDB storage model: WAL + chunks + blocks + compaction
- [ ] Cardinality problem and why high-cardinality labels (user_id, request_id) kill Prometheus
- [ ] Thanos or Cortex for long-term storage (not just local Prometheus disk)
- [ ] Downsampling strategy for cost-efficient retention

### Real Company Notes
| Company | Scale | Approach |
|---------|-------|----------|
| Google | 1B+ time series | Monarch — purpose-built TSDB with zone-level sharding |
| Datadog | 10T data points/day | Custom TSDB with zstd compression, 5-byte avg per point |
| Netflix | 3B metrics/day | Atlas TSDB — heap-memory optimized, 6-hour retention hot tier |
