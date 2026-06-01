---
title: "Meta System Design Interview Guide"
layer: interview-q
section: "12-interview-prep/question-bank/company-specific"
difficulty: advanced
tags: [meta, facebook, instagram, whatsapp, system-design, interview, social-graph, tao, faang]
category: interview-prep
references:
  - title: "TAO: Facebook's Distributed Data Store for the Social Graph"
    url: "https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson"
    type: article
  - title: "Scaling Memcache at Facebook"
    url: "https://research.facebook.com/publications/scaling-memcache-at-facebook/"
    type: article
---

# Meta System Design Interview Guide

## Meta's Interview Loop

| Level | Rounds | Unique to Meta |
|-------|--------|---------------|
| E4 (SWE II) | 4-5 rounds | 1 system design |
| E5 (Senior) | 5 rounds | 2 system design + 1 Product Sense |
| E6 (Staff) | 5-6 rounds | System design is primary signal |

**Meta's focus:** social graph (TAO), real-time at 3B+ users, mobile-first design, speed of execution, Product Sense integration.

---

## Understanding TAO (Critical for E5+ Interviews)

TAO (The Associations and Objects) is Meta's core distributed data store, optimized for social graph traversal.

**Data model:**
- **Objects:** entities with numeric IDs — User(123), Post(456), Comment(789)
- **Associations:** directed typed edges — FRIEND_OF(user_id→friend_id), LIKED(user_id→post_id), POSTED(user_id→post_id)
- **Core query:** `get_associations(id, assoc_type, limit)` — "get all posts liked by user 123"

**Why not a relational DB:**
A JOIN across 3B user rows × billions of edges is prohibitively slow. TAO is optimized for the read-heavy, graph-traversal access patterns of social features (news feed, friend suggestions, notifications).

**Consistency model:** Eventual consistency for most social actions (likes, comments, friend requests). Stronger consistency only for financial or safety-critical operations.

**Interview implication:** When Meta asks you to design News Feed, friend suggestions, or notifications — reference TAO for the graph traversal layer. This is the key differentiator between E4 and E5 answers.

---

## What Meta Evaluates Differently

**1. Social graph depth** — Know TAO. Know fan-out strategies. Know graph traversal at 3B-node scale.

**2. Mobile-first design** — 2B of 3B users are on mobile. Every system design should address: offline behavior, bandwidth constraints (emerging markets = 2G/3G), battery optimization, and background sync.

**3. Speed of execution** — Meta culture: "Move fast and ship things." Designs should support rapid iteration and A/B testing. Over-engineered systems slow down iteration cycles. Present MVP-first designs.

**4. Product sense integration** — Even in system design rounds, Meta interviewers ask: "How would you measure whether this is successful?" Know the metrics: DAU, engagement rate, session length, revenue per user.

---

## Top 15 Meta System Design Questions

### 1. Design Facebook News Feed
**Scale:** 3B users, each with 200-500 friends/follows

