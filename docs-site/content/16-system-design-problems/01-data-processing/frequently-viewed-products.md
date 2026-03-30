---
title: "Design a Frequently Viewed Products System"
layer: case-study
section: "16-system-design-problems/01-data-processing"
difficulty: intermediate
tags: [personalization, recommendation, view-history, decay, kafka, flink, redis, e-commerce, cold-start]
category: data-processing
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "Amazon Personalization — Real-Time Recommendations"
    url: "https://engineering.fb.com"
    type: article
  - title: "Netflix — Beyond the 5 Stars"
    url: "https://netflixtechblog.com/netflix-recommendations-beyond-the-5-stars-part-1-55838468f429"
    type: article
  - title: "ByteByteGo — Design a Recommendation System"
    url: "https://www.youtube.com/@ByteByteGo"
    type: article
---

# Design a Frequently Viewed Products System

**Difficulty**: 🟡 Medium | **Codemania #100**
**Reading Time**: ~10 min
**Interview Frequency**: Medium

---

## The Core Problem

Showing "recently and frequently viewed" products on an e-commerce platform for 100 million users — personalized to each user's browsing history — with ordering that balances recency and frequency and updates within 1 minute of a view event.

---

## Functional Requirements

- Track products viewed by each user
- Return per-user top-50 "frequently viewed" products, ordered by engagement score
- Score must decay over time (a product viewed 30 days ago ranks lower than one viewed today)
- Remove products from history after 90 days of no activity
- New users (no history) receive popular products for their browsing category (cold start)
- Update recommendations within 60 seconds of a view event

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Users | 100M active users |
| Products | 50M products in catalog |
| Events | 500M product view events/day = 5,787 events/sec |
| Update latency | Recommendation updates within 60 seconds of view |
| Personalization | Top-50 products per user, ordered by score |
| Cold start | Popular items within same category for new users |

---

## Back-of-Envelope Estimates

- **Event rate**: 500M views/day ÷ 86,400s = 5,787 view events/sec
- **Per-user storage**: 100M users × 50 products × 16 bytes (product_id + score) = 80 GB Redis
- **Kafka throughput**: 5,787 events × 200 bytes = 1.16 MB/sec (trivial)
- **Cleanup**: 100M users × 50 products × 90-day TTL → 5B entries max at any time; TTL eviction handles cleanup

---

## High-Level Architecture

```mermaid
graph TD
    ProductPage[Product Page\nUser Views Product] -->|view event| Kafka[Kafka\nPartitioned by user_id]
    Kafka --> Flink[Flink\nPer-user aggregate\nDecay scoring]
    Flink --> Redis[Redis Hash\nuser:{uid}:viewed → product_id:score\nMax 50 items, sorted]
    Redis --> RecAPI[Recommendation API\nGET /users/{id}/recently-viewed]
    RecAPI --> Client[E-Commerce\nFront-End]

    PopularItems[Popularity Service\nTop items per category] --> Redis
    Redis -->|cold start fallback| ColdStart[New User\nCategory popular items]
```

---

## Key Design Decisions

### 1. Online (Real-Time) vs Offline (Batch) Aggregation

| Approach | Online (Kafka + Flink) | Offline (Batch Spark/Hadoop) |
|----------|----------------------|------------------------------|
| Update latency | < 60 seconds | 1–24 hours |
| Compute cost | Higher (streaming infra) | Lower (batch, cheaper) |
| Recency accuracy | True real-time | Stale during batch window |
| Use case | "Viewed 5 minutes ago" | "Viewed last week" weekly digest |

**Decision**: Online (Flink streaming) for the frequently-viewed widget. Users expect to see items they just browsed immediately. Offline batch acceptable for weekly recommendation emails.

### 2. Scoring: Recency vs Frequency

Simple frequency (view count) favors items browsed repeatedly long ago. Pure recency ignores that something viewed 20 times is more interesting than something viewed once today.

**Time-decay scoring formula**:
```
score(product, user) = frequency × decay_factor(days_since_last_view)

decay_factor(d) = e^(-0.1 × d)
```

