---
title: "⚡ The 12-Article Fast Path"
description: "The 80% of system design knowledge that covers 85% of interview questions. Do these 12 articles in order."
layer: index
section: "00-start-here"
---

# ⚡ The 12-Article Fast Path

We have 529 articles. You need 12 to pass a FAANG system design interview.

Here they are, in order. Do not skip. Do not start at article 8 because it looks interesting. The sequence is deliberate — each article builds vocabulary the next one requires. Article 3 assumes you know article 2. Article 7 assumes you know articles 5 and 6. If you skip, you'll hit a wall and not know why.

Blocked time: ~6 hours total. One article per day for two weeks. Outcome: you can walk into any system design interview and handle the most common 80% of what gets asked.

> **Your commitment:** ~6 hours total · 12 articles · 2 case studies · One defined finish line

---

## The Sequence

1. **[Back-of-Envelope Estimation](/00-start-here/back-of-envelope)**
   Every interview starts with sizing. The interviewer will ask "how many requests per second?" before any architecture discussion. Learn this vocabulary first — it's the language the rest of the course is written in.
   ⏱ ~15 min · 🟢 Beginner

2. **[Scaling Basics](/06-scalability/concepts/scaling-basics)**
   Horizontal vs vertical scaling is the first fork in every design conversation. When do you scale up? When do you scale out? Where does each break? You cannot discuss any other architecture pattern without this.
   ⏱ ~12 min · 🟢 Beginner

3. **[Caching Fundamentals](/02-caching/concepts/caching-fundamentals)**
   Caching is mentioned in 90% of system design interviews. If you don't know eviction policies, TTL, and the difference between a read-through and a cache-aside pattern, you'll lose the thread in half your interviews. Know this cold.
   ⏱ ~18 min · 🟡 Intermediate

4. **[Caching Strategies](/02-caching/concepts/caching-strategies)**
   The patterns — write-through, write-back, write-around — are the actual interview answer when someone asks "how does your cache stay consistent?" Article 3 tells you what caches are. This article tells you how to use them correctly.
   ⏱ ~20 min · 🟡 Intermediate

5. **[Database Replication](/01-databases/concepts/replication-basics)**
   Before you can talk about sharding, you need to understand read replicas. Leader-follower replication is step one of every database scaling conversation. Every senior engineer knows this order: replicate first, shard second.
   ⏱ ~20 min · 🟡 Intermediate

6. **[Sharding Strategies](/01-databases/concepts/sharding-strategies)**
   How you actually split data across multiple database nodes without creating hotspots. Hash sharding vs range sharding vs directory-based — and the specific failures each approach introduces at scale.
   ⏱ ~22 min · 🟡 Intermediate

7. **[Consistent Hashing](/06-scalability/concepts/consistent-hashing-deep-dive)**
   Load balancing, database partitioning, cache routing — all three require this mental model. When you add a node to a naive modulo system, nearly everything remaps. Consistent hashing limits that to ~1/N of keys. Understanding why is essential for articles 6, 9, and both case studies.
   ⏱ ~20 min · 🟡 Intermediate

8. **[CAP Theorem (Practical)](/05-distributed-systems/concepts/cap-theorem-practical)**
   Every "SQL vs NoSQL?" question in an interview is a CAP question in disguise. Every "what happens during a network partition?" question is a CAP question. Learn the actual trade-off engineers face in production — not the theorem, but the decision it forces.
   ⏱ ~15 min · 🟡 Intermediate

9. **[Message Queue Basics](/04-messaging/concepts/message-queue-basics)**
   Async decoupling appears in 70% of system design problems. Notification systems, order processing, feed generation, video transcoding — all of these architectures depend on a queue. At-least-once delivery and idempotency are concepts you'll need immediately in the case studies.
   ⏱ ~18 min · 🟡 Intermediate

10. **[High Availability](/06-scalability/concepts/high-availability)**
    SLAs, failover, redundancy, and the language of production systems. An interviewer who asks "how would you achieve 99.9% uptime?" is testing whether you know what that actually means in infrastructure terms. This article closes that gap.
    ⏱ ~15 min · 🟡 Intermediate

11. **[Design: URL Shortener](/16-system-design-problems/01-data-processing/url-shortener)**
    First full system design walkthrough. The URL shortener looks simple — it isn't. It reveals every fundamental under pressure: hash collisions, redirect latency, analytics storage, cache eviction. This is the article where the first 10 articles integrate into a single design.
    ⏱ ~35 min · 🟡 Intermediate

12. **[Design: Twitter Feed](/16-system-design-problems/02-social-platforms/twitter)**
    Fan-out at scale — the highest complexity pattern in system design interviews. Push model vs pull model vs hybrid, and why the answer changes depending on follower count. This is the hardest problem on the fast path and the most frequently asked at Staff and above.
    ⏱ ~45 min · 🔴 Advanced

---

## Which articles to prioritize by your situation

> **Interview in 1 week or less**
> You don't have time for all 12. Do articles 1, 3, 7, 8, 11, and 12 in that order.
> That's ~2.5 hours and covers estimation, caching, consistent hashing, CAP theorem, and both case studies.
> Skip 2, 4, 5, 6, 9, 10 — you'll have the mental models for most interviews without them.

> **Junior engineer building intuition**
> Do all 12 in order. Don't rush. After you finish, continue with the role-specific track in [Learning Paths](./learning-paths).
> The sequence matters — let each article change how you read the next one.

> **Staff or Principal engineer preparing for system design rounds**
> Do all 12 first, even if some feel familiar. The case studies (articles 11 and 12) show you the level of depth expected at senior levels.
> After the fast path, go directly to [Senior Questions](/12-interview-prep/senior-questions/) — that section is written for your level.

---

## What this path does NOT cover

Three honest gaps in the fast path that matter for some roles:

- **Deep distributed consensus (Raft, Paxos):** The fast path covers CAP theorem and high availability, but not the internals of consensus algorithms. These are needed for Staff/Principal roles at companies building databases or distributed infrastructure. They are not asked in standard FAANG system design interviews.
- **ML/AI system design:** Designing feature stores, model serving infrastructure, embedding pipelines, and vector search requires a different mental model. See the [Agent Workflows section](/13-agent-workflows/) for that track.
- **Security architecture deep dives:** Authentication flows, zero-trust architecture, and encryption at rest/in-transit are important but not the primary focus of system design interviews. See the [Security section](/08-security/) for that material.

---

## After you finish

The fast path ends with two case studies and a defined finish line. When you're done, two directions:

- **Deeper by role**: [Learning Paths](./learning-paths) — structured tracks for different engineering levels and goals
- **Interview practice**: [Question Bank](/12-interview-prep/question-bank/) — 149+ real interview questions with worked answers, organized by topic
