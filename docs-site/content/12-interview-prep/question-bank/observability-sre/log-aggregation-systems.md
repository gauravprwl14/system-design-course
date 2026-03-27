---
title: "Log Aggregation Systems"
layer: interview-q
section: interview-prep/question-bank/observability-sre
difficulty: advanced
tags: [observability, logging, elk-stack, elasticsearch, kafka, clickhouse]
---

# Log Aggregation Systems

5 questions covering log aggregation from ELK fundamentals to Cloudflare processing 10M events/sec with ClickHouse.

---

## Q1: How does the ELK stack work — what does each component do?

**Role:** Junior, Mid | **Difficulty:** 🟢 | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can explain the three ELK components and their responsibilities in a log pipeline.

### Answer in 60 seconds
- **E — Elasticsearch:** Distributed search and analytics engine. Stores log documents as JSON, builds inverted indexes on every field, enables full-text search and aggregations over log data. Cluster of nodes with shards and replicas for scale and HA.
- **L — Logstash:** Data processing pipeline. Ingests logs from multiple sources (files, sockets, Kafka, Beats), applies filters (parse, transform, enrich), outputs to Elasticsearch or other destinations. CPU-intensive for parsing; can be a bottleneck at high volume.
- **K — Kibana:** Visualization UI. Connects to Elasticsearch, provides: log search with Lucene query syntax, dashboards (metric panels, timelines), Discover for ad-hoc log exploration, Alerting for threshold-based alerts. Not a data store — purely a query and visualization layer.
- **Beats:** Lightweight data shippers (Filebeat for log files, Metricbeat for system metrics, Packetbeat for network). Run as agents on each server, forward to Logstash or directly to Elasticsearch. 10MB RAM footprint vs Logstash's 500MB+.
- **Flow:** Application writes logs → Filebeat ships to Logstash → Logstash parses → Elasticsearch indexes → Kibana queries.

### Diagram

```mermaid
graph LR
  subgraph Producers["Log Producers"]
    App1["App Server 1\nfilebeat agent"]
    App2["App Server 2\nfilebeat agent"]
    App3["App Server 3\nfilebeat agent"]
  end

  subgraph Processing["Log Processing"]
    LS["Logstash\nParse grok patterns\nEnrich with GeoIP\nFilter sensitive fields\n~500MB RAM, 2 CPU cores"]
  end

  subgraph Storage["Storage and Query"]
    ES["Elasticsearch Cluster\n3 nodes, RF=2\nInverted index on all fields\n~10GB per 1M log lines"]
    K["Kibana\nSearch UI\nDashboards\nAlerting"]
  end

  App1 -->|Filebeat — 10MB RAM| LS
  App2 -->|Filebeat| LS
  App3 -->|Filebeat| LS
  LS -->|Parsed JSON| ES
  K -->|Lucene queries| ES
```

### Pitfalls
- ❌ **Using Logstash for every pipeline:** At high volume (>10K events/sec), Logstash becomes a bottleneck due to JVM overhead. Use Kafka between Beats and Logstash to buffer bursts. Or skip Logstash and use Elasticsearch's Ingest Pipelines for simple parsing.
- ❌ **Single Elasticsearch node:** ES is a distributed system — single node provides no HA and limits indexing throughput. Minimum 3 nodes for production (allows quorum for master election).
- ❌ **Indexing everything at field level:** ES indexes every field by default. For logs with 200 unique fields, this creates a massive index. Use `dynamic: false` and explicitly map only queried fields to reduce index size by 3-5x.

### Concept Reference

---

## Q2: Structured logging vs unstructured — JSON fields, queryability, and parsing overhead?

**Role:** Mid | **Difficulty:** 🟡 | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand why structured logging is a prerequisite for effective log aggregation and can quantify the trade-offs.

