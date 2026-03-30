---
title: "Messaging & Streaming Cheat Sheet"
description: "Message queues, pub/sub, event streaming, and async patterns quick reference"
---

> **📅 Spaced Repetition Schedule**
> Use this cheat sheet on a 4-interval cycle for maximum retention:
> - **Day 0** — Read it fully (20–30 min)
> - **Day 3** — Skim headers, cover answers, test yourself
> - **Day 10** — Quiz yourself on the "Trap" entries without looking
> - **Day 30** — Quick scan for gaps; revisit any you missed

---

# Messaging & Streaming Cheat Sheet

> Key facts for event-driven architecture interviews. Patterns, numbers, and decision rules only.

---

## 1. Messaging Patterns — Decision Table

| Pattern | AWS Tool | When to Use |
|---------|----------|-------------|
| **Work Queue** | SQS Standard | One consumer pool, at-least-once, order doesn't matter |
| **FIFO Queue** | SQS FIFO | Order required, exactly-once processing, **300 TPS** |
| **Pub/Sub Push** | SNS | Push to multiple endpoints (Lambda, email, SMS, HTTP) |
| **Fan-out** | SNS → SQS | Multiple consumers, different processing rates, decouple |
| **Event Bus** | EventBridge | Cross-account, complex routing, 90+ AWS service sources |
| **Stream** | Kinesis Data Streams | Ordered, replay, real-time analytics, multiple consumers |
| **High-throughput Topic** | Kafka / MSK | Millions/sec, long retention, replay, consumer groups |
| **Job Scheduling** | EventBridge Scheduler | Cron or one-time future invocations |

```mermaid
graph LR
    P[Producer] --> WQ[Work Queue\nSQS Standard]
    P --> FIFO[FIFO Queue\nSQS FIFO]
    P --> PS[Pub/Sub\nSNS]
    P --> EB[Event Bus\nEventBridge]
    P --> ST[Stream\nKinesis/Kafka]

    WQ --> C1[Consumer Pool]
    FIFO --> C2[Ordered Consumer]
    PS --> C3[Lambda]
    PS --> C4[SQS Fan-out]
    EB --> C5[Cross-account\nTargets]
    ST --> C6[Consumer Groups]
```

---

## 2. SQS Quick Reference

### Standard vs FIFO

| | SQS Standard | SQS FIFO |
|-|-------------|----------|
| **Throughput** | **Unlimited** TPS | **300 TPS** (3,000 with batching) |
| **Ordering** | Best-effort | **Strict FIFO** within message group |
| **Delivery** | **At-least-once** (duplicates possible) | **Exactly-once** |
| **Deduplication** | Not supported | 5-minute deduplication window |
| **Cost** | Lower | Higher |
| **Use** | Email sends, log processing | Financial transactions, inventory updates |

### Key SQS Concepts

| Concept | Detail |
|---------|--------|
| **Visibility timeout** | Message hidden during processing — default **30s**, max **12 hours**. Set > max processing time |
| **Dead-letter queue (DLQ)** | After `maxReceiveCount` failures → route to DLQ for debugging. **Always configure a DLQ** |
| **Long polling** | `WaitTimeSeconds=20` — waits up to 20s for a message. Reduces empty receives = **cheaper** |
| **Short polling** | Returns immediately even if empty — wasteful, avoid |
| **Delay queue** | `DelaySeconds` (0–900s) — message invisible after send. Use for scheduled retries |
| **Message retention** | 1 min to **14 days** (default **4 days**) |
| **Max message size** | **256 KB** (use S3 + pointer for larger) |
| **Batch** | Up to **10 messages** per receive/delete call |

**Trap:** If visibility timeout expires before processing finishes, message becomes visible again → duplicate processing. Solution: extend timeout during processing or set it generously.

```mermaid
sequenceDiagram
    participant P as Producer
    participant SQS as SQS Queue
    participant C as Consumer
    participant DLQ as Dead-Letter Queue

    P->>SQS: SendMessage
    C->>SQS: ReceiveMessage (long poll 20s)
    SQS-->>C: Message (hidden for visibility timeout)
    C->>C: Process message
    alt Success
        C->>SQS: DeleteMessage
    else Failure (maxReceiveCount exceeded)
        SQS->>DLQ: Route to DLQ
    end
```

