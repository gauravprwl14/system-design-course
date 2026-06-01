---
title: "Amazon System Design Interview Guide"
layer: interview-q
section: "12-interview-prep/question-bank/company-specific"
difficulty: advanced
tags: [amazon, aws, system-design, interview, leadership-principles, faang]
category: interview-prep
---

# Amazon System Design Interview Guide

Amazon's system design interviews differ from other FAANG companies in one fundamental way: **every technical decision is expected to connect back to a Leadership Principle**. You are not just designing a system — you are demonstrating that you think like an Amazonian. This guide prepares you for the full loop.

---

## Amazon's Interview Loop Structure

### Round Composition (SDE-II and above)

A typical Amazon loop has **4 to 6 rounds**, each lasting 55–60 minutes. Every round opens with Leadership Principle (LP) behavioral questions — usually 2–3 STAR stories — before transitioning to technical content.

| Round | Focus | LP Emphasis |
|-------|-------|-------------|
| Phone Screen | Coding + 1-2 LP stories | Ownership, Deliver Results |
| Onsite Round 1 | Data Structures / Algorithms | Learn and Be Curious |
| Onsite Round 2 | **System Design** | Customer Obsession, Dive Deep |
| Onsite Round 3 | Coding + Design | Bias for Action |
| Onsite Round 4 | **Bar Raiser** | All 16 LPs under scrutiny |
| Onsite Round 5 | Hiring Manager round | Earn Trust, Think Big |

### Bar Raiser Round

The Bar Raiser is a cross-functional interviewer — often from a completely different team — whose sole purpose is to ensure the hire raises the average bar of Amazon's workforce. The Bar Raiser has veto power over the hiring committee.

**What this means for you:**
- Expect follow-up questions that probe the limits of your answers
- Surface assumptions proactively before the Bar Raiser exposes them
- Generic answers fail here — you need specific numbers, trade-offs, and failure modes
- The Bar Raiser will test consistency: if you claim a design scales to 10M QPS, you will be asked why

### System Design Rounds at SDE-II and Above

At SDE-II, expect 1 system design round. At SDE-III (Senior SDE), expect 2. At Principal, system design is often the entire interview with no coding.

The design round at Amazon is not free-form exploration. Amazon expects a structured approach:

1. **Clarify requirements** — especially scale: users, QPS, data size, SLA
2. **Define success metrics** — always customer-facing (latency at P99, not average)
3. **High-level architecture** — draw boxes, name the AWS services you would use
4. **Deep dive on the hardest component** — the interviewer will direct you here
5. **Operational concerns** — monitoring, failure handling, cost

Amazon interviewers are trained to push you off your prepared path. Expect 3–4 redirects during a single design round.

---

## Leadership Principles Integration

### Why LPs Matter in System Design

Amazon's 16 Leadership Principles are not a culture add-on — they are the decision framework Amazon engineers use daily. In a system design interview, the interviewer is not just grading your architecture; they are grading whether your reasoning process matches an Amazon engineer's reasoning process.

**The integration technique**: After making a design decision, briefly name the principle it reflects. Do not over-explain. One sentence is enough.

### Key LPs and How to Weave Them In

#### Bias for Action

> "We value calculated risk-taking over waiting for perfect information."

**Wrong approach**: "It depends on the requirements whether we use SQL or NoSQL."

**Right approach**: "Given the read-heavy access pattern and the scale numbers we established, I would use DynamoDB with a GSI on the user_id field. We can always migrate if the schema evolves — the cost of over-engineering upfront is higher than the cost of a future migration."

*How to weave it*: Make a concrete choice. State your assumption. Move forward. Do not hedge with "it depends" unless you immediately resolve the dependency.

#### Customer Obsession

> "Leaders start with the customer and work backward."

**Wrong approach**: Starting your design by talking about throughput, storage, or infrastructure.

**Right approach**: "The customer impact of this feature is that checkout must complete in under 2 seconds at the 99th percentile. Every architectural choice I make will be evaluated against that number first."

*How to weave it*: Define customer-facing SLAs before any infrastructure discussion. Use P99 latency and error rate as your primary success metrics, not CPU utilization or cache hit rate.

#### Dive Deep

> "Leaders operate at all levels and stay connected to the details."

**Wrong approach**: Describing a design without concrete numbers. "We use a cache in front of the database."

**Right approach**: "We put an ElastiCache Redis cluster with 3 replicas in front of RDS. At 50k reads/second with an 80% cache hit rate, that offloads 40k reads/second from RDS, keeping it under the 10k RPS limit for a db.r5.2xlarge. Cache TTL of 5 minutes is acceptable given the product catalog changes at most once per hour."

*How to weave it*: Every major component should have an associated number. Memorize rough AWS pricing tiers, RDS limits, DynamoDB partition throughput (3000 RCU / 1000 WCU per partition), and S3 request rates (5500 GET / 3500 PUT per prefix per second).