### Answer in 60 seconds
- **Unstructured log:** A free-form string. Example: `[2026-01-01 14:32:00] ERROR payment-svc: failed to process order 123, user 456, amount 99.99, reason: timeout`. Information exists but requires regex to extract.
- **Structured log:** A JSON document where each field is a key-value pair. Example: `{"timestamp":"2026-01-01T14:32:00Z","level":"error","service":"payment-svc","order_id":123,"user_id":456,"amount":99.99,"error":"timeout"}`.
- **Queryability difference:** Unstructured: `grep "ERROR" payments.log | grep "user 456"` — works on single files. Elasticsearch query on unstructured: full-text search, imprecise. Structured in Elasticsearch: `{"query":{"bool":{"filter":[{"term":{"user_id":456}},{"term":{"level":"error"}}]}}}` — exact field match, milliseconds on billions of logs.
- **Parsing overhead:** Unstructured logs require grok patterns in Logstash (regex parsing) — CPU-intensive, 50K–200K events/sec per CPU core. Structured JSON is parsed natively by ES Ingest Pipelines — 10x faster, no regex required.
- **Cardinality pitfall:** Structured fields with high cardinality (e.g., `user_id`, `order_id`) create large Elasticsearch keyword indexes. Use numeric fields for IDs; enable `doc_values` only for aggregation fields.

### Diagram

```mermaid
graph TD
  subgraph Unstructured["Unstructured Log"]
    U1["Raw string:\n2026-01-01 14:32:00 ERROR payment-svc failed order 123 user 456 timeout"]
    U2["To query: regex grok pattern\ntime=%{TIMESTAMP_ISO8601:timestamp}\nlevel=%{LOGLEVEL:level}...\nFails if format changes"]
    U3["Elasticsearch query: full-text match\nNot indexed by field — slow for billions of logs"]
    U1 --> U2 --> U3
  end

  subgraph Structured["Structured JSON Log"]
    S1["JSON document:\ntimestamp, level, service,\norder_id, user_id, amount, error"]
    S2["No parsing needed — already key:value\nES indexes each field automatically\nNew fields auto-discovered"]
    S3["Elasticsearch query: term query on order_id=123\nO(1) lookup via inverted index\nMilliseconds on billions of logs"]
    S1 --> S2 --> S3
  end
```

| Dimension | Unstructured | Structured JSON |
|-----------|-------------|-----------------|
| Query by field | Regex grep — slow | Indexed field lookup — fast |
| Parsing overhead | High (grok regex, CPU-intensive) | Low (native JSON decode) |
| Schema changes | Break regex patterns | New fields auto-indexed |
| Storage size | Smaller (plain text) | Larger (JSON overhead ~30%) |
| Cross-service correlation | Hard (different formats) | Easy (consistent field names) |
| Alerting on field values | Regex match | Exact term match |

### Pitfalls
- ❌ **Mixing structured and unstructured in the same pipeline:** If 80% of services emit JSON but 20% emit plain text, your Kibana dashboards cannot aggregate across them. Enforce structured logging via linting in CI.
- ❌ **Logging sensitive data as structured fields:** A structured field `{"credit_card":"4111..."}` gets indexed in Elasticsearch where it is queryable by anyone with Kibana access. Mask or omit sensitive fields at the application layer before logging.
- ❌ **Free-form string for numeric fields:** `{"duration":"450ms"}` stores a string. `{"duration_ms":450}` stores a number. Only numeric types support range queries (`duration_ms > 200`) — critical for latency alerting.

### Concept Reference

---

## Q3: Log sampling — reduce volume 10x without losing P0 errors?

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you can design a log sampling strategy that reduces cost while preserving observability for critical events.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Current volume | 1M log events/sec |
| Elasticsearch cost | $50K/month for cluster to handle 1M/sec |
| Error rate | 0.1% (1K errors/sec) |
| Goal | Reduce volume to 100K/sec (10x reduction) with zero error loss |
| Constraint | P0 errors (500 status, exceptions) must all be preserved |

### Approach A — Head Sampling (naive)

```mermaid
graph TD
  AllLogs["All logs: 1M/sec"]
  HeadSample{"Random 10% keep"}
  AllLogs --> HeadSample
  HeadSample -->|10% kept| ES["Elasticsearch\n100K/sec"]
  HeadSample -->|90% dropped| Drop["Dropped\n(includes ~900 errors/sec)"]

  style Drop fill:#f88,stroke:#900
```

Problem: 90% of error logs dropped. Of 1K errors/sec, 900 are lost. P0 incident goes undetected.

### Approach B — Priority-Based Sampling

