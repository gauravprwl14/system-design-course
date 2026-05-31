# Principal Engineer Curriculum — Master Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute each phase. Steps use checkbox (`- [ ]`) syntax for tracking. Run at minimum 10 sub-agents in parallel per phase.

**Goal:** Fill every gap in the system design knowledge base so any software engineer can use it to become a world-class principal engineer — covering scalable systems, real-time pressure, security, and interview readiness at FAANG/staff level.

**Architecture:** Six sequential phases, each fanning out 10+ parallel sub-agents. Phase 0 must complete before others. Phases 1–5 can overlap once Phase 0 is done. Each article must follow the Two-Depth structure (Level 1: 2-min surface, Level 2: deep dive) from CLAUDE.md. No duplication — the DO NOT RE-COVER list is law.

**Tech Stack:** Nextra 4 (MDX/MD), Mermaid diagrams, frontmatter YAML, Next.js 14, content at `docs-site/content/`.

---

## ⚠️ DO NOT RE-COVER (Already Comprehensive — Skip These)

The following topics have full deep-dive articles and must NOT be rewritten. Cross-reference only:

| Topic | File(s) |
|-------|---------|
| Chaos engineering | `10-architecture/concepts/chaos-engineering.md` + hands-on |
| Service mesh (Istio/Linkerd) | `10-architecture/concepts/service-mesh-architecture.md` |
| Event sourcing + CQRS | `04-messaging/concepts/event-sourcing-design.md`, `10-architecture/concepts/cqrs.md` |
| Saga pattern | `10-architecture/concepts/saga-pattern-deep-dive.md` |
| Database internals (B-tree, WAL) | `01-databases/concepts/write-ahead-log.md`, `indexing-deep-dive.md` |
| Multi-region active-active | `06-scalability/concepts/multi-region.md`, `global-distribution-strategy.md` |
| Zero trust architecture | `08-security/concepts/zero-trust-architecture.md` |
| mTLS / certificate management | `08-security/concepts/mtls-certificate-management.md` |
| Kubernetes advanced | `12-interview-prep/question-bank/cloud-devops/kubernetes-architecture.md` |
| FinOps / cost optimization | `09-observability/concepts/cost-monitoring-finops.md` |
| CDC (Change Data Capture) | `01-databases/concepts/change-data-capture.md` |
| Bloom filters / HyperLogLog | `14-algorithms/`, `12-interview-prep/question-bank/algorithms-patterns/bloom-filters-hyperloglog.md` |
| Consistent hashing | `06-scalability/concepts/consistent-hashing-deep-dive.md` |
| Raft / Paxos consensus | `05-distributed-systems/concepts/raft-consensus.md`, `distributed-consensus.md` |
| Two-phase commit | `05-distributed-systems/concepts/two-phase-commit.md` |
| Backpressure | `10-architecture/concepts/backpressure.md` |
| Circuit breaker + bulkhead + retry | `10-architecture/concepts/circuit-breaker.md`, `bulkhead-pattern.md` |
| Rate limiting algorithms | `06-scalability/concepts/rate-limiting-algorithms.md` |
| gRPC / Protocol Buffers | `07-api-design/concepts/grpc-design-patterns.md` |
| GraphQL federation | `07-api-design/concepts/graphql-production-patterns.md` |
| CRDT | `14-algorithms/distributed/crdt-conflict-free-data-types.md` |
| Vector clocks | `05-distributed-systems/concepts/vector-clocks-logical-time.md` |
| Distributed tracing (OTel) | `09-observability/concepts/opentelemetry-instrumentation.md` |
| SLO/SLA/SLI engineering | `09-observability/concepts/slo-error-budget-design.md` |
| Progressive delivery | `10-architecture/concepts/deployment-strategies-deep-dive.md` |
| Feature flags | `10-architecture/concepts/feature-flag-architecture.md` |
| Read-your-writes consistency | `05-distributed-systems/concepts/read-your-writes-consistency.md` |
| Linearizability vs serializability | `05-distributed-systems/concepts/linearizability-vs-serializability.md` |

---

## Indexing Strategy (Distributed Tree)

Each section gets its own `STATUS.md` file. Do not put all status in one giant file — it becomes unreadable. Structure:

```
content/
  STATUS.md                          <- Master index (section-level only, <150 lines)
  01-databases/STATUS.md             <- All database articles: done/stub/missing
  02-caching/STATUS.md
  03-redis/STATUS.md
  04-messaging/STATUS.md
  05-distributed-systems/STATUS.md
  06-scalability/STATUS.md
  07-api-design/STATUS.md
  08-security/STATUS.md
  09-observability/STATUS.md
  10-architecture/STATUS.md
  11-real-world/STATUS.md
  12-interview-prep/STATUS.md
  13-agent-workflows/STATUS.md
  14-algorithms/STATUS.md
  15-vector-databases/STATUS.md
  16-system-design-problems/STATUS.md  <- Replaces PROGRESS.md
  problems-at-scale/STATUS.md
  cheat-sheets/STATUS.md
```

Each `STATUS.md` format:
```markdown
# [Section] Status

| File | Title | Status | Lines | Last Updated |
|------|-------|--------|-------|--------------|
| concepts/write-ahead-log.md | Write-Ahead Log | Full | 847 | 2026-03 |
| concepts/mvcc.md | MVCC | Stub | 143 | 2026-01 |
| concepts/planned-topic.md | Topic Name | Missing | - | - |
```

Status codes:
- Full = 500+ lines, has Mermaid diagram, real-world examples, numbers
- Stub = exists but < 300 lines, needs expansion
- Missing = in plan but not written yet

The master `content/STATUS.md` only shows section-level summary (how many Full/Stub/Missing per section), linking to section-level STATUS.md for details.

---

## Phase 0 — Indexing Infrastructure
**Duration:** 1–2 days | **Parallel agents:** 12
**Goal:** Build distributed STATUS.md tree. No content writing. This unblocks all other phases by giving agents a clear "what's done" reference.

**Anti-duplication rule for all agents:** READ the STATUS.md of your section before writing anything. If a topic is already Full, skip it.

### Agent Assignments (run all 12 in parallel)

| Agent | Task | Output File |
|-------|------|-------------|
| A0-1 | Scan all files in `01-databases/` + `02-caching/` + `03-redis/`, compute status per file | `01-databases/STATUS.md`, `02-caching/STATUS.md`, `03-redis/STATUS.md` |
| A0-2 | Scan `04-messaging/` + `05-distributed-systems/` | `04-messaging/STATUS.md`, `05-distributed-systems/STATUS.md` |
| A0-3 | Scan `06-scalability/` + `07-api-design/` | `06-scalability/STATUS.md`, `07-api-design/STATUS.md` |
| A0-4 | Scan `08-security/` + `09-observability/` | `08-security/STATUS.md`, `09-observability/STATUS.md` |
| A0-5 | Scan `10-architecture/` + `11-real-world/` | `10-architecture/STATUS.md`, `11-real-world/STATUS.md` |
| A0-6 | Scan `12-interview-prep/` (all sub-dirs) | `12-interview-prep/STATUS.md` |
| A0-7 | Scan `13-agent-workflows/` + `14-algorithms/` | `13-agent-workflows/STATUS.md`, `14-algorithms/STATUS.md` |
| A0-8 | Scan `15-vector-databases/` + `cheat-sheets/` | `15-vector-databases/STATUS.md`, `cheat-sheets/STATUS.md` |
| A0-9 | Scan `16-system-design-problems/` (all 10 sub-dirs) | `16-system-design-problems/STATUS.md` (replaces PROGRESS.md) |
| A0-10 | Scan `problems-at-scale/` + `00-start-here/` | `problems-at-scale/STATUS.md`, `00-start-here/STATUS.md` |
| A0-11 | Write master `content/STATUS.md` (section-level rollup only) after A0-1 through A0-10 complete | `content/STATUS.md` |
| A0-12 | Update `KNOWLEDGE-MAP.md` to add STATUS.md entry points. Update root `CONTINUATION_PLAN.md` to reflect reality (current: 1048 files, not 3%). | `content/KNOWLEDGE-MAP.md`, root `CONTINUATION_PLAN.md` |

### Per-Agent Instructions (A0-1 through A0-10)

For each file in your assigned sections:
1. Run `wc -l` on the file
2. Read first 20 lines to extract frontmatter title
3. Check for Mermaid diagram (grep `mermaid`)
4. Check for real-world examples (grep `Netflix\|Uber\|Google\|Amazon\|Meta`)
5. Assign status:
   - Full: >= 500 lines AND has mermaid AND has real-world reference
   - Stub: < 500 lines OR missing mermaid OR no real-world reference
   - Missing: file doesn't exist but should (based on _meta.js entries)
6. Write STATUS.md table for your section

---

## Phase 1 — System Design Problems: Stub to Full Deep Dives
**Duration:** 2–3 weeks | **Parallel agents:** 10 (each batch runs concurrently)
**Goal:** Expand ~97 stub system design problems into full 600+ line deep-dive articles.

**IMPORTANT:** Read `16-system-design-problems/STATUS.md` before writing. Skip any file already marked Full.

### Article Template (every problem must have):
1. **Problem statement** — exact scenario with scale numbers (users, RPS, data volume)
2. **Functional requirements** — what the system does
3. **Non-functional requirements** — latency, availability, consistency targets
4. **Back-of-envelope estimation** — storage, bandwidth, QPS calculations
5. **High-level design** — Mermaid diagram with all components
6. **Deep dive: 3 critical components** — each with its own Mermaid + trade-off table
7. **Data model** — schema with types and indexes
8. **Scale bottlenecks** — where the system breaks at 10x, 100x traffic
9. **Real company reference** — how Netflix/Uber/Google actually built this
10. **Interview angle** — what the interviewer is testing, common mistakes candidates make
11. **Key numbers table** — memorizable figures (storage, latency, throughput)

