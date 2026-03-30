[← Question Bank](/12-interview-prep/question-bank) / System Design

# 🏗️ System Design — Question Bank

**20 topics · ~120 interview questions**

Classic FAANG system design questions. Each topic has 4-6 questions covering Quick Answer, Deep Dive, and Scenario formats.

## All Topics

| Topic | Difficulty | Priority | Questions |
|-------|-----------|----------|-----------|
| [URL Shortener](design-url-shortener) | 🟡 Mid | P0 | 100M URLs, 10K redirects/sec, hash collisions |
| [Notification System](design-notification-system) | 🟡 Mid | P0 | Push, email, SMS at 10M/day |
| [Rate Limiter](design-rate-limiter) | 🟡 Mid | P0 | Token bucket vs sliding window, distributed |
| [Chat System](design-chat-system) | 🔴 Senior | P0 | 1M concurrent, WebSocket, message storage |
| [News Feed](design-news-feed) | 🔴 Senior | P0 | Fan-out on write vs read, 500M users |
| [Video Streaming](design-video-streaming) | 🔴 Senior | P0 | YouTube-scale, CDN, adaptive bitrate |
| [Search Autocomplete](design-search-autocomplete) | 🟡 Mid | P0 | Trie, prefix search, 10K q/sec |
| [Ride Sharing](design-ride-sharing) | 🔴 Senior | P1 | Geolocation, matching, surge pricing |
| [Payment System](design-payment-system) | 🔴 Senior | P0 | Idempotency, exactly-once, reconciliation |
| [Distributed Cache](design-distributed-cache) | 🔴 Senior | P1 | Redis cluster, eviction, consistency |
| [CDN](design-cdn) | 🔴 Senior | P1 | PoPs, cache invalidation, edge logic |
| [API Gateway](design-api-gateway) | 🟡 Mid | P0 | Auth, rate limiting, routing, observability |
| [Job Scheduler](design-job-scheduler) | 🔴 Senior | P1 | Cron at scale, at-least-once, backpressure |
| [File Storage](design-file-storage) | 🔴 Senior | P1 | S3-like, chunking, dedup, versioning |
| [Location Service](design-location-service) | 🔴 Senior | P1 | Geo-index, proximity, 10M drivers |
| [Recommendation Engine](design-recommendation-engine) | ⚫ Staff | P2 | Collaborative filtering, real-time, cold start |
| [Ad Click Aggregator](design-ad-click-aggregator) | 🔴 Senior | P1 | Stream processing, dedup, 100K clicks/sec |
| [Web Crawler](design-web-crawler) | 🟡 Mid | P1 | Politeness, dedup, frontier, 1B pages |
| [Metrics & Monitoring](design-metrics-monitoring) | 🔴 Senior | P1 | Time-series, alerting, Prometheus-scale |
| [Distributed Locking](design-distributed-locking) | 🔴 Senior | P1 | Redis SETNX, Redlock, fencing tokens |

## Start Here: P0 Questions

For most interviews, focus on these first:
1. [URL Shortener](design-url-shortener) — the classic warm-up, asked in 70%+ of mid-level interviews
2. [Rate Limiter](design-rate-limiter) — covers token bucket, sliding window, distributed state
3. [Chat System](design-chat-system) — WebSocket, fan-out, message ordering
4. [Notification System](design-notification-system) — async pipelines, multi-channel delivery
5. [News Feed](design-news-feed) — fan-out on write vs read is a canonical trade-off question
6. [Payment System](design-payment-system) — idempotency and exactly-once delivery
7. [API Gateway](design-api-gateway) — cross-cutting concerns: auth, rate limit, observability

---

[← Back to Question Bank](/12-interview-prep/question-bank)
