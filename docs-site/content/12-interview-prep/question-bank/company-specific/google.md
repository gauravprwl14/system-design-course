---
title: "Google System Design Interview Guide"
layer: interview-q
section: "12-interview-prep/question-bank/company-specific"
difficulty: advanced
tags: [google, system-design, interview, sre, faang, distributed-systems, scale, reliability]
category: interview-prep
references:
  - title: "Google SRE Book"
    url: "https://sre.google/sre-book/table-of-contents/"
    type: article
  - title: "Spanner: Google's Globally-Distributed Database"
    url: "https://research.google/pubs/pub39966/"
    type: article
---

# Google System Design Interview Guide

## Google's Interview Loop

| Level | System Design Weight |
|-------|---------------------|
| L4 (SWE II) | 1 round, classic problem |
| L5 (Senior) | 1-2 rounds, primary signal |
| L6 (Staff) | System design IS the interview |
| SRE | +1 reliability/SLO round |

**Google's focus:** correctness at 1B+ users, reliability (SLOs), simplicity, explicit trade-off articulation.

---

## What Google Evaluates Differently

**1. Google-scale default** — Always design for the real scale. "Design YouTube" means 500 hours/min uploaded, 1B hours/day watched. Starting with 10M users signals you haven't prepared.

**2. SLO/reliability discussion** — After any design, expect: "What SLOs would you define?" Know SLI (the metric), SLO (the target), SLA (the contract). Burn rate alerts: fast burn = 2% monthly budget in 1h → immediate page; slow burn = 5% in 6h → ticket.

**3. Simplicity as a virtue** — Google penalizes over-engineering. If you propose Kafka + service mesh + 6 microservices for a system 3 engineers maintain, you will be scored down. Add complexity only with justification.

**4. Knowledge of Google's own systems** — At L5+, referencing Spanner, Bigtable, Borg, Colossus, Maglev shows genuine preparation. Candidates who reference only AWS services signal they haven't studied Google's engineering culture.

---

## Top 15 Google System Design Questions

### 1. Design Google Search
**Scale:** 8.5B queries/day, 130T web pages indexed

**Key insight:** Two-tier index — real-time index (hours old, fresh content, less filtered) and main index (established content, PageRank-scored). Search blends both. This solves freshness vs quality without rebuilding the full index on every new page.

**What Google tests:** Index sharding strategy, ranking pipeline separation from serving, freshness vs quality trade-off.

---

### 2. Design Google Maps
**Scale:** 1B monthly users, 1T+ road segments globally

**Key insight:** Standard Dijkstra on 1T nodes would take minutes. **Contraction hierarchies** precompute shortcut edges between important junctions, reducing routing to O(few thousand nodes) for typical city-to-city queries.

Real-time traffic: GPS data from Android devices (with location sharing) aggregated every 1-2 minutes, fed as edge weight updates — no full recomputation.

---

### 3. Design YouTube
**Scale:** 500 hours uploaded/minute, 1B+ hours watched/day

**Key insight:** Upload creates a **DAG of parallel jobs on Borg** — 6 quality tiers (144p→1080p) transcode concurrently, not sequentially. Parallel transcoding reduces end-to-end upload-to-playback time from hours to minutes.

80% of watch time comes from recommendations — the recommendation model is a separate ranking pipeline that runs on watch history, not a simple collaborative filter.

---

### 4. Design Google Drive
**Scale:** 1B users, petabytes stored

**Key insight:** **Content-addressable storage** — files split into 256KB blocks, identified by SHA-256. Duplicate blocks stored once. ~30% storage reduction across the corpus from shared blocks.

Google Docs uses **Operational Transform (OT)** for conflict resolution — server-authoritative, simpler than CRDT for the central-server model Google uses.

---

### 5. Design Google Photos
**Scale:** 4T photos backed up, 28B new photos/week

**Key insight:** Near-duplicate detection uses **perceptual hash (pHash)**, not SHA-256. pHash produces similar values for perceptually similar images (same photo cropped, resized, color-adjusted). SHA-256 changes completely for any pixel change. Burst-mode deduplication requires pHash.

```
Original photo:  pHash = 8f3b2a01...   (similar photos have Hamming distance < 5)
Same, cropped:   pHash = 8f3b2b01...   (distance = 1 — near-duplicate)
Different photo: pHash = 3c9f1e7a...   (distance = 30 — different)
```

---

### 6. Design Gmail
**Scale:** 1.8B users, 300B emails/year

**Key insight:** Gmail search uses **per-user inverted index** — each user's email corpus is indexed separately. Unlike web search (single global index), Gmail queries a single user's index shard. Threading uses thread_id, not just parent message ID, to handle forwarded chains.

Spam filtering: 2B+ spam emails blocked/day. Rules engine (explicit blocklist) + ML model (Bayesian + neural) cascade — cheap rules first, expensive ML only for borderline.

---

### 7. Design Googlebot
**Scale:** 1B+ pages/day, politeness per domain

**Key insight:** **robots.txt must be aggressively cached** (24h TTL per domain). Without caching, fetching robots.txt before every page doubles request load on every website.

Near-duplicate detection: **SimHash** — locality-sensitive hash where similar documents have similar hash values. Allows skipping re-index of printer-friendly, paginated, or translated duplicates.

