# Interview Question Bank (1000+ Questions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:dispatching-parallel-agents to implement this plan task-by-task.

**Goal:** Create 1000+ interview questions across 11 topic directories and 10 role index pages inside `docs-site/content/12-interview-prep/question-bank/`, with a master index table linking everything.

**Architecture:** Topic-first grouping (Option A). `question-bank/` is the single source of truth. `roles/` pages are filtered views only — no content duplication. Every answer links to existing concept articles rather than re-explaining them. Three question formats (Quick Answer, Deep Dive, Scenario) chosen per question based on complexity.

**Tech Stack:** Nextra MDX, Mermaid diagrams, YAML frontmatter, _meta.js navigation files.

---

## Parallel Execution Map

Tasks 0 (setup) must complete first. Then Tasks 1–6 run in parallel (independent topic directories). Task 7 (assembly) runs last after all topic files exist.

```
Task 0: Setup (dirs + _meta.js files)
    ↓
Task 1: system-design/          ← parallel
Task 2: databases/              ← parallel
Task 3: distributed-systems/    ← parallel
    + caching-performance/
Task 4: apis-networking/        ← parallel
    + security-auth/
Task 5: cloud-devops/           ← parallel
    + algorithms-patterns/
Task 6: ai-ml-systems/          ← parallel
    + observability-sre/
    + mobile-architecture/
    ↓
Task 7: master-index + role pages
```

---

## Question Format Templates (reference for all agents)

### Format 1: Quick Answer
```markdown
## Q{N}: {Question title}

**Role:** {roles} | **Difficulty:** {emoji} {level} | **Priority:** {P0/P1/P2/P3} | **Format:** Quick Answer

> **What the interviewer is testing:** {1 sentence — specific skill being evaluated}

### Answer in 60 seconds
- **{Point 1}:** {specific detail with a number}
- **{Point 2}:** {specific detail with a number}
- **{Point 3}:** {specific detail with a number}
- **{Point 4}:** {specific detail with a number}

### Diagram
```mermaid
graph LR
  A[Component] --> B[Component]
  B --> C[Component]
```

### Pitfalls
- ❌ **{Mistake}:** {why it's wrong, root cause}
- ❌ **{Mistake}:** {why it's wrong, root cause}

### Concept Reference
→ [{Existing article title}](../../../{path-to-existing-article})
```

### Format 2: Deep Dive
```markdown
## Q{N}: {Question title}

**Role:** {roles} | **Difficulty:** {emoji} {level} | **Priority:** {P0/P1/P2/P3} | **Format:** Deep Dive

> **What the interviewer is testing:** {1 sentence}

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Scale | {X req/sec, Y users} |
| Latency SLA | {p99 target} |
| Availability | {99.9% / 99.99%} |
| Data size | {X GB / TB} |

### Approach A — {Name}
```mermaid
graph TD
  ...
```
| Dimension | Value |
|-----------|-------|
| Throughput | X req/sec |
| Latency | Y ms p99 |
| Trade-off | ... |

**When to use:** {condition}

### Approach B — {Name}
```mermaid
graph TD
  ...
```
| Dimension | Value |
|-----------|-------|

**When to use:** {condition}

### Recommended Answer
{Which approach + why + specific numbers that justify it}

### What a great answer includes
- [ ] Mentions {specific thing}
- [ ] Quantifies {specific metric}
- [ ] Considers {specific failure mode}
- [ ] Acknowledges {trade-off}

### Pitfalls
- ❌ **{Mistake}:** {root cause + fix}
- ❌ **{Mistake}:** {root cause + fix}

### Concept Reference
→ [{Existing article title}](../../../{path})
```

### Format 3: Scenario
```markdown
## Q{N}: {Scenario title}

**Role:** {roles} | **Difficulty:** {emoji} {level} | **Priority:** {P0/P1/P2/P3} | **Format:** Scenario
**Real Company:** {Company} — {what they use this for}

### The Brief (as given in interview)
> "{Exact-style interview prompt with constraints}"

### Clarifying Questions to Ask First
1. {Question about scale}
2. {Question about consistency vs availability}
3. {Question about read/write ratio}
4. {Question about geographic scope}

### Back-of-Envelope Estimation
| Metric | Calculation | Result |
|--------|-------------|--------|
| Daily active users | {assumption} | {X}M DAU |
| Requests/sec | {X}M × {Y} req/day ÷ 86400 | ~{Z} rps |
| Peak rps (3× avg) | {Z} × 3 | ~{W} rps |
| Storage/day | {X} req × {Y} KB | ~{Z} GB/day |
| Storage/year | {Z} × 365 | ~{W} TB/year |

### High-Level Architecture
```mermaid
graph TD
  ...
```

### Deep Dive: {Critical Component}
```mermaid
graph TD
  ...
```

### Trade-off Decisions
| Decision | Option A | Option B | Chosen | Why |
|----------|----------|----------|--------|-----|

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|

### Concept References
→ [{Article 1}](path)
→ [{Article 2}](path)
```

---

## Task 0: Setup — Directory Structure + _meta.js Files

**Files to create:**
- `docs-site/content/12-interview-prep/question-bank/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/index.md` (placeholder, filled in Task 7)
- `docs-site/content/12-interview-prep/question-bank/system-design/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/databases/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/distributed-systems/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/caching-performance/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/apis-networking/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/security-auth/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/cloud-devops/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/algorithms-patterns/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/ai-ml-systems/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/observability-sre/_meta.js`
- `docs-site/content/12-interview-prep/question-bank/mobile-architecture/_meta.js`
- `docs-site/content/12-interview-prep/roles/_meta.js`
- Update `docs-site/content/12-interview-prep/_meta.js` to add `question-bank` and `roles` entries

- [ ] Create `question-bank/_meta.js`:
```js
export default {
  index: "📚 Master Question Index",
  "system-design": "🏗️ System Design",
  databases: "🗄️ Databases & Storage",
  "distributed-systems": "🌐 Distributed Systems",
  "caching-performance": "⚡ Caching & Performance",
  "apis-networking": "🔌 APIs & Networking",
  "security-auth": "🔒 Security & Auth",
  "cloud-devops": "☁️ Cloud & DevOps",
  "algorithms-patterns": "🧮 Algorithms & Patterns",
  "ai-ml-systems": "🤖 AI & ML Systems",
  "observability-sre": "📊 Observability & SRE",
  "mobile-architecture": "📱 Mobile Architecture",
}
```

- [ ] Create `question-bank/system-design/_meta.js`:
```js
export default {
  "design-url-shortener": "URL Shortener",
  "design-notification-system": "Notification System",
  "design-rate-limiter": "Rate Limiter",
  "design-chat-system": "Chat System",
  "design-news-feed": "News Feed",
  "design-video-streaming": "Video Streaming",
  "design-search-autocomplete": "Search Autocomplete",
  "design-ride-sharing": "Ride Sharing",
  "design-payment-system": "Payment System",
  "design-distributed-cache": "Distributed Cache",
  "design-cdn": "CDN",
  "design-api-gateway": "API Gateway",
  "design-job-scheduler": "Job Scheduler",
  "design-file-storage": "File Storage",
  "design-location-service": "Location Service",
  "design-recommendation-engine": "Recommendation Engine",
  "design-ad-click-aggregator": "Ad Click Aggregator",
  "design-web-crawler": "Web Crawler",
  "design-metrics-monitoring": "Metrics & Monitoring",
  "design-distributed-locking": "Distributed Locking",
}
```

- [ ] Create `question-bank/databases/_meta.js`:
```js
export default {
  "sql-vs-nosql-decisions": "SQL vs NoSQL Decisions",
  "database-sharding-deep-dive": "Database Sharding",
  "database-replication-patterns": "Replication Patterns",
  "indexing-strategies": "Indexing Strategies",
  "transactions-acid-base": "Transactions & ACID",
  "connection-pooling": "Connection Pooling",
  "database-migrations-at-scale": "Migrations at Scale",
  "time-series-databases": "Time-Series Databases",
  "graph-databases": "Graph Databases",
  "document-databases": "Document Databases",
  "wide-column-stores": "Wide-Column Stores",
  "query-optimization": "Query Optimization",
  "database-consistency-models": "Consistency Models",
  "multi-tenancy-database-patterns": "Multi-Tenancy Patterns",
  "database-backup-recovery": "Backup & Recovery",
}
```

- [ ] Create `question-bank/distributed-systems/_meta.js`:
```js
export default {
  "cap-theorem-real-world": "CAP Theorem",
  "consensus-algorithms": "Consensus Algorithms",
  "distributed-transactions": "Distributed Transactions",
  "event-sourcing-cqrs": "Event Sourcing & CQRS",
  "saga-pattern": "Saga Pattern",
  "leader-election": "Leader Election",
  "clock-synchronization": "Clock Synchronization",
  "partition-tolerance": "Partition Tolerance",
  "gossip-protocol": "Gossip Protocol",
  "vector-clocks": "Vector Clocks",
  "two-phase-commit": "Two-Phase Commit",
  "idempotency-at-scale": "Idempotency at Scale",
}
```

- [ ] Create `question-bank/caching-performance/_meta.js`:
```js
export default {
  "cache-invalidation-strategies": "Cache Invalidation",
  "redis-advanced-patterns": "Redis Advanced Patterns",
  "cdn-caching-strategies": "CDN Caching",
  "database-query-caching": "Query Caching",
  "cache-stampede-thundering-herd": "Cache Stampede",
  "application-layer-caching": "Application Caching",
  "cache-sizing-eviction": "Cache Sizing & Eviction",
  "write-behind-write-through": "Write-Behind & Write-Through",
  "multi-level-caching": "Multi-Level Caching",
  "cache-warming-strategies": "Cache Warming",
}
```

- [ ] Create `question-bank/apis-networking/_meta.js`:
```js
export default {
  "rest-api-design-principles": "REST API Design",
  "graphql-design-patterns": "GraphQL Patterns",
  "grpc-and-protobuf": "gRPC & Protobuf",
  "websockets-long-polling": "WebSockets & Long Polling",
  "api-versioning-strategies": "API Versioning",
  "api-gateway-patterns": "API Gateway Patterns",
  "http-internals": "HTTP Internals",
  "dns-load-balancing": "DNS & Load Balancing",
}
```