### Batch Assignments (10 agents in parallel)

#### Batch 1 — Agent P1-1: Social Platforms (11 problems)
Files in `16-system-design-problems/02-social-platforms/`:

- `instagram.md` — Photo sharing at 1B users. Deep dive: media storage (S3+CDN), feed generation (push vs pull), activity graph. Real: Instagram's Cassandra migration from PostgreSQL at 300M photos/day.
- `twitter.md` — Tweet delivery at 500M tweets/day. Deep dive: fanout service, home timeline cache (Redis sorted set), search index. Real: Twitter's Pelikan cache, Flock graph service.
- `reddit.md` — Voting + commenting at scale. Deep dive: vote aggregation (eventual consistency), hot post ranking (Wilson score), content moderation pipeline. Real: Reddit's migration to Kubernetes.
- `spotify.md` — Music streaming + recommendation. Deep dive: audio CDN delivery, playlist sync (CRDTs), recommendation engine (collaborative filtering). Real: Spotify's Event Delivery service — 600B events/day.
- `craigslist.md` — Classifieds with geo-search. Deep dive: geo-indexing (R-tree vs PostGIS), listing expiry pipeline, spam detection (fingerprinting). Real: Craigslist's aging PostgreSQL and why it still works at 50M users.
- `shopify.md` — Multi-tenant e-commerce. Deep dive: tenant isolation (pod architecture), flash sale traffic spikes, payment processing pipeline. Real: Shopify's $5M/minute Black Friday — 1.7M merchants.
- Remaining 5 files — follow same template, include real company reference for each.

#### Batch 2 — Agent P1-2: Communication Systems (12 problems)
Files in `16-system-design-problems/03-communication/`:

- `facebook-messenger.md` — Chat at 1B users. Deep dive: message ordering (sequence IDs per conversation), online presence (Redis pub/sub + fanout), multi-device sync (inbox model). Real: Facebook's Iris messaging system replacing Cassandra.
- `whatsapp-messenger.md` — E2E encrypted at 2B users. Deep dive: Signal Protocol key exchange, delivery receipts (read receipts vs server receipt), media compression pipeline. Real: WhatsApp's Erlang + BEAM — 2B users on 50 engineers.
- `google-docs.md` — Real-time collaborative editing. Deep dive: Operational Transform vs CRDT (OT for server-authoritative, CRDT for P2P), cursor broadcasting via WebSocket, offline edit queue. Real: Google Wave collapse and what Docs does differently — why OT won.
- `video-conferencing.md` — WebRTC at scale for groups. Deep dive: STUN/TURN for NAT traversal, SFU vs MCU topology (SFU: O(N) bandwidth, MCU: O(1) but CPU-bound), adaptive bitrate (REMB). Real: Zoom's pivot from P2P to server-based during COVID — why the switch was forced.
- `notification-system.md` — Push + SMS + email fan-out at 1B/day. Deep dive: delivery guarantees (at-least-once + idempotency), priority queues (critical vs marketing), APNs vs FCM token management. Real: Meta's notification pipeline — 1B/day, 99.5% delivery rate target.
- Remaining 7 — follow template.

#### Batch 3 — Agent P1-3: Reservation and Scheduling (22 problems)
Files in `16-system-design-problems/04-reservation-scheduling/`:

