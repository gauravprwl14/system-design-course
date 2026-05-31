---
title: "Design a Movie Reviews Aggregator"
layer: case-study
section: "16-system-design-problems/01-data-processing"
difficulty: intermediate
tags: [aggregation, crawler, normalization, circuit-breaker, caching, weighted-average, rotten-tomatoes, imdb]
category: data-processing
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "Circuit Breaker Pattern — Martin Fowler"
    url: "https://martin.fowler.com/bliki/CircuitBreaker.html"
    type: article
  - title: "High Scalability — Web Crawler Design"
    url: "https://highscalability.com"
    type: article
  - title: "ByteByteGo — Design a Web Crawler"
    url: "https://www.youtube.com/@ByteByteGo"
    type: article
---

# Design a Movie Reviews Aggregator

**Difficulty**: 🟡 Medium | **Codemania #109**
**Reading Time**: ~10 min
**Interview Frequency**: Medium

---

## The Core Problem

Aggregating movie reviews from 100 external sources (IMDb, Rotten Tomatoes, Metacritic, Letterboxd, etc.) into a unified score per movie, keeping data fresh (update every 6 hours), handling unreliable source APIs, and normalizing incompatible rating scales (stars out of 5, percentages, 1–100 scores).

---

## Functional Requirements

- Crawl 100 review sources for scores on 10M movies
- Normalize different rating scales to a unified 0–100 score
- Compute a weighted aggregate score (weight by source credibility)
- Serve fresh scores via API with < 200ms latency
- Handle slow or unavailable sources gracefully (circuit breaker)
- Flag scores as "stale" if data is > 12 hours old

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Movies | 10M movies in catalog |
| Sources | 100 review sources |
| Crawl freshness | Each source refreshed every 6 hours |
| API latency | < 200ms (served from cache) |
| Source availability | Tolerate 20% of sources being down |
| Score latency | New movie score available within 30 minutes of release |

---

## Back-of-Envelope Estimates

- **Crawl load**: 10M movies × 100 sources = 1B crawl requests/6 hours = 167M requests/hour = ~46k requests/sec
- **Practical**: Most sources offer bulk API or XML feeds; not one request per movie. Assume 100 feeds × 100k movies each = 10M records per crawl cycle.
- **Score storage**: 10M movies × 100 source scores × 16 bytes = 16 GB (fits in PostgreSQL + Redis)
- **Cache size**: 10M movie scores × 500 bytes = 5 GB Redis (fits easily)

---

## High-Level Architecture

```mermaid
graph TD
    Scheduler[Cron Scheduler\nTrigger crawl every 6h per source] --> CrawlQueue[SQS\nCrawl tasks per source]
    CrawlQueue --> CrawlerPool[Crawler Workers\n100 per source]
    CrawlerPool --> SourceAPIs[100 External Sources\nIMDb / RT / Metacritic ...]
    CrawlerPool --> CircuitBreaker[Circuit Breaker\nPer source — open on 5 errors in 60s]
    CrawlerPool --> RawScores[(PostgreSQL\nRaw scores per movie per source)]
    RawScores --> NormEngine[Normalization Engine\nScale → 0-100]
    NormEngine --> AggEngine[Aggregation Engine\nWeighted average]
    AggEngine --> ScoreCache[Redis\nmovie_id → aggregate score, TTL 1h]
    ScoreCache --> MovieAPI[Movie Score API\nGET /movies/{id}/score]
    MovieAPI --> Clients[Web / Mobile Apps]
```

---

## Key Design Decisions

### 1. Pull-Based Crawling vs Webhook Subscription

| Approach | Pull-Based Crawling | Webhook Subscription |
|----------|--------------------|-----------------------|
| Implementation | Crawler visits source periodically | Source calls our endpoint on update |
| Freshness | Lag = crawl interval (up to 6 hours) | Near-instant (webhook delivers on change) |
| Source support | Works for all sources | Only if source supports webhooks |
| Reliability | We control retry logic | Source must reliably deliver webhook |