#### Frugality

> "Accomplish more with less. Constraints breed resourcefulness."

**Wrong approach**: Proposing a 1000-node Kafka cluster for a feature that processes 1000 events/second.

**Right approach**: "At 1000 events/second with a 24-hour retention requirement, a single 3-node Kafka cluster is sufficient. I would start with that and add partitions as we grow. Jumping to a 100-node cluster to future-proof adds $15,000/month with no customer benefit today."

*How to weave it*: Size your infrastructure to current load with a defined scale-up trigger. Mention cost explicitly. Amazon engineers are expected to know the cost of their infrastructure.

#### Ownership

> "Leaders are owners. They never say 'that's not my job.'"

*How to weave it*: Proactively mention operational concerns without being asked. "I own the monitoring story for this service — I would instrument latency, error rate, and DLQ depth as the three golden signals, with PagerDuty alerts if error rate exceeds 0.1% for 5 consecutive minutes."

#### Invent and Simplify

*How to weave it*: When a standard solution exists, use it. Amazon does not want novel architectures for commodity problems. "For this use case, SQS with a dead-letter queue and exponential backoff handles the reliability requirements without building custom retry logic."

---

## Top 15 Amazon System Design Questions

### 1. Design Amazon's Shopping Cart

**Scale assumptions**: 300M active users, 50M daily sessions, 2M concurrent sessions at peak (Prime Day), cart read QPS 500k, cart write QPS 100k.

**The key architectural decision**: Shopping cart state must survive crashes and work across devices (browser, mobile, Alexa). The choice is **session-scoped (Redis)** vs **persistent (DynamoDB)** vs **hybrid (both)**.

**LP tested**: Customer Obsession (cart loss = lost revenue), Bias for Action (pick a consistency model and justify it).

**Core insight**: Amazon uses DynamoDB as the persistent store with a TTL of 30 days on cart items, and an in-memory cache for active sessions. Eventual consistency is acceptable for reading the cart but checkout requires a read-your-writes guarantee.

```
Cart write → DynamoDB (partition key: user_id, sort key: item_id)
Cart read  → ElastiCache Redis (session cache, 30-minute TTL)
On cache miss → DynamoDB read-through, repopulate cache
Checkout → DynamoDB strongly consistent read to prevent overselling
```

**The gotcha**: Anonymous carts must merge with authenticated carts at login. This is the edge case interviewers probe. Implement a `merge_carts(anonymous_id, user_id)` operation at login that deduplicates by item_id and sums quantities where business logic allows.

---

### 2. Design AWS S3

**Scale assumptions**: 200 trillion objects, 1 billion requests/day (10k+ RPS), objects ranging from 1 byte to 5TB, 99.999999999% (11 nines) durability.

**The key architectural decision**: How to achieve 11 nines durability without storing 6 copies of every byte. The answer is **erasure coding** (Reed-Solomon), not replication.

