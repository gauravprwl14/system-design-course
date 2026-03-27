---
title: "Interview Question Bank — Master Index"
---

# Interview Question Bank

**1,000+ interview questions** across 11 topic areas and 10 engineering roles. Each question includes role metadata, difficulty, priority (P0–P3), and format (Quick Answer / Deep Dive / Scenario).

## How to Navigate

- **By topic** — use the sidebar to browse questions by domain
- **By role** — see [Role-Based Guides](../roles/) for curated P0/P1 question lists per role
- **By priority** — P0 questions appear in ~70% of interviews; start there

## Topic Index

| Topic | Files | Questions (est.) | Key Areas |
|-------|-------|-----------------|-----------|
| [System Design](/12-interview-prep/question-bank/system-design) | 20 | ~120 | URL shortener, chat, payment, video, ride sharing, news feed, crawler, monitoring |
| [Databases](/12-interview-prep/question-bank/databases) | 15 | ~90 | SQL vs NoSQL, sharding, replication, indexing, ACID, migrations, multi-tenancy |
| [Distributed Systems](/12-interview-prep/question-bank/distributed-systems) | 12 | ~70 | CAP theorem, consensus, saga, 2PC, event sourcing, gossip, vector clocks |
| [Caching & Performance](/12-interview-prep/question-bank/caching-performance) | 10 | ~60 | Invalidation, Redis patterns, CDN, stampede, eviction, write-behind, warming |
| [APIs & Networking](/12-interview-prep/question-bank/apis-networking) | 8 | ~50 | REST, GraphQL, gRPC, WebSockets, versioning, gateway, HTTP, DNS |
| [Security & Auth](/12-interview-prep/question-bank/security-auth) | 7 | ~45 | Authentication, RBAC/ABAC, OAuth2, JWT, encryption, API security, zero trust |
| [AI/ML Systems](/12-interview-prep/question-bank/ai-ml-systems) | 8 | ~50 | ML pipelines, LLM design, RAG, vector DBs, model serving, feature stores, agents |
| [Cloud & DevOps](/12-interview-prep/question-bank/cloud-devops) | 7 | ~40 | Kubernetes, CI/CD, AWS, IaC, blue-green, containers, cost optimization |
| [Algorithms & Patterns](/12-interview-prep/question-bank/algorithms-patterns) | 6 | ~35 | Consistent hashing, Bloom filters, rate limiting, top-K, search, approximation |
| [Observability & SRE](/12-interview-prep/question-bank/observability-sre) | 5 | ~35 | Tracing, metrics, logs, SLOs, incident response |
| [Mobile Architecture](/12-interview-prep/question-bank/mobile-architecture) | 2 | ~12 | Offline-first, sync, performance, push notifications |

**Total: 100 topic files · ~600+ individual questions**

---

## Priority Legend

| Priority | Description | Coverage |
|----------|-------------|----------|
| **P0** | Must know cold — asked in >70% of interviews | ~200 questions |
| **P1** | Differentiators — separate mid from senior | ~250 questions |
| **P2** | Staff/Principal depth — rarely asked but impressive | ~150 questions |

## Difficulty Legend

| Emoji | Level | Experience |
|-------|-------|------------|
| 🟢 | Junior | 0–2 years |
| 🟡 | Mid | 2–5 years |
| 🔴 | Senior | 5–8 years |
| ⚫ | Staff/Principal | 8+ years |

---

## Top P0 Questions by Topic

### System Design (Scenario Format)
1. [Design a URL Shortener](/12-interview-prep/question-bank/system-design/design-url-shortener) — 100M URLs, 10K redirects/sec
2. [Design a Notification System](/12-interview-prep/question-bank/system-design/design-notification-system) — 10M push/email/SMS/day
3. [Design a Rate Limiter](/12-interview-prep/question-bank/system-design/design-rate-limiter) — 10K req/sec, sliding window
4. [Design a Chat System](/12-interview-prep/question-bank/system-design/design-chat-system) — 1M concurrent users, WebSocket
5. [Design a News Feed](/12-interview-prep/question-bank/system-design/design-news-feed) — Instagram/Twitter at 500M users

### Distributed Systems (Deep Dive Format)
1. [CAP Theorem Real World](/12-interview-prep/question-bank/distributed-systems/cap-theorem-real-world) — CP vs AP in production
2. [Consensus Algorithms](/12-interview-prep/question-bank/distributed-systems/consensus-algorithms) — Paxos vs Raft
3. [Saga Pattern](/12-interview-prep/question-bank/distributed-systems/saga-pattern) — distributed transactions for microservices
4. [Idempotency at Scale](/12-interview-prep/question-bank/distributed-systems/idempotency-at-scale) — payment dedup, Stripe
5. [Event Sourcing & CQRS](/12-interview-prep/question-bank/distributed-systems/event-sourcing-cqrs) — audit log, temporal queries

### Databases (Quick Answer + Deep Dive)
1. [SQL vs NoSQL Decisions](/12-interview-prep/question-bank/databases/sql-vs-nosql-decisions) — decision matrix with numbers
2. [Database Sharding Deep Dive](/12-interview-prep/question-bank/databases/database-sharding-deep-dive) — consistent hashing, hot spots
3. [Indexing Strategies](/12-interview-prep/question-bank/databases/indexing-strategies) — B-tree, hash, GIN, partial, covering
4. [Transactions & ACID](/12-interview-prep/question-bank/databases/transactions-acid-base) — isolation levels, phantom reads
5. [Database Replication Patterns](/12-interview-prep/question-bank/databases/database-replication-patterns) — sync vs async, lag

### Security & Auth (Quick Answer)
1. [Authentication Patterns](/12-interview-prep/question-bank/security-auth/authentication-patterns) — bcrypt, MFA, WebAuthn
2. [JWT vs Sessions vs Cookies](/12-interview-prep/question-bank/security-auth/jwt-sessions-cookies) — stateless trade-offs, CSRF
3. [OAuth2 & OIDC](/12-interview-prep/question-bank/security-auth/oauth2-oidc) — 4 flows, PKCE, token refresh
4. [Encryption At Rest & In Transit](/12-interview-prep/question-bank/security-auth/encryption-at-rest-transit) — TLS 1.3, KMS, envelope
5. [API Security Patterns](/12-interview-prep/question-bank/security-auth/api-security-patterns) — SQL injection, XSS, OWASP

---

## Role-Based Entry Points

| Role | Start Here |
|------|-----------|
| Backend Engineer | [Backend Guide](../roles/backend-engineer) |
| Senior Engineer | [Senior Guide](../roles/senior-engineer) |
| Solution Architect | [Architect Guide](../roles/solution-architect) |
| DevOps / SRE | [DevOps Guide](../roles/devops-sre) |
| ML / AI Engineer | [ML Guide](../roles/ml-ai-engineer) |
| Frontend Engineer | [Frontend Guide](../roles/frontend-engineer) |
| Fullstack Mid-Level | [Fullstack Guide](../roles/fullstack-mid) |
| Data Engineer | [Data Guide](../roles/data-engineer) |
| Security Engineer | [Security Guide](../roles/security-engineer) |
| Mobile Engineer | [Mobile Guide](../roles/mobile-engineer) |