```mermaid
graph TD
  AllLogs["All logs: 1M/sec"]

  Router{"Classify log level and type"}

  AllLogs --> Router

  Router -->|"level=ERROR (1K/sec)"| KeepAll["Keep 100%\n1K/sec — never drop errors"]
  Router -->|"level=WARN (50K/sec)"| KeepWarn["Keep 20%\n10K/sec — enough for trend analysis"]
  Router -->|"level=INFO — health checks (800K/sec)"| KeepInfo["Keep 1%\n8K/sec — baseline coverage"]
  Router -->|"level=DEBUG (149K/sec)"| DropDebug["Drop 100%\n0/sec — debug not needed in prod"]

  KeepAll --> ES["Elasticsearch\n~19K/sec — 95% cost reduction"]
  KeepWarn --> ES
  KeepInfo --> ES

  style DropDebug fill:#f88
  style KeepAll fill:#8f8
```

### Approach C — Tail Sampling with Error Buffer

```mermaid
sequenceDiagram
  participant App as Application
  participant Buffer as Log Buffer (30s window)
  participant Sampler as Sampling Policy Engine
  participant ES as Elasticsearch

  App->>Buffer: All log lines emitted (1M/sec)
  Note over Buffer: Buffer holds 30 seconds of logs\nGrouped by request/trace_id

  Buffer->>Sampler: Trace completed — evaluate
  Sampler->>Sampler: Was any span an error? YES
  Sampler->>ES: Keep ALL logs for this trace (100%)

  Buffer->>Sampler: Another trace completed
  Sampler->>Sampler: All spans success, latency < 200ms
  Sampler->>ES: Keep 1% random sample
  Sampler->>Sampler: Drop 99% — normal successful trace
```

| Strategy | Error Preservation | Volume Reduction | Complexity |
|----------|-------------------|------------------|------------|
| Head sampling 10% | 90% errors lost | 10x | Low |
| Level-based priority | 100% errors kept | ~95% reduction | Medium |
| Tail sampling | 100% errors kept | 90%+ reduction | High (stateful buffer) |

### What a great answer includes
- [ ] State the constraint: P0 errors (level=ERROR, HTTP 5xx) must always be kept at 100%
- [ ] Level-based sampling: ERROR 100%, WARN 20%, INFO 1%, DEBUG 0% in production
- [ ] Calculate resulting volume: 1K + 10K + 8K = 19K/sec (vs 1M/sec) — 98% reduction
- [ ] Tail sampling: buffer logs by trace-id, keep all logs for error traces, sample success traces
- [ ] Mention cost: Elasticsearch ingestion and storage both scale linearly with volume

### Pitfalls
- ❌ **Sampling at the agent (Filebeat):** Filebeat head-sampling drops logs before they reach the pipeline — you cannot recover dropped errors. Sample at the aggregator (Logstash/Kafka) where you have full visibility.
- ❌ **Dropping WARN logs entirely:** WARN-level logs often precede P0 errors by 5–60 minutes. Keeping 20% of WARNs provides enough signal to detect degradation before it becomes an incident.
- ❌ **No sampling counter metric:** When you sample, emit a metric: `logs_sampled_total{level, service, kept=true/false}`. Without this, you cannot tell from Kibana whether low log volume means "no events" or "events dropped by sampler."

### Concept Reference

---

## Q4: Kafka as log buffer — decouple producers from Elasticsearch at 1M events/sec

**Role:** Senior | **Difficulty:** 🔴 | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand why a message queue is essential between log producers and log storage at scale, and how Kafka absorbs burst writes.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Steady state | 100K log events/sec |
| Deployment spike | 10,000 services restart simultaneously = 10M events/sec for 2 minutes |
| Elasticsearch max ingest | 500K events/sec (5-node cluster) |
| Without buffer | ES overloaded during spike; logs dropped; back-pressure crashes apps |
| With Kafka buffer | Spike absorbed; ES drains at 500K/sec over 20 minutes; no loss |

### Without Kafka (direct Logstash to ES)

```mermaid
graph TD
  Services["10,000 services restart\n10M log events/sec for 2 minutes"]
  Logstash["Logstash\nMax: 500K events/sec"]
  ES["Elasticsearch\nMax: 500K events/sec"]

  Services -->|Overwhelms| Logstash
  Logstash -->|Overwhelms| ES

  Drop["9.5M events/sec dropped\nNo buffer — data loss\nBack-pressure crashes Logstash"]

  ES --> Drop
  style Drop fill:#f88,stroke:#900
```