**LP tested**: Dive Deep (erasure coding math), Invent and Simplify (don't over-replicate).

**Core insight**: S3 uses erasure coding to split each object into data shards + parity shards. A common scheme is 6+4: split the object into 6 data chunks, generate 4 parity chunks. Any 6 of the 10 chunks can reconstruct the original. Chunks are stored across different Availability Zones. Durability calculation: with 10 AZs, you would need 5 simultaneous failures of specific shards to lose data — mathematically equivalent to 11 nines.

```
Object upload → Object metadata stored in index layer (key → shard locations)
Sharding → Reed-Solomon encoding, 6 data + 4 parity shards
Placement → Shards placed across 3+ AZs in different physical racks
Read path → Fetch any 6 of 10 shards, reconstruct → serve
```

**Key numbers to cite**: S3 can sustain 3500 PUT/DELETE and 5500 GET requests per second **per prefix**. Striping object keys with a random prefix hash distributes load across partitions.

---

### 3. Design Amazon's Order Fulfillment System

**Scale assumptions**: 2M orders/day on normal days, 20M orders/day on Prime Day, 185 fulfillment centers globally, delivery SLA of same-day to 5 days depending on tier.

**The key architectural decision**: How to route an order to the right fulfillment center and track its state through 15+ status transitions without losing updates.

**LP tested**: Ownership (you own the order end-to-end), Deliver Results (order must arrive on time).

**Core insight**: Use an event-driven state machine. Each order has a state (PLACED → PAYMENT_CONFIRMED → ASSIGNED_TO_FC → PICKED → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED). Each transition is an event published to an SNS topic. Downstream systems (warehouse management, driver routing, customer notifications) subscribe to relevant events.

```
Order placed → SQS FIFO queue (deduplication ID = order_id)
Payment service consumes → emits PAYMENT_CONFIRMED event → SNS
Routing engine subscribes → assigns to nearest FC with inventory
FC management system → picks, packs, emits SHIPPED event
Driver routing system → subscribes to SHIPPED → assigns last-mile
Customer notification → subscribes to all state changes → sends push/email/SMS
```

**The gotcha Amazon cares about**: Idempotency at every step. The shipping label service must not print two labels for the same order even if the SHIPPED event is delivered twice. Use the order_id as idempotency key.

---

### 4. Design Prime Video Streaming

**Scale assumptions**: 200M Prime subscribers, 15M concurrent streams at peak, average bitrate 8 Mbps (HD), catalog of 20,000+ titles, global distribution.

**The key architectural decision**: **Adaptive Bitrate (ABR)** streaming via HLS or DASH, with CloudFront as the CDN. The design question is about origin architecture and DRM key delivery latency.

**LP tested**: Customer Obsession (buffering = customer defect), Think Big (global scale from day one).

**Core insight**: Video is transcoded into multiple bitrate ladders (4K/1080p/720p/480p/360p) and segmented into 6-second chunks stored in S3. CloudFront serves segments from edge locations. The player uses ABR to switch bitrates based on measured bandwidth.

```
Ingest → Transcoding farm (EC2 GPU instances with FFmpeg) → 5 bitrate variants
Storage → S3 with lifecycle policies (S3-IA after 30 days for catalog)
Delivery → CloudFront CDN (350+ PoPs globally)
DRM → AWS Elemental MediaConvert for Widevine/FairPlay/PlayReady
Manifest → Dynamic manifest generation per device/geography/license
```

**The DRM key delivery problem**: DRM license requests are not cacheable (per-user, per-device). At 15M concurrent streams with license renewal every 20 minutes, that is 12,500 license requests/second to the license server. Shard the license service by content_id hash to distribute load.

---

### 5. Design Alexa Backend

**Scale assumptions**: 500M Alexa-enabled devices, 300M monthly active voice users, peak QPS at 8 AM (morning routines) of 500k requests/second, response latency SLA of under 1 second end-to-end.

**The key architectural decision**: The NLU (Natural Language Understanding) pipeline must be fast enough that the latency budget for cloud processing is under 300ms (100ms is the device round trip, 600ms is reserved for TTS generation and audio buffer).

**LP tested**: Customer Obsession (1-second latency SLA), Dive Deep (latency budget decomposition).

**Core insight**: The pipeline is: Wake word detection (on device) → ASR (Automatic Speech Recognition) → NLU (intent + slot extraction) → Fulfillment (skill backend) → Response generation → TTS → Audio delivery.

```
Device → ASR service (edge or cloud, ~50ms) → intent text
Intent text → NLU model inference (~30ms on GPU, ~80ms on CPU)
Intent → Skill router → Skill Lambda (~50-100ms, P99)
Response → Polly TTS (~100ms for short responses)
Total cloud budget: ~280ms at P50, ~450ms at P99
```

**Device state synchronization**: Alexa devices maintain a shadow state in AWS IoT Core. When a user says "Alexa, turn off the lights," the Alexa backend updates the device shadow, and the device polls for state changes. This decouples the response latency from the device acknowledgment.

---

### 6. Design Amazon's Fraud Detection

**Scale assumptions**: 2M transactions/day, 50k TPS at peak checkout periods, fraud check must complete in under 100ms (synchronous, blocks checkout), historical transaction data 3 years rolling.

**The key architectural decision**: Real-time ML scoring (feature computation + model inference in under 100ms) vs asynchronous post-transaction scoring. Amazon requires **synchronous** for high-risk transactions.

**LP tested**: Bias for Action (make a call on sync vs async, don't hedge), Dive Deep (feature latency breakdown).

**Core insight**: The 100ms budget breaks down as: feature retrieval ~20ms, model inference ~10ms, rules engine ~5ms, overhead ~15ms. The bottleneck is feature retrieval — computing aggregate features (transactions in last 1 hour, 24 hours, 30 days) from a raw event log at query time is too slow.

```
Transaction arrives → Feature store lookup (DynamoDB, pre-computed aggregates)
  - user_txn_count_1h, user_txn_count_24h, user_spend_30d
  - device_fingerprint_first_seen, ip_geolocation_mismatch
Feature vector → SageMaker real-time endpoint (XGBoost model, ~10ms P99)
Score + rule evaluation → ALLOW / REVIEW / BLOCK decision
Feature store update → Kinesis Data Streams → Lambda → DynamoDB (async)
```

**The key insight**: Feature aggregates are pre-computed and updated asynchronously via a streaming pipeline. The fraud check reads pre-computed values, not raw events. This is the standard feature store pattern.

---

### 7. Design AWS Lambda

**Scale assumptions**: Millions of function deployments, billions of invocations/day, cold start SLA of under 1 second for most runtimes, execution environments from 128MB to 10GB RAM.

**The key architectural decision**: The **cold start problem**. When a function has not been invoked recently, a new execution environment (microVM) must be provisioned. The design question is how to minimize cold starts while not wasting capacity.

**LP tested**: Frugality (don't provision hot environments for idle functions), Invent and Simplify (Firecracker microVM).

**Core insight**: AWS Lambda uses Firecracker microVMs — lightweight VMs that boot in under 125ms. Each Lambda execution environment is a Firecracker VM running on a fleet of bare-metal hosts managed by the Lambda control plane.

```
Invoke request → Lambda control plane (routing layer)
  If warm environment available → assign → run → return
  If no warm environment:
    → Firecracker VM boot (~125ms)
    → Runtime initialization (Node/Python/Java, 10ms–500ms)
    → Handler initialization (your code, variable)
    → Execute handler
Environment pool → maintained per function version per AZ
Scaling → ~1000 concurrent executions/account default, burst scaling at 500-3000/minute
```

**The Provisioned Concurrency feature**: For functions that cannot tolerate cold starts, Provisioned Concurrency pre-warms N environments permanently. Cost is ~65% of on-demand price for those environments. The design trade-off is Frugality vs Customer Obsession.

**Key number**: Firecracker can boot 150 microVMs/second per host. A single Lambda host serves thousands of functions.

---

### 8. Design Amazon's Product Review System

**Scale assumptions**: 400M products, 200M reviews total, 50k new reviews/day, review reads at 2M QPS (product pages), rating aggregation must reflect new reviews within 5 minutes.

**The key architectural decision**: How to maintain accurate aggregate ratings (average, histogram) without recomputing from all reviews on every write.

**LP tested**: Dive Deep (aggregate math), Customer Obsession (stale ratings mislead purchase decisions).

**Core insight**: Use pre-aggregated rating summaries stored alongside the product record. Each review write triggers an atomic increment to `total_reviews` and `total_stars` counters. Average = total_stars / total_reviews, no full recomputation needed.

```
Review submitted → SQS queue → Review validation Lambda
  → Spam detection (ML model, async)
  → Profanity filter (synchronous)
  → Verified purchase check (order database lookup)
Approved review → DynamoDB reviews table + DynamoDB product rating table
  → Atomic update: total_reviews += 1, rating_N_count += 1, total_stars += N
Rating display → Read product rating table (pre-aggregated, sub-millisecond)
Helpfulness votes → Separate counter, used for ranking/sorting
```

**The spam detection problem**: Amazon uses a combination of text similarity (TF-IDF against known spam patterns), behavioral signals (account age, purchase history, review velocity), and network analysis (reviewer communities that vote for each other). The ML model runs asynchronously — reviews are published immediately and retroactively removed if flagged.

---

### 9. Design a Distributed Key-Value Store (Like DynamoDB)

**Scale assumptions**: 1M RPS mixed read/write, sub-10ms P99 latency, 99.99% availability, petabyte-scale data, thousands of tables.

**The key architectural decision**: **Consistent hashing** for data partitioning, **quorum reads/writes** (Dynamo paper: W + R > N) for tunable consistency.

**LP tested**: Think Big (design for planet scale), Dive Deep (Dynamo paper internals).

**Core insight**: This is based on the Amazon Dynamo paper (2007). Every SDE-III candidate is expected to know this paper.

```
Data partitioning:
  - Virtual nodes (vnodes) on a consistent hash ring
  - Each physical node owns multiple vnodes (150 vnodes/node by default)
  - Key → hash → vnode → physical node
  - Node add/remove only affects neighboring vnodes

Replication:
  - N=3: Each key is stored on the primary node + next 2 nodes clockwise
  - W=2: Write acknowledged after 2 of 3 nodes confirm
  - R=2: Read fetches from 2 of 3 nodes
  - W+R > N guarantees read-your-writes (2+2=4 > 3)

Conflict resolution:
  - Vector clocks on each item version
  - Concurrent writes → siblings → application-level merge (shopping cart: union)
  - "Last Write Wins" mode available but loses data on concurrent writes
```

**The anti-entropy mechanism**: Background gossip protocol synchronizes state between nodes. Each node exchanges Merkle tree hashes of its key range with neighbors. Differences trigger repair operations. This is how DynamoDB self-heals without requiring manual intervention.

---

### 10. Design Amazon's Flash Sale System

**Scale assumptions**: 1M items in stock, 10M users attempting to buy simultaneously at t=0 (Prime Day deal), payment processing at 5k TPS, item must not oversell.

**The key architectural decision**: How to prevent overselling without making the purchase flow synchronous through a single database lock. The answer is a **Redis atomic decrement as a gate** followed by a payment queue.

**LP tested**: Customer Obsession (no overselling = no chargebacks), Bias for Action (pick the architecture, justify it).

**Core insight**: Use Redis DECR as an atomic inventory gate. Redis is single-threaded — DECR is atomic without locks. If DECR returns >= 0, the user has a reservation. Payment is processed asynchronously.

```
Flash sale start: Redis SET inventory:item123 1000000 (1M items)

User purchases:
  1. Redis DECR inventory:item123
     → If result >= 0: reservation granted
     → If result < 0: sold out (INCR to compensate, return error)
  2. On reservation granted:
     → Write reservation to DynamoDB (TTL: 15 minutes)
     → Enqueue payment job to SQS FIFO (deduplication-id: user_id + item_id)
  3. Payment service processes SQS:
     → Charge card
     → On success: confirm order, decrement persistent inventory
     → On failure: release Redis reservation (INCR), cancel reservation record
```

**The queue depth problem**: 10M simultaneous clicks → 10M SQS messages. SQS can handle this (virtually unlimited throughput), but the payment service downstream cannot process 10M messages at once. Use an SQS consumer that auto-scales EC2 instances based on queue depth (CloudWatch metric: ApproximateNumberOfMessages).

---

### 11. Design AWS CloudWatch

**Scale assumptions**: 100B metric data points ingested per day (~1.2M points/second), 10M log streams, alerting latency under 1 minute from metric ingestion to alarm state change, dashboards at 100k QPS.

**The key architectural decision**: Metrics ingestion is a write-heavy time-series workload. Standard relational databases cannot handle 1.2M writes/second. The answer is a purpose-built **time-series store with pre-aggregation**.

**LP tested**: Dive Deep (time-series database internals), Frugality (pre-aggregation reduces storage 100x).

**Core insight**: CloudWatch uses a tiered storage model. Raw data is stored at 1-second resolution for 3 hours, aggregated to 1-minute resolution for 15 days, then 5-minute for 63 days, then 1-hour for 455 days. This mirrors the Prometheus retention model.

```
Metric ingest → Kinesis Data Streams (1.2M points/second)
Consumer → Lambda or Flink → batch write to time-series store
Time-series store → Apache Parquet on S3 + DynamoDB index (metric name → S3 paths)
Pre-aggregation → hourly Glue jobs: raw → 1-min → 5-min → 1-hour rollups

Alerting:
  → Rule evaluator polls time-series store every 60 seconds
  → Sliding window computation (sum, average, percentile)
  → State machine: OK → ALARM → OK (hysteresis prevents flapping)
  → On ALARM: SNS publish → PagerDuty, Lambda, SQS targets

Log aggregation:
  → Agent (CloudWatch Agent) on EC2 → Kinesis Firehose → S3
  → CloudWatch Logs Insights → Presto SQL engine over S3 data
```

---

### 12. Design Amazon's Package Delivery Routing

**Scale assumptions**: 10M deliveries/day, 300k drivers globally, dynamic route re-optimization when a delivery fails or traffic changes, driver location updates every 30 seconds.

**The key architectural decision**: Optimal route computation is NP-hard (Traveling Salesman Problem). At 100 stops per driver, exact TSP is computationally infeasible in real time. Use **heuristic approximation** (nearest neighbor + 2-opt local search).

**LP tested**: Frugality (don't buy Oracle optimization licenses), Dive Deep (algorithm trade-offs).

**Core insight**: Routes are pre-computed offline the night before, then dynamically adjusted during the day as deliveries are confirmed or failed.

```
Offline route planning (10 PM - 4 AM):
  → Cluster stops by geographic area (K-means, k = expected drivers available)
  → Per cluster: nearest-neighbor heuristic to build initial route
  → 2-opt improvement: swap pairs of edges if total distance decreases
  → Output: ordered stop list per driver, uploaded to driver app

Real-time adjustments:
  → Driver location: mobile app → Kinesis → Redis geospatial index (GEOADD)
  → Failed delivery → re-insert stop into active driver route
     → Run 2-opt on remaining stops (~50ms for 50 stops)
  → Customer "not home" → automated re-route to end of driver's route

ETA prediction:
  → Historical delivery time per (ZIP code, time-of-day, weather) → ML model
  → Real-time traffic: HERE Maps API → adjust time estimates
  → Push notification when driver is 2 stops away (< 15 minutes)
```

---

### 13. Design Amazon Go Checkout

**Scale assumptions**: 500 Amazon Go stores, 2000 customers/store/day, computer vision pipeline must attribute items to customers in real time, payment processed within 2 hours of store exit.

**The key architectural decision**: The "Just Walk Out" system must track items from shelf to basket in real time. This requires **fusion of computer vision (ceiling cameras) + weight sensors (shelf sensors)** rather than relying on either alone.

**LP tested**: Customer Obsession (no checkout friction), Think Big (scale to 10k stores).

**Core insight**: The system has three layers: entry (associate customer ID with session via palm scan or QR), in-store tracking (computer vision + shelf sensors), and exit (session close → inventory reconciliation → charge payment method on file).

```
Entry:
  → Customer scans phone (QR code = session_id) or palm (biometric hash = customer_id)
  → Session created: {customer_id, entry_time, cart: []}

In-store:
  → Overhead cameras (fish-eye, 10 cameras/1000 sq ft) → person tracking model
  → Each person assigned a track_id (re-identification via appearance features)
  → Shelf interaction: hand near shelf → trigger item classification
  → Shelf weight delta → confirm item removed or returned
  → Item added to virtual cart: {track_id: [item_id, quantity]}

Exit:
  → Person exits → track_id → session_id (via entry gate association)
  → Cart finalized → price computation
  → Charge within 2 hours (batch payment processor)
  → Receipt via app push notification
```

**The hard problem**: Re-identification — if a customer walks behind a shelf and out of camera view, the computer vision system must re-identify them when they reappear. This uses appearance embeddings (color histogram + body shape) with a cosine similarity threshold of 0.85.

---

### 14. Design AWS IAM

**Scale assumptions**: 1B API calls/day authenticated via IAM, policy evaluation latency under 1ms (authorization is in the hot path of every AWS API call), 100M IAM entities (users, roles, groups), policy documents totaling 10s of TB.

**The key architectural decision**: Policy evaluation must be **sub-millisecond** and happen at the API endpoint (the API gateway cannot call a remote IAM service for every request — that doubles latency). The answer is **policy caching with TTL-based invalidation**.

**LP tested**: Customer Obsession (every AWS call has IAM overhead), Dive Deep (policy evaluation algorithm).

**Core insight**: IAM uses a policy evaluation algorithm with defined precedence: (1) Explicit Deny wins, (2) explicit Allow wins, (3) implicit Deny is default. The evaluation traverses all attached policies (identity-based, resource-based, SCPs, permission boundaries) and returns a combined decision.

```
IAM policy cache:
  → Per-entity policy bundle cached in each AWS service host (memory cache)
  → TTL: 60 seconds (IAM changes propagate within ~60 seconds — a documented SLA)
  → Cache miss → call IAM service → cache result

Policy evaluation (on cache hit, sub-1ms):
  1. Collect all applicable policies: identity-based + resource-based + SCP + boundary
  2. Check for explicit Deny → if found, DENY immediately
  3. Check for Allow in identity-based policies
  4. Check for Allow in resource-based policies
  5. If neither → implicit DENY

Cross-account role assumption:
  → AssumeRole call → STS → validate trust policy → issue temporary credentials (15min-12hr)
  → Credentials cached in client SDK (~5 minutes before expiry)
  → Permission boundaries: intersection of role policies + boundary policies
```

---

### 15. Design Amazon's Recommendation Engine

**Scale assumptions**: 500M unique items, 300M customers, homepage recommendations at 30M QPS (personalized per user), recommendation freshness: new purchases should influence recommendations within 1 hour.

**The key architectural decision**: **Item-to-item collaborative filtering** (Amazon's 2003 paper) vs user-based filtering. At 300M users, computing user similarity is O(n²) — infeasible. Item similarity scales because the item catalog (500M) is smaller than the user base and item vectors are denser.

**LP tested**: Invent and Simplify (item-item CF was Amazon's invention), Dive Deep (matrix factorization math).

**Core insight**: Precompute an item similarity matrix offline. At serve time, look up items the user recently viewed/purchased, find their top-K similar items, rank by recency weight.

```
Offline (daily batch):
  → Build user-item interaction matrix from orders, views, ratings
  → Item co-occurrence matrix: count users who interacted with both item_A and item_B
  → Normalize by item popularity (divide by sqrt(|users_A| * |users_B|)) = cosine similarity
  → For each item: store top-100 similar items in DynamoDB
     Key: item_id, Value: [(similar_item_id, similarity_score), ...]

Online serving (< 10ms P99):
  → Fetch user's last 10 interactions from Redis (interaction_history:{user_id})
  → Batch DynamoDB GetItem for 10 items' similar-item lists
  → Merge, deduplicate, remove already-purchased items
  → Rank by: similarity_score * recency_weight * availability_flag
  → Return top 20 recommendations

Real-time updates:
  → New purchase event → Kinesis → Lambda → append to Redis interaction history
  → Full model retrain: daily (Spark on EMR, ~4 hours for full recompute)
  → Incremental update: hourly (ALS incremental update for new interactions)
```

**Key number**: Amazon's item-item CF paper reported a 9x speedup over user-user CF with better recommendation quality at scale. This is a paper worth citing by name in the interview.

---

## Common Mistakes in Amazon Interviews

### Mistake 1: Starting with Technology, Not the Customer Problem

**What it looks like**: "I would use Kafka for the event streaming layer because it has high throughput and supports multiple consumers."

**Why it fails**: You have named a technology before establishing why streaming is needed, what throughput is required, and what the customer-facing consequence of slow processing is.

**Fix**: Start with "The customer impact of this decision is..." — state the latency or reliability SLA, then choose technology that meets it. If someone asks why Kafka and not SQS, you should answer: "SQS has a 256KB message size limit and does not support replay, which we need for our audit log requirement. Kafka supports 1MB messages by default and 7-day log retention for replay."

---

### Mistake 2: Under-specifying Scale, Then Making Wrong Trade-offs

**What it looks like**: Designing a system without asking for QPS, data size, or SLA numbers, then proposing a solution that is either over-engineered (10-node Kafka for 100 events/second) or under-engineered (single RDS for 1M TPS).

**Why it fails**: Amazon interviewers grade you on your judgment, and judgment requires numbers. "It depends" without resolving the dependency is the most common reason for a "hire" (weak yes) instead of "strong hire."

**Fix**: In the first 5 minutes, establish: peak QPS (read and write separately), data retention requirement, latency SLA (P99, not average), consistency requirement (eventual vs strong), and geographic scope. Write these on the whiteboard. Return to them when making trade-offs.

---

### Mistake 3: Ignoring Failure Modes and Operational Concerns

**What it looks like**: Designing a perfect-path architecture without discussing what happens when a component fails — DynamoDB throttles, an AZ goes down, a downstream service returns 503.

**Why it fails**: Amazon's culture values Ownership. An owner thinks about what happens at 3 AM when the pager goes off. Ignoring failure modes signals you will build systems that are hard to operate.

**Fix**: For every component you draw, name its failure mode and mitigation:
- "If ElastiCache fails, the fallback is a direct DynamoDB read — latency increases from 2ms to 8ms but the system stays available."
- "If the payment service is down, we enqueue to SQS and retry with exponential backoff up to 3 times over 15 minutes. After 3 failures, we move to the DLQ and alert on-call."

---

### Mistake 4: Proposing Non-AWS Solutions Without Justification

**What it looks like**: "I would use PostgreSQL on-premise with a Redis cluster on EC2 for caching."

**Why it fails**: Amazon builds on AWS. Proposing to run your own Postgres on EC2 when RDS exists, or building a custom message queue when SQS/Kinesis exist, signals poor familiarity with the ecosystem and contradicts Invent and Simplify.

**Fix**: Default to managed AWS services. If you propose a custom solution, explain why the managed service does not meet your requirements: "I cannot use SQS here because my messages are 50MB video thumbnails, which exceeds SQS's 256KB limit. I would store the payload in S3 and put only the S3 reference in the SQS message."

---

### Mistake 5: Not Sizing the Cost

**What it looks like**: Proposing an architecture without mentioning what it costs per month.

**Why it fails**: Amazon's Frugality principle is not just a culture value — it is evaluated in interviews. A system design that works but costs $5M/month when a $50k/month alternative exists is a failed design at Amazon.

**Fix**: Rough-size your major cost drivers. Know these numbers:
- EC2 m5.xlarge: ~$140/month on-demand, ~$50/month reserved
- DynamoDB: $1.25 per million WCUs, $0.25 per million RCUs (on-demand)
- S3: $23/TB/month for S3 Standard, $5/TB/month for S3-IA
- Data transfer: $0.09/GB out to internet, free within same region
- RDS db.r5.2xlarge: ~$700/month on-demand

When proposing an architecture, state: "The dominant cost driver here is DynamoDB write capacity at 100k WPS, which would cost approximately $7,500/month on-demand. I would evaluate whether provisioned capacity at $12,500/month provides better predictability given the steady-state traffic."

---

## Strong Hire vs No Hire Signals

### SDE-II (L5 equivalent)

**Strong Hire signals:**
- Independently identifies scale requirements and uses them to drive trade-off decisions
- Knows P99 latency, not just average; reasons about tail latency causes (GC pauses, lock contention)
- Can design a system end-to-end, knows when to use SQL vs NoSQL, cache vs no-cache
- Proactively mentions failure modes and retry/circuit breaker patterns
- Connects at least 2 design decisions to specific LPs without prompting
- Names specific AWS services (not just "a queue" — SQS FIFO vs standard, with justification)

**Hire signals (baseline, gets the offer but with less enthusiasm):**
- Makes correct architectural choices when prompted by the interviewer
- Knows the standard patterns but needs help applying them to the specific problem
- Mentions failure handling when asked

**No Hire signals:**
- Cannot explain why they chose one database over another (no criteria beyond "I've used it before")
- Designs for a single-server scenario (no sharding, no replication discussion)
- Cannot estimate QPS, storage, or bandwidth from given scale numbers
- Argues with the interviewer when redirected instead of adapting
- Proposes architectures without knowing the cost or operational overhead

---

### SDE-III / Senior SDE (L6 equivalent)

**Strong Hire signals:**
- Leads the conversation — defines scope, challenges ambiguous requirements, proposes success metrics before being asked
- Identifies the single hardest technical problem in the design and dives deep on it unprompted
- Trade-off reasoning is at the system level: "choosing eventual consistency here allows us to reduce write latency from 50ms to 5ms, which directly impacts the checkout conversion rate — at our scale, a 10ms improvement in checkout latency is worth 0.5% conversion, roughly $25M/year in GMV"
- Recognizes when a standard solution applies (does not over-engineer)
- Has specific failure post-mortem knowledge: can name real incidents and what they taught them about the design

**Hire signals:**
- Strong technical design with good trade-off reasoning
- Needs occasional prompting to go deeper or consider failure modes

**No Hire signals:**
- Designs are technically correct but lack operational depth
- Cannot articulate trade-offs beyond "it's faster" or "it's more reliable"
- Does not consider cost, team ownership, or operational burden
- Gets flustered when the Bar Raiser challenges a design choice and cannot defend or adapt

---

### Principal SDE (L7 equivalent)

**Strong Hire signals:**
- Opens by questioning the problem framing: "Before designing this, I want to understand whether we have data showing this is the customer pain, and whether there is a simpler solution that does not require a new system"
- Designs for org topology: "Given that three teams will own different parts of this system, I would define the API contracts between subsystems before discussing implementation — this shapes team autonomy and deployment independence"
- Has a point of view on long-term evolution: "Starting with a monolith here is the right call — the domain is not well-understood enough to decompose. We plan to extract services at the 18-month mark when the domain boundaries are clear"
- Can evaluate build vs buy vs open-source at the business level: "Using Confluent Kafka adds $200k/year in licensing but eliminates a 2-engineer operational burden — at our current eng cost, that is breakeven. But the option value of owning the platform is worth it at our scale"
- Identifies cross-cutting concerns other candidates miss: compliance, GDPR data residency, cost allocation across BUs, disaster recovery RTO/RPO

**No Hire signals:**
- Cannot operate above the component level — discusses implementation details without addressing architectural principles
- Does not engage with organizational or business context
- Strong opinions without openness to being challenged
- Cannot estimate impact of technical decisions in business terms (revenue, cost, headcount)

---

## Quick Reference: Key Numbers to Memorize

| System | Key Number |
|--------|-----------|
| DynamoDB partition throughput | 3000 RCUs / 1000 WCUs per partition |
| S3 GET throughput per prefix | 5500 requests/second |
| S3 PUT throughput per prefix | 3500 requests/second |
| SQS message size limit | 256 KB |
| SQS visibility timeout max | 12 hours |
| Kinesis shard throughput | 1 MB/s write, 2 MB/s read, 1000 records/s write |
| Lambda cold start (Node.js) | ~100-300ms |
| Lambda cold start (Java) | ~1-3 seconds |
| Lambda Firecracker boot | ~125ms |
| Redis single-node throughput | ~100k ops/second |
| ElastiCache Redis max memory | 425 GB (cache.r6g.16xlarge) |
| RDS max connections (r5.2xlarge) | ~2,000 (PostgreSQL) |
| CloudFront edge locations | 400+ PoPs in 90+ cities |
| SQS FIFO max throughput | 3000 messages/second (with batching) |
| DynamoDB item size limit | 400 KB |
| DynamoDB table max RCU (soft limit) | Unlimited (auto-scaling) |

---

## References

- 📖 [Amazon Dynamo: Highly Available Key-Value Store (2007)](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) — Werner Vogels, Amazon CTO
- 📖 [Amazon Item-to-Item Collaborative Filtering (2003)](https://www.cs.umd.edu/~samir/498/Amazon-Recommendations.pdf) — Greg Linden, Brent Smith, Jeremy York
- 📖 [Amazon Leadership Principles](https://www.amazon.jobs/content/en/our-workplace/leadership-principles) — Official Amazon Jobs page
- 📺 [AWS re:Invent 2022 — DynamoDB Under the Hood](https://www.youtube.com/watch?v=yvBR71D0nAQ) — Marc Brooker
- 📺 [AWS re:Invent 2023 — How Lambda Works](https://www.youtube.com/watch?v=0_jfH6qijVY) — Marc Brooker on Firecracker
- 📖 [Firecracker: Lightweight Virtualization for Serverless Applications](https://www.usenix.org/conference/nsdi20/presentation/agache) — NSDI 2020
- 📖 [The Amazon Builders' Library](https://aws.amazon.com/builders-library/) — Amazon's internal engineering practices made public
