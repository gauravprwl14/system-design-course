# 11-real-world/ — Layer 1 Module

End-to-end real-world system design case studies — how production systems like Netflix, YouTube, Uber, Spotify, and others are architected at scale.

## Articles in This Module

| File | Description |
|------|-------------|
| netflix | Netflix architecture: adaptive bitrate streaming, CDN design, chaos engineering, and microservices |
| youtube | YouTube architecture: video ingestion pipeline, transcoding, CDN, and recommendation |
| spotify | Spotify architecture: audio streaming, offline sync, playlist management, and recommendations |
| uber-backend | Uber backend: real-time dispatch, geospatial indexing, surge pricing, and trip lifecycle |
| payment-system | Payment system design: idempotency, double-spend prevention, ledger, and settlement |
| chat-system | Chat system design: WebSockets, message delivery guarantees, and presence tracking |
| news-feed | News feed design: fan-out-on-write vs fan-out-on-read, ranking, and pagination |
| notification-system | Notification system: push, email, SMS delivery pipeline, deduplication, and prioritization |
| google-drive | Google Drive: file storage, sync, conflict resolution, and sharing model |
| url-shortener | URL shortener: hash generation, redirect performance, and analytics |
| pastebin | Pastebin: content storage, expiry, and read-heavy optimization |
| rate-limiter | Distributed rate limiter: sliding window, token bucket, and Redis-backed implementation |
| ticket-booking | Ticket booking system: seat reservation, concurrency, and payment orchestration |
| unique-id-generator | Distributed unique ID generation: Snowflake, UUID strategies, and clock skew handling |
| recommendation-system | Recommendation system: collaborative filtering, content-based, and hybrid approaches |
| google-file-system | Google File System (GFS): chunk servers, master, replication, and fault tolerance |
| salesforce-architecture | Salesforce multi-tenant architecture: shared schema, metadata-driven platform |
| google-ads-auction | Google Ads auction: real-time bidding, Quality Score, second-price auction mechanics |

## Article Count
- Total: 18 case study articles

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Understand large-scale video streaming | netflix.md, youtube.md |
| Design a payment or checkout system | payment-system.md |
| Build a real-time messaging product | chat-system.md |
| Design social media feed ranking | news-feed.md |
| Implement notifications at scale | notification-system.md |
| Design a ride-sharing or mapping backend | uber-backend.md |
| Build file storage and sync | google-drive.md, google-file-system.md |
| Design a URL shortening service | url-shortener.md |
| Generate globally unique IDs | unique-id-generator.md |
| Prevent double-booking or seat contention | ticket-booking.md |
| Build a rate limiting service | rate-limiter.md |
| Design a recommendation engine | recommendation-system.md |
| Understand multi-tenant SaaS architecture | salesforce-architecture.md |
| Design a real-time ad auction | google-ads-auction.md |

## Prerequisites
- Core modules 01-06 for database, caching, and messaging foundations
- 10-architecture/ for patterns referenced across all case studies

## Connects To
- 10-architecture/ — Patterns like circuit breakers, sagas, and event-driven design appear throughout
- 12-interview-prep/ — These case studies map directly to interview questions in system-design/