### With Kafka Buffer

```mermaid
graph TD
  Services["10,000 services\nSteady: 100K/sec\nSpike: 10M/sec for 2 min"]

  Kafka["Kafka — 32 partitions\n7-day retention\nAccepts 50M/sec writes\n(commodity hardware: 1GB/sec per broker)"]

  Logstash["Logstash Consumers — 10 instances\nConsume from Kafka at controlled rate\n500K events/sec total output"]

  ES["Elasticsearch — 5 nodes\n500K events/sec ingest\nNo overload — Kafka smooths the burst"]

  Services -->|Always succeeds fast| Kafka
  Kafka -->|Controlled drain| Logstash
  Logstash -->|Indexed| ES

  Note["Spike: 10M/sec into Kafka for 2 min = 1.2B events buffered\nDrain: 500K/sec from Kafka = 2400 seconds = 40 minutes to drain\nZero data loss"]

  style Note fill:#8f8
```

### Kafka Configuration for Log Pipeline

```mermaid
graph LR
  Topic["Kafka Topic: application-logs\n32 partitions — parallelism\n7-day retention — replay on ES outage\nCompression: LZ4 — 4x storage reduction"]

  Producers["Log producers — Filebeat\nBatch size: 16KB per batch\nLinger: 5ms max wait\nacks=1 — leader ACK only (speed over durability)"]

  Consumers["Logstash consumers — 10 instances\n1 consumer per 3 partitions\nCommit offset after ES ACK\n— exactly-once delivery guarantee"]

  Topic --> Consumers
  Producers --> Topic
```

| Dimension | Direct Pipeline | Kafka-Buffered |
|-----------|----------------|----------------|
| Handles burst writes | No — data loss | Yes — buffer absorbs |
| ES outage behavior | Logs dropped during outage | Logs replay from Kafka on recovery |
| Backpressure to apps | Yes — apps stall | No — Kafka always accepts |
| Operational complexity | Low | Medium (Kafka cluster management) |
| Cost | Lower (no Kafka) | Higher ($500–2K/month for Kafka cluster) |
| Minimum production scale | < 10K events/sec | > 10K events/sec |

### What a great answer includes
- [ ] State the spike scenario: deployments cause 10–100x burst writes
- [ ] Kafka absorbs burst: writes always succeed; downstream drains at controlled rate
- [ ] Replay on ES failure: Kafka retains 7 days; resume from last committed offset
- [ ] Partition count determines parallelism: 32 partitions = 32 parallel consumers max
- [ ] Break-even: Kafka overhead justified above 10K events/sec; below that, direct pipeline is simpler

### Pitfalls
- ❌ **Using Kafka topic with 1 partition for logs:** Single partition = single consumer = sequential processing. At 1M events/sec, one Logstash instance cannot keep up. Use 32+ partitions for parallel consumption.
- ❌ **Setting acks=all for log producers:** acks=all requires all Kafka replicas to confirm — adds 10–50ms latency per log batch. For logs, acks=1 (leader only) is sufficient. Log loss risk is acceptable; write latency impact on applications is not.
- ❌ **Not monitoring Kafka consumer lag:** Consumer lag = (Kafka latest offset) - (consumer committed offset). If lag grows continuously, consumers are too slow. Alert at lag > 10M messages (20 minutes of production logs at 500K/sec).

### Concept Reference

---

## Q5: Cloudflare processes 10M log events/sec with ClickHouse — why columnar wins for log analytics

**Role:** Staff | **Difficulty:** ⚫ | **Priority:** P2 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand columnar storage's advantages for log analytics and why Cloudflare chose ClickHouse over Elasticsearch at extreme scale.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Scale | 10M HTTP log events/sec (Cloudflare handles ~30% of web traffic) |
| Daily volume | 10M × 86400s × ~500 bytes = ~432TB/day raw |
| Queries | "Error rate by PoP in last 5 minutes" — aggregation over 50M rows |
| Elasticsearch limit | ~500K events/sec per cluster before degradation |
| ClickHouse ingest | 10M+ events/sec on 10-node cluster |

### Why Elasticsearch Fails at This Scale