---

## 3. SNS Quick Reference

| Concept | Detail |
|---------|--------|
| **Push model** | SNS pushes to subscribers — no polling needed |
| **Subscribers** | Lambda, SQS, HTTP/S, Email, SMS, mobile push |
| **Message filtering** | Filter policies on attributes → subscribers only get relevant messages |
| **Fan-out pattern** | SNS topic → multiple SQS queues = decoupled parallel processing |
| **FIFO topic** | Ordered, deduplication — **SQS FIFO subscribers only** |
| **Max message size** | **256 KB** |
| **Message delivery retries** | HTTP: 3 attempts with exponential backoff |

**Fan-out use case:** Order placed → SNS → SQS(inventory), SQS(shipping), SQS(email) — each processes independently.

```mermaid
graph TD
    O[Order Placed] --> SNS[SNS Topic]
    SNS -->|filter: type=order| SQS1[SQS: Inventory]
    SNS -->|filter: type=order| SQS2[SQS: Shipping]
    SNS -->|filter: type=order| SQS3[SQS: Email]
    SNS --> L[Lambda]
    SNS --> HTTP[HTTP Endpoint]
    SQS1 --> W1[Inventory Worker]
    SQS2 --> W2[Shipping Worker]
    SQS3 --> W3[Email Worker]
```

---

## 4. EventBridge vs SNS

| | EventBridge | SNS |
|-|-------------|-----|
| **Routing** | **Content-based rules** (event fields, patterns) | Attribute filter policies |
| **Cross-account** | **Yes** (event bus to bus) | No |
| **AWS sources** | **90+ native** integrations | Custom events only |
| **Schema registry** | **Yes** — auto-infer + validate | No |
| **Archive + replay** | **Yes** — replay past events | No |
| **Cost** | Higher ($1/million events) | Lower ($0.50/million) |
| **Targets** | 20+ AWS services | Fewer targets |
| **Latency** | ~500ms typical | Lower |

**Use EventBridge when:** cross-account routing, complex filtering logic, AWS service events (CodePipeline, GuardDuty, etc.), schema validation, event replay needed.
**Use SNS when:** simple fan-out, cost-sensitive, low latency push required.

```mermaid
flowchart LR
    Q{Need cross-account\nor schema validation?}
    Q -->|Yes| EB[EventBridge]
    Q -->|No| Q2{Complex content\nbased routing?}
    Q2 -->|Yes| EB
    Q2 -->|No| Q3{Cost sensitive\nor low latency?}
    Q3 -->|Yes| SNS[SNS]
    Q3 -->|No| SNS
```

---

## 5. Kafka Quick Reference

### Core Concepts

| Concept | What It Is |
|---------|-----------|
| **Topic** | Named log/channel — like an SNS topic but durable |
| **Partition** | Ordered, append-only log — unit of parallelism. **Partition count = max consumer parallelism** |
| **Offset** | Position within a partition — consumer tracks its own offset |
| **Consumer group** | Group sharing a topic — **each partition assigned to one consumer** in the group |
| **Broker** | Single Kafka server — multiple = cluster |
| **Replication factor** | Copies of each partition across brokers — **3 is standard** |
| **ISR** | In-sync replicas — replicas caught up with leader |

### Partition Key → Ordering

```
ProducerRecord(topic, key="user_123", value="event")
  → hash(key) % numPartitions → same partition
  → same consumer → ordered processing per user
```

**Ordering is only guaranteed within a partition.** No cross-partition ordering.

### Key Numbers

| Metric | Value |
|--------|-------|
| **Retention** | Default **7 days**, configurable up to forever |
| **Throughput per partition** | Limited by disk I/O — typically **~100 MB/s** |
| **Max message size** | Default **1 MB** (configurable) |
| **Replication lag** | Typically **<10ms** in healthy cluster |

### Kafka vs SQS