---

### 8. Design Google's Logging Infrastructure
**Scale:** Zettabytes/year across 1M+ servers

**Key insight:** Logs stored **columnar by default** (Dremel/BigQuery). A typical log record has 50+ fields, but queries touch 2-3 fields. Columnar storage reads only the queried column — 50× less data than row-oriented. Flume pipeline provides MapReduce-style processing at petabyte scale.

---

### 9. Design Google Meet
**Scale:** 100M+ daily participants, up to 500 per meeting

**Key insight:** For meetings over 50 participants, **cascaded SFUs** — primary SFU in organizer's region, secondary SFUs in participant regions. Each secondary receives from primary and forwards locally. Avoids all participants crossing the globe to reach a single SFU.

Recording: dedicated recording server subscribes as a participant, receives all streams, mixes, writes to GCS. Separated from SFU to avoid impacting call quality.

---

### 10. Design Cloud Spanner
**Scale:** Globally distributed SQL for Google's own financial systems

**Key insight:** **TrueTime** uses GPS + atomic clocks to bound clock uncertainty to ±7ms. The **commit-wait protocol** delays making a write visible until `TrueTime.now() > commit_timestamp`. This achieves **external consistency** — global transactions appear to execute in a single globally consistent order, across datacenters, without network coordination at read time.

Most distributed databases achieve only serializability. Spanner's external consistency is architecturally stronger and enables cross-region reads that are trivially consistent.

---

### 11. Design Google's Maglev Load Balancer
**Key insight:** Consistent hash table with **65,537 slots** (prime number). On backend add/remove, the table rebuilds but only 1/N connections remap (N = backend count). This minimizes connection disruption on scaling events while maintaining even distribution.

---

### 12. Design Cloud Bigtable
**Key insight:** **Row key design is the single most impactful performance decision.** Monotonically increasing keys (timestamps, sequential IDs) concentrate all writes on the last tablet — hot spot. Fix: reverse timestamp, add hash prefix, or use non-sequential key. This is the #1 Bigtable interview mistake.

LSM tree: writes go to in-memory MemTable → periodically flushed to SSTable files → background compaction merges SSTables. Reads check MemTable first, then SSTables in recency order.

---

### 13. Design a Feature Flag System
**Key insight:** User-to-variant assignment must be **deterministic hash-based**: `hash(user_id + experiment_id) % 100`. Random assignment means the same user gets different variants on different servers — destroying experiment statistical validity. Hash ensures consistency across all servers with no shared state.

---

### 14. Design Google Ads Auction
**Scale:** 8.5B auctions/day, each under 100ms

**Key insight:** Generalized second-price (GSP) auction with quality score: `effective_bid = bid × quality_score`. Highest effective_bid wins but pays the minimum to maintain position (not their full bid). Quality score aligns advertiser and user interests — a highly relevant lower-bid ad beats an irrelevant high-bid ad.

---

### 15. Design Duplicate Event Detection at 1M Events/Sec
**Key insight:** Exact dedup requires 32GB/hour just for the ID hash table. **Bloom filter** provides O(1) membership check with tunable false positive rate — 1% FPR needs only 1.2 bytes/element. For time-windowed dedup, maintain 3 rotating 5-minute Bloom filters (current + last 2) — discard oldest when window slides.

---

## SRE Variant: Reliability Follow-Ups

| Follow-up | Strong Answer |
|-----------|--------------|
| "What SLOs would you define?" | Name SLIs, set SLO targets with business justification |
| "What alerts?" | Fast burn (2% in 1h → page), slow burn (5% in 6h → ticket) |
| "What breaks first at 10x?" | Name the bottleneck and mitigation |
| "Zero-downtime deployment?" | Canary + feature flags + readiness probe before traffic shift |

---

## Strong Hire vs No-Hire Signals

| Signal | ✅ Strong Hire | ❌ No Hire |
|--------|--------------|-----------|
| Scale | Designs for 1B users with justification | "10M to keep it simple" |
| Trade-offs | "Chose X over Y because [numbers]" | "It depends" without committing |
| Reliability | Proactively names SLOs and failure modes | Finishes design without reliability mention |
| Simplicity | Justifies every added component | Adds Kafka/K8s without justification |
| Google systems | References Spanner/Bigtable/Borg correctly | Only knows AWS equivalents |

---

## Common Mistakes

1. **Not designing for Google-scale** — designing for 10M when the product has 1B users
2. **Over-engineering** — service mesh + 6 microservices for a system 3 engineers maintain
3. **No reliability discussion** — finishing without SLOs, monitoring, or failure modes
4. **Generic tool choices** — "use Kafka" or "use DynamoDB" without knowing their specific trade-offs
5. **No Google systems knowledge** — only referencing AWS services when Google has its own stack

---

## 📚 Resources

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [Google SRE Book](https://sre.google/sre-book/) | 📚 Docs | SLO/SLA/SLI framework, reliability engineering |
| [Google Research Papers](https://research.google/) | 📖 Blog | Spanner, Bigtable, Maglev, MapReduce — primary sources |
| [Designing Data-Intensive Applications](https://dataintensive.net/) | 📚 Docs | Foundational systems knowledge behind Google's stack |