**Key insight:** **Hybrid fan-out** — push for users with <5,000 followers (writes to all follower timeline caches on post), pull for celebrities (Lady Gaga with 50M followers can't push to 50M caches on every post). Celebrity posts are fetched on timeline load and merged with the push-based feed.

**What Meta tests:** Fan-out strategy, feed ranking (EdgeRank/ML model), ads integration without hurting engagement.

---

### 2. Design Instagram
**Scale:** 2B users, 100M photos/day uploaded

**Key insight:** Instagram stores **3 resolutions at upload time** (thumbnail ~10KB, medium ~100KB, full ~500KB) rather than resizing on demand. This trades storage for serving latency — on-the-fly resize at 100M photos/day would overwhelm compute.

Reels recommendation: ML model on watch time signals, not just likes — watch time is a stronger engagement signal than passive like.

---

### 3. Design WhatsApp
**Scale:** 2B users, 100B messages/day

**Key insight:** WhatsApp uses the **Signal Protocol** (double ratchet algorithm) for E2E encryption. Meta's servers see only encrypted ciphertext + metadata (who messaged who, when, from what device). Even Meta cannot decrypt message content.

**Multi-device sync:** A message sent from your phone is re-encrypted for each registered device (phone + iPad + web) and stored as separate encrypted blobs. The first device to open the app receives the message; all devices receive notification.

---

### 4. Design Facebook Live
**Scale:** 1B+ viewers for popular streams

**Key insight:** Latency-vs-delay is a **tunable trade-off**:
- 2-second delay: requires RTMP → HLS with tiny segments; expensive CDN capacity
- 30-second delay: standard HLS chunking; 15× cheaper per viewer

Interactive features (real-time chat, live reactions) require low latency. Passive watching doesn't. Meta serves different delay tiers based on viewer's network quality.

**Live chat fan-out:** 1M concurrent viewers each sending reactions = 1M messages/sec to fan out. WebSocket connections to a sharded fan-out service; messages batched before broadcast.

---

### 5. Design Facebook Marketplace
**Key insight:** Marketplace **reuses Messenger** for buyer-seller communication — platform thinking. Building a new messaging system for Marketplace would duplicate infrastructure. Routing marketplace conversations through Messenger gets delivery receipts, media sharing, and notification infrastructure for free.

Geo search: Elasticsearch geo_point for radius queries on listings. Listing lifecycle: Active → Sold → Expired (TTL-based expiry for old listings).

---

### 6. Design Meta's Notification System
**Scale:** 1B+ notifications/day (push, in-app, email)

**Key insight:** Notification fan-out reuses the **same infrastructure as News Feed fan-out** — the event (post, like, comment) triggers a fan-out job that writes to APNs/FCM queues per recipient.

Priority queues: critical notifications (security alerts, friend requests) ahead of marketing notifications. Deduplication window: if the same notification would be sent 5 times in 1 hour, coalesce into one.

---

### 7. Design Facebook Friend Suggestions ("People You May Know")
**Key insight:** **Louvain community detection runs on partitioned sub-graphs**, not the full 3B-node graph. The graph is first partitioned by social clusters (groups of highly-connected users). Louvain runs within each partition. Cross-partition edges are handled by a separate linking pass.

Mutual friends count via TAO: `COUNT(INTERSECTION(get_friends(A), get_friends(B)))` — TAO's indexed associations make this efficient.

---

### 8. Design Meta's Content Moderation
**Scale:** 10B+ pieces of content/day

**Key insight:** **Classifier cascade** — cheap text classifier (cost: $0.00001/item) → expensive vision model (cost: $0.01/item) → human review ($1/item). Only 0.1% of content reaches human review. **99% of violating content is removed before anyone reports it** — proactive detection at upload, not reactive on report.

---

### 9. Design Facebook Ad Delivery
**Scale:** $116B/year in revenue

**Key insight:** Meta uses a **Vickrey-Clarke-Groves (VCG) auction variant**: `effective_bid = bid × quality_score`. Quality score = predicted click-through rate × relevance score. A highly relevant ad with lower bid beats an irrelevant ad with higher bid — aligns advertiser ROI with user experience.

Frequency capping: the same user shouldn't see the same ad 20 times in a week. Redis counter per (user_id, ad_id, week) window.

---

### 10. Design Instagram Stories
**Scale:** 500M daily active Stories users

**Key insight:** Stories have **25-hour TTL** (24h + 1h grace period). Storage: objects in blob store with TTL metadata. Expiry: background job sweeps expired stories + sends APNs/FCM to update the ring status.

View counts use **HyperLogLog** for approximate unique viewer counts at scale — exact counts would require storing every viewer ID. HLL uses ~1.5KB per story for <1% error rate on millions of viewers.

---

### 11. Design Messenger Group Video Calls
**Key insight:** Meta uses **tiered SFU architecture** — primary SFU in organizer's region, secondary SFUs in participant regions. Each secondary receives from primary and forwards to local participants. This avoids inter-continental latency for participants far from the primary.

For calls >25 participants: active speaker detection — only forward the 5 most active speakers at high quality. Others get thumbnail streams.

---

### 12. Design Facebook Events
**Key insight:** RSVP creates a **subscription** — when the event updates, subscribers are notified via the same fan-out infrastructure as News Feed. Event discovery uses geo-based Elasticsearch queries + social signals (friends attending boosted in ranking).

---

### 13. Design Facebook Search (Unicorn)
**Key insight:** Unicorn indexes **social signals in real-time** — when you like a post, that signal is indexed within seconds and affects search ranking immediately. Unlike web search (PageRank is batch), social search ranking is real-time because freshness of social signals matters within hours, not days.

---

### 14. Design Meta's Data Warehouse
**Scale:** Petabytes, used by 50k+ analysts daily

**Key insight:** Meta runs **3 query engines on the same data** because no single engine is optimal:
- **Hive** (MapReduce): batch queries that run for hours
- **Presto** (MPP SQL): interactive queries under 60 seconds
- **Scuba** (in-memory time-series): real-time queries on last 30 days

This is not redundancy — it's workload-appropriate query optimization.

---

### 15. Design Meta's Identity System
**Key insight:** Account recovery uses **trusted contacts** — 3 friends pre-selected by the account holder. When all authentication factors are lost (phone stolen, email compromised), 3 trusted contacts each receive a recovery code fragment. Presenting all 3 fragments proves social identity.

This is decentralized identity verification — no need for government ID or call center. Scales globally without per-country infrastructure.

---

## Product Sense Integration

Meta interviewers blend product judgment into system design:

| Follow-up | Strong Answer |
|-----------|--------------|
| "How would you measure success?" | Name DAU impact, engagement rate change, revenue contribution — not just uptime |
| "What would you ship first?" | Prioritize by user value × engineering cost, name the trade-off |
| "What could go wrong at launch?" | Name product failure modes, not just system failure modes |

---

## Strong Hire vs No-Hire Signals

| Signal | ✅ Strong Hire | ❌ No Hire |
|--------|--------------|-----------|
| Social graph | Mentions TAO, hybrid fan-out | Uses generic SQL JOIN for friend traversal |
| Mobile-first | Addresses bandwidth, offline, battery | Designs only for desktop/broadband |
| Speed of execution | MVP + iteration path | Perfect system, no incremental delivery |
| Product metrics | Ties decisions to DAU/engagement | Pure technical design, no user impact |

---

## Common Mistakes in Meta Interviews

1. **Not knowing TAO** — at E5+, not mentioning TAO for graph features is a signal you haven't studied Meta's stack
2. **Desktop-first design** — 2B of 3B users are mobile; ignoring mobile constraints is a red flag
3. **Skipping fan-out** — the hardest part of social systems is fan-out; candidates who skip it show shallow understanding
4. **No product sense** — Meta interviews reward candidates who think about user impact, not just system correctness
5. **Not addressing eventual consistency** — Meta's systems are largely eventually consistent by design; presenting strong consistency everywhere shows misaligned mental model

---

## 📚 Resources

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [TAO: Facebook's Distributed Data Store](https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson) | 📖 Blog | TAO internals — the foundation of Meta's social graph |
| [Instagram Engineering Blog](https://instagram-engineering.com/) | 📖 Blog | Real architecture decisions at Instagram scale |
| [WhatsApp Engineering Blog](https://engineering.fb.com/category/messaging/) | 📖 Blog | Messaging at 2B user scale |
| [Facebook's Data Infrastructure](https://engineering.fb.com/category/data-infrastructure/) | 📖 Blog | Hive, Presto, Scuba, data warehouse architecture |