| | Kafka | SQS |
|-|-------|-----|
| **Ordering** | Per partition | FIFO only with SQS FIFO |
| **Replay** | **Yes** — retain and re-consume | No — once consumed, gone |
| **Consumer model** | Pull (consumer controls pace) | Pull (long polling) |
| **Multiple consumers** | **Yes** — different offsets | No — competing consumers |
| **Operations** | Self-managed or MSK | Fully managed |
| **Throughput** | Millions/sec | SQS Standard: unlimited, FIFO: 3K TPS |
| **Cost** | Higher (infra) | Pay per message |

```mermaid
graph TD
    T[Kafka Topic] --> P0[Partition 0]
    T --> P1[Partition 1]
    T --> P2[Partition 2]

    P0 -->|assigned to| C0[Consumer 0\nGroup A]
    P1 -->|assigned to| C1[Consumer 1\nGroup A]
    P2 -->|assigned to| C2[Consumer 2\nGroup A]

    P0 -->|independent offset| CA[Consumer\nGroup B]
    P1 --> CA
    P2 --> CA
```

---

## 6. Kinesis Quick Reference

### Kinesis Data Streams

| Concept | Detail |
|---------|--------|
| **Shard** | Unit of capacity — **1 MB/s write, 2 MB/s read** per shard |
| **Enhanced fan-out** | **2 MB/s per consumer** per shard (dedicated throughput, push-based) |
| **Partition key** | Determines shard — use high-cardinality keys to avoid hot shards |
| **Retention** | Default **24h**, up to **365 days** |
| **Max record size** | **1 MB** |
| **Max shards** | **500 per account** (can request increase) |
| **Ordering** | Within shard only |

**Hot shard trap:** If partition key has low cardinality (e.g., country code), all traffic goes to same shard → throttling. Use high-cardinality keys or random suffix.

### Kinesis Services Comparison

| Service | Use Case | Code Required |
|---------|----------|---------------|
| **Data Streams** | Custom processing, multiple consumers, replay | Yes |
| **Firehose** | Delivery to S3/Redshift/OpenSearch/Splunk | **Zero code** |
| **Data Analytics** | Real-time SQL (Apache Flink) on streams | SQL/Flink |

### Kinesis vs Kafka

| | Kinesis | Kafka (MSK) |
|-|---------|-------------|
| **Operations** | Fully managed | Managed but more config |
| **Shard limit** | **500/account** (soft) | No hard partition limit |
| **Retention** | Max **365 days** | Unlimited |
| **Replay** | Yes (within retention) | Yes |
| **Cost** | Per shard-hour | Per broker |

```mermaid
graph TD
    Prod[Producer] -->|partition key| S0[Shard 0\n1MB/s write]
    Prod --> S1[Shard 1\n1MB/s write]
    Prod --> S2[Shard 2\n1MB/s write]

    S0 -->|standard: 2MB/s shared| App1[App Consumer]
    S0 -->|enhanced fan-out: 2MB/s each| App2[Analytics Consumer]
    S1 --> FH[Firehose → S3]
    S2 --> DA[Data Analytics\nFlink SQL]
```

---

## 7. Async Patterns

### Outbox Pattern
```
BEGIN TRANSACTION
  INSERT INTO orders (...)
  INSERT INTO outbox (event_type, payload, status='pending')
COMMIT

-- Background worker:
  SELECT * FROM outbox WHERE status='pending'
  → publish to Kafka/SQS
  → UPDATE outbox SET status='published'
```
**Why:** Guarantees DB write and event publish are atomic — no lost events on crash.

### Saga Pattern

| Type | How | When |
|------|-----|------|
| **Choreography** | Services emit events, react to each other's events | Simple flows, loose coupling |
| **Orchestration** | Central coordinator calls each service | Complex flows, easier to monitor |

Both handle distributed transactions without 2PC. Each step has a compensating transaction for rollback.

### CQRS

```
Write path: Command → Command Handler → Write DB → Event
Read path:  Event → Projection Builder → Read DB (optimized)
Query:      Read DB (no joins needed — denormalized)
```
**Use when:** Read/write patterns differ significantly, need multiple read models, high read load.

### Event Sourcing
- Store **events** (not current state)
- Replay events to rebuild state
- Append-only log — full audit trail
- Tradeoff: complex queries, eventual consistency, large storage over time