- [ ] Create `question-bank/security-auth/_meta.js`:
```js
export default {
  "authentication-patterns": "Authentication Patterns",
  "authorization-rbac-abac": "Authorization: RBAC vs ABAC",
  "oauth2-oidc": "OAuth2 & OIDC",
  "jwt-sessions-cookies": "JWT vs Sessions vs Cookies",
  "encryption-at-rest-transit": "Encryption At Rest & In Transit",
  "api-security-patterns": "API Security Patterns",
  "zero-trust-architecture": "Zero Trust Architecture",
}
```

- [ ] Create `question-bank/cloud-devops/_meta.js`:
```js
export default {
  "kubernetes-architecture": "Kubernetes Architecture",
  "cicd-pipeline-design": "CI/CD Pipeline Design",
  "aws-core-services": "AWS Core Services",
  "infrastructure-as-code": "Infrastructure as Code",
  "blue-green-canary-deployments": "Blue-Green & Canary",
  "container-orchestration": "Container Orchestration",
  "cloud-cost-optimization": "Cloud Cost Optimization",
}
```

- [ ] Create `question-bank/algorithms-patterns/_meta.js`:
```js
export default {
  "consistent-hashing": "Consistent Hashing",
  "bloom-filters-hyperloglog": "Bloom Filters & HyperLogLog",
  "rate-limiting-algorithms": "Rate Limiting Algorithms",
  "data-structures-at-scale": "Data Structures at Scale",
  "search-algorithms-systems": "Search Algorithms",
  "approximation-algorithms": "Approximation Algorithms",
}
```

- [ ] Create `question-bank/ai-ml-systems/_meta.js`:
```js
export default {
  "ml-pipeline-design": "ML Pipeline Design",
  "llm-system-design": "LLM System Design",
  "rag-architecture": "RAG Architecture",
  "vector-database-design": "Vector Database Design",
  "model-serving-infrastructure": "Model Serving",
  "feature-store-design": "Feature Store Design",
  "ab-testing-ml-models": "A/B Testing ML Models",
  "ai-agent-architecture": "AI Agent Architecture",
}
```

- [ ] Create `question-bank/observability-sre/_meta.js`:
```js
export default {
  "distributed-tracing": "Distributed Tracing",
  "metrics-alerting-design": "Metrics & Alerting",
  "log-aggregation-systems": "Log Aggregation",
  "slo-sla-error-budgets": "SLOs, SLAs & Error Budgets",
  "incident-response-systems": "Incident Response",
}
```

- [ ] Create `question-bank/mobile-architecture/_meta.js`:
```js
export default {
  "offline-sync-patterns": "Offline Sync Patterns",
  "mobile-app-architecture": "Mobile App Architecture",
}
```

- [ ] Create `roles/_meta.js`:
```js
export default {
  index: "🎭 Choose Your Role",
  "backend-engineer": "⚙️ Backend Engineer",
  "senior-engineer": "🔴 Senior Engineer",
  "solution-architect": "⚫ Solution Architect",
  "frontend-engineer": "🎨 Frontend Engineer",
  "devops-sre": "🚀 DevOps / SRE",
  "fullstack-mid": "🟡 Full-Stack (Mid-Level)",
  "data-engineer": "📊 Data Engineer",
  "ml-ai-engineer": "🤖 ML / AI Engineer",
  "security-engineer": "🔒 Security Engineer",
  "mobile-engineer": "📱 Mobile Engineer",
}
```

- [ ] Update `docs-site/content/12-interview-prep/_meta.js` to add new sections:
```js
export default {
  index: "🎯 Interview Prep",
  "question-bank": "📚 Question Bank (1000+)",
  roles: "🎭 By Role",
  "senior-questions": "🏆 Senior Engineer Questions",
  "system-design": "🎯 System Design Questions",
  "quick-reference": "📋 Quick Reference",
}
```

- [ ] Create placeholder `question-bank/index.md` (will be replaced in Task 7):
```markdown
---
title: "Interview Question Bank"
---
# Interview Question Bank

> Master index is being assembled. Check individual topic sections below.
```

- [ ] Commit:
```bash
git add docs-site/content/12-interview-prep/
git commit -m "feat(question-bank): scaffold directory structure and navigation meta files"
```

---

## Task 1: System Design Questions (20 files, ~200 questions)

**Directory:** `docs-site/content/12-interview-prep/question-bank/system-design/`

### Frontmatter template for all files in this task:
```yaml
---
title: "{Title}"
layer: interview-q
section: interview-prep/question-bank/system-design
difficulty: intermediate
tags: [system-design, scalability]
---
```

---

### File 1: `design-url-shortener.md` — 10 questions

Questions to include:
1. (Scenario, P0, Senior) Design a URL shortener like bit.ly handling 100M URLs and 10K redirects/sec
2. (Quick Answer, P0, Mid) How do you generate unique short codes for URLs?
3. (Quick Answer, P0, Mid) How would you handle custom aliases (e.g. bit.ly/my-brand)?
4. (Deep Dive, P0, Senior) How would you scale the redirect service to handle 50K req/sec?
5. (Quick Answer, P1, Mid) What database schema would you use for storing URL mappings?
6. (Quick Answer, P1, Mid) How do you cache redirects to avoid hitting the database every time?
7. (Deep Dive, P1, Senior) How do you track analytics (click counts, geo, referrer) without slowing down redirects?
8. (Quick Answer, P1, Senior) How do you handle link expiration?
9. (Quick Answer, P2, Senior) How do you prevent abuse (spam, phishing)?
10. (Deep Dive, P2, Staff) How would you geo-distribute the redirect service to <50ms globally?

### File 2: `design-notification-system.md` — 10 questions