Examples:
- Viewed 10 times today: 10 × e^0 = 10.0
- Viewed 10 times 7 days ago: 10 × e^(-0.7) = 5.0
- Viewed 1 time today: 1 × e^0 = 1.0

Flink computes this in real-time: on each view event, retrieve current score from Redis, apply decay, increment:
```python
def update_score(user_id, product_id):
    key = f"user:{user_id}:viewed"
    current = redis.hget(key, product_id)
    if current:
        days_since = (now() - last_view_time) / 86400
        decayed = float(current) * math.exp(-0.1 * days_since)
    else:
        decayed = 0.0
    new_score = decayed + 1.0  # add 1 for this view
    redis.hset(key, product_id, new_score)
    redis.hset(f"user:{user_id}:last_view", product_id, now())
```

### 3. Keeping Only Top-50 per User

After each update, if the user's product list exceeds 50 items, remove the lowest-scoring item:
```python
# Use Redis Sorted Set instead of Hash for automatic ranking
redis.zadd(f"user:{user_id}:viewed", {product_id: new_score})
# Keep only top 50: remove all but top 50
count = redis.zcard(f"user:{user_id}:viewed")
if count > 50:
    redis.zremrangebyrank(f"user:{user_id}:viewed", 0, count - 51)  # remove bottom N
```

Redis Sorted Sets with `ZADD`, `ZREVRANGE`, and `ZREMRANGEBYRANK` are the natural fit.

### 4. Cold Start for New Users

Users with < 5 view events → insufficient personalization signal. Fall back to:
1. **Category popularity**: Track top-20 products per category (Electronics, Clothing, etc.) in Redis sorted set updated hourly
2. **Geographic popularity**: Top products in user's country (different catalog preferences by region)
3. **Session-based**: Use current session's viewed products as initial signal

Switch from cold-start to personalized mode once user has ≥ 5 views.

---

## Cleanup: Stale Products

Products not viewed in 90 days should be removed from recommendations:
- Set a 90-day TTL on each product entry in the sorted set (not directly supported by Redis sorted sets — use a separate TTL tracking Hash or periodic Flink job)
- **Approach**: Background Flink job runs nightly, scans user sorted sets, removes entries where `last_view_time > 90 days ago`
- Alternative: Redis `EXPIRE` on the entire user key (90 days) — simpler but resets TTL on any new view

---

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| How do you prevent a product viewed 100 times 6 months ago from dominating recommendations? | Time-decay function, exponential decay score |
| How do you handle cold start for new users with no history? | Category-based fallback, geographic popularity, session-based |
| Why Redis Sorted Set instead of a database for per-user product rankings? | O(log N) insert + automatic ranking + in-memory speed for 100M users |
| How do you keep memory bounded with 100M users? | Top-50 cap per user (ZREMRANGEBYRANK), 90-day TTL on stale items |

---

## Common Mistakes

1. **Using view count without decay**: Items viewed 100 times 1 year ago score higher than items viewed today. Decay is essential for relevance.
2. **No cap on items per user**: Without a 50-item cap, a power user browsing 10,000 products would consume unbounded Redis memory.
3. **Synchronous DB writes on every page view**: Product views happen 5,787/sec. Writing to PostgreSQL on every view kills the database. Buffer in Kafka, aggregate in Flink.

---

## Related Concepts

- [Caching Fundamentals](../../02-caching/concepts/caching-fundamentals) — Redis Sorted Sets for per-user rankings
- [Message Queue Basics](../../04-messaging/concepts/message-queue-basics) — Kafka event buffering

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [ByteByteGo — Recommendation System Design](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Collaborative filtering, real-time personalization |
| [Netflix — Beyond the 5 Stars](https://netflixtechblog.com/netflix-recommendations-beyond-the-5-stars-part-1-55838468f429) | 📖 Blog | How Netflix personalizes recommendations at scale |
| [Hussein Nasser — Redis Data Structures](https://www.youtube.com/@hnasr) | 📺 YouTube | Sorted sets, use cases, performance characteristics |
| [High Scalability — E-commerce Personalization](https://highscalability.com) | 📖 Blog | Real-world personalization architecture patterns |