```mermaid
graph TD
    subgraph Outbox Pattern
        W[Write TX] -->|atomic| DB[(orders table)]
        W -->|atomic| OB[(outbox table)]
        BG[Background Worker] -->|poll pending| OB
        BG -->|publish| MQ[Kafka / SQS]
    end

    subgraph Saga - Choreography
        S1[Order Service] -->|OrderPlaced| S2[Inventory Service]
        S2 -->|StockReserved| S3[Payment Service]
        S3 -->|PaymentFailed| S4[Compensate:\nRelease Stock]
    end
```

---

## 8. Idempotency

**Why:** At-least-once delivery = duplicates are normal. Your consumer MUST be idempotent.

### Implementation Options

| Approach | How | Where |
|----------|-----|-------|
| **Idempotency key** | UUID per operation in request header | API Gateway, payment processing |
| **Redis SETNX** | `SETNX key 1 EX 86400` — only first request wins | High-throughput dedup |
| **DB unique constraint** | `UNIQUE(idempotency_key)` — duplicate throws error | Transactional systems |
| **Conditional writes** | DynamoDB condition expressions | NoSQL dedup |

```
# Redis idempotency check
result = redis.SET(f"idem:{idempotency_key}", 1, NX=True, EX=86400)
if result is None:
    return cached_response  # duplicate
# process request...
```

**TTL on idempotency keys:** Set based on retry window (e.g., 24h for payments).

```mermaid
sequenceDiagram
    participant C as Consumer
    participant R as Redis
    participant DB as Database

    C->>R: SET idem:{key} 1 NX EX 86400
    alt Key did not exist (first time)
        R-->>C: OK
        C->>DB: Process & write result
    else Key already existed (duplicate)
        R-->>C: nil
        C-->>C: Return cached/skip response
    end
```

---

## 9. Message Ordering Guarantees Summary

| System | Ordering Guarantee |
|--------|--------------------|
| SQS Standard | Best-effort (no guarantee) |
| SQS FIFO | **Strict order within message group** |
| SNS | No ordering |
| EventBridge | No ordering |
| Kinesis | **Within shard** |
| Kafka | **Within partition** |
| DynamoDB Streams | Per partition key (shard) |

```mermaid
graph LR
    subgraph No Ordering
        SNS[SNS]
        EB[EventBridge]
    end
    subgraph Best-effort
        SQSS[SQS Standard]
    end
    subgraph Partial Ordering
        SQSF[SQS FIFO\nper message group]
        KIN[Kinesis\nper shard]
        KAF[Kafka\nper partition]
        DDB[DynamoDB Streams\nper partition key]
    end
```

---

## 10. Key Messaging Numbers

| Metric | Value |
|--------|-------|
| **SQS max message size** | **256 KB** |
| **SQS FIFO throughput** | **300 TPS** (3,000 with batching) |
| **SQS Standard throughput** | Unlimited |
| **SQS max retention** | **14 days** |
| **SQS visibility timeout max** | **12 hours** |
| **SQS batch size** | **10 messages** |
| **SNS max message size** | **256 KB** |
| **Kinesis shard write** | **1 MB/s** |
| **Kinesis shard read (standard)** | **2 MB/s shared** across consumers |
| **Kinesis shard read (enhanced)** | **2 MB/s per consumer** |
| **Kinesis max record** | **1 MB** |
| **Kinesis default retention** | **24 hours** |
| **Kafka default retention** | **7 days** |
| **EventBridge default rate** | **10,000 events/s** per account |

```mermaid
graph LR
    subgraph AWS
        SQS[SQS Standard\nunlimited TPS\n256KB max\n14d retention]
        SQSF[SQS FIFO\n300 TPS\nstrict order]
        SNS[SNS\n256KB max\nno retention]
        KIN[Kinesis Shard\n1MB/s write\n2MB/s read\n24h default]
    end
    subgraph OSS
        KAF[Kafka Partition\nhigh throughput\n7d default retention\nreplay]
    end
```

---

[Deep dive: SQS / SNS / EventBridge →](../12-interview-prep/quick-reference/aws-cloud/sqs-sns-eventbridge)
[Deep dive: Kinesis Streaming →](../12-interview-prep/quick-reference/aws-cloud/kinesis-streaming)