**Decision**: Pull-based crawling for most sources (majority don't offer webhooks). For sources that offer webhooks (IMDb data API, TMDB), subscribe for instant updates and fall back to 6-hour crawl as safety net.

### 2. Score Normalization

Each source uses a different scale:
```
IMDb: 1–10 → multiply by 10 → 0–100
Rotten Tomatoes: 0%–100% → direct mapping → 0–100
Metacritic: 0–100 → direct mapping → 0–100
Letterboxd: 0–5 stars → multiply by 20 → 0–100
Roger Ebert: 0–4 stars → multiply by 25 → 0–100
```

Normalization stored in a source configuration table:
```sql
CREATE TABLE source_config (
  source_id   INT PRIMARY KEY,
  name        VARCHAR(100),
  scale_min   FLOAT,
  scale_max   FLOAT,
  weight      FLOAT,  -- credibility weight (0–1)
  is_active   BOOLEAN
);
```

Normalized score = `(raw_score - scale_min) / (scale_max - scale_min) * 100`

### 3. Weighted Average (Source Credibility)

Simple average treats IMDb (millions of reviews) equally with a small blog. Weighted average gives more credibility to established sources:

```
aggregate_score = Σ(normalized_score_i × weight_i) / Σ(weight_i)
```

Weight factors:
- Review volume: `min(log10(review_count), 6) / 6` (0–1 scale, caps at 1M reviews)
- Source credibility: manually assigned (IMDb = 1.0, Metacritic = 0.9, small blog = 0.3)
- Recency: more recent reviews weighted higher

### 4. Circuit Breaker for Slow Sources

Some sources are slow or unreliable. A slow source that takes 30 seconds to respond blocks crawler workers:

Circuit breaker states per source:
- **Closed** (normal): allow requests
- **Open** (failing): skip this source for 5 minutes after 5 consecutive errors
- **Half-Open**: try 1 request after timeout; if success → Closed; if fail → Open again

```python
class SourceCircuitBreaker:
    def __init__(self, source_id, failure_threshold=5, reset_timeout=300):
        self.failures = 0
        self.state = "CLOSED"
        self.last_failure = None

    def call(self, crawl_fn):
        if self.state == "OPEN":
            if time.time() - self.last_failure > self.reset_timeout:
                self.state = "HALF_OPEN"
            else:
                raise CircuitOpenError(f"Source {self.source_id} circuit open")
        try:
            result = crawl_fn()
            self.failures = 0
            self.state = "CLOSED"
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure = time.time()
            if self.failures >= self.failure_threshold:
                self.state = "OPEN"
            raise
```

### 5. Stale-if-Error Handling

If a source's circuit is open:
- Serve the last known score from that source (with a "stale" flag)
- Exclude it from the aggregate only if data is > 24 hours old
- Show the aggregate score with a note: "Based on 95/100 sources (5 sources unavailable)"

---

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| How do you handle a source that's been down for 3 days? | Circuit breaker, stale-if-error, degrade gracefully in aggregate |
| Why use weighted average instead of simple average? | Source credibility, review volume differences, manipulation resistance |
| How would you detect if a source has been hacked and is returning fake scores? | Anomaly detection — score deviated >30 points from other sources → flag for review |
| How do you add a new source without recomputing all historical aggregates? | Re-run aggregation engine on stored raw scores with new source weight |

---

## Common Mistakes

1. **Computing aggregates synchronously on API request**: Aggregate 100 sources on every request → too slow. Pre-compute and cache.
2. **No circuit breaker**: One slow source with 30s timeout blocks all crawlers waiting for it. Circuit breaker is mandatory.
3. **Equal weighting for all sources**: A fake review site and IMDb should not have equal influence. Always weight by credibility and review volume.

---

## Related Concepts

- [Caching Fundamentals](../../02-caching/concepts/caching-fundamentals) — Redis caching for aggregate scores
- [Rate Limiter](../05-infrastructure/rate-limiter) — Throttle crawling rate per source to avoid bans

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [Circuit Breaker — Martin Fowler](https://martin.fowler.com/bliki/CircuitBreaker.html) | 📖 Blog | Circuit breaker pattern, states, implementation |
| [ByteByteGo — Web Crawler Design](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Crawler architecture, politeness, scheduling |
| [Hussein Nasser — Resiliency Patterns](https://www.youtube.com/@hnasr) | 📺 YouTube | Circuit breaker, retry, bulkhead patterns |
| [High Scalability — Aggregation Systems](https://highscalability.com) | 📖 Blog | Data aggregation and normalization patterns at scale |