- `ticketmaster.md` — Concert tickets with 100k concurrent buyers at the same second. Deep dive: seat locking (optimistic vs pessimistic — pessimistic wins for < 10min hold), virtual waiting room (Redis sorted set by join time), payment idempotency. Real: Ticketmaster's Taylor Swift Eras Tour outage — 3.5B bot requests, actual postmortem.
- `airbnb-listing-search.md` — Geo-search + calendar availability. Deep dive: geo-indexing (Elasticsearch geo_point + polygon filters), availability calendar (Redis bitmap per listing), search ranking (Airbnb's custom ML ranker). Real: Airbnb's migration from Solr to Elasticsearch — 150M listings.
- `uber-ride-matching.md` — Driver-rider matching under 500ms. Deep dive: geo-indexing (H3 hexagonal grid, resolution 9 = 5 km2 cells), surge pricing algorithm (supply/demand ratio per cell), ETA calculation (historical + live traffic). Real: Uber's H3 system — 86B cell assignments, open-sourced.
- `flash-sale.md` — 10M users, 1k items, 1-minute window. Deep dive: inventory locking (Redis DECRBY atomic), queue-based purchase flow (Kafka), CDN pre-warming for product page. Real: Alibaba's 11.11 Singles' Day — $1B in 68 seconds, 544k orders/second peak.
- `food-delivery.md` — Order matching + live tracking. Deep dive: restaurant capacity modeling (slots per time window), driver location updates (WebSocket + Redis GEOADD 5s interval), ETA under uncertainty (ML + routing). Real: DoorDash's live order tracking — 25M deliveries/month.
- `hotel-booking.md` — Booking with overbooking risk. Deep dive: double-booking prevention (DB-level SELECT FOR UPDATE vs saga compensation), price dynamic computation, availability calendar. Real: Booking.com's microservices — 1.5M room nights/day, split architecture.
- Remaining 16 — follow template.

#### Batch 4 — Agent P1-4: Infrastructure Systems Part 1 (16 problems)
Files in `16-system-design-problems/05-infrastructure/` — first 16 alphabetically:

- `key-value-store.md` — Build DynamoDB internals. Deep dive: consistent hashing with virtual nodes (150 vnodes per physical), gossip protocol for membership, vector clock for conflict resolution, quorum reads/writes (R+W > N). Real: DynamoDB's original Dynamo paper — 99.9th percentile latency < 300ms at Amazon scale.
- `distributed-locking.md` — Redlock vs Chubby vs ZooKeeper. Deep dive: fencing tokens (Martin Kleppmann's critique of Redlock), ZooKeeper ephemeral nodes, lock timeouts under GC pauses (the unsafe window). Real: Google Chubby's design paper — Chubby vs Redlock controversy.
- `rate-limiter.md` — API gateway rate limiting. Deep dive: sliding window log vs fixed window vs sliding window counter, Redis INCR atomic operations, distributed rate limiting (token sync across nodes). Real: Stripe — 100 req/s per API key, why they chose Redis not DB.
- `load-balancer.md` — L4 vs L7 load balancing. Deep dive: consistent hashing for session affinity, health check strategies (passive vs active), connection draining for zero-downtime deploys. Real: AWS ELB vs Nginx vs HAProxy — when each wins.
- `cdn.md` — Content delivery network. Deep dive: anycast routing (BGP advertisement), cache invalidation across 250+ PoPs (purge propagation latency), origin shield pattern, edge compute (Cloudflare Workers). Real: Cloudflare's architecture — 250 PoPs, 172 Tbps capacity.
- `distributed-messaging.md` — Build Kafka from scratch. Deep dive: log segmentation (1GB segments), compaction (tombstone records), consumer group rebalancing (cooperative rebalancing in Kafka 2.4+), exactly-once (idempotent producer + transactions). Real: LinkedIn's original Kafka design — why they chose append-only log.
- Remaining 10 — follow template.

#### Batch 5 — Agent P1-5: Infrastructure Systems Part 2 (15 problems)
Files in `16-system-design-problems/05-infrastructure/` — remaining 15:

- `big-data-pipeline.md` — Lambda vs Kappa architecture at Netflix scale. Deep dive: batch layer (Spark on S3), speed layer (Kafka Streams), serving layer (Cassandra for time-series), why Kappa wins for most use cases. Real: Netflix's Keystone pipeline — 700B events/day, Flink for stream processing.
- `metrics-alerting.md` — Prometheus + Grafana at Uber scale. Deep dive: cardinality explosion (label explosion causing OOM), long-term storage (Thanos object store), alert routing (AlertManager). Real: Uber's M3 metrics system — 600M metrics/minute, replaced Prometheus at scale.
- `distributed-tracing.md` — Jaeger/Zipkin/OTel internals. Deep dive: sampling strategies (head-based 0.1% vs tail-based on error), trace propagation (W3C TraceContext header), storage (Cassandra for traces). Real: Uber's Jaeger — 1M traces/second, why they open-sourced it.
- `container-orchestration.md` — Kubernetes internals. Deep dive: scheduler (bin packing via LeastRequestedPriority), etcd consistency (Raft with 5-node cluster), kubelet reconciliation loop (desired state vs actual state). Real: Google's Borg to Kubernetes history — 2B container starts/week at Google.
- `disaster-recovery.md` — RTO/RPO design. Deep dive: active-active vs active-passive (active-active costs 2x but cuts RTO to 0), data replication lag (async vs sync), DNS failover (TTL tuning). Real: Netflix's Chaos Monkey + multi-region DR — surviving us-east-1 failure.
- Remaining 10 — follow template.

#### Batch 6 — Agent P1-6: Data Processing (25 problems)
Files in `16-system-design-problems/01-data-processing/`:

- `web-crawler.md` — Googlebot at 1B pages/day. Deep dive: URL frontier (BFS + politeness delay per domain), deduplication (SimHash for near-duplicate detection), distributed coordination (consistent hashing of URLs to crawl nodes). Real: Google's crawl budget allocation — why low-quality pages get crawled less.
- `youtube-netflix.md` — Video upload + transcoding. Deep dive: codec selection (H.264 for compatibility, AV1 for 50% size savings), adaptive bitrate (MPEG-DASH), thumbnail generation at scale (1 frame per 10s). Real: YouTube's Borg-based transcoding — 500 hours of video uploaded per minute.
- `url-shortener.md` — 1B URLs, 10B redirects/day. Deep dive: ID generation (base62 encoding of auto-increment vs nanoid), redirect caching (CDN edge cache for popular URLs), analytics pipeline (click counts via Kafka). Real: Bitly — 8B clicks/month, why they chose MySQL not NoSQL.
- `top-k-analysis.md` — Real-time trending topics. Deep dive: Count-Min Sketch for frequency estimation (space: O(1/epsilon), error: O(epsilon*N)), heavy hitters algorithm, time-decay (exponential moving average with lambda). Real: Twitter Trending — Zipf's law means top 1% of topics get 50% of traffic.
- `web-analytics.md` — Google Analytics at scale. Deep dive: event ingestion (Kafka + Avro), session stitching (cookie + fingerprint), pre-aggregation (hourly rollups vs on-the-fly). Real: Amplitude — 10T events/month, ClickHouse as query engine.
- `log-collection.md` — Centralized logging at 1M events/sec. Deep dive: log agent (Fluentd vs Filebeat), buffer + retry (disk-backed buffer), hot/warm/cold tiering (SSD → HDD → S3). Real: Datadog's log pipeline — 15 petabytes ingested/day.
- `real-time-stock-trading.md` — Order matching engine at microsecond latency. Deep dive: LMAX Disruptor ring buffer (lock-free, 6M transactions/sec), mechanical sympathy (CPU cache line = 64 bytes), market data feed (multicast UDP). Real: NYSE's SFTI network — 10 microsecond matching latency.
- Remaining 18 — follow template.

#### Batch 7 — Agent P1-7: Security + Storage + Search (22 problems)
Files in `07-security/`, `06-storage-files/`, `08-search-discovery/`:

**Security (9 files):**
- `payment-gateway.md` — PCI-DSS compliant payment processing. Deep dive: tokenization (Braintree Vault replaces PAN with token), 3DS2 authentication flow, fraud detection (ML + velocity rules). Real: Stripe — $640B processed/year, how Stripe Radar works.
- `digital-wallet.md` — Double-spend prevention at scale. Deep dive: ledger architecture (double-entry bookkeeping — every debit has a credit), idempotency keys for payment retries, strong consistency requirement. Real: PayPal's ledger migration — from Oracle to distributed DB.
- `identity-management.md` — OAuth2 + OIDC at 15k req/s. Deep dive: token introspection vs local JWT validation (introspection = fresh but slow, JWT = fast but stale), federated identity (SAML for enterprise), session invalidation. Real: Okta's architecture — 15k requests/sec auth.
- `blockchain.md` — Distributed ledger internals. Deep dive: Merkle tree proofs (O(log N) membership proof), Nakamoto consensus (PoW: 10min block time), smart contract execution (EVM: deterministic). Real: Bitcoin's UTXO model vs Ethereum's account model — why the difference matters.
- Remaining 5 security files — follow template.

**Storage (3 files):**
- `dropbox.md` — File sync at 500M users. Deep dive: block deduplication (content-addressable storage, SHA-256 hash), delta sync (only changed blocks), conflict resolution (last-write-wins for most files, copy-both for conflict). Real: Dropbox's Magic Pocket — storing 500 petabytes in-house after leaving S3.
- `collaborative-spreadsheet.md` — Google Sheets-style. Deep dive: dependency graph (cells as DAG, topological sort for recalculation), real-time collaboration (OT for cell-level), formula parsing. Real: Google Sheets' 10M cell limit — why it exists (memory + recalculation time).
- `file-sharing.md` — Secure file sharing. Deep dive: presigned URLs (S3 presigned, 1-hour expiry), virus scanning pipeline (ClamAV + ML scanner), permission model. Real: Dropbox Paper's sharing model.

**Search (9 files):**
- `google-search.md` — Web search at 8.5B queries/day. Deep dive: inverted index (TF-IDF evolved to BM25 then neural embeddings), index serving (sharding by doc ID across 1M+ machines), ranking pipeline (200+ signals). Real: Google's original PageRank paper + BERT integration for 10% of queries.
- `typeahead-suggestion.md` — Autocomplete at < 500ms. Deep dive: trie vs inverted index for prefix search (trie wins for prefix, inverted wins for mid-word), personalized ranking (CTR-weighted), cache warming (precompute top 1000 prefixes). Real: Google Suggest — prefix tree with 500M+ terms, rebuilt daily.
- `twitter-search.md` — Real-time tweet search with < 1s freshness. Deep dive: Earlybird (real-time inverted index, tweets indexed in < 15s), relevance ranking (Blender model), timeline caching. Real: Twitter's Earlybird architecture — why Lucene wasn't fast enough.
- Remaining 6 search files — follow template.

#### Batch 8 — Agent P1-8: AI Systems (17 problems)
Files in `16-system-design-problems/09-ai-agents/`:

- `rag-qa-agent.md` — RAG Q&A at scale. Deep dive: chunking strategy (semantic chunking vs fixed-size — 512 tokens standard), embedding model selection (MTEB benchmark), vector store choice (HNSW: O(log N) ANN, FAISS: batch, Pinecone: managed), context window management (reranking to fit 8k tokens). Real: Notion AI's RAG pipeline — 100M+ documents, hybrid dense + sparse retrieval.
- `multi-agent-orchestration.md` — LangGraph/AutoGen patterns. Deep dive: agent state machine (nodes = agents, edges = tool results), tool registry (OpenAPI-described tools), parallel agent execution (task graph), error recovery (retry with different agent). Real: Microsoft Copilot's orchestration layer — multi-step reasoning.
- `code-generation-agent.md` — Copilot-style system. Deep dive: fill-in-the-middle training (prefix + suffix → middle), repo-level context (retrieval from codebase), streaming token generation (SSE), rejection sampling. Real: GitHub Copilot — 1.8M paid users, 46% of code written by AI in some repos.
- `content-moderation-agent.md` — Real-time moderation at 10B posts/day. Deep dive: classifier cascade (cheap text classifier → expensive vision model → human review), human-in-the-loop for edge cases, appeal handling queue. Real: Meta's content moderation pipeline — 99% of violating content removed before reported.
- `customer-support-agent.md` — Tier-1 automation. Deep dive: intent classification (BERT fine-tuned), knowledge base retrieval (hybrid BM25 + semantic), escalation logic (confidence threshold), conversation state (Redis TTL). Real: Intercom's Fin AI — 45% of tickets resolved without human.
- `medical-triage-agent.md` — Clinical decision support. Deep dive: safety guardrails (hallucination detection via self-consistency), regulatory (FDA SaMD class II), uncertainty quantification (predict + confidence interval). Real: Epic's Cognitive Computing — integrated into 250M patient records.
- Remaining 11 — same template, emphasize: what problem AI solves, why non-AI failed, production risks (hallucination rate, latency budget, cost per query).

#### Batch 9 — Agent P1-9: Object-Oriented Design (23 problems)
Files in `16-system-design-problems/10-object-oriented-design/`:

Each OOD article must include:
- Class diagram (Mermaid `classDiagram`)
- Design patterns used (name them: Strategy, Observer, Factory, Command, State, etc.)
- SOLID principles applied (name the specific principle)
- Concurrency considerations (thread safety, locks, atomic operations)
- Extension points (how to add features without breaking existing code — Open/Closed Principle)
- Interview angle: what design principle the interviewer is testing, what makes candidates fail

Priority files:
- `parking-lot.md` — Classic. Strategy for pricing (flat, hourly, daily). Observer for slot availability events. Singleton for lot registry. Real: ParkWhiz backend pattern.
- `elevator-system.md` — Scheduling algorithm (SCAN/LOOK vs SSTF). State machine (Idle, Moving, DoorsOpen). Observer for floor requests. Real: ThyssenKrupp MULTI system — rope-free, multiple cabs per shaft.
- `chess-game.md` — Command pattern for moves (enables undo/redo). Visitor for legal move validation. Iterator for move generation. Real: chess.com's engine interface — Stockfish integration via UCI protocol.
- `atm-system.md` — State machine (NoCard → CardInserted → PINEntered → Selecting → Dispensing). Decorator for transaction logging. Strategy for card validation. Real: Diebold's XFS middleware standard.
- `library-management.md` — Observer for due date notifications. Strategy for fine calculation. Iterator for catalog search. Real: BiblioCommons SaaS — used by 400+ public libraries.
- `vending-machine.md` — State pattern (Idle, HasMoney, Dispensing, OutOfStock). Strategy for payment methods (cash, card, mobile). Real: Crane Merchandising Systems — 5M machines globally.
- Remaining 17 — follow OOD template.

#### Batch 10 — Agent P1-10: Problems at Scale (32 problems)
Files in `problems-at-scale/` (all 7 categories):

Each article must follow this failure-cascade-mitigation structure:
- **Trigger** — exact conditions (traffic level, config change, dependency failure)
- **Cascade timeline** — what breaks at T+0, T+30s, T+2min, T+10min
- **Detection** — which alert fires first, what metric to watch
- **Mitigation** — 3 strategies, each with trade-off
- **Prevention** — architectural change that makes this impossible or rare
- **Mermaid sequence diagram** — showing the failure cascade timeline

Priority files:

**Availability (5 files):**
- `thundering-herd.md` — 10k app servers wake up simultaneously after cache cold start. Every server misses the cache and queries DB at the same time. DB can handle 1000 QPS, receives 50k. Fix: cache-aside with jitter (Math.random() * TTL * 0.1), probabilistic early expiration, request coalescing (singleflight pattern).
- `cascading-failures.md` — Service A times out calling B which is waiting on C. Thread pools fill with waiting requests. Memory pressure. OOM kill. Fix: bulkhead isolation (separate thread pool per dependency), circuit breaker (open after 5 failures in 10s), graceful degradation (serve stale data).
- `retry-storm.md` — Network hiccup causes 5% of requests to fail. All clients retry. Traffic doubles. Service falls over. Now 100% of requests retry. Fix: exponential backoff (1s, 2s, 4s, 8s) with jitter, circuit breaker, client-side rate-limit retries.
- `split-brain.md` — Network partition between two data centers. Both believe they're the primary. Both accept writes. Divergence. Fix: Raft leader election (only one leader), fencing tokens (monotonic lease numbers), STONITH (shoot-the-other-node-in-the-head).
- `timeout-domino-effect.md` — Slow DB query (P99 = 30s). Service sets 5s timeout. Upstream service sets 3s. API gateway sets 2s. User sees failure in 2s. DB thread is held for 30s regardless. Fix: consistent timeout budget (2s total, not per-hop), async processing for slow operations.

**Concurrency (6 files):**
- `double-booking.md` — Two users book the last seat at the same millisecond. Both read qty=1, both decrement to 0. Both succeed. Oversold. Fix: SELECT FOR UPDATE (pessimistic), UPDATE SET qty=qty-1 WHERE qty>0 (optimistic + atomic), Redis DECRBY + check.
- `race-condition-inventory.md` — Flash sale: 1000 items, 100k buyers. Without locking: all 100k read stock>0, all decrement. -99000 stock. Fix: Redis DECRBY atomic, DB atomic decrement with WHERE clause, pre-issued tokens approach.
- `double-charge-payment.md` — Network timeout on payment API. Client retries. Payment processed twice. Fix: idempotency key (hash of request params), check-and-insert in DB (INSERT IF NOT EXISTS), saga compensation (refund on detect).
- `counter-race.md` — 10 app servers increment a counter concurrently. INCR in Redis is atomic — safe. But if using DB: read-modify-write loses updates. Fix: Redis INCR, PostgreSQL UPDATE SET count=count+1, G-Counter CRDT for distributed.
- `duplicate-orders.md` — Network retry creates two identical orders. Fix: idempotency key in request header, deduplication window (24h), check order hash before processing.
- `orphaned-records.md` — Payment succeeds but order record fails to save (DB down). Customer charged, no order. Fix: DB transaction wrapping both, saga with payment compensation, outbox pattern (write order + payment event in one transaction).

**Consistency, Performance, Scalability, Cost Optimization, Data Integrity** — follow same template.

**Data Integrity (NEW — currently empty):**
- `data-drift.md` — Primary and replica diverge silently after a crash. 0.01% of rows differ. Detection: Percona pt-table-checksum. Fix: automated checksums on replication pipeline. Real: GitHub's MySQL replication drift 2018.
- `silent-data-corruption.md` — Bit flip in DRAM or disk without detection. Facebook found 1 in 1,000 disks/year has corruption. Fix: ZFS checksums on every block, application-level hash verification, ECC RAM. Real: Facebook's f4 Warm Storage — checksums on every block read.

---

## Phase 2 — Missing Critical Content
**Duration:** 1 week | **Parallel agents:** 10

### Agent C1: WebRTC / STUN / TURN (NEW — currently missing)
**File:** `docs-site/content/07-api-design/concepts/webrtc-stun-turn.md`

Article must cover:
- **Level 1 Surface:** What WebRTC is, when to use it vs WebSocket (WebRTC: P2P media, WebSocket: server-mediated data), 3-line browser API
- **Level 2 Deep dive:**
  - ICE candidate gathering: STUN discovers public IP+port, TURN relays when NAT blocks direct connection
  - Signaling server role: SDP offer/answer exchange via your WebSocket — WebRTC doesn't specify signaling
  - SFU vs MCU topology for group calls: SFU = each client sends 1 stream, receives N-1 (CPU on client, bandwidth O(N)); MCU = server mixes (CPU on server, bandwidth O(1))
  - Adaptive bitrate: REMB (receiver reports bandwidth estimate), TWCC (transport-wide congestion control)
  - Real: Zoom's migration from P2P to SFU for groups of > 3 (CPU on mobile phones was too high P2P)
  - Real: Discord — 1M concurrent voice users, Selective Forwarding Unit, Opus codec at 32kbps
  - Mermaid: ICE connection establishment flow (STUN probe → TURN fallback)
  - Numbers: STUN round-trip < 100ms, TURN relay adds 50-200ms, SFU saves 70% bandwidth vs full mesh, TURN needed in ~15% of cases
- **Update:** `07-api-design/STATUS.md`, add entry to `cheat-sheets/networking.md`

### Agent C2: Incident Management Deep Dive (NEW)
**File:** `docs-site/content/09-observability/concepts/incident-management-postmortem.md`

Article must cover:
- **Level 1 Surface:** SEV1/2/3/4 classification table, 5-minute detection rule, single incident commander role
- **Level 2 Deep dive:**
  - Incident lifecycle: Detection (alert fires) → Triage (severity + owner) → Mitigation (stop the bleeding, not the root cause) → Resolution (permanent fix) → Post-mortem (learning)
  - On-call runbook structure: each runbook = alert name + P90 cause + immediate steps + escalation path (name + Slack + phone)
  - Blameless post-mortem template: timeline (5-minute intervals), 5-why contributing factors, action items with DRIs and due dates
  - SLO burn rate alerts: fast burn = 2% of monthly budget in 1h (page immediately), slow burn = 5% in 6h (ticket)
  - MTTR reduction: feature flags for instant rollback, canary deployment to limit blast radius, pre-built runbooks
  - Real: Google's 5-phase incident management (SRE Book Chapter 14) — who owns incident vs who fixes
  - Real: AWS us-east-1 2021 outage post-mortem — internal dependency on kinesis created cascade
  - Real: Cloudflare's BGP leak 2019 — full recovery in 20 minutes, why they recovered fast
  - Mermaid: incident escalation flow + on-call rotation model
  - Numbers: MTTD target < 5 minutes (alert latency), MTTR target < 30 minutes (P1), post-mortem within 48 hours, blameless = 40% faster recovery (Google SRE data)
- **Update:** `09-observability/STATUS.md`

### Agent C3: Technical Program Manager Interview Guide (NEW)
**File:** `docs-site/content/12-interview-prep/roles/technical-program-manager.md`
**Also update:** `docs-site/content/12-interview-prep/roles/_meta.js` to add tpm entry

Guide must cover:
- **TPM vs PM vs EM:** TPM owns the technical program (cross-team, multi-quarter), PM owns the product, EM owns the team
- **Round 1 — Technical Depth:** System design at TPM level — you drive architecture discussion without coding. Sample: "Design a cross-team data migration program for 50TB, 15 teams, 6 months"
- **Round 2 — Program Management:** How do you coordinate 5 engineering teams on a 6-month project? RACI matrix, critical path method, risk register with probability x impact
- **Round 3 — Ambiguity and Estimation:** "Estimate how many engineers Google needs for Search" — top-down (Google revenue / engineer cost) vs bottom-up (features / effort)
- **Round 4 — Behavioral:** Conflict between two senior engineers on architecture choice. Deadline missed by one team impacting the whole program. Exec escalation when teams can't agree.
- **Company-specific TPM loops:** Google (gTech), Amazon (TPM L5/L6), Microsoft (PM II → Senior PM path), Meta (TPN role)
- **10 most common TPM interview questions with model answers**
- **Scoring rubric:** What "strong hire" vs "no hire" looks like for each round type

### Agent C4: Mobile Architecture Cheat Sheet (EXPAND — currently 53 lines)
**File:** `docs-site/content/cheat-sheets/mobile.md`

Expand from 53 to 500+ lines:
- **iOS vs Android architecture comparison table** (UIKit vs Jetpack Compose, CoreData vs Room, GCD vs Coroutines, URLSession vs OkHttp)
- **Offline-first patterns:** SQLite sync, conflict resolution strategies (last-write-wins, merge, user-prompt), optimistic UI updates
- **Push notification delivery:** APNs (iOS) vs FCM (Android), token management, delivery guarantees (best-effort, no ordering), silent push for background sync
- **App performance numbers:** Cold start targets < 2s (iOS), < 3s (Android); frame budget 16ms at 60fps, 8ms at 120fps; memory limit 200MB before jetsam kill (iOS)
- **Battery optimization:** Background App Refresh (iOS), Doze mode + App Standby (Android), WorkManager for deferred work, avoid wake locks
- **Security:** iOS Secure Enclave (biometric keys never leave chip), Android Keystore (hardware-backed on API 23+), certificate pinning (HPKP deprecated, use TrustKit or OkHttp CertificatePinner)
- **Mobile-specific system design patterns:** pagination (cursor-based > offset for mobile), delta sync (sync only changed records since last timestamp), request batching (group N API calls into 1)
- **Interview questions for mobile architects:** 10 most common with brief answers (offline-first design, push notification deduplication, image loading at scale, reducing app size, handling weak network)

### Agent C5: Data Integrity Problems (NEW files)
**Files:**
- `docs-site/content/problems-at-scale/data-integrity/data-drift.md`
- `docs-site/content/problems-at-scale/data-integrity/silent-data-corruption.md`

Follow the failure-cascade-mitigation template from Phase 1 Batch 10.

**data-drift.md:** Primary and replica diverge after write surge + partial crash. 0.01% rows differ. Triggers: skipped replication event, clock skew, crash during log apply. Detection: pt-table-checksum (CRC32 per chunk), dual-read verification for critical data. Fix: automated daily checksums, reconciliation jobs comparing row hashes. Real: GitHub MySQL replication drift 2018 incident.

**silent-data-corruption.md:** Bit flip in DRAM/disk. 1 in 1,000 drives/year has detectable corruption (Facebook study). No error thrown — data silently wrong. Detection: ZFS end-to-end checksums, application-level SHA-256 on read, ECC RAM. Fix: storage layer checksums, verify-on-read, scrubbing. Real: Facebook's f4 Warm Storage design — checksums on every block read + scrubbing every 14 days.

### Agent C6: Capacity Planning and Forecasting (NEW)
**File:** `docs-site/content/06-scalability/concepts/capacity-planning-forecasting.md`

Article must cover:
- **Level 1 Surface:** What capacity planning prevents (the 3am outage nobody expected), when to do it (before launch, quarterly, post-incident), the 3x rule of thumb
- **Level 2 Deep dive:**
  - Traffic forecasting: linear extrapolation (simple, works for 3 months), seasonal decomposition (STL for known patterns like day-of-week), ML-based (Meta's Prophet for complex seasonality)
  - Resource models: CPU headroom (target 70% peak utilization, scale at 80%), memory headroom (keep 30% free for GC spikes), storage growth (project 12 months, provision 18)
  - Load testing methodology: define success criteria first (P99 < 100ms at 10k RPS), ramp-up pattern (gradual, not instant), realistic data distribution (Zipf law for hot keys)
  - Cost modeling: $/RPS for different instance types, reserved vs on-demand break-even (> 6 months = reserved wins), spot instance for stateless batch
  - Real: Twitter's Super Bowl capacity planning — 10x normal spike, 15-minute window, pre-scale 1h before kickoff
  - Real: Netflix's Stranger Things Season 5 launch — pre-scaled 36h before release, CDN pre-warmed, chaos tests 2 weeks prior
  - Mermaid: capacity review cadence (weekly ops review → monthly capacity review → quarterly planning)
  - Numbers: 3x headroom on peak for services without autoscaling, 20% monthly growth rate for high-growth products requires doubling every 3-4 months, load test at 2x expected peak

### Agent C7: Platform Engineering and Internal Developer Platform (NEW)
**File:** `docs-site/content/10-architecture/concepts/platform-engineering.md`

Article must cover:
- **Level 1 Surface:** What an IDP is, when you need one (> 50 engineers, > 5 different tech stacks, onboarding takes weeks), the golden path concept
- **Level 2 Deep dive:**
  - Core IDP components: service catalog (Backstage), golden path templates (opinionated starter repos), CI/CD as a service (self-service pipelines), environment provisioning (Terraform modules)
  - Build vs Buy: Backstage (open-source, flexible but complex) vs Port (managed, opinionated) vs Cortex (metadata + scorecards) — trade-off table
  - DORA metrics: deployment frequency (elite: multiple/day, low: monthly), lead time (elite: < 1h, low: > 6 months), MTTR (elite: < 1h), change failure rate (elite: 0-15%)
  - Platform team as product team: internal users = developers, measure by developer satisfaction and DORA improvement
  - Real: Spotify's Backstage origin story — 200 engineers, 80 tech stacks, onboarding 2 weeks → 1 hour, now used by 3000+ companies
  - Real: Netflix's Paved Road — opinionated stack (Java + Gradle + Spinnaker), 90% of teams use it, 10% escape hatch allowed
  - Numbers: IDP adoption correlates with 25% faster onboarding, 40% toil reduction (Google DORA report)

### Agent C8: Multi-Tenancy Architecture Patterns (NEW)
**File:** `docs-site/content/10-architecture/concepts/multi-tenancy-patterns.md`

Article must cover:
- **Level 1 Surface:** 3 multi-tenancy models and when to pick each
- **Level 2 Deep dive:**
  - 3 models with trade-off table: Database-per-tenant (max isolation, max cost), Schema-per-tenant (balance, moderate ops overhead), Shared schema with tenant_id column (max efficiency, min isolation)
  - Row-level security: PostgreSQL RLS policies (CREATE POLICY tenant_isolation ON orders USING (tenant_id = current_setting('app.tenant_id'))), performance impact (adds WHERE clause, still uses indexes), bypass risks (SET SESSION requires superuser — use connection pooler to enforce)
  - Noisy neighbor problem: CPU/IO quotas per tenant, connection limits, rate limiting at API gateway by tenant_id
  - Scaling per model: shared schema starts breaking at > 10k tenants (index bloat), migration path to schema-per-tenant
  - Real: Salesforce's "Trust" architecture — shared Oracle DB, tenant ID on every row, 150k+ orgs, multi-tenant since 1999
  - Real: Shopify's pod architecture — tenant groups in pods, no cross-pod queries, pods deployed to separate regions for compliance
  - Numbers: Shopify handles $5M/minute on Black Friday, 1.7M merchants, 99.99% uptime SLA

### Agent C9: Serverless Architecture at Scale (NEW/EXPAND)
**File:** `docs-site/content/10-architecture/concepts/serverless-at-scale.md`

Article must cover:
- **Level 1 Surface:** What serverless is, when it wins (spiky traffic, ops-light teams, event-driven), when it loses (steady high traffic, long-running processes)
- **Level 2 Deep dive:**
  - Cold start problem: JVM Lambda = 3-10s, Node.js = 200ms, Go = 50ms, Python = 300ms. Mitigations: provisioned concurrency (warm pool, costs money), Lambda SnapStart for JVM (restore from snapshot, 90% reduction), keep-alive pings (hack, frowned upon)
  - Concurrency limits: AWS Lambda default 1000 concurrent per region, burst limit 3000/min — design around it (SQS queue + Lambda: SQS buffers, Lambda pulls at its rate)
  - State management: Lambda is stateless by design → DynamoDB for persistent state, ElastiCache for session, Step Functions for long-running workflows (max 1 year)
  - Event-driven patterns: Lambda as SQS consumer (batch size tuning: 10 messages/invocation), Kinesis (shard iterator, sequence numbers), SNS (fan-out to multiple Lambdas)
  - Cost model: Lambda $0.0000166/GB-second + $0.20/1M requests vs EC2 t3.medium $0.042/hour — break-even at ~30% utilization (Lambda wins below, EC2 wins above)
  - Real: Coca-Cola's vending machine network on Lambda — 2.5M+ machines, $1M savings vs EC2
  - Real: BBC Online election night 2019 — peak 50k req/s, zero pre-provisioned capacity, £0 idle cost
  - Numbers: Lambda max 15min execution, max 10GB memory, max 6MB sync payload / 256KB async, 1000 default concurrent, 29s API Gateway timeout (design around it)

### Agent C10: Update _meta.js Files for New Content
After all Phase 2 content agents complete, update these navigation files:
- `07-api-design/concepts/_meta.js` — add `webrtc-stun-turn` entry
- `09-observability/concepts/_meta.js` — add `incident-management-postmortem` entry
- `12-interview-prep/roles/_meta.js` — add `technical-program-manager` entry
- `06-scalability/concepts/_meta.js` — add `capacity-planning-forecasting` entry
- `10-architecture/concepts/_meta.js` — add `platform-engineering`, `multi-tenancy-patterns`, `serverless-at-scale` entries
- `problems-at-scale/data-integrity/_meta.js` — add `data-drift`, `silent-data-corruption` entries
- `cheat-sheets/_meta.js` — verify mobile entry exists

---

## Phase 3 — Runnable POC Labs
**Duration:** 2–3 weeks | **Parallel agents:** 10

**Problem:** The "hands-on" articles describe code but aren't standalone runnable labs. Engineers learn by doing, not reading.

**Every POC must include:**
- docker-compose.yml (working, tested)
- Application code (complete, not pseudo-code)
- Step-by-step commands with expected output
- What to observe (which metric/log proves it's working)
- What breaks it (how to trigger the failure mode)
- How to extend it (3 next-step suggestions)

### Batch Assignments

#### Agent POC-1: Redis Advanced (10 POCs)
Create in `docs-site/content/03-redis/hands-on/`:

1. `redis-distributed-lock-poc.md` — Implement Redlock with 3 Redis nodes. Show GC pause creating unsafe window. Fix with fencing tokens. Commands: `SET resource:lock token NX PX 30000`
2. `redis-rate-limiter-poc.md` — Sliding window using ZADD + ZRANGEBYSCORE. Demonstrate 100 req/min throttle. Show burst vs sustained.
3. `redis-pubsub-vs-streams-poc.md` — Same use case implemented with Pub/Sub (fire-and-forget) then Streams (persistent, consumer groups). Show delivery guarantee difference.
4. `redis-streams-consumer-group-poc.md` — Kafka-like queue on Redis Streams. XADD producer, XREADGROUP consumers, XACK on process. Show XPENDING for failed messages.
5. `redis-leaderboard-1m-poc.md` — ZADD 1M entries, ZRANK, ZRANGE with WITHSCORES. Benchmark performance. Show why sorted set beats SQL for this.
6. `redis-lua-atomic-inventory-poc.md` — Atomic inventory decrement. First show race condition in 3 Node.js processes without Lua. Then fix with Lua script (EVAL). Measure difference.
7. `redis-bloom-filter-poc.md` — RedisBloom BF.ADD + BF.EXISTS. Show false positive rate at 1%, 0.1%. Compare space vs hash set.
8. `redis-geosearch-poc.md` — GEOADD 10k locations, GEOSEARCH by radius. Build a driver-location index. Show GEORADIUS performance vs PostGIS.
9. `redis-sentinel-failover-poc.md` — docker-compose: 1 master, 2 replicas, 3 sentinels. Kill master container. Watch election in sentinel logs. Reconnect client.
10. `redis-cluster-poc.md` — 3-master 3-replica cluster. Show MOVED redirection. Add a 4th shard mid-run. Show slot rebalancing.

#### Agent POC-2: Kafka End-to-End (8 POCs)
Create in `docs-site/content/04-messaging/hands-on/`:

1. `kafka-producer-consumer-poc.md` — Java/Python producer, 3-partition topic, 2-consumer group. Show partition assignment. Increase consumers to 4 — one goes idle.
2. `kafka-exactly-once-poc.md` — Idempotent producer (enable.idempotence=true) + transactional API. Show duplicate message without, then zero duplicates with.
3. `kafka-consumer-lag-poc.md` — Slow consumer (Thread.sleep). Watch lag grow in consumer group metrics. Fix: add partitions + consumers. Show rebalance.
4. `kafka-streams-windowed-count-poc.md` — Word count with 30-second tumbling windows. Show stateful store (RocksDB). Observe state restoration after restart.
5. `kafka-connect-cdc-poc.md` — Debezium Connector: PostgreSQL → Kafka. Insert/Update/Delete rows. See before/after events in Kafka topic.
6. `kafka-schema-registry-poc.md` — Avro schemas with Confluent Schema Registry. Produce with schema v1. Add optional field (backward compatible). Try to remove required field (fails). Show evolution rules.
7. `kafka-compaction-poc.md` — Compacted topic for user profile state. Produce 100 updates to same key. Trigger compaction. Show only latest value retained.
8. `kafka-mirroring-poc.md` — MirrorMaker2 between two Kafka clusters. Show replication lag. Simulate source cluster failure. Failover consumers to mirror.

#### Agent POC-3: Database Internals (8 POCs)
Create in `docs-site/content/01-databases/hands-on/`:

1. `btree-vs-hash-index-poc.md` — Create both index types on same column. Run equality query (hash wins), range query (btree wins), EXPLAIN ANALYZE proof of both.
2. `mvcc-transaction-isolation-poc.md` — 4 scenarios: dirty read, non-repeatable read, phantom read, serialization anomaly. Show which isolation level prevents each. Use sleep to make race visible.
3. `connection-pool-sizing-poc.md` — PgBouncer: test at pool size 5, 20, 50, 100 with 500 concurrent connections. Show throughput and latency graph. Show the knee of the curve.
4. `wal-and-replication-poc.md` — PostgreSQL primary + 1 streaming replica. Run write load. Show replication lag metric (pg_stat_replication). Observe WAL segment files.
5. `partial-index-poc.md` — 10M rows. Full index vs partial index (WHERE status='active' covers 5% of rows). Show index size difference (20x). Show query performance on filtered queries.
6. `deadlock-creation-and-fix-poc.md` — Two transactions, each holding a lock the other needs. Observe PostgreSQL deadlock detection log. Fix: consistent lock ordering.
7. `query-explain-workshop-poc.md` — 5 progressive queries. Start with sequential scan. Add index. Add covering index. Add partial index. Add composite. EXPLAIN ANALYZE each. Show cost reduction at each step.
8. `row-level-security-multi-tenant-poc.md` — PostgreSQL RLS. 3 tenants, shared table. Show tenant A's queries only see their rows. Benchmark RLS overhead vs application-level filtering.

#### Agent POC-4: Distributed Systems Patterns (8 POCs)
Create in `docs-site/content/05-distributed-systems/poc/`:

1. `raft-election-poc.md` — 3-node Raft cluster (Python/Go implementation). Kill leader. Watch election. Show split vote (even number of nodes). Show log replication.
2. `two-phase-commit-poc.md` — 2PC across 2 Node.js services. Simulate coordinator crash after phase 1. Show blocking problem. Show recovery with timeout + compensate.
3. `saga-choreography-poc.md` — Order → Payment → Inventory saga via Kafka events. Simulate payment failure at step 2. Watch compensation events flow backwards. Verify final state consistent.
4. `outbox-pattern-poc.md` — PostgreSQL outbox table. Insert order + outbox event atomically. Debezium reads CDC event. Publishes to Kafka. Show: no event lost even if Kafka is down during write.
5. `consistent-hashing-simulation-poc.md` — Python: 3 nodes, add 1 node, remove 1 node. Show percentage of keys that move (target: 1/N per node change). Compare with modulo hashing (50% move).
6. `leader-election-zookeeper-poc.md` — ZooKeeper ephemeral sequential nodes. 3 services compete. Show leader election. Kill leader process. Watch re-election in < 10s.
7. `crdt-g-counter-poc.md` — G-Counter implementation. 3 nodes increment independently (no coordination). Merge via max(). Show convergence. Compare with centralized counter (single point of failure).
8. `gossip-protocol-simulation-poc.md` — Python simulation: 20 nodes, each gossips to 3 peers per round. New node joins — time to propagate membership to all nodes. Show O(log N) convergence.

#### Agent POC-5: Observability Stack (6 POCs)
Create in `docs-site/content/09-observability/hands-on/`:

1. `otel-full-stack-poc.md` — Node.js app + OTel SDK + Jaeger (traces) + Prometheus (metrics) + Loki (logs) + Grafana. Single docker-compose. Show full trace-to-metric-to-log correlation.
2. `slo-error-budget-poc.md` — Prometheus recording rules for SLO. Grafana dashboard: current burn rate, error budget remaining, 7-day trend. Alert fires at 2x burn rate.
3. `custom-spans-poc.md` — Add manual spans to Node.js → Redis → PostgreSQL app. Annotate with business context (user_id, order_id). Show trace waterfall with 8 spans.
4. `alertmanager-routing-poc.md` — AlertManager config: P1 → PagerDuty webhook, P2 → Slack, P3 → email. Trigger each severity. Verify routing. Show silencing and inhibition rules.
5. `cardinality-explosion-poc.md` — Add high-cardinality label (user_id on HTTP metrics). Watch Prometheus memory grow. Show recording rules to aggregate. Before/after memory comparison.
6. `synthetic-monitoring-poc.md` — Playwright test runs every 60s against staging. Tests: login flow, add-to-cart, checkout. AlertManager fires if test fails 2 consecutive times. Show in Grafana.

#### Agent POC-6: Security Patterns (6 POCs)
Create in `docs-site/content/08-security/hands-on/`:

1. `jwt-access-refresh-rotation-poc.md` — Access token 15min, refresh token 7 days, stored in Redis with jti. Implement rotation (new refresh on each use). Show token revocation via Redis DEL.
2. `mtls-two-services-poc.md` — cfssl generates CA + service certs. Service A calls Service B. Show mTLS handshake in Wireshark/tcpdump. Show failure when cert is expired.
3. `rbac-postgres-poc.md` — 3 roles (admin/editor/viewer). PostgreSQL RLS + application middleware. Show access matrix enforcement. Show what happens when middleware is bypassed (RLS catches it).
4. `vault-dynamic-secrets-poc.md` — HashiCorp Vault database secrets engine. Generate PostgreSQL creds on demand (TTL: 1h). Show auto-revocation. Show app using rotated credentials without restart.
5. `nginx-rate-limiting-ddos-poc.md` — Locust generates 5k req/s attack. Nginx limit_req_zone stops it at 100 req/s. Show access log pattern. Show burst allowance (burst=50 nodelay).
6. `zero-trust-jwt-chain-poc.md` — Service A generates short-lived JWT (5min). Service B validates without calling A. Show chain of trust. Show replay attack prevention (jti in Redis).

#### Agent POC-7: Scalability Patterns (6 POCs)
Create in `docs-site/content/06-scalability/hands-on/`:

1. `horizontal-scaling-live-poc.md` — docker-compose scale web=5. HAProxy distributes load (round-robin). While running: docker-compose scale web=8. Show zero-downtime scale-out.
2. `backpressure-bounded-queue-poc.md` — Producer 1000 msg/s, consumer 100 msg/s. Unbounded queue: OOM in 30s. Bounded queue (capacity=500): producer blocks. Fix: producer reads queue depth, slows down.
3. `circuit-breaker-opossum-poc.md` — Node.js service using opossum. Dependency returns 500. After 5 failures in 10s: circuit OPEN (fast-fail). After 30s: HALF-OPEN (probe). On success: CLOSED.
4. `nginx-rate-limit-algorithms-poc.md` — Implement token bucket vs leaky bucket vs fixed window in Nginx + Lua. Show difference: token bucket allows burst, leaky bucket smooths, fixed window allows 2x burst at boundary.
5. `graceful-degradation-feature-flag-poc.md` — LaunchDarkly/custom flag: turn off recommendation engine under CPU pressure. Show site stays up with "Top Sellers" fallback. Measure latency reduction.
6. `autoscaling-simulation-poc.md` — Simulate Kubernetes HPA: track CPU metric, threshold = 70%, scale-out delay 60s, scale-in delay 300s. Show oscillation without cooldown. Fix with cooldown.

#### Agent POC-8: API Design Patterns (6 POCs)
Create in `docs-site/content/07-api-design/hands-on/`:

1. `grpc-all-streaming-modes-poc.md` — Node.js gRPC: unary RPC, server streaming (live updates), client streaming (file upload), bidirectional (chat). proto3 definition included.
2. `graphql-federation-poc.md` — 2 subgraph services (users, orders) + Apollo Router. Show federated query joining data across services. Show schema composition. Show @key directive.
3. `websocket-chat-with-rooms-poc.md` — ws library, Redis pub/sub for room fan-out across multiple Node.js instances. Show connection management, heartbeat (ping/pong every 30s), reconnection with exponential backoff.
4. `api-versioning-comparison-poc.md` — Same REST API: URL versioning (/v1/, /v2/) vs header versioning (Accept: application/vnd.api.v2+json). Show client migration. Show deprecation warning header.
5. `idempotency-key-payment-poc.md` — Payment endpoint: X-Idempotency-Key header. Store result in Redis with 24h TTL. Send same request twice. Show same response, single charge. Show race condition handling (Redis SETNX).
6. `openapi-contract-test-poc.md` — OpenAPI spec for user API. Dredd runs contract tests against live server in CI. Break an endpoint (change field name). Watch Dredd catch it. Fix.

#### Agent POC-9: Architecture Patterns (6 POCs)
Create in `docs-site/content/10-architecture/hands-on/`:

1. `event-sourcing-shopping-cart-poc.md` — Shopping cart as append-only event store (PostgreSQL). Events: CartCreated, ItemAdded, ItemRemoved, CartCheckedOut. Replay events to rebuild current state. Show time-travel query.
2. `cqrs-read-write-split-poc.md` — Write model (PostgreSQL, normalized). Kafka event bus. Read model (Elasticsearch, denormalized). Show eventual consistency lag. Show query performance difference.
3. `strangler-fig-migration-poc.md` — Legacy Express monolith + new FastAPI microservice behind Nginx. Feature flag in Redis toggles traffic. Migrate /orders endpoint while /products stays on monolith.
4. `multi-tenant-rls-benchmark-poc.md` — Shared PostgreSQL, 1000 tenants, 1M rows. Measure query performance: no RLS baseline vs RLS with policy vs application-level filtering. Show index usage with RLS.
5. `envoy-sidecar-poc.md` — App container + Envoy sidecar in docker-compose. Envoy handles: mTLS termination, circuit breaking (outlier detection), retry policy, timeout. Show app code has zero knowledge of these.
6. `bulkhead-thread-pool-poc.md` — Critical operations (payments) and non-critical (recommendations) share one service. Without bulkhead: slow recommendations starve payment threads. With Hystrix/Resilience4j bulkhead: separate pools, payments protected.

#### Agent POC-10: Real-World System Reconstructions (5 POCs)
Create in `docs-site/content/11-real-world/`:

1. `netflix-chaos-engineering-poc.md` — Minimal Chaos Monkey: random container kill every 60s. Spring Boot app with graceful shutdown, retry, circuit breaker. Show system stays up. Show which patterns prevent failure.
2. `uber-surge-pricing-simulation-poc.md` — H3 hexagonal grid cells. Driver supply vs rider demand per cell. Python: compute surge multiplier (demand/supply ratio, capped at 5x). Show real-time update as drivers join/leave.
3. `twitter-timeline-fanout-poc.md` — Push model: on tweet, fan out to all follower timeline caches. Pull model: on read, merge followee tweets. Show celebrity problem (10M followers: push = 10M Redis writes). Fix: hybrid (push for < 1M followers, pull for celebrity accounts).
4. `stripe-idempotency-poc.md` — Payment API with X-Idempotency-Key. Postgres: INSERT INTO payments ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING *. Retry 3 times from client. Verify single charge.
5. `discord-online-presence-poc.md` — WebSocket + Redis pub/sub. User connects: publish presence:online. User disconnects: publish presence:offline. 10k simulated users. Show heartbeat protocol (30s ping). Show presence fan-out to friends.

---

## Phase 4 — Interview Preparation Enhancement
**Duration:** 1 week | **Parallel agents:** 10

### Agent I1: Amazon System Design Interview Guide
**File:** `docs-site/content/12-interview-prep/question-bank/company-specific/amazon.md`

Top 15 Amazon system design questions with full architectural answers. For each question:
- Scale assumptions (users, QPS, storage)
- Key architectural decision + why (relates to Amazon's actual system where known)
- Which Leadership Principles to demonstrate during the answer

Questions: shopping cart (DynamoDB, eventual consistency), AWS S3 (erasure coding), order fulfillment (warehouse to delivery), Prime Video (CDN + DRM), Alexa backend (NLU pipeline), fraud detection (real-time ML), AWS Lambda (cold start), review system (spam detection), distributed key-value store (Dynamo paper), flash sale, CloudWatch (metrics + alerting), delivery routing (TSP approximation), Amazon Go (computer vision), AWS IAM (policy evaluation), recommendation engine (collaborative filtering).

LP integration: Bias for Action (make a call, don't hedge), Customer Obsession (measure by customer impact), Dive Deep (know your numbers).

### Agent I2: Google System Design Interview Guide
**File:** `docs-site/content/12-interview-prep/question-bank/company-specific/google.md`

Top 15 Google questions with full answers. Google SWE loop: 5-6 rounds, all include system design. SRE loop adds reliability/SLO question.

Questions: Google Search (indexing + ranking), Google Maps (routing + tile serving), YouTube (upload + transcoding), Google Drive (sync + conflict), Google Photos (object detection + dedup), Gmail (threading + search), Googlebot crawler (1B pages/day), Google logging infrastructure (Flume + BigQuery), Google Meet (WebRTC SFU), Spanner (TrueTime + external consistency), Maglev load balancer, Cloud Bigtable (HBase internals), feature flag system, Google Ads auction (real-time bidding), duplicate event detection (Count-Min Sketch).

SRE variant notes: for each system, what SLOs you would define and how you would monitor them.

### Agent I3: Meta System Design Interview Guide
**File:** `docs-site/content/12-interview-prep/question-bank/company-specific/meta.md`

Top 15 Meta questions. Meta loop unique: Product Sense round + technical rounds. Social graph knowledge expected.

Questions: Facebook News Feed (fanout + ranking + ads), Instagram (photo storage + explore), WhatsApp (E2E encryption + multi-device), Facebook Live (ingestion + distribution), Marketplace (listing + search), notification system, friend suggestion (TAO graph), content moderation (classifier cascade), ad delivery (auction + targeting), Instagram Stories (24h expiry + view count), Messenger group calls (SFU + codec), event system (RSVPs at 1B users), Facebook search (Unicorn social search), Meta data warehouse (Hive + Presto + Scuba), identity system (account recovery + 2FA).

### Agent I4: Netflix + Uber + Stripe Interview Guides
**Files:**
- `docs-site/content/12-interview-prep/question-bank/company-specific/netflix.md` — 10 questions: content delivery, recommendation engine, A/B testing platform, streaming pipeline, chaos engineering architecture, observability stack, video encoding, personalization, licensing system, Content Delivery Network
- `docs-site/content/12-interview-prep/question-bank/company-specific/uber.md` — 10 questions: ride matching, surge pricing, driver location tracking, ETA calculation, payment processing, UberEats delivery, fraud detection, UberPool grouping, maps routing, driver onboarding
- `docs-site/content/12-interview-prep/question-bank/company-specific/stripe.md` — 10 questions: payment processing, fraud detection (Radar), webhook delivery, API idempotency, billing system, Atlas company formation, Connect platform, Sigma analytics, Financial Connections, Terminal

### Agent I5: Staff and Principal Engineer Loop Guide
**File:** `docs-site/content/12-interview-prep/senior-questions/staff-principal-loop.md`

What's different at Staff+: scope (org-wide), ambiguity (you define the problem), influence (cross-team alignment), no right answer.

10 Staff-level system design questions with approach guidance:
1. Design a multi-region active-active database — intentionally hard, test for trade-off awareness
2. Design an Internal Developer Platform for 5000 engineers
3. Design a streaming system for 100 petabytes/day
4. Design a zero-trust security architecture for a 10k-engineer company
5. Design a global CDN from scratch
6. Design a self-healing distributed system
7. Design a 2B-row database migration with zero downtime
8. Design an observability platform for 1000 microservices
9. Design a consensus protocol without using Raft or Paxos
10. Design a cost-optimized multi-cloud architecture

For each: what "good" looks like, what "great" looks like, what makes a principal-level answer different from a senior-level answer.

### Agent I6: Behavioral + System Design Combo
**File:** `docs-site/content/12-interview-prep/question-bank/behavioral-system-design-combo.md`

Many companies (Stripe, Airbnb, Lyft) run hybrid rounds: "Tell me about a complex system you designed" followed by deep-dive into a specific component you mentioned.

Guide covers:
- How to structure your system design story (STAR format with technical depth)
- How to prepare 3 "portfolio systems" from your past experience
- Pivot points: when they redirect to scalability, reliability, trade-offs, or failure modes
- 5 sample combo interview transcripts with analysis (what the interviewer was probing, what the candidate did right/wrong)
- Common follow-up ambushes: "What would you do differently?", "What broke in production?", "How did you handle the incident?", "How would you scale this 10x?"

### Agent I7: Numbers Every Engineer Must Memorize
**File:** `docs-site/content/12-interview-prep/quick-reference/numbers-to-memorize.md`

A dense, scannable reference of every number interviewers test for:
- Latency hierarchy (L1 cache to cross-region network)
- Storage units and real-world sizes
- Throughput limits per system (PostgreSQL, Redis, Kafka, S3)
- Scale numbers (Twitter tweets/day, Netflix bandwidth %, Google searches/day)
- Availability math (99.9% = 8.7h/year, 99.99% = 52min, 99.999% = 5min)
- Encoding overhead (base64 = +33%, gzip = -70-90% on text)
- Cloud pricing rules of thumb (Lambda vs EC2 break-even, S3 vs RDS cost model)
- Back-of-envelope formulas (storage estimation, bandwidth calculation, QPS from DAU)

### Agent I8: Coding to System Design Bridge
**File:** `docs-site/content/12-interview-prep/question-bank/coding-system-design-bridge.md`

Many candidates fail the transition from LeetCode to system design. This guide bridges them:

10 LeetCode patterns mapped to system design equivalents:
1. LRU Cache (146) → Design a distributed cache
2. Top K Frequent Elements (347) → Design real-time trending topics
3. Design Twitter (355) → Design Twitter at 100M users
4. Word Search (79) → Design Google Search autocomplete
5. Sliding Window Maximum (239) → Design real-time rate limiter
6. Find Median from Data Stream (295) → Design percentile metrics dashboard
7. Time Based Key-Value Store (981) → Design a distributed key-value store with versioning
8. Design Hit Counter (362) → Design API analytics at scale
9. Serialize and Deserialize Binary Tree (297) → Design a distributed job scheduler
10. Range Sum Query (303) → Design a real-time analytics system

For each: show how the O(n) insight at coding level becomes an architectural pattern at system design level.

### Agent I9: Interview Anti-Patterns Guide
**File:** `docs-site/content/12-interview-prep/question-bank/interview-antipatterns.md`

10 anti-patterns that kill candidates who actually know the material:

1. Over-engineering: Adding Kafka when a simple queue works. Fix: ask "what's the scale?" before architecting
2. Skipping requirements: Jumping to the whiteboard before clarifying users, scale, consistency needs
3. No numbers: "It'll be fast" vs "P99 < 50ms at 10k RPS with 1TB dataset"
4. One-size-fits-all: Always microservices, always SQL, always Redis. Fix: articulate when each wins
5. Ignoring failure modes: Never mentioning what happens when a component fails
6. Magic database syndrome: "Just use Cassandra" without explaining write-ahead log, eventual consistency, and tombstones
7. Resumé-driven design: Proposing a technology you know, not one that fits
8. Single point of failure blindness: Designing a system where one node going down = 100% outage
9. Premature optimization: Worrying about P99 latency before the system can even handle P50
10. Avoiding trade-offs: Saying "we can have both high consistency and high availability" (CAP theorem)

For each: before/after example of a candidate answer. What the interviewer heard. What they wanted to hear.

### Agent I10: Navigation and _meta.js Updates for Phase 4
- Create `12-interview-prep/question-bank/company-specific/_meta.js` with entries for all 5 company guides
- Update `12-interview-prep/question-bank/_meta.js` to include company-specific, behavioral-system-design-combo, interview-antipatterns, coding-system-design-bridge
- Update `12-interview-prep/quick-reference/_meta.js` to add numbers-to-memorize
- Update `12-interview-prep/STATUS.md`

---

## Phase 5 — Cheat Sheet Completion and Cross-Linking
**Duration:** 3–4 days | **Parallel agents:** 10

### Agents CS-1 through CS-8: Cheat Sheet Expansion

For each cheat sheet, read the corresponding section's Full articles and extract dense entries following the cheat sheet format: table + key number + decision rule + trap + link.

| Agent | Cheat Sheet | Current Lines | Target | Priority Gaps to Fill |
|-------|------------|--------------|--------|----------------------|
| CS-1 | `cheat-sheets/databases.md` | 644 | 900 | Multi-tenancy, zero-downtime migrations, CDC, capacity planning |
| CS-2 | `cheat-sheets/caching.md` | 628 | 800 | CDN edge compute numbers, cache stampede mitigation, warming strategies |
| CS-3 | `cheat-sheets/system-design.md` | 1286 | 1500 | Serverless limits, platform engineering DORA numbers, WebRTC topology trade-offs |
| CS-4 | `cheat-sheets/networking.md` | 601 | 800 | WebRTC numbers, gRPC vs REST vs GraphQL decision table, WebSocket vs SSE vs long-poll |
| CS-5 | `cheat-sheets/security.md` | 550 | 700 | Zero trust checklist, mTLS setup steps, secret rotation best practices |
| CS-6 | `cheat-sheets/messaging.md` | 433 | 600 | Kafka partition sizing formula, DLQ decision rules, Streams vs Pub/Sub |
| CS-7 | `cheat-sheets/aws.md` | 829 | 1000 | Lambda limits table, EKS vs ECS decision, cost optimization rules, Fargate vs EC2 |
| CS-8 | `cheat-sheets/mobile.md` | 53 | 500 | Full rebuild — already detailed in Phase 2 Agent C4 |

### Agent CS-9: Cross-Link Audit
For every Full article (500+ lines):
- Ensure `see_poc:` frontmatter points to related POC files created in Phase 3
- Ensure `related_problems:` points to problems-at-scale articles
- Ensure `case_studies:` points to 11-real-world articles
- Find orphaned articles (not referenced from anywhere) and add them to section index.md

### Agent CS-10: Final Sync and Validation
After all content phases complete:
- Run `/sync-graph` to rebuild KNOWLEDGE-MAP.md and KNOWLEDGE-GRAPH.md
- Validate all `_meta.js` entries have corresponding files (grep for missing files)
- Check all internal links in MDX files point to valid paths
- Update master `content/STATUS.md` with final counts

---

## Phase 6 — Quality Pass (Continuous, Runs in Parallel with Later Phases)
**Duration:** Ongoing | **Parallel agents:** 10 at a time, rotating batches

Process all ⚠️ Stub articles found in Phase 0. Run 10 stubs per batch. For each stub:

1. Read current content
2. Check DO NOT RE-COVER list — if topic is covered elsewhere, update stub to be a redirect/overview with link to full article
3. If topic is valid and unique: expand to 500+ lines following Two-Depth structure
4. Run quality gate checklist
5. Update section STATUS.md

Priority order:
1. `16-system-design-problems/` stubs (97 files, 107 lines avg) — highest interview value
2. `problems-at-scale/` stubs — real-world failure scenarios
3. `12-interview-prep/question-bank/` stubs — interview questions with thin answers
4. Section `index.md` files — make them useful navigation hubs, not empty shells
5. `13-agent-workflows/` stubs — rapidly growing section, high relevance

---

## Execution Order and Dependencies

```
Phase 0: Indexing (12 agents, 1-2 days)
    |
    v [Phase 0 must complete — all agents read STATUS.md]
    |
    +---> Phase 1: Problem Deep Dives (10 agents, 2-3 weeks)
    |
    +---> Phase 2: Missing Content (10 agents, 1 week)
    |
    +---> Phase 3: POC Labs (10 agents, 2-3 weeks)
    |
    [Phases 1, 2, 3 run concurrently — no dependencies between them]
    |
    v [Phases 1-3 must complete]
    |
Phase 4: Interview Prep (10 agents, 1 week)
    |
    v
Phase 5: Cheat Sheets + Cross-links (10 agents, 3-4 days)
    |
    v
Phase 6: Quality Pass (continuous, 10 agents rotating)
```

---

## Anti-Duplication Enforcement Rules

Before any agent writes a new article:

1. Check the DO NOT RE-COVER list at the top of this document
2. Check the section STATUS.md — if Full, skip
3. Search: `grep -r "topic-keyword" docs-site/content/ --include="*.md" -l`
4. If similar content exists in another section: LINK TO IT, do not duplicate. Add `related:` frontmatter.
5. If partial coverage exists (Stub): EXPAND that file, do not create a new one
6. If a concept is covered in interview-prep but not in the main domain section: write it in the domain section, link from interview-prep

---

## Quality Gate (Every Article Must Pass All)

- [ ] 500+ lines
- [ ] Level 1 section (2-minute surface read)
- [ ] Level 2 section (deep dive)
- [ ] At least 1 Mermaid diagram
- [ ] At least 3 real company references with specific numbers
- [ ] Key numbers table (throughput, latency, storage, scale threshold)
- [ ] Common mistakes section (min 3 mistakes with root cause and fix)
- [ ] Interview angle (what the interviewer is testing)
- [ ] Frontmatter complete: title, layer, section, difficulty, tags, category
- [ ] Cheat sheet entry added or updated
- [ ] Section STATUS.md updated

---

## File Naming Conventions

- Concept articles: `kebab-case-topic.md` in `section/concepts/`
- POC labs: `kebab-case-topic-poc.md` in `section/hands-on/`
- Failure scenarios: `kebab-case-failure.md` in `section/failures/` or `problems-at-scale/category/`
- Company interview guides: `company-name.md` in `12-interview-prep/question-bank/company-specific/`
- Status files: `STATUS.md` (uppercase) in every section root

---

## Progress Metrics

| Metric | Baseline (Jun 2026) | Phase 0 Target | Final Target |
|--------|--------------------|--------------  |-------------|
| Full articles (500+ lines) | ~338 | — | 700+ |
| Stub articles (< 300 lines) | ~315 | Catalogued | < 50 |
| Runnable POC labs | 5 | — | 65+ |
| Company interview guides | 0 | — | 5 |
| Cheat sheets (all expanded) | 10 (1 near-empty) | — | 10 (all 500+) |
| System design problems (full) | ~18 | — | 100+ |
| Problems-at-scale articles | 32 | — | 42+ |
| New concept articles | — | — | 12+ |

---

*Plan created: 2026-05-31*
*Based on audit of 1,048 existing files across 16 content sections*
*Baseline: 33/35 principal-engineer topics covered, 30% content is stubs, 5 runnable POCs*
*First action: Execute Phase 0 with 12 parallel sub-agents*
