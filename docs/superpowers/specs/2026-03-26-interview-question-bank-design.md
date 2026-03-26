# Design Spec: Interview Question Bank (1000+ Questions)

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Add 1000+ interview questions across 10 roles and 11 topics to the system design knowledge base

---

## 1. Goal

Build a comprehensive, role-indexed interview question bank with 1000+ questions covering 10 engineering roles and 11 topic areas. Questions link to existing concept articles (single source of truth) rather than duplicating content. The bank is navigable via a master index table and per-role filtered views.

---

## 2. Constraints

- **No content duplication:** Concept explanations live in `system-design/` and `quick-reference/`. Questions link to them.
- **Single source of truth:** `question-bank/` is the only place questions live. Role pages are filtered views only.
- **No actual code:** Pseudo-code and diagrams only.
- **80/20 principle:** P0 questions (20%) cover 70%+ of real interview coverage.
- **All links must resolve** to real files.
- **No duplicate questions** across any file.

---

## 3. File Structure

```
docs-site/content/12-interview-prep/
├── question-bank/
│   ├── index.md                        ← master index (1000-row table, 8 columns)
│   ├── _meta.js
│   ├── system-design/                  ← 20 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── design-url-shortener.md
│   │   ├── design-notification-system.md
│   │   ├── design-rate-limiter.md
│   │   ├── design-chat-system.md
│   │   ├── design-news-feed.md
│   │   ├── design-video-streaming.md
│   │   ├── design-search-autocomplete.md
│   │   ├── design-ride-sharing.md
│   │   ├── design-payment-system.md
│   │   ├── design-distributed-cache.md
│   │   ├── design-cdn.md
│   │   ├── design-api-gateway.md
│   │   ├── design-job-scheduler.md
│   │   ├── design-file-storage.md
│   │   ├── design-location-service.md
│   │   ├── design-recommendation-engine.md
│   │   ├── design-ad-click-aggregator.md
│   │   ├── design-web-crawler.md
│   │   ├── design-metrics-monitoring.md
│   │   └── design-distributed-locking.md
│   ├── databases/                      ← 15 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── sql-vs-nosql-decisions.md
│   │   ├── database-sharding-deep-dive.md
│   │   ├── database-replication-patterns.md
│   │   ├── indexing-strategies.md
│   │   ├── transactions-acid-base.md
│   │   ├── connection-pooling.md
│   │   ├── database-migrations-at-scale.md
│   │   ├── time-series-databases.md
│   │   ├── graph-databases.md
│   │   ├── document-databases.md
│   │   ├── wide-column-stores.md
│   │   ├── query-optimization.md
│   │   ├── database-consistency-models.md
│   │   ├── multi-tenancy-database-patterns.md
│   │   └── database-backup-recovery.md
│   ├── distributed-systems/            ← 12 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── cap-theorem-real-world.md
│   │   ├── consensus-algorithms.md
│   │   ├── distributed-transactions.md
│   │   ├── event-sourcing-cqrs.md
│   │   ├── saga-pattern.md
│   │   ├── leader-election.md
│   │   ├── clock-synchronization.md
│   │   ├── partition-tolerance.md
│   │   ├── gossip-protocol.md
│   │   ├── vector-clocks.md
│   │   ├── two-phase-commit.md
│   │   └── idempotency-at-scale.md
│   ├── caching-performance/            ← 10 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── cache-invalidation-strategies.md
│   │   ├── redis-advanced-patterns.md
│   │   ├── cdn-caching-strategies.md
│   │   ├── database-query-caching.md
│   │   ├── cache-stampede-thundering-herd.md
│   │   ├── application-layer-caching.md
│   │   ├── cache-sizing-eviction.md
│   │   ├── write-behind-write-through.md
│   │   ├── multi-level-caching.md
│   │   └── cache-warming-strategies.md
│   ├── apis-networking/                ← 8 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── rest-api-design-principles.md
│   │   ├── graphql-design-patterns.md
│   │   ├── grpc-and-protobuf.md
│   │   ├── websockets-long-polling.md
│   │   ├── api-versioning-strategies.md
│   │   ├── api-gateway-patterns.md
│   │   ├── http-internals.md
│   │   └── dns-load-balancing.md
│   ├── security-auth/                  ← 7 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── authentication-patterns.md
│   │   ├── authorization-rbac-abac.md
│   │   ├── oauth2-oidc.md
│   │   ├── jwt-sessions-cookies.md
│   │   ├── encryption-at-rest-transit.md
│   │   ├── api-security-patterns.md
│   │   └── zero-trust-architecture.md
│   ├── cloud-devops/                   ← 7 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── kubernetes-architecture.md
│   │   ├── cicd-pipeline-design.md
│   │   ├── aws-core-services.md
│   │   ├── infrastructure-as-code.md
│   │   ├── blue-green-canary-deployments.md
│   │   ├── container-orchestration.md
│   │   └── cloud-cost-optimization.md
│   ├── algorithms-patterns/            ← 6 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── consistent-hashing.md
│   │   ├── bloom-filters-hyperloglog.md
│   │   ├── rate-limiting-algorithms.md
│   │   ├── data-structures-at-scale.md
│   │   ├── search-algorithms-systems.md
│   │   └── approximation-algorithms.md
│   ├── ai-ml-systems/                  ← 8 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── ml-pipeline-design.md
│   │   ├── llm-system-design.md
│   │   ├── rag-architecture.md
│   │   ├── vector-database-design.md
│   │   ├── model-serving-infrastructure.md
│   │   ├── feature-store-design.md
│   │   ├── ab-testing-ml-models.md
│   │   └── ai-agent-architecture.md
│   ├── observability-sre/              ← 5 files × ~10 questions
│   │   ├── _meta.js
│   │   ├── distributed-tracing.md
│   │   ├── metrics-alerting-design.md
│   │   ├── log-aggregation-systems.md
│   │   ├── slo-sla-error-budgets.md
│   │   └── incident-response-systems.md
│   └── mobile-architecture/            ← 2 files × ~10 questions
│       ├── _meta.js
│       ├── offline-sync-patterns.md
│       └── mobile-app-architecture.md
└── roles/
    ├── _meta.js
    ├── index.md                        ← role selection page
    ├── backend-engineer.md
    ├── senior-engineer.md
    ├── solution-architect.md
    ├── frontend-engineer.md
    ├── devops-sre.md
    ├── fullstack-mid.md
    ├── data-engineer.md
    ├── ml-ai-engineer.md
    ├── security-engineer.md
    └── mobile-engineer.md
```

