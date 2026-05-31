---
title: "System Design Problems — 163 Deep Dives"
description: "Production-grade system design walkthroughs for every major interview problem category"
---

# System Design Problems — 163 Deep Dives

A structured collection of 163 system design problems, each with:
- **Multi-level diagrams** — high-level overview + component deep-dives
- **Multiple approaches** — compare 2-3 architectures with trade-off tables
- **Scale problems** — what breaks at 10K, 100K, 1M req/s and how to fix it
- **Pseudo-code** — enough to reason through implementation without being a tutorial
- **Interview links** — mapped to real interview questions in the question bank

---

## How to Use This Section

```
Beginner → Start with 🟢 Easy problems in each category
Intermediate → Tackle 🟡 Medium problems, focus on trade-offs
Advanced → Go deep on 🔴 Hard problems, especially distributed aspects
Senior/Principal → Study 🔴🔴 Advanced problems, multi-system interactions
```

## Categories

| Category | Problems | Difficulty Range |
|----------|----------|-----------------|
| [⚙️ Data Processing](./01-data-processing) | 18 | 🟢–🔴 |
| [📱 Social Platforms](./02-social-platforms) | 8 | 🟡–🔴 |
| [💬 Communication](./03-communication) | 10 | 🟡–🔴 |
| [📅 Reservation & Scheduling](./04-reservation-scheduling) | 12 | 🟢–🔴 |
| [🔧 Infrastructure](./05-infrastructure) | 28 | 🟡–🔴🔴 |
| [🗂️ Storage & Files](./06-storage-files) | 6 | 🔴 |
| [🔒 Security & Payments](./07-security) | 8 | 🟡–🔴🔴 |
| [🔍 Search & Discovery](./08-search-discovery) | 5 | 🟡–🔴 |
| [🤖 AI & Agents](./09-ai-agents) | 16 | 🟢–🔴🔴 |
| [🎯 Object-Oriented Design](./10-object-oriented-design) | 12 | 🟢–🔴 |

---

## Progress

See the full [Progress Tracker](./PROGRESS) for status on all 163 problems.

---

## Core Concepts Woven Throughout

Every article cross-links to foundational concepts. The most frequently referenced:

- [Caching Strategies](/02-caching/concepts/caching-strategies) — appears in 40+ problems
- [Database Replication](/01-databases/concepts/replication-basics) — appears in 30+ problems
- [Message Queues](/04-messaging/concepts/message-queue-basics) — appears in 25+ problems
- [Rate Limiting](/07-api-design/concepts/rate-limiting) — appears in 20+ problems
- [Consistent Hashing](/05-distributed-systems/poc/consistent-hashing-poc) — appears in 15+ problems
- [CAP Theorem](/05-distributed-systems/concepts/cap-theorem-practical) — appears in every distributed problem