```mermaid
graph TD
  ES_Write["Elasticsearch write path:\n1. Parse JSON document\n2. Update inverted index for ALL fields\n3. Build doc_values for aggregatable fields\n4. Flush to Lucene segment\nCost: 4 write amplifications per document"]

  ES_Query["Elasticsearch query for error rate:\nSELECT COUNT(*) WHERE status=500\n1. Scan inverted index for 'status' field\n2. Load all matching doc IDs\n3. Count docs\nRow-oriented: must process each document individually\nAt 10M events/sec: 864B documents per day"]

  ES_Limit["Result at 10M events/sec:\n~500K events/sec max sustainable ingest\n20x over capacity — cluster crashes"]

  ES_Write --> ES_Limit
  ES_Query --> ES_Limit
```

### ClickHouse Columnar Architecture

```mermaid
graph TD
  CH_Storage["ClickHouse columnar storage:\nEach column stored separately\nTimestamp column: all timestamps compressed together\nStatus column: all status codes compressed together\nURL column: all URLs compressed together\n\nCompression ratio on status column (low cardinality):\n10M rows of status codes — 200/301/404/500\nRLE compression: 90% size reduction"]

  CH_Query["Query: SELECT count() WHERE status=500 in last 5min\n1. Read ONLY the status column and timestamp column\n2. Skip all other columns (url, user_agent, etc.) entirely\n3. SIMD vectorized comparison: 256 values per CPU instruction\nResult: 50M rows processed in < 1 second"]

  CH_Write["ClickHouse write path:\nBatch insert: 100K rows per batch\nAppend to column files (no index update)\nBackground merge sorts data by primary key\nNo per-document index overhead"]

  CH_Storage --> CH_Query
  CH_Write --> CH_Storage
```

### Architecture at Cloudflare Scale

```mermaid
graph LR
  CDN["Cloudflare PoPs\n200+ locations\n10M HTTP requests/sec global"]

  Kafka["Kafka — 200 partitions\nper-PoP topic partitioning\n10M events/sec ingest"]

  CH["ClickHouse Cluster\n10 shards x 2 replicas = 20 nodes\nEach shard: 1M events/sec ingest\nPrimary key: (timestamp, pop_id)\nTTL: 90 days — auto-delete old data"]

  Dashboard["Analytics Dashboard\nSELECT pop_id, countIf(status=500)/count()\nFROM http_logs\nWHERE timestamp > now() - 300\nGROUP BY pop_id\nQuery time: under 1 second over 3B rows"]

  CDN --> Kafka
  Kafka --> CH
  CH --> Dashboard
```

| Dimension | Elasticsearch | ClickHouse |
|-----------|---------------|------------|
| Ingest throughput | 500K events/sec (cluster) | 10M+ events/sec (cluster) |
| Query pattern | Full-text search, exact match | Aggregations, column scans |
| Storage per 1M rows | ~5GB (inverted index overhead) | ~200MB (columnar + compression) |
| p99 aggregation query | 5–30s for 1B rows | 0.5–3s for 1B rows |
| Strengths | Log search, regex queries | Aggregations, timeseries analytics |
| Best for | Debugging (find log for order X) | Analytics (error rate by region) |

### What a great answer includes
- [ ] State the bottleneck: ES inverted index write amplification — 4x overhead per document
- [ ] Columnar advantage: query only reads columns referenced by the query, skips all others
- [ ] Compression advantage: status column (200/301/404/500) compresses 90% with RLE
- [ ] SIMD vectorization: ClickHouse processes 256 values per CPU instruction for column scans
- [ ] Cloudflare architecture: Kafka 200 partitions → ClickHouse 10-shard cluster, 90-day TTL

### Pitfalls
- ❌ **Using ClickHouse for log search (find a specific log line):** ClickHouse has no full-text search index — searching for a specific error message requires full column scan. ES is better for search; ClickHouse is better for aggregation. Use both: ES for debug search, ClickHouse for dashboards.
- ❌ **Small batch inserts to ClickHouse:** ClickHouse is optimized for large batch inserts (100K+ rows). Inserting 1 row at a time creates thousands of small parts — compaction overhead crushes performance. Always buffer and batch via Kafka.
- ❌ **Ignoring primary key design:** ClickHouse primary key determines data sort order, not uniqueness. For time-series logs: `ORDER BY (timestamp, service_name)` enables partition pruning on time-range queries. Wrong primary key = full table scan for every query.

### Concept Reference