1. (Scenario, P0, Senior) Design a notification system for 100M users sending push, email, and SMS
2. (Quick Answer, P0, Mid) What are the differences between push notifications, email, and SMS at scale?
3. (Deep Dive, P0, Senior) How do you guarantee at-least-once delivery for critical notifications?
4. (Quick Answer, P1, Mid) How do you handle user notification preferences?
5. (Quick Answer, P1, Mid) How would you implement notification rate limiting per user?
6. (Deep Dive, P1, Senior) How do you handle notification fan-out for a social platform (1 post → 10M followers)?
7. (Quick Answer, P1, Senior) How do you handle notification deduplication?
8. (Quick Answer, P2, Senior) How do you implement notification scheduling (send at 9am user's local time)?
9. (Deep Dive, P2, Staff) How do you design a priority queue so critical alerts (OTP) bypass marketing emails?
10. (Quick Answer, P2, Staff) How do you measure notification delivery success and debug failures?

### File 3: `design-rate-limiter.md` — 10 questions

1. (Scenario, P0, Senior) Design a distributed rate limiter for a public API serving 50K req/sec
2. (Quick Answer, P0, Junior) What is a rate limiter and why do you need one?
3. (Deep Dive, P0, Senior) Compare Fixed Window vs Sliding Window vs Token Bucket rate limiting algorithms
4. (Quick Answer, P0, Mid) How do you implement a rate limiter in a distributed system (multiple servers)?
5. (Quick Answer, P1, Mid) How do you handle rate limit headers in API responses?
6. (Deep Dive, P1, Senior) How do you rate limit by user, IP, and API key simultaneously?
7. (Quick Answer, P1, Senior) What happens when your Redis cluster for rate limiting goes down?
8. (Quick Answer, P2, Senior) How do you implement burst allowance (momentary spikes above the rate limit)?
9. (Deep Dive, P2, Staff) How does Stripe implement tiered rate limiting (free vs paid tiers)?
10. (Quick Answer, P2, Staff) How do you prevent rate limit bypass via distributed IPs?

### File 4: `design-chat-system.md` — 10 questions

1. (Scenario, P0, Senior) Design a real-time chat system like WhatsApp for 500M users
2. (Quick Answer, P0, Mid) What protocol would you use for real-time messaging — WebSockets, SSE, or long-polling?
3. (Deep Dive, P0, Senior) How do you store and retrieve message history efficiently?
4. (Quick Answer, P1, Mid) How do you deliver messages to offline users?
5. (Deep Dive, P1, Senior) How do you implement message ordering guarantees in a distributed chat system?
6. (Quick Answer, P1, Senior) How do you handle group chats with 1000+ members?
7. (Quick Answer, P2, Senior) How do you implement end-to-end encryption without the server reading messages?
8. (Deep Dive, P2, Senior) How do you design the presence system (online/offline/typing indicators)?
9. (Quick Answer, P2, Staff) How do you handle message fanout at WhatsApp scale (100B messages/day)?
10. (Quick Answer, P3, Staff) How would you design message search across billions of messages?

### File 5: `design-news-feed.md` — 10 questions

1. (Scenario, P0, Senior) Design a social news feed like Twitter/Instagram for 100M DAU
2. (Quick Answer, P0, Mid) What is fan-out on write vs fan-out on read? When do you use each?
3. (Deep Dive, P0, Senior) How does Instagram handle feed generation for users with 10M followers?
4. (Quick Answer, P1, Mid) How do you paginate a news feed efficiently?
5. (Deep Dive, P1, Senior) How do you implement feed ranking (relevance over recency)?
6. (Quick Answer, P1, Senior) How do you handle "celebrity problem" (one user → 100M followers) in feed fanout?
7. (Quick Answer, P2, Senior) How do you ensure a post appears in feeds within 5 seconds of publishing?
8. (Deep Dive, P2, Staff) How would you design a hybrid fan-out strategy that switches based on follower count?
9. (Quick Answer, P2, Staff) How do you handle feed for new users with no follows (cold start)?
10. (Quick Answer, P3, Staff) How do you A/B test feed ranking algorithms without degrading user experience?

### File 6: `design-video-streaming.md` — 10 questions

1. (Scenario, P0, Senior) Design a video streaming platform like Netflix handling 1M concurrent streams
2. (Quick Answer, P0, Mid) What is adaptive bitrate streaming (ABR) and how does it work?
3. (Deep Dive, P0, Senior) How does Netflix encode and store videos for delivery at global scale?
4. (Quick Answer, P1, Mid) What is a CDN and how does it reduce video buffering?
5. (Deep Dive, P1, Senior) How do you handle video upload, processing pipeline, and transcoding at scale?
6. (Quick Answer, P1, Senior) How do you implement video resumption (continue watching from where you left off)?
7. (Quick Answer, P2, Senior) How do you protect video content from unauthorized downloads (DRM)?
8. (Deep Dive, P2, Senior) How would you design the thumbnail generation pipeline for 500M videos?
9. (Quick Answer, P2, Staff) How do you handle live streaming vs on-demand streaming architecture differences?
10. (Quick Answer, P3, Staff) How does YouTube achieve <2s video start time for 2B users?

### File 7: `design-search-autocomplete.md` — 10 questions

1. (Scenario, P0, Senior) Design a search autocomplete system like Google's handling 10K queries/sec
2. (Quick Answer, P0, Mid) What data structure is best for prefix-based search autocomplete?
3. (Deep Dive, P0, Senior) How do you rank autocomplete suggestions by popularity and relevance?
4. (Quick Answer, P1, Mid) How do you update autocomplete suggestions in real-time as trends change?
5. (Deep Dive, P1, Senior) How do you scale a trie to handle 1B search terms?
6. (Quick Answer, P1, Senior) How do you handle typos and fuzzy matching in autocomplete?
7. (Quick Answer, P2, Senior) How do you personalize autocomplete suggestions per user?
8. (Deep Dive, P2, Staff) How would you design autocomplete to work across 40 languages?
9. (Quick Answer, P2, Staff) How do you filter offensive or dangerous search suggestions in real-time?
10. (Quick Answer, P3, Staff) How does Google's autocomplete handle "did you mean?" suggestions?

### File 8: `design-ride-sharing.md` — 10 questions

1. (Scenario, P0, Senior) Design the matching system for a ride-sharing app like Uber handling 1M rides/day
2. (Quick Answer, P0, Mid) How do you store and query real-time driver locations efficiently?
3. (Deep Dive, P0, Senior) How does Uber's dispatch algorithm match riders to the nearest driver?
4. (Quick Answer, P1, Mid) How do you calculate ETA accurately?
5. (Deep Dive, P1, Senior) How do you handle surge pricing in real-time based on demand?
6. (Quick Answer, P1, Senior) How do you ensure a driver isn't double-matched to two riders simultaneously?
7. (Quick Answer, P2, Senior) How does Uber handle the GPS location update stream from millions of drivers?
8. (Deep Dive, P2, Staff) How would you design the geospatial indexing for finding nearby drivers in <100ms?
9. (Quick Answer, P2, Staff) How do you handle driver going offline mid-ride?
10. (Quick Answer, P3, Staff) How would you design the routing engine for multi-stop rides?

### File 9: `design-payment-system.md` — 10 questions

1. (Scenario, P0, Senior) Design a payment processing system like Stripe handling 1000 transactions/sec
2. (Quick Answer, P0, Mid) What is idempotency and why is it critical for payment APIs?
3. (Deep Dive, P0, Senior) How do you prevent double charges in a distributed payment system?
4. (Quick Answer, P1, Mid) What is the difference between authorization and capture in payment flows?
5. (Deep Dive, P1, Senior) How do you implement the Saga pattern for a distributed checkout flow?
6. (Quick Answer, P1, Senior) How do you handle payment retries safely without charging twice?
7. (Quick Answer, P2, Senior) How do you design reconciliation to detect missed or duplicate transactions?
8. (Deep Dive, P2, Staff) How would you handle currency conversion at scale across 135 currencies?
9. (Quick Answer, P2, Staff) How does Stripe handle PCI-DSS compliance in their architecture?
10. (Quick Answer, P3, Staff) How do you detect and prevent fraudulent transactions in real-time?

### File 10: `design-distributed-cache.md` — 10 questions

1. (Scenario, P0, Senior) Design a distributed cache like Redis Cluster handling 500K req/sec
2. (Quick Answer, P0, Mid) What is consistent hashing and how does it minimize cache misses during node changes?
3. (Deep Dive, P0, Senior) How do you handle cache eviction when memory is full?
4. (Quick Answer, P1, Mid) What is the difference between cache-aside, read-through, and write-through?
5. (Deep Dive, P1, Senior) How do you handle a cache node failure without a thundering herd?
6. (Quick Answer, P1, Senior) How do you replicate cache data for high availability?
7. (Quick Answer, P2, Senior) How do you handle hot keys in a distributed cache?
8. (Deep Dive, P2, Staff) How would you design a multi-region cache with consistency guarantees?
9. (Quick Answer, P2, Staff) How does Redis handle persistence (RDB vs AOF)?
10. (Quick Answer, P3, Staff) How would you implement a hierarchical cache (L1 in-process + L2 Redis)?

### File 11: `design-cdn.md` — 10 questions

1. (Scenario, P0, Senior) Design a CDN for serving static assets to 1B users globally
2. (Quick Answer, P0, Mid) How does a CDN work? What happens on a cache miss?
3. (Deep Dive, P0, Senior) How does a CDN decide which edge server to route a user to?
4. (Quick Answer, P1, Mid) What content is suitable for CDN caching vs what should bypass CDN?
5. (Deep Dive, P1, Senior) How do you handle CDN cache invalidation for updated content?
6. (Quick Answer, P1, Senior) What is anycast routing and how does Cloudflare use it?
7. (Quick Answer, P2, Senior) How do you handle CDN failover when an edge node goes down?
8. (Deep Dive, P2, Staff) How would you design a CDN for video streaming with adaptive bitrate?
9. (Quick Answer, P2, Staff) How does CDN cache vary by request headers (e.g. Accept-Language)?
10. (Quick Answer, P3, Staff) How would you design a CDN PoP placement strategy for India + Southeast Asia?

### File 12: `design-api-gateway.md` — 10 questions

1. (Scenario, P0, Senior) Design an API gateway handling 100K req/sec for a microservices platform
2. (Quick Answer, P0, Mid) What is an API gateway and what responsibilities does it own?
3. (Deep Dive, P0, Senior) How does an API gateway handle authentication without coupling to auth service?
4. (Quick Answer, P1, Mid) How do you implement request routing at the API gateway layer?
5. (Deep Dive, P1, Senior) How do you implement circuit breaking at the API gateway?
6. (Quick Answer, P1, Senior) How do you handle API versioning at the gateway layer?
7. (Quick Answer, P2, Senior) How do you rate limit at the gateway vs at the service level?
8. (Deep Dive, P2, Staff) How would you design an API gateway for a multi-tenant SaaS platform?
9. (Quick Answer, P2, Staff) How does Kong or AWS API Gateway handle plugin extensibility?
10. (Quick Answer, P3, Staff) How do you implement request/response transformation at the gateway?

### File 13: `design-job-scheduler.md` — 10 questions

1. (Scenario, P0, Senior) Design a distributed job scheduler like AWS EventBridge handling 1M jobs/day
2. (Quick Answer, P0, Mid) What is the difference between a job queue and a job scheduler?
3. (Deep Dive, P0, Senior) How do you guarantee exactly-once execution for scheduled jobs?
4. (Quick Answer, P1, Mid) How do you implement cron-style scheduling in a distributed system?
5. (Deep Dive, P1, Senior) How do you handle job failures, retries, and dead letter queues?
6. (Quick Answer, P1, Senior) How do you distribute jobs across workers with different capacities?
7. (Quick Answer, P2, Senior) How do you handle long-running jobs that exceed timeout limits?
8. (Deep Dive, P2, Staff) How would you design priority queues so critical jobs don't starve behind batch jobs?
9. (Quick Answer, P2, Staff) How do you prevent duplicate job execution in a distributed scheduler?
10. (Quick Answer, P3, Staff) How does Airflow handle DAG-based job scheduling with dependencies?

### File 14: `design-file-storage.md` — 10 questions

1. (Scenario, P0, Senior) Design a file storage system like Dropbox handling 500M files and 10M DAU
2. (Quick Answer, P0, Mid) How do you chunk files for efficient upload and storage?
3. (Deep Dive, P0, Senior) How do you implement delta sync (only sync changed blocks)?
4. (Quick Answer, P1, Mid) How would you handle concurrent edits to the same file from two devices?
5. (Deep Dive, P1, Senior) How do you ensure file consistency across multiple storage nodes?
6. (Quick Answer, P1, Senior) How do you implement file deduplication to save storage costs?
7. (Quick Answer, P2, Senior) How do you handle file versioning and rollback?
8. (Deep Dive, P2, Staff) How does Dropbox implement Smart Sync (files on-demand, not fully downloaded)?
9. (Quick Answer, P2, Staff) How do you handle file access control in a shared folder?
10. (Quick Answer, P3, Staff) How would you design virus scanning for uploaded files without slowing uploads?

### File 15: `design-location-service.md` — 10 questions

1. (Scenario, P0, Senior) Design a location service for a food delivery app tracking 1M drivers in real-time
2. (Quick Answer, P0, Mid) What is a geohash and how does it help with proximity queries?
3. (Deep Dive, P0, Senior) How do you find all drivers within 5km of a point in <100ms?
4. (Quick Answer, P1, Mid) How frequently should drivers send location updates without draining battery?
5. (Deep Dive, P1, Senior) How do you handle 1M concurrent location writes without overwhelming the DB?
6. (Quick Answer, P1, Senior) How do you store historical location trails for a driver's trip?
7. (Quick Answer, P2, Senior) How do you detect if a driver has gone offline vs just a GPS gap?
8. (Deep Dive, P2, Staff) How would you design a geo-fencing system to detect when a driver enters a zone?
9. (Quick Answer, P2, Staff) How do you handle location data privacy and GDPR compliance?
10. (Quick Answer, P3, Staff) How would you design indoor location tracking (no GPS) for a warehouse?

### File 16: `design-recommendation-engine.md` — 10 questions

1. (Scenario, P0, Senior) Design a recommendation system like Netflix's "Because you watched" at 200M users
2. (Quick Answer, P0, Mid) What is collaborative filtering vs content-based filtering?
3. (Deep Dive, P0, Senior) How do you handle the cold start problem for new users and new items?
4. (Quick Answer, P1, Mid) How do you serve personalized recommendations with <200ms latency?
5. (Deep Dive, P1, Senior) How does Netflix train and serve recommendation models at scale?
6. (Quick Answer, P1, Senior) How do you handle recommendation diversity (avoid filter bubbles)?
7. (Quick Answer, P2, Senior) How do you A/B test recommendation algorithms without harming user experience?
8. (Deep Dive, P2, Staff) How would you design near-real-time recommendations based on current session behavior?
9. (Quick Answer, P2, Staff) How do you explain recommendations to users (explainability)?
10. (Quick Answer, P3, Staff) How does Spotify's Discover Weekly generate personalized playlists for 400M users?

### File 17: `design-ad-click-aggregator.md` — 10 questions

1. (Scenario, P0, Senior) Design an ad click aggregation system processing 1B clicks/day for billing
2. (Quick Answer, P0, Mid) Why is counting ad clicks hard in a distributed system?
3. (Deep Dive, P0, Senior) How do you aggregate click counts accurately at 100K events/sec?
4. (Quick Answer, P1, Mid) How do you deduplicate clicks from the same user within a time window?
5. (Deep Dive, P1, Senior) How do you implement real-time vs batch aggregation trade-offs?
6. (Quick Answer, P1, Senior) How do you handle late-arriving events in a stream processing pipeline?
7. (Quick Answer, P2, Senior) How do you detect and filter click fraud in real-time?
8. (Deep Dive, P2, Staff) How would you design the billing reconciliation to match click counts to invoices?
9. (Quick Answer, P2, Staff) How do you guarantee exactly-once counting for billing accuracy?
10. (Quick Answer, P3, Staff) How does Google handle invalid click detection across 100B daily ad clicks?

### File 18: `design-web-crawler.md` — 10 questions

1. (Scenario, P0, Senior) Design a web crawler for a search engine indexing 5B pages
2. (Quick Answer, P0, Mid) How does a web crawler avoid crawling the same page twice?
3. (Deep Dive, P0, Senior) How do you prioritize which URLs to crawl first?
4. (Quick Answer, P1, Mid) How do you respect robots.txt and crawl rate limits per domain?
5. (Deep Dive, P1, Senior) How do you scale a crawler to process 1M pages/hour?
6. (Quick Answer, P1, Senior) How do you handle JavaScript-rendered pages (SPAs)?
7. (Quick Answer, P2, Senior) How do you detect and avoid crawler traps (infinite URL loops)?
8. (Deep Dive, P2, Staff) How would you design distributed crawl scheduling across 1000 crawler nodes?
9. (Quick Answer, P2, Staff) How do you handle duplicate content at different URLs (canonical URLs)?
10. (Quick Answer, P3, Staff) How does Googlebot handle recrawl scheduling based on page change frequency?

### File 19: `design-metrics-monitoring.md` — 10 questions

1. (Scenario, P0, Senior) Design a metrics monitoring system like Datadog ingesting 1M metrics/sec
2. (Quick Answer, P0, Mid) What is the difference between metrics, logs, and traces?
3. (Deep Dive, P0, Senior) How do you store time-series metrics efficiently with compression?
4. (Quick Answer, P1, Mid) How do you implement alerting with minimal false positives?
5. (Deep Dive, P1, Senior) How do you scale a metrics ingestion pipeline to 1M events/sec?
6. (Quick Answer, P1, Senior) What is downsampling and why do you need it for long-term metric storage?
7. (Quick Answer, P2, Senior) How do you implement anomaly detection on time-series metrics?
8. (Deep Dive, P2, Staff) How would you design a multi-tenant metrics platform (one cluster, many customers)?
9. (Quick Answer, P2, Staff) How does Prometheus handle high-cardinality metrics?
10. (Quick Answer, P3, Staff) How does Datadog achieve <60s metric ingestion-to-dashboard latency at petabyte scale?

### File 20: `design-distributed-locking.md` — 10 questions

1. (Scenario, P0, Senior) Design a distributed locking service like Chubby handling 10K lock requests/sec
2. (Quick Answer, P0, Mid) Why can't you use a database row lock across distributed services?
3. (Deep Dive, P0, Senior) How does RedLock (Redis distributed lock) work, and what are its failure modes?
4. (Quick Answer, P1, Mid) How do you prevent a lock from being held forever (lock expiry)?
5. (Deep Dive, P1, Senior) How do you implement fencing tokens to prevent stale lock holders from corrupting data?
6. (Quick Answer, P1, Senior) How does ZooKeeper implement distributed locking?
7. (Quick Answer, P2, Senior) How do you handle split-brain scenarios in distributed locking?
8. (Deep Dive, P2, Staff) How does Google Chubby achieve consensus-based locking with Paxos?
9. (Quick Answer, P2, Staff) How do you implement optimistic vs pessimistic locking for different workloads?
10. (Quick Answer, P3, Staff) How would you design a lock service that survives network partitions without violating safety?

- [ ] Write all 20 files with full content following the 3 format templates above
- [ ] Every question must include: format header, interviewer testing note, answer content, at least one Mermaid diagram, pitfalls, concept reference link
- [ ] Commit: `git commit -m "feat(question-bank): add system-design questions (200 questions, 20 files)"`

---

## Task 2: Databases Questions (15 files, ~150 questions)

**Directory:** `docs-site/content/12-interview-prep/question-bank/databases/`

### File 1: `sql-vs-nosql-decisions.md` — 10 questions
1. (Quick Answer, P0, Junior) When do you choose SQL vs NoSQL?
2. (Quick Answer, P0, Mid) What are the ACID properties and why do they matter?
3. (Deep Dive, P0, Senior) How do you design a schema for a multi-tenant SaaS with both SQL and NoSQL?
4. (Quick Answer, P1, Mid) When would you use a document database vs a relational database?
5. (Quick Answer, P1, Mid) What is BASE consistency and when is it acceptable?
6. (Deep Dive, P1, Senior) How do you migrate from SQL to NoSQL without downtime?
7. (Quick Answer, P1, Senior) When is a wide-column store (Cassandra) better than DynamoDB?
8. (Quick Answer, P2, Senior) How do you handle polyglot persistence (multiple DB types in one system)?
9. (Deep Dive, P2, Staff) How does Airbnb use both MySQL and HBase together?
10. (Quick Answer, P3, Staff) How do you evaluate and select a new database for a 10x traffic growth scenario?

### File 2: `database-sharding-deep-dive.md` — 10 questions
1. (Quick Answer, P0, Mid) What is database sharding and when do you need it?
2. (Deep Dive, P0, Senior) Compare horizontal sharding strategies: range, hash, directory-based
3. (Quick Answer, P1, Mid) What is a hotspot shard and how do you prevent it?
4. (Deep Dive, P1, Senior) How do you handle cross-shard queries and joins?
5. (Quick Answer, P1, Senior) How do you re-shard without downtime when a shard grows too large?
6. (Quick Answer, P2, Senior) How does Instagram shard their PostgreSQL databases?
7. (Deep Dive, P2, Staff) How do you implement distributed transactions across shards?
8. (Quick Answer, P2, Staff) What is consistent hashing's role in sharding?
9. (Quick Answer, P3, Staff) How does Vitess (YouTube's MySQL sharding layer) work?
10. (Scenario, P0, Senior) Your single PostgreSQL table has 500M rows and reads are degrading — design a sharding strategy

### File 3: `database-replication-patterns.md` — 10 questions
1. (Quick Answer, P0, Mid) What is the difference between synchronous and asynchronous replication?
2. (Quick Answer, P0, Mid) What is a read replica and when should you use it?
3. (Deep Dive, P0, Senior) How does MySQL binlog replication work and what are its failure modes?
4. (Quick Answer, P1, Mid) What is replication lag and how does it affect read-after-write consistency?
5. (Deep Dive, P1, Senior) How do you implement leader election when the primary DB fails?
6. (Quick Answer, P1, Senior) What is multi-primary replication and when would you use it?
7. (Deep Dive, P2, Senior) How does PostgreSQL streaming replication compare to logical replication?
8. (Quick Answer, P2, Staff) How do you handle the "phantom read" problem in replicated databases?
9. (Quick Answer, P2, Staff) How does CockroachDB achieve multi-region replication with <100ms latency?
10. (Scenario, P1, Senior) Your read replicas are 30 seconds behind during peak traffic — what do you investigate and fix?

### File 4: `indexing-strategies.md` — 10 questions
1. (Quick Answer, P0, Junior) What is a database index and why does it speed up queries?
2. (Quick Answer, P0, Mid) What is the difference between B-tree, hash, and full-text indexes?
3. (Deep Dive, P0, Senior) How do composite indexes work and what is column ordering importance?
4. (Quick Answer, P1, Mid) What is an index scan vs a full table scan? When does the DB choose each?
5. (Quick Answer, P1, Mid) What are covering indexes and when should you use them?
6. (Deep Dive, P1, Senior) How do you diagnose a slow query and decide whether an index will help?
7. (Quick Answer, P2, Senior) What is index bloat and how do you prevent it in PostgreSQL?
8. (Deep Dive, P2, Staff) How does PostgreSQL's query planner decide between multiple possible indexes?
9. (Quick Answer, P2, Staff) How do partial indexes reduce index size and improve write performance?
10. (Scenario, P0, Mid) A query that joins 3 tables is taking 8 seconds. Walk through your optimization process.

### File 5: `transactions-acid-base.md` — 10 questions
1. (Quick Answer, P0, Junior) Explain ACID with a concrete example (bank transfer)
2. (Quick Answer, P0, Mid) What is an isolation level and what problems does each level prevent?
3. (Deep Dive, P0, Senior) How do MVCC (Multi-Version Concurrency Control) databases handle concurrent transactions?
4. (Quick Answer, P1, Mid) What is a phantom read, dirty read, and non-repeatable read?
5. (Deep Dive, P1, Senior) When would you use SERIALIZABLE isolation and what is the performance cost?
6. (Quick Answer, P1, Senior) How do you implement optimistic concurrency control without locking?
7. (Quick Answer, P2, Senior) How does PostgreSQL implement MVCC under the hood?
8. (Deep Dive, P2, Staff) How do you design a distributed transaction across PostgreSQL + Redis + Kafka?
9. (Quick Answer, P2, Staff) What is the difference between 2PL (two-phase locking) and MVCC?
10. (Scenario, P1, Senior) You have a race condition causing double inventory deductions. How do you fix it without table locks?

### File 6: `connection-pooling.md` — 10 questions
1. (Quick Answer, P0, Mid) What is connection pooling and why is it necessary?
2. (Quick Answer, P0, Mid) What happens when you exhaust your database connection pool?
3. (Deep Dive, P0, Senior) How does PgBouncer work and what pooling modes does it offer?
4. (Quick Answer, P1, Mid) What is the optimal connection pool size formula?
5. (Deep Dive, P1, Senior) How do you handle connection pool exhaustion gracefully under load?
6. (Quick Answer, P1, Senior) What is connection multiplexing and how does it differ from pooling?
7. (Quick Answer, P2, Senior) How do you monitor connection pool health metrics?
8. (Deep Dive, P2, Staff) How does RDS Proxy handle connection pooling for serverless workloads?
9. (Quick Answer, P2, Staff) How do you handle prepared statement caching with connection pooling?
10. (Scenario, P1, Senior) Your API is seeing intermittent "too many connections" errors during traffic spikes. Diagnose and fix.

### File 7: `database-migrations-at-scale.md` — 10 questions
1. (Quick Answer, P0, Mid) How do you add a column to a 100M row table without downtime?
2. (Deep Dive, P0, Senior) What is an expand-contract migration pattern?
3. (Quick Answer, P1, Mid) How do you run a zero-downtime schema migration?
4. (Deep Dive, P1, Senior) How does GitHub handle schema migrations on a 50TB database?
5. (Quick Answer, P1, Senior) When would you use pt-online-schema-change vs gh-ost?
6. (Quick Answer, P2, Senior) How do you handle failed migrations in production?
7. (Deep Dive, P2, Staff) How do you migrate 500M rows to a new table with different schema without downtime?
8. (Quick Answer, P2, Staff) How do you version database schemas in a microservices environment?
9. (Quick Answer, P3, Staff) How does Stripe manage schema evolution across hundreds of microservices?
10. (Scenario, P1, Senior) You need to add a NOT NULL column with a default value to a 200M row live table. Walk through your approach.

### File 8: `time-series-databases.md` — 10 questions
1. (Quick Answer, P0, Mid) What is a time-series database and how is it different from a relational DB?
2. (Quick Answer, P1, Mid) When would you use InfluxDB vs Prometheus vs TimescaleDB?
3. (Deep Dive, P1, Senior) How do time-series databases compress data to reduce storage by 10-100x?
4. (Quick Answer, P1, Senior) What is downsampling and how do you implement it for long-term storage?
5. (Deep Dive, P2, Senior) How does InfluxDB's TSM (Time-Series Merge Tree) storage engine work?
6. (Quick Answer, P2, Senior) How do you handle high-cardinality in time-series data?
7. (Deep Dive, P2, Staff) How would you design a time-series DB for IoT data from 10M sensors?
8. (Quick Answer, P2, Staff) How does Prometheus handle data scraping intervals and retention?
9. (Quick Answer, P3, Staff) How does Meta store and query petabytes of time-series metrics?
10. (Scenario, P1, Senior) You need to store 1M IoT temperature readings per minute. Design the storage and query system.

### File 9: `graph-databases.md` — 10 questions
1. (Quick Answer, P1, Mid) What is a graph database and when is it better than a relational DB?
2. (Quick Answer, P1, Mid) What is the difference between Neo4j, Amazon Neptune, and DGraph?
3. (Deep Dive, P1, Senior) How do graph databases traverse relationships faster than SQL JOIN chains?
4. (Quick Answer, P2, Senior) How would you model a social network's friend-of-friend queries in a graph DB?
5. (Deep Dive, P2, Senior) How does Neo4j store graph data on disk for efficient traversal?
6. (Quick Answer, P2, Staff) How do you scale a graph database horizontally?
7. (Quick Answer, P3, Staff) How does LinkedIn use graph databases for "People You May Know"?
8. (Scenario, P2, Senior) Design a fraud detection system using graph traversal to find connected suspicious accounts
9. (Quick Answer, P2, Staff) What is Cypher query language and how does it compare to SQL?
10. (Quick Answer, P3, Staff) How would you detect a cycle in a 1B-node social graph efficiently?

### File 10: `document-databases.md` — 10 questions
1. (Quick Answer, P0, Mid) What is a document database and when should you use MongoDB over PostgreSQL?
2. (Quick Answer, P1, Mid) How do you model one-to-many relationships in a document database?
3. (Deep Dive, P1, Senior) How does MongoDB handle ACID transactions in a distributed cluster?
4. (Quick Answer, P1, Senior) What are the trade-offs of embedding documents vs referencing in MongoDB?
5. (Deep Dive, P2, Senior) How does MongoDB's aggregation pipeline work?
6. (Quick Answer, P2, Senior) How do you handle schema evolution in a document database?
7. (Quick Answer, P2, Staff) How does MongoDB Atlas handle global multi-region reads?
8. (Deep Dive, P2, Staff) How would you shard a MongoDB collection for a multi-tenant SaaS?
9. (Quick Answer, P3, Staff) How does Cosmos DB's partitioning model differ from MongoDB?
10. (Scenario, P1, Senior) You're storing user profiles with highly variable nested attributes — design the document schema.

### File 11: `wide-column-stores.md` — 10 questions
1. (Quick Answer, P1, Mid) What is a wide-column store and how does Cassandra differ from a relational DB?
2. (Quick Answer, P1, Mid) What is a partition key vs clustering key in Cassandra?
3. (Deep Dive, P1, Senior) How does Cassandra's consistent hashing ring work?
4. (Quick Answer, P2, Senior) What is a tombstone in Cassandra and why does it cause performance problems?
5. (Deep Dive, P2, Senior) How does Cassandra achieve tunable consistency (ONE, QUORUM, ALL)?
6. (Quick Answer, P2, Staff) How do you model time-series data in Cassandra?
7. (Quick Answer, P2, Staff) How does HBase differ from Cassandra in architecture?
8. (Deep Dive, P3, Staff) How does Discord store trillions of messages in Cassandra?
9. (Scenario, P2, Senior) Design a Cassandra schema for a messaging app with per-user message history
10. (Quick Answer, P3, Staff) How does DynamoDB's single-table design pattern map to wide-column concepts?

### File 12: `query-optimization.md` — 10 questions
1. (Quick Answer, P0, Mid) How do you read and interpret a SQL EXPLAIN plan?
2. (Quick Answer, P1, Mid) What are N+1 queries and how do you eliminate them?
3. (Deep Dive, P1, Senior) How do you optimize a slow query that can't be indexed (full table scan)?
4. (Quick Answer, P1, Senior) What is query caching and when does it help vs hurt?
5. (Deep Dive, P2, Senior) How do you tune PostgreSQL autovacuum for a high-write workload?
6. (Quick Answer, P2, Senior) How do materialized views improve query performance?
7. (Quick Answer, P2, Staff) When do query hints help and when do they make things worse?
8. (Deep Dive, P2, Staff) How does partition pruning speed up queries on partitioned tables?
9. (Scenario, P0, Senior) A dashboard query aggregating 1B rows takes 45 seconds. Walk through 5 optimization steps.
10. (Quick Answer, P3, Staff) How does Google Spanner's query optimizer work at global scale?

### File 13: `database-consistency-models.md` — 10 questions
1. (Quick Answer, P0, Mid) What is eventual consistency and when is it acceptable?
2. (Quick Answer, P1, Mid) What is the difference between strong, causal, and eventual consistency?
3. (Deep Dive, P1, Senior) How does DynamoDB implement eventual vs strong consistency per-request?
4. (Quick Answer, P1, Senior) What is read-your-writes consistency and how do you achieve it?
5. (Deep Dive, P2, Senior) How does CockroachDB implement linearizability using hybrid logical clocks?
6. (Quick Answer, P2, Senior) What are the consistency models available in MongoDB?
7. (Quick Answer, P2, Staff) How do you design around eventual consistency without confusing users?
8. (Deep Dive, P2, Staff) How does Google Spanner achieve external consistency globally?
9. (Scenario, P1, Senior) Users see stale data after an update — your read replicas are lagging. What are your options?
10. (Quick Answer, P3, Staff) How does the CALM theorem relate to distributed consistency?

### File 14: `multi-tenancy-database-patterns.md` — 10 questions
1. (Quick Answer, P0, Mid) What are the 3 multi-tenancy database patterns (shared table, shared schema, separate DB)?
2. (Deep Dive, P0, Senior) How do you choose between multi-tenancy patterns for a SaaS product?
3. (Quick Answer, P1, Mid) How do you prevent data leakage between tenants in a shared table?
4. (Deep Dive, P1, Senior) How do you handle per-tenant performance isolation in a shared database?
5. (Quick Answer, P2, Senior) How do you implement tenant-aware connection pooling?
6. (Quick Answer, P2, Senior) How do you run schema migrations when tenants are on different schema versions?
7. (Deep Dive, P2, Staff) How does Salesforce achieve multi-tenancy for 150K+ customers in a shared Oracle DB?
8. (Quick Answer, P2, Staff) How do you implement per-tenant rate limiting at the database layer?
9. (Scenario, P1, Senior) A noisy tenant is consuming 80% of DB CPU, degrading all other tenants. How do you fix it?
10. (Quick Answer, P3, Staff) How does PlanetScale's branching model help with multi-tenant schema management?

### File 15: `database-backup-recovery.md` — 10 questions
1. (Quick Answer, P0, Mid) What is the difference between RTO and RPO?
2. (Quick Answer, P1, Mid) What is the difference between full, incremental, and differential backups?
3. (Deep Dive, P1, Senior) How do you implement point-in-time recovery (PITR) for PostgreSQL?
4. (Quick Answer, P1, Senior) How do you test that your backups actually work?
5. (Deep Dive, P2, Senior) How do you achieve RPO <1 minute for a critical transactional database?
6. (Quick Answer, P2, Senior) How do you restore a 5TB database to a specific point in time?
7. (Quick Answer, P2, Staff) How does AWS RDS automated backup work under the hood?
8. (Deep Dive, P2, Staff) How do you design a disaster recovery strategy across two AWS regions?
9. (Scenario, P1, Senior) Production database corrupted at 2pm. Last backup is 11pm yesterday. What is your recovery plan?
10. (Quick Answer, P3, Staff) How does Cloudflare implement zero-data-loss replication across global data centers?

- [ ] Write all 15 files with full content
- [ ] Commit: `git commit -m "feat(question-bank): add databases questions (150 questions, 15 files)"`

---

## Task 3: Distributed Systems + Caching (22 files, ~220 questions)

**Directories:**
- `docs-site/content/12-interview-prep/question-bank/distributed-systems/`
- `docs-site/content/12-interview-prep/question-bank/caching-performance/`

### Distributed Systems files (12 files, ~120 questions):

**`cap-theorem-real-world.md`** (10 Qs): CAP theorem definition; CP vs AP choice; network partition practical meaning; how DynamoDB and Zookeeper choose sides; CA systems myth; designing around partition tolerance; real examples from Discord, Cassandra, HBase; choosing consistency level per operation; PACELC theorem extension; when eventual consistency costs money

**`consensus-algorithms.md`** (10 Qs): Paxos simplified; Raft vs Paxos; leader election in Raft; log replication; what happens on leader failure; quorum definition and math; how etcd implements Raft; Raft safety vs liveness trade-off; Byzantine fault tolerance; how Kafka uses Raft for KRaft mode

**`distributed-transactions.md`** (10 Qs): Why distributed transactions are hard; 2PC definition and failure modes; 3PC and why it's rarely used; Saga pattern overview; compensating transactions; how Google Spanner implements distributed transactions; XA transactions; when NOT to use distributed transactions; idempotent retries as an alternative; how Stripe handles payment distributed transactions

**`event-sourcing-cqrs.md`** (10 Qs): Event sourcing definition; CQRS definition; why use them together; event store design; replaying events; eventual consistency in CQRS; how Axon Framework implements this; projection rebuilds; event schema evolution; how Shopify uses event sourcing

**`saga-pattern.md`** (10 Qs): Saga vs 2PC; choreography vs orchestration sagas; compensating transactions design; how to handle partial failures; saga execution coordinator; how Uber uses sagas for trip lifecycle; idempotency in saga steps; saga rollback; testing sagas; when NOT to use saga

**`leader-election.md`** (10 Qs): Why leader election is needed; bully algorithm; ring algorithm; ZooKeeper-based election; etcd-based election; split-brain scenario; fencing tokens for stale leaders; how Kafka elects partition leaders; what happens if leader election loops; how Kubernetes elects controller manager leader

**`clock-synchronization.md`** (10 Qs): Why clocks drift in distributed systems; NTP limitations; logical clocks (Lamport timestamps); vector clocks; Hybrid Logical Clocks (HLC); how Google Spanner uses TrueTime; timestamp ordering in distributed DBs; event ordering without synchronized clocks; clock skew causing bugs; how CockroachDB handles time uncertainty

**`partition-tolerance.md`** (10 Qs): What a network partition is; how to detect partitions; designing read/write behavior during partitions; returning stale data vs errors; how DynamoDB handles partitions; partition recovery and reconciliation; split-brain definition; fencing tokens; how ZooKeeper handles partitions; designing user-facing error messages during partitions

**`gossip-protocol.md`** (10 Qs): How gossip protocol works; what Cassandra uses gossip for; failure detection via gossip; convergence time math; gossip vs consensus; SWIM protocol; how gossip handles node churn; anti-entropy in gossip; gossip vs broadcast; how Consul uses gossip for service discovery

**`vector-clocks.md`** (10 Qs): Vector clocks definition; happens-before relationship; concurrent event detection; how Amazon Dynamo uses vector clocks; vector clock size growth problem; version vectors vs vector clocks; conflict detection and resolution; how Riak uses vector clocks; dotted version vectors; practical implementation pseudocode

**`two-phase-commit.md`** (10 Qs): 2PC protocol steps; coordinator failure scenarios; participant failure scenarios; blocking problem in 2PC; 3PC as improvement; how MySQL implements XA; 2PC vs Saga; when coordinator crashes after PREPARE; 2PC in microservices; how Google Spanner avoids 2PC coordinator bottleneck

**`idempotency-at-scale.md`** (10 Qs): What idempotency is and why it matters; idempotency keys pattern; storing idempotency keys; TTL for idempotency records; idempotency vs deduplication; making non-idempotent operations idempotent; how Stripe implements idempotency keys; at-least-once vs exactly-once delivery; idempotent consumers in Kafka; idempotency in payment retries

### Caching files (10 files, ~100 questions):

**`cache-invalidation-strategies.md`** (10 Qs): Why cache invalidation is hard; TTL-based invalidation; event-driven invalidation; write-through invalidation; cache tags; how Varnish implements tag-based invalidation; Facebook's cache invalidation at scale; stale-while-revalidate; cache versioning (cache busting); CDN invalidation propagation delay

**`redis-advanced-patterns.md`** (10 Qs): Redis sorted sets for leaderboards; Redis Lua scripts for atomic operations; Redis pub/sub vs Streams; Redis Streams for event sourcing; Redis BITFIELD for compact data; Redis bloom filters (RedisBloom); Redis probabilistic data structures; Redis cluster vs Sentinel; Redis pipelining for throughput; Redis memory optimization techniques

**`cdn-caching-strategies.md`** (10 Qs): Cache-Control headers (max-age, s-maxage, no-cache, no-store); ETag and Last-Modified; CDN cache hit ratio optimization; origin shield pattern; CDN cache warming; geographic cache distribution; CDN cache partitioning by URL; how Netflix Open Connect works; CDN failover; private vs shared cache

**`database-query-caching.md`** (10 Qs): Query result caching vs row caching; when DB query cache helps vs hurts; application-level query caching; cache key design for queries; how to invalidate cached query results; read-through cache pattern; caching paginated results; caching aggregated results; how ProxySQL caches MySQL queries; caching in GraphQL resolvers

**`cache-stampede-thundering-herd.md`** (10 Qs): Cache stampede definition; probabilistic early expiration (XFetch); mutex lock on cache miss; request coalescing; stale-while-revalidate to prevent stampede; pre-warming caches before expiry; distributed lock for single-filler pattern; how Reddit handles cache stampedes; jitter in TTL to spread expiry; background refresh pattern

**`application-layer-caching.md`** (10 Qs): In-process cache (L1) vs distributed cache (L2); Guava Cache / Caffeine patterns; LRU vs LFU eviction in application caches; cache size limits and monitoring; serialization overhead for distributed caches; cache consistency between application instances; session caching; API response caching; how Spring Cache abstraction works; near-cache pattern

**`cache-sizing-eviction.md`** (10 Qs): How to calculate required cache size; hit rate math; eviction policy comparison (LRU, LFU, ARC, LFRU); which eviction policy for which workload; Redis maxmemory-policy settings; memory fragmentation in Redis; cache efficiency metrics; working set size estimation; eviction vs expiration difference; how to right-size Redis in production

**`write-behind-write-through.md`** (10 Qs): Write-through definition and latency impact; write-behind (write-back) definition and durability risk; write-around definition; when to use each; write-behind failure recovery; how write-behind handles ordering; combining read and write cache strategies; write-through in read-heavy vs write-heavy workloads; how MySQL InnoDB buffer pool uses write-behind; production example from PayPal

**`multi-level-caching.md`** (10 Qs): L1/L2/L3 cache hierarchy in software; browser cache → CDN → app cache → DB cache layers; cache coherence between levels; updating all cache levels on write; hierarchy invalidation cascade; how Facebook's Memcache uses multi-level caching; TAO (Facebook's graph cache); near-cache pattern; cost vs latency trade-off per tier; designing cache hierarchy for a global system

**`cache-warming-strategies.md`** (10 Qs): Cold cache problem on startup; lazy vs eager warming; pre-warming from DB on deployment; shadow traffic replaying for warming; warming order (hot keys first); how Netflix warms edge caches before a big release; cache warming in blue-green deployments; ML-driven cache warming (predict what to warm); warming time estimation; how to validate a cache is warm enough

- [ ] Write all 22 files with full content
- [ ] Commit: `git commit -m "feat(question-bank): add distributed-systems + caching questions (220 questions, 22 files)"`

---

## Task 4: APIs & Networking + Security & Auth (15 files, ~150 questions)

**Directories:**
- `docs-site/content/12-interview-prep/question-bank/apis-networking/`
- `docs-site/content/12-interview-prep/question-bank/security-auth/`

### APIs & Networking (8 files, ~80 questions):

**`rest-api-design-principles.md`** (10 Qs): REST constraints (stateless, uniform interface); resource naming conventions; HTTP verb semantics (GET/POST/PUT/PATCH/DELETE); status code selection; pagination (cursor vs offset); HATEOAS; idempotency of HTTP verbs; REST vs RPC; API design anti-patterns; how Stripe's API design influenced industry standards

**`graphql-design-patterns.md`** (10 Qs): GraphQL vs REST trade-offs; N+1 problem in GraphQL and DataLoader solution; schema design principles; mutations vs queries; subscriptions for real-time; persisted queries; schema stitching vs federation; GraphQL caching challenges; rate limiting in GraphQL; how GitHub migrated from REST to GraphQL

**`grpc-and-protobuf.md`** (10 Qs): gRPC vs REST vs GraphQL; protobuf binary encoding efficiency; service definition (.proto files); unary vs streaming RPCs; gRPC error codes; gRPC load balancing challenges; deadline propagation; gRPC-web for browser clients; backward-compatible protobuf schema evolution; how Google uses gRPC internally

**`websockets-long-polling.md`** (10 Qs): WebSocket handshake; WebSocket vs HTTP long-polling vs SSE; sticky sessions with WebSockets; scaling WebSocket connections; WebSocket connection limits per server; reconnection strategies; message ordering via WebSockets; how Slack uses WebSockets; WebSocket security (CSRF, origin validation); WebSocket load balancing

**`api-versioning-strategies.md`** (10 Qs): URL versioning vs header versioning vs content negotiation; when to version vs evolve; sunset headers for deprecated APIs; backward compatibility rules; additive vs breaking changes; how Stripe handles multi-year API version support; versioning in GraphQL; microservices API contract versioning; API changelog design; version deprecation communication

**`api-gateway-patterns.md`** (10 Qs): BFF (Backend for Frontend) pattern; API composition pattern; request aggregation; response transformation; protocol translation (REST → gRPC); gateway circuit breaking; gateway vs service mesh; how Netflix Zuul handles API gateway; API gateway in serverless architectures; Kong plugin architecture

**`http-internals.md`** (10 Qs): HTTP/1.1 vs HTTP/2 vs HTTP/3 key differences; head-of-line blocking; HTTP/2 multiplexing; QUIC protocol in HTTP/3; TLS handshake steps; HTTP caching headers (ETag, Cache-Control, Vary); keep-alive connections; chunked transfer encoding; content negotiation; how CDNs use HTTP/2 server push

**`dns-load-balancing.md`** (10 Qs): How DNS resolution works (recursive vs authoritative); DNS TTL and caching; DNS-based load balancing; GeoDNS for regional routing; anycast routing; DNS failover; split-horizon DNS; DNS-over-HTTPS; how Cloudflare uses DNS for DDoS protection; DNS propagation delay and impact on deployments

### Security & Auth (7 files, ~70 questions):

**`authentication-patterns.md`** (10 Qs): Password hashing (bcrypt vs Argon2); salting; credential stuffing attacks; MFA implementation; TOTP algorithm; passkeys/WebAuthn; session fixation attacks; brute force protection; secure password reset flow; how GitHub implemented passkeys

**`authorization-rbac-abac.md`** (10 Qs): RBAC definition and data model; ABAC definition and policy engine; ReBAC (relationship-based); RBAC vs ABAC trade-offs; role explosion problem; permission inheritance; deny vs allow precedence; how Google Zanzibar implements ReBAC at 10M QPS; Open Policy Agent (OPA); AWS IAM policy evaluation

**`oauth2-oidc.md`** (10 Qs): OAuth2 grant types (authorization code, client credentials, device); PKCE for mobile; OIDC on top of OAuth2; access token vs refresh token; token rotation; OAuth2 scopes; implicit flow deprecation; JWT vs opaque tokens for OAuth; OAuth2 security pitfalls (redirect URI, state param); how Slack implements OAuth for third-party apps

**`jwt-sessions-cookies.md`** (10 Qs): JWT structure (header, payload, signature); JWT vs opaque session tokens; stateless vs stateful sessions; JWT revocation problem; refresh token rotation; secure cookie attributes (HttpOnly, SameSite, Secure); session fixation; CSRF with cookies; token storage (localStorage vs cookie vs memory); how Auth0 handles token refresh

**`encryption-at-rest-transit.md`** (10 Qs): Symmetric vs asymmetric encryption; AES-256 for data at rest; TLS 1.3 improvements; certificate pinning; key rotation without downtime; envelope encryption; AWS KMS for key management; database field-level encryption; encrypted backups; how Stripe handles cardholder data encryption

**`api-security-patterns.md`** (10 Qs): OWASP API Top 10; API key management; mutual TLS (mTLS); request signing (AWS SigV4 style); SQL injection in API parameters; rate limiting for security; API input validation; sensitive data in URL params; CORS configuration; how Twilio secures webhook delivery

**`zero-trust-architecture.md`** (10 Qs): Zero trust principles (never trust, always verify); identity-centric security; microsegmentation; service-to-service authentication; BeyondCorp model; how Google implemented zero trust internally; SPIFFE/SPIRE for workload identity; zero trust vs VPN; device trust signals; zero trust implementation roadmap for an existing company

- [ ] Write all 15 files with full content
- [ ] Commit: `git commit -m "feat(question-bank): add apis-networking + security-auth questions (150 questions, 15 files)"`

---

## Task 5: Cloud & DevOps + Algorithms & Patterns (13 files, ~130 questions)

**Directories:**
- `docs-site/content/12-interview-prep/question-bank/cloud-devops/`
- `docs-site/content/12-interview-prep/question-bank/algorithms-patterns/`

### Cloud & DevOps (7 files, ~70 questions):

**`kubernetes-architecture.md`** (10 Qs): K8s control plane components; Pod scheduling; ReplicaSet vs Deployment; Service types (ClusterIP, NodePort, LoadBalancer); ConfigMap vs Secret; HPA (Horizontal Pod Autoscaler) algorithm; persistent volumes and storage classes; K8s networking (CNI, kube-proxy); RBAC in Kubernetes; how Kubernetes handles node failure

**`cicd-pipeline-design.md`** (10 Qs): CI vs CD vs CD (continuous deployment); pipeline stages (lint, test, build, scan, deploy); artifact management; environment promotion strategy; canary deployments in CI/CD; rollback strategy; feature flags in deployment; parallel test execution; pipeline as code (Jenkinsfile, GitHub Actions); how Netflix deploys 1000 times per day

**`aws-core-services.md`** (10 Qs): EC2 vs Lambda vs ECS vs EKS decision matrix; S3 storage classes and lifecycle; RDS vs Aurora vs DynamoDB; SQS vs SNS vs EventBridge; VPC design (public/private subnets, NAT); CloudFront + S3 static hosting; IAM least-privilege design; Route53 routing policies; Auto Scaling group strategies; AWS Well-Architected Framework pillars

**`infrastructure-as-code.md`** (10 Qs): IaC benefits; Terraform vs CloudFormation vs Pulumi; Terraform state management; module design; drift detection; IaC testing strategies; secrets management in IaC; GitOps workflow; immutable infrastructure pattern; how Stripe manages infrastructure at scale with Terraform

**`blue-green-canary-deployments.md`** (10 Qs): Blue-green deployment mechanics; database migration in blue-green; canary deployment vs blue-green; traffic splitting strategies; feature flags as lightweight canary; monitoring canary health; automatic rollback triggers; shadow deployment (dark launch); A/B testing vs canary; how Facebook deploys code to 1% of users first

**`container-orchestration.md`** (10 Qs): Container vs VM; Docker image layers and caching; container registry design; container networking; resource limits (CPU/memory requests vs limits); container security (non-root, read-only filesystem); multi-container pods (sidecar pattern); service mesh (Istio); container image scanning; how Shopify runs containers at scale

**`cloud-cost-optimization.md`** (10 Qs): Reserved vs On-demand vs Spot instances; right-sizing compute; S3 storage class optimization; data transfer cost reduction; unused resource cleanup; cost allocation tags; FinOps practices; auto-scaling to reduce idle capacity; CDN cost vs origin cost trade-off; how Netflix saves $1B/year on AWS bills

### Algorithms & Patterns (6 files, ~60 questions):

**`consistent-hashing.md`** (10 Qs): Why consistent hashing over modulo hashing; virtual nodes; minimal key remapping on node change; consistent hashing in Cassandra; consistent hashing in Memcached; load imbalance with few nodes; weighted virtual nodes; consistent hashing for sharding; consistent hashing in CDN routing; implementation pseudocode with sorted ring

**`bloom-filters-hyperloglog.md`** (10 Qs): Bloom filter definition and false positive rate; hash function count tradeoff; Bloom filter size formula; Counting Bloom Filter (deletion support); Scalable Bloom Filter; HyperLogLog for cardinality estimation; HyperLogLog error rate; Redis PFADD/PFCOUNT; how Cassandra uses Bloom filters for SSTable lookup; how YouTube uses HLL for unique view counts

**`rate-limiting-algorithms.md`** (10 Qs): Fixed window counter; sliding window log; sliding window counter; token bucket (how Stripe uses it); leaky bucket; comparison table (memory, accuracy, burst behavior); distributed rate limiting across multiple servers; sliding window with Redis sorted sets (pseudocode); rate limit by user + IP simultaneously; adaptive rate limiting based on server load

**`data-structures-at-scale.md`** (10 Qs): Skip list for O(log n) ordered operations (Redis sorted set); LSM tree for write-heavy workloads; B-tree for read-heavy; Count-Min Sketch for frequency estimation; MinHash for similarity estimation; inverted index for full-text search; bitmap indexes for low-cardinality columns; Trie for autocomplete; circular buffer for time-window aggregation; priority queue for job scheduling

**`search-algorithms-systems.md`** (10 Qs): Inverted index construction; TF-IDF ranking; BM25 improvements; how Elasticsearch indexes documents; fuzzy search with edit distance; phonetic search (Soundex); n-gram tokenization; vector similarity search (cosine, dot product); ANN (approximate nearest neighbor) algorithms (HNSW, IVF); how Google ranks search results (PageRank concept)

**`approximation-algorithms.md`** (10 Qs): When to use approximation over exact answers; reservoir sampling for streaming data; top-K with Min-Heap; approximate percentile (t-digest); Count-Min Sketch for heavy hitters; HyperLogLog for unique counts; locality-sensitive hashing for similarity; approximate joins in big data; how Twitter's trending topics use approximation; trade-off table: accuracy vs memory vs speed

- [ ] Write all 13 files with full content
- [ ] Commit: `git commit -m "feat(question-bank): add cloud-devops + algorithms questions (130 questions, 13 files)"`

---

## Task 6: AI/ML + Observability + Mobile (15 files, ~150 questions)

**Directories:**
- `docs-site/content/12-interview-prep/question-bank/ai-ml-systems/`
- `docs-site/content/12-interview-prep/question-bank/observability-sre/`
- `docs-site/content/12-interview-prep/question-bank/mobile-architecture/`

### AI/ML Systems (8 files, ~80 questions):

**`ml-pipeline-design.md`** (10 Qs): ML pipeline stages (ingest, transform, train, evaluate, serve); feature engineering at scale; training pipeline parallelization; model versioning; data versioning (DVC); pipeline orchestration (Airflow, Kubeflow); online vs offline features; data quality monitoring; how Uber's Michelangelo ML platform works; ML pipeline failure recovery

**`llm-system-design.md`** (10 Qs): LLM inference architecture; token generation latency (TTFT vs TPOT); KV cache for inference; batching strategies (continuous batching); GPU memory constraints; model parallelism (tensor, pipeline, data); quantization (INT8, INT4) trade-offs; how OpenAI serves GPT-4 at scale; prompt caching; multi-model routing by capability and cost

**`rag-architecture.md`** (10 Qs): RAG definition vs fine-tuning; chunking strategies (fixed, semantic, hierarchical); embedding model selection; vector store comparison (Pinecone, Weaviate, pgvector); retrieval strategies (dense, sparse, hybrid); re-ranking; context window management; RAG evaluation metrics (faithfulness, relevance); how Notion AI implements RAG; multi-hop reasoning in RAG

**`vector-database-design.md`** (10 Qs): Vector index types (HNSW, IVF-PQ, FAISS); ANN search trade-offs (recall vs speed); dimension reduction; filtering with vector search; distributed vector search; vector database vs traditional DB; pgvector vs dedicated vector DB; how Spotify uses vectors for music recommendations; embedding drift; vector DB cost at scale

**`model-serving-infrastructure.md`** (10 Qs): Online vs batch serving; model server (TorchServe, Triton); GPU vs CPU serving trade-offs; model warm-up; A/B testing model versions; shadow scoring; latency optimization (caching, batching); auto-scaling model servers; how Airbnb serves 100+ ML models; model rollback strategy

**`feature-store-design.md`** (10 Qs): Feature store definition; online vs offline feature store; feature freshness; point-in-time correctness; feature sharing across teams; feature backfill; how Uber's Feast works; feature transformation at serve time vs training time; feature monitoring for drift; how Doordash's Riviera feature store handles real-time features

**`ab-testing-ml-models.md`** (10 Qs): A/B test design for ML models; statistical significance calculation; minimum sample size; metric selection (guardrail vs success metrics); multi-armed bandit vs A/B test; interleaving for ranking models; experiment isolation (network effects); how Netflix runs 1000 A/B tests simultaneously; holdout groups; sequential testing to stop early

**`ai-agent-architecture.md`** (10 Qs): Agent loop design (perceive, plan, act, reflect); tool calling reliability; multi-agent coordination patterns; agent memory (short-term, long-term, episodic); context window management for long tasks; human-in-the-loop checkpoints; agent observability (trace agent steps); prompt injection defense; how Anthropic's Claude handles tool use; agent failure recovery

### Observability & SRE (5 files, ~50 questions):

**`distributed-tracing.md`** (10 Qs): What distributed tracing solves (vs logs); trace, span, context propagation; W3C TraceContext standard; sampling strategies (head, tail, adaptive); how Jaeger stores and queries traces; how to instrument without code changes (auto-instrumentation); trace analysis for latency debugging; connecting traces to logs and metrics; how Uber reduced p99 latency 40% using tracing; OpenTelemetry collector design

**`metrics-alerting-design.md`** (10 Qs): Four golden signals (latency, traffic, errors, saturation); USE method (utilization, saturation, errors); RED method; alert threshold vs anomaly detection; alert fatigue and how to reduce it; on-call escalation design; runbook automation; how PagerDuty reduces noise; SLO-based alerting; alerting lag vs false positive trade-off

**`log-aggregation-systems.md`** (10 Qs): Structured vs unstructured logging; log levels and when to use each; ELK stack (Elasticsearch, Logstash, Kibana) architecture; Loki vs Elasticsearch for logs; log sampling strategies; log retention and cost; correlation ID for request tracing; log parsing and normalization; how Cloudflare processes 10M log events/sec; GDPR compliance in logging (PII scrubbing)

**`slo-sla-error-budgets.md`** (10 Qs): SLI vs SLO vs SLA definitions; choosing the right SLI; error budget calculation; error budget burn rate alerts; what to do when error budget is exhausted; rolling vs calendar window for SLOs; multi-window multi-burn-rate alerting (Google's approach); SLO for asynchronous systems; SLO for batch pipelines; how Spotify uses error budgets to balance reliability and velocity

**`incident-response-systems.md`** (10 Qs): Incident severity classification; on-call rotation design; incident commander role; communication channel design (war room, status page); postmortem process (blameless); 5 whys vs fault tree analysis; how to design a status page (Statuspage.io); runbook design; chaos engineering as proactive incident prevention; how Google SRE handles production incidents

### Mobile Architecture (2 files, ~20 questions):

**`offline-sync-patterns.md`** (10 Qs): Offline-first architecture; conflict resolution strategies (LWW, CRDT, user-prompted); optimistic updates; local database (SQLite, Realm, WatermelonDB); sync protocol design; delta sync (only sync changes); background sync on reconnect; how Notion implements offline editing; sync queue for pending operations; handling sync failures gracefully

**`mobile-app-architecture.md`** (10 Qs): MVC vs MVVM vs MVI on mobile; reactive state management; deep linking architecture; push notification architecture; app size optimization; code splitting / modularization; mobile CI/CD pipeline; crash reporting design; A/B testing on mobile; how Instagram's mobile architecture handles feed rendering for 2B users

- [ ] Write all 15 files with full content
- [ ] Commit: `git commit -m "feat(question-bank): add ai-ml + observability + mobile questions (150 questions, 15 files)"`

---

## Task 7: Master Index + Role Pages (assembly task — runs after Tasks 1–6)

**Files:**
- `docs-site/content/12-interview-prep/question-bank/index.md` (replace placeholder)
- `docs-site/content/12-interview-prep/roles/index.md`
- `docs-site/content/12-interview-prep/roles/backend-engineer.md`
- `docs-site/content/12-interview-prep/roles/senior-engineer.md`
- `docs-site/content/12-interview-prep/roles/solution-architect.md`
- `docs-site/content/12-interview-prep/roles/frontend-engineer.md`
- `docs-site/content/12-interview-prep/roles/devops-sre.md`
- `docs-site/content/12-interview-prep/roles/fullstack-mid.md`
- `docs-site/content/12-interview-prep/roles/data-engineer.md`
- `docs-site/content/12-interview-prep/roles/ml-ai-engineer.md`
- `docs-site/content/12-interview-prep/roles/security-engineer.md`
- `docs-site/content/12-interview-prep/roles/mobile-engineer.md`

- [ ] Replace `question-bank/index.md` with full master index:

```markdown
---
title: "Interview Question Bank — Master Index"
---
# Interview Question Bank

1,000+ interview questions across 11 topics and 10 engineering roles.
Sorted by priority. All questions link to full answers with diagrams and real-world examples.

## How to use this index
- **P0** = must-know cold before any senior interview
- **P1** = differentiates strong candidates
- **P2/P3** = specialist depth — study after P0/P1
- Filter by **Role** column to find questions for your target position
- Click question to go to full answer with diagrams

## 📋 Full Question Table

| # | Question | Role | Topic | Difficulty | Format | Priority | Real Company |
|---|----------|------|-------|------------|--------|----------|--------------|
| 1 | [Design a URL shortener](./system-design/design-url-shortener.md#q1) | Backend, Senior | System Design | 🔴 Senior | Scenario | P0 | Bitly, TinyURL |
| 2 | [How do you generate unique short codes?](./system-design/design-url-shortener.md#q2) | Backend, Mid | System Design | 🟡 Mid | Quick Answer | P0 | Bitly |
... (continue for all ~1000 questions)
```

- [ ] Write `roles/index.md` — role selector page with summary table:

```markdown
---
title: "Interview Prep by Role"
---
# Choose Your Role

| Role | Questions | P0 Focus | Avg Interview Length |
|------|-----------|----------|---------------------|
| [⚙️ Backend Engineer](./backend-engineer) | 180 | Databases, APIs, Caching | 90 min |
| [🔴 Senior Engineer](./senior-engineer) | 200 | Distributed Systems, Scale | 120 min |
...
```

- [ ] Write each of the 10 role pages with:
  - Role overview (what interviewers focus on for this role)
  - Study roadmap (P0 first, then P1, then P2)
  - P0 filtered table (links into question-bank/)
  - P1 filtered table
  - P2 filtered table
  - Recommended study order

**Role → Topic mapping (which questions to include per role):**

| Role | Primary Topics | Secondary Topics |
|------|---------------|-----------------|
| Backend Engineer | Databases, APIs, Caching, System Design | Distributed Systems, Security |
| Senior Engineer | Distributed Systems, System Design, Databases | All topics |
| Solution Architect | System Design, Cloud/DevOps, Security | All topics |
| Frontend Engineer | APIs, Caching (CDN), System Design (feed/chat) | Security (auth), Observability |
| DevOps / SRE | Cloud/DevOps, Observability, System Design | Distributed Systems, Security |
| Full-Stack Mid | APIs, Databases, Caching, System Design | Security |
| Data Engineer | Databases, Algorithms, AI/ML, System Design | Cloud/DevOps |
| ML / AI Engineer | AI/ML, Algorithms, Databases, System Design | Observability |
| Security Engineer | Security, APIs, Cloud/DevOps, System Design | Distributed Systems |
| Mobile Engineer | Mobile, APIs, Caching, System Design | Security |

- [ ] Commit: `git commit -m "feat(question-bank): add master index and 10 role pages"`

---

## Validation Checklist (run after all tasks complete)

- [ ] All internal links resolve (`grep -r "\.\./\.\." docs-site/content/12-interview-prep/question-bank/` — no broken relative paths)
- [ ] All concept reference links point to existing files
- [ ] Every question file has correct frontmatter
- [ ] Every question has at least one Mermaid diagram
- [ ] Master index has ~1000 rows
- [ ] No duplicate questions across files
- [ ] All role pages link only into question-bank/ (no direct content)
- [ ] `_meta.js` updated in root interview-prep directory
- [ ] `npm run build` passes in docs-site/

---

## Quick reference: existing concept article paths

Link to these from question answers (do not duplicate their content):

| Topic | Existing Article Path |
|-------|----------------------|
| API Design | `../../system-design/fundamentals/api-design-rest-graphql-grpc` |
| Rate Limiting | `../../system-design/fundamentals/rate-limiting` |
| Caching Strategies | `../../system-design/fundamentals/caching-strategies` |
| Load Balancing | `../../system-design/fundamentals/load-balancing` |
| Circuit Breaker | `../../system-design/fundamentals/circuit-breaker-pattern` |
| SQL vs NoSQL | `../../system-design/storage-and-databases/sql-vs-nosql` |
| Database Sharding | `../../system-design/storage-and-databases/database-sharding` |
| DB Replication | `../../system-design/storage-and-databases/database-replication` |
| Kafka/Messaging | `../../system-design/messaging-and-streaming/kafka-rabbitmq` |
| CDN Design | `../../system-design/scale-and-reliability/cdn-design` |
| Microservices | `../../system-design/scale-and-reliability/microservices-migration` |
| Observability | `../../system-design/scale-and-reliability/observability` |
| WebSockets | `../../system-design/real-time-systems/websockets-real-time` |
| Checkout/Payments | `../../system-design/business-and-advanced/ecommerce-checkout` |
| Fraud Detection | `../../system-design/business-and-advanced/fraud-detection` |
| Recommendation | `../../system-design/business-and-advanced/recommendation-system` |
| Saga/CQRS | `../../system-design/business-and-advanced/saga-cqrs-patterns` |
| RAG | `../../system-design/ai-and-agents/rag-retrieval-augmented-generation` |
| AI Agents | `../../system-design/ai-and-agents/agent-loop-tool-calling` |
| AWS Quick Ref | `../../quick-reference/aws-cloud/` |
| Security Quick Ref | `../../quick-reference/security-encryption/` |
| DB Quick Ref | `../../quick-reference/database-storage/` |
| Caching Quick Ref | `../../quick-reference/caching-cdn/` |