---

## 4. Question Distribution

| Topic | Files | Questions | Priority |
|-------|-------|-----------|----------|
| System Design (end-to-end) | 20 | ~200 | P0 |
| Databases & Storage | 15 | ~150 | P0 |
| Distributed Systems | 12 | ~120 | P0 |
| Caching & Performance | 10 | ~100 | P0 |
| APIs & Networking | 8 | ~80 | P1 |
| Security & Auth | 7 | ~70 | P1 |
| Cloud / AWS / DevOps | 7 | ~70 | P1 |
| Algorithms & Patterns | 6 | ~60 | P1 |
| AI / ML Systems | 8 | ~80 | P2 |
| Observability & SRE | 5 | ~50 | P2 |
| Mobile Architecture | 2 | ~20 | P3 |
| **Total** | **100** | **~1000** | |

---

## 5. Priority Framework

| Priority | % of Questions | Definition |
|----------|---------------|------------|
| P0 | 20% (~200 Q) | Asked in >70% of interviews. Must know cold. |
| P1 | 30% (~300 Q) | Asked regularly, differentiates good from great. |
| P2 | 35% (~350 Q) | Depth questions, senior+ or specialist roles. |
| P3 | 15% (~150 Q) | Edge cases, niche topics, nice-to-know. |

---

## 6. Three Question Formats

### Format 1: Quick Answer
Used for: P0 common questions, Junior–Mid difficulty
Structure: question → what interviewer tests → 3–5 bullets with numbers → Mermaid diagram (≤8 nodes) → pitfalls → concept link

### Format 2: Deep Dive
Used for: P0 complex questions, Senior–Staff difficulty
Structure: question → constraints (scale/SLA) → Approach A/B/C with diagrams and trade-off tables → recommended answer → "what great answers include" checklist → pitfalls → concept links

### Format 3: Scenario / System Design
Used for: Senior–Architect, real company scenarios
Structure: interview brief → clarifying questions to ask → back-of-envelope estimation table → high-level architecture diagram → component deep-dive → trade-off decisions table → failure modes table → concept links

---

## 7. Master Index Table Schema

```markdown
| # | Question | Role | Topic | Difficulty | Format | Priority | Real Company |
```

- **#**: Sequential number across all 1000 questions
- **Question**: Linked to the actual file/section
- **Role**: Comma-separated (Backend, Senior, Solution Architect, etc.)
- **Topic**: Single topic category
- **Difficulty**: 🟢 Junior / 🟡 Mid / 🔴 Senior / ⚫ Staff
- **Format**: Quick Answer / Deep Dive / Scenario
- **Priority**: P0 / P1 / P2 / P3
- **Real Company**: Companies that use this pattern (Netflix, Amazon, Stripe, etc.)

---

## 8. Role Index Page Structure

Each role page (`roles/backend-engineer.md`) contains:
1. Role overview (what this role's interviews focus on)
2. Study order (which P0 topics to hit first)
3. Filtered table: P0 questions for this role
4. Filtered table: P1 questions for this role
5. Filtered table: P2+ questions for this role
6. All tables link into `question-bank/` files (no content duplication)

---

## 9. Single Source of Truth Rules

- Concept explanations → `system-design/` or `quick-reference/` sections (existing)
- Interview questions → `question-bank/` (new)
- Role-filtered views → `roles/` (new, links only)
- No concept explanations in `question-bank/` files — link to existing articles instead
- No question content in `roles/` files — link to `question-bank/` instead

---

## 10. Implementation Approach

- Use **parallel agents with git worktrees** (one worktree per topic group)
- Each agent handles one topic directory (~10 files)
- Master index assembled after all topic files are complete
- Role pages generated last (depend on master index)
- All internal links validated before merge

---

## 11. Agent Assignment Plan

| Agent | Topic Directory | Files | Questions |
|-------|----------------|-------|-----------|
| Agent 1 | system-design/ | 20 | ~200 |
| Agent 2 | databases/ | 15 | ~150 |
| Agent 3 | distributed-systems/ + caching-performance/ | 22 | ~220 |
| Agent 4 | apis-networking/ + security-auth/ | 15 | ~150 |
| Agent 5 | cloud-devops/ + algorithms-patterns/ | 13 | ~130 |
| Agent 6 | ai-ml-systems/ + observability-sre/ + mobile-architecture/ | 15 | ~150 |
| Agent 7 | master-index + role pages | — | aggregation |
