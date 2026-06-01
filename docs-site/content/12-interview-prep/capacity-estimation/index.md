---
title: "Capacity Estimation — 100+ Worked Scenarios"
layer: interview-q
section: "12-interview-prep/capacity-estimation"
difficulty: intermediate
tags: [capacity-estimation, interview-prep, system-design, back-of-envelope]
category: architecture
prerequisites: []
---

# 📐 Capacity Estimation — 100+ Worked Scenarios

Capacity estimation accounts for roughly **30% of a system design interview score**. It is the quantitative foundation that separates a vague design from a credible one. Interviewers at FAANG and top tech companies use it to assess whether you can reason about scale before recommending architecture.

> **Key Insight**: Every interview problem has exactly 5 estimatable components:
> **traffic · storage · compute · cache · cost**
> Master these five axes and no problem will catch you off guard.

---

## What Is Capacity Estimation?

Capacity estimation (also called back-of-envelope calculation) is the practice of producing rough but defensible numbers for a system before writing a single line of code. It answers:

- How many requests per second will hit this service?
- How much storage does 5 years of data require?
- How many servers do I need to handle peak load?
- How much will this cost on AWS?

The numbers do not need to be exact. They need to be in the right **order of magnitude** and derived from stated assumptions. An interviewer who sees you off by 2x does not penalize you. An interviewer who sees you skip this step entirely, or guess without justification, will mark you down.

---

## Why 30% of Interview Score?

Capacity estimation is tested because it reveals:

1. **Systems thinking** — Can you decompose a problem into measurable components?
2. **Real-world intuition** — Do you know that 100M DAU at 10 requests/day = ~11,600 QPS?
3. **Architectural consequence** — Do your numbers lead you to the right technology choices (single DB vs. sharding, in-memory vs. disk)?
4. **Communication** — Can you walk an interviewer through your math clearly?

Skipping estimation is the single most common reason candidates fail L5/L6/Staff design interviews at Meta, Google, and Amazon.

---

## How to Use This Section

This section is structured as a four-stage learning path:

```
Stage 1: Learn the Framework
  └── 00-methodology.md  (6-step universal method + formulas)

Stage 2: Study Reference Numbers
  └── 01-reference-tables/  (EC2, S3, Redis, Kafka, etc.)

Stage 3: Study Worked Examples
  └── 02-worked-scenarios/  (100 fully solved problems)

Stage 4: Practice Without Answers
  └── 03-practice-problems/  (same 100 problems, no solutions visible)
```

**Recommended sequence**:
1. Read the methodology once (15 min)
2. Skim the reference tables — bookmark, do not memorize (20 min)
3. Work through 2-3 solved scenarios per day in your target domain
4. After 1 week, start the practice problems with a timer (15 min each)

---

## Quick-Start — 1 Hour Before Your Interview

If you have only **60 minutes**, do this:

| Time | Action |
|------|--------|
| 0–15 min | Read [6-Step Methodology](/12-interview-prep/capacity-estimation/00-methodology) — memorize the blank template |
| 15–25 min | Memorize the [Traffic Scale Tiers table](/12-interview-prep/capacity-estimation/00-methodology#traffic-scale-tiers) — know QPS at 1M/10M/100M/1B DAU |
| 25–35 min | Read one worked scenario in your target domain |
| 35–50 min | Work one practice problem on paper without looking at the solution |
| 50–60 min | Review the 5 common mistakes section of the methodology |

The single most valuable thing to memorize: **1M DAU ≈ 12 QPS average; assume 3x peak = 36 QPS.** Everything else scales linearly.

---

## Table of Contents — 100 Scenarios by Domain

### 📱 Social Media (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 1 | [Instagram](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/instagram-500m-dau) | 500M DAU | Photo CDN, feed fan-out |
| 2 | [Twitter](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/twitter-300m-dau) | 300M DAU | Celebrity fan-out (10M followers) |
| 3 | [TikTok](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/tiktok-1b-dau) | 1B DAU | Video transcoding at scale |
| 4 | [LinkedIn](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/linkedin-100m-dau) | 100M DAU | Social graph, job search |
| 5 | [Reddit](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/reddit-50m-dau) | 50M DAU | Vote aggregation, hot ranking |
| 6 | [Snapchat](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/snapchat-200m-dau) | 200M DAU | Ephemeral storage, deletion pipeline |
| 7 | [Pinterest](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/pinterest-100m-dau) | 100M DAU | Visual search, image deduplication |
| 8 | [Facebook](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/facebook-2b-dau) | 2B DAU | News Feed at petabyte scale |
| 9 | [Discord](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/discord-150m-dau) | 150M DAU | Persistent messages + voice |
| 10 | [Substack](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/substack-10m-dau) | 10M DAU | Email delivery bursts |

### 🎬 Streaming (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 11 | [YouTube](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/youtube-2b-dau) | 2B DAU | 500 hrs upload/min, CDN egress |
| 12 | [Netflix](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/netflix-200m-subscribers) | 200M subscribers | 37% US internet traffic at peak |
| 13 | [Twitch](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/twitch-30m-dau) | 30M DAU | Live ingest + fan-out |
| 14 | [Spotify](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/spotify-50m-dau) | 50M DAU | 50M concurrent audio streams |
| 15 | [Podcast Platform](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/podcast-platform-20m-dau) | 20M DAU | RSS polling, audio storage |
| 16 | [Live Event](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/live-event-50m-concurrent) | 50M concurrent | Super Bowl spike, cost for 4h |
| 17 | [Zoom](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/zoom-100m-dau) | 100M DAU | TURN server bandwidth |
| 18 | [Music Streaming](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/music-streaming-100m-dau) | 100M DAU | Adaptive bitrate, cache warm-up |
| 19 | [HLS CDN](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/hls-cdn-1b-requests) | 1B requests/day | Segment cache per PoP |
| 20 | [Clubhouse](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/clubhouse-5m-dau) | 5M DAU | Audio-only rooms, STUN/TURN |

### 🛒 E-Commerce (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 21 | [Amazon](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/amazon-marketplace-300m-dau) | 300M DAU | Search + inventory at scale |
| 22 | [Flash Sale](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/flash-sale-10m-concurrent) | 10M concurrent | 10M hits at T+0, 10K units |
| 23 | [Payment Gateway](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/payment-gateway-100m-tx) | 100M tx/day | Idempotency, PCI audit logs |
| 24 | [Recommendation Engine](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/recommendation-engine-100m-dau) | 100M DAU | ML inference QPS, feature store |
| 25 | [Inventory](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/inventory-10m-sku) | 10M SKUs | Lock contention, cache invalidation |
| 26 | [Shopping Cart](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/shopping-cart-50m-dau) | 50M DAU | Session storage, abandoned carts |
| 27 | [Product Catalog](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/product-catalog-50m-dau) | 50M DAU | Full-text search, image CDN |
| 28 | [Order Tracking](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/order-tracking-20m-dau) | 20M DAU | Carrier webhooks, push on delivery |
| 29 | [Reviews & Ratings](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/review-rating-30m-dau) | 30M DAU | Aggregate recomputation, spam ML |
| 30 | [B2B Marketplace](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/b2b-marketplace-5m-dau) | 5M DAU | ERP integration, contract storage |

### 💬 Messaging (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 31 | [WhatsApp](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/whatsapp-2b-dau) | 2B DAU | E2E encryption, group fan-out |
| 32 | [Slack](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/slack-10m-dau) | 10M DAU | WebSockets + search history |
| 33 | [SMS Gateway](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/sms-gateway-100m-day) | 100M/day | SMPP to carriers, receipts |
| 34 | [Push Notifications](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/push-notifications-500m-users) | 500M devices | Blast 100M in < 5 min |
| 35 | [Email Delivery](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/email-delivery-10b-month) | 10B/month | SPF/DKIM, bounce rate handling |
| 36 | [Telegram](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/telegram-500m-dau) | 500M DAU | Channels, media deduplication |
| 37 | [Customer Chat](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/customer-chat-10m-concurrent) | 10M concurrent | WebSocket server count |
| 38 | [IoT Messaging](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/iot-messaging-100m-devices) | 100M devices | MQTT, time-series ingest |
| 39 | [Notification Fanout](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/notification-fanout-200m-users) | 200M users | Celebrity post → 10M followers |
| 40 | [Video Signaling](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/video-signaling-50m-dau) | 50M DAU | ICE/STUN/TURN sizing |

### 🔍 Search (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 41 | [Web Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/web-search-8b-queries) | 8B queries/day | 50B page index, ranking compute |
| 42 | [Typeahead](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/typeahead-100m-dau) | 100M DAU | 5x QPS amplification per keypress |
| 43 | [E-Commerce Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/ecommerce-search-50m-dau) | 50M DAU | 200M product index |
| 44 | [Log Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/log-search-1tb-day) | 1TB/day | Hot/warm/cold tier cost |
| 45 | [Vector Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/semantic-vector-search-10m-dau) | 10M DAU | 100M embeddings in memory |
| 46 | [Document Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/document-search-5m-dau) | 5M DAU | ACL-aware search overhead |
| 47 | [Image Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/image-search-50m-dau) | 50M DAU | 10B image vectors, GPU inference |
| 48 | [News Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/realtime-news-search-20m-dau) | 20M DAU | 5-second freshness SLA |
| 49 | [Code Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/code-search-10m-dau) | 10M DAU | 400M repos, trigram index |
| 50 | [Multi-tenant Search](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/multitenant-search-30m-users) | 30M users | 10K tenants, isolation overhead |

### 🗺️ Maps & Geo (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 51 | [Uber](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/uber-ridesharing-50m-dau) | 50M DAU | Driver location QPS, surge pricing |
| 52 | [Google Maps](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/maps-navigation-1b-dau) | 1B DAU | Map tile CDN, traffic ingestion |
| 53 | [Food Delivery](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/food-delivery-20m-dau) | 20M DAU | Dasher location, ETA recompute |
| 54 | [Yelp](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/yelp-proximity-10m-dau) | 10M DAU | Proximity index, review CDN |
| 55 | [Fleet Management](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/fleet-management-1m-vehicles) | 1M vehicles | GPS ping time-series |
| 56 | [Geofencing](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/geofencing-10m-dau) | 10M DAU | 1M active fences, entry detection |
| 57 | [Location Sharing](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/location-sharing-10m-dau) | 10M DAU | Real-time friend location updates |
| 58 | [Route Optimization](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/route-optimization-5m-deliveries) | 5M deliveries | VRP compute, API cost |
| 59 | [Location History](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/location-history-20m-dau) | 20M DAU | Time-series storage, archival |
| 60 | [Store Finder](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/poi-store-finder-30m-dau) | 30M DAU | 50K POIs, peak load ratio |

### 🗄️ Storage (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 61 | [Dropbox](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/dropbox-500m-users) | 500M users | Block dedup, delta sync |
| 62 | [Google Drive](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/google-drive-1b-users) | 1B users | CRDT collaboration, EB storage |
| 63 | [Object Storage](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/object-storage-100b-objects) | 100B objects | Metadata index at S3 scale |
| 64 | [CDN Static](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/cdn-static-1b-requests) | 1B req/day | Cache hit ratio, PoP sizing |
| 65 | [Image Processing CDN](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/image-processing-cdn-500m) | 500M images | On-the-fly transforms, variants |
| 66 | [Video Transcoding](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/video-storage-transcoding-500m) | 500M videos | 5 variants, cold storage migration |
| 67 | [Backup Service](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/backup-service-10m-users) | 10M users | Initial upload, incremental delta |
| 68 | [File Sharing](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/file-sharing-50m-dau) | 50M DAU | Shared link QPS, expiry cleanup |
| 69 | [Photo Backup](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/photo-backup-100m-users) | 100M users | 5 photos/day, ML labeling |
| 70 | [Document Storage](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/document-storage-20m-dau) | 20M DAU | Versioning, compliance archive |

### 🎮 Gaming (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 71 | [Game Server](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/online-game-server-1m-concurrent) | 1M concurrent | Tick rate, shard count |
| 72 | [Leaderboard](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/leaderboard-100m-dau) | 100M DAU | Redis Sorted Set at 100M |
| 73 | [Matchmaking](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/matchmaking-10m-dau) | 10M DAU | < 30s match latency SLA |
| 74 | [Game State Sync](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/game-state-sync-500k-concurrent) | 500K concurrent | State delta broadcast QPS |
| 75 | [In-Game Chat](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/ingame-chat-5m-concurrent) | 5M concurrent | Guild fan-out, profanity filter |
| 76 | [Achievements](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/achievements-50m-dau) | 50M DAU | Rule engine throughput per event |
| 77 | [FPS Game Server](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/fps-game-500k-concurrent) | 500K concurrent | 60Hz tick, anti-cheat |
| 78 | [Game Analytics](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/game-analytics-1b-events) | 1B events/day | Kafka ingest, DWH query time |
| 79 | [Virtual Economy](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/virtual-economy-10m-dau) | 10M DAU | Double-spend prevention |
| 80 | [Game Replay](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/game-replay-5m-dau) | 5M DAU | Input stream vs state storage |

### 💰 Finance (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 81 | [Banking App](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/banking-app-50m-dau) | 50M DAU | Strong consistency cost |
| 82 | [Stock Trading](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/stock-trading-10m-dau) | 10M DAU | Market open burst, order book |
| 83 | [Crypto Exchange](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/crypto-exchange-5m-dau) | 5M DAU | 24/7, 200 pairs, matching engine |
| 84 | [Payment Processor](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/payment-processor-100m-tx) | 100M tx/day | Idempotency, ledger throughput |
| 85 | [Fraud Detection](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/fraud-detection-100m-tx) | 100M tx/day | < 50ms total latency budget |
| 86 | [Digital Wallet](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/digital-wallet-100m-dau) | 100M DAU | P2P transfer, KYC storage |
| 87 | [Market Data Feed](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/market-data-feed-10m-subscribers) | 10M subscribers | 500K ticks/s, microsecond SLA |
| 88 | [Loan Origination](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/loan-origination-1m-day) | 1M apps/day | OCR queue, credit bureau calls |
| 89 | [Audit Log](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/audit-log-100m-events) | 100M events/day | Append-only, 7-year retention |
| 90 | [Tax Filing](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/tax-filing-10m-seasonal) | 10M seasonal | 50x seasonal spike |

### 🤖 AI & ML (10 Scenarios)

| # | Scenario | Scale | Key Challenge |
|---|----------|-------|---------------|
| 91 | [LLM API Service](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/llm-api-service-10m-dau) | 10M DAU | GPU count, KV cache, cost |
| 92 | [Recommendation Engine](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/recommendation-engine-100m-dau) | 100M DAU | Embedding store, feature QPS |
| 93 | [Fraud Detection ML](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/fraud-detection-ml-100m) | 100M tx/day | < 20ms feature compute |
| 94 | [Image Recognition API](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/image-recognition-api-50m) | 50M req/day | GPU memory, model variants |
| 95 | [RAG Pipeline](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/rag-pipeline-1m-dau) | 1M DAU | Vector DB + LLM latency budget |
| 96 | [ML Training Pipeline](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/ml-training-pipeline) | 70B params | FLOPs, GPU cluster, cost |
| 97 | [A/B Testing](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/ab-testing-100m-dau) | 100M DAU | 1K experiments simultaneously |
| 98 | [Content Moderation](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/content-moderation-100m-posts) | 100M posts/day | Multi-modal pipeline |
| 99 | [Speech Recognition](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/speech-recognition-10m-minutes) | 10M min/day | Real-time factor, GPU |
| 100 | [Autonomous Vehicle](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/autonomous-vehicle-data) | 10K vehicles | 4TB/vehicle/day, edge compress |

---

## The 5 Components — Quick Reference

For any system, always estimate these five axes before proposing architecture:

| Component | Formula | Red Flag Threshold |
|-----------|---------|-------------------|
| **Traffic** | DAU × requests/user/day ÷ 86,400 = avg QPS; peak = avg × 3 | > 10K QPS → need load balancer + multiple app servers |
| **Storage** | writes/day × avg object size × retention days | > 1TB/day → object storage + lifecycle policies |
| **Compute** | peak QPS ÷ RPS/server (assume 1K RPS/server baseline) | > 100 servers → auto-scaling groups, containerization |
| **Cache** | working set = top 20% of reads × avg object size | > 100GB → dedicated Redis cluster, not single node |
| **Cost** | sum of: compute + storage + bandwidth + managed services | > $100K/month → cost optimization is an architecture concern |

---

## Next Steps

- **New to estimation?** Start with [6-Step Methodology](/12-interview-prep/capacity-estimation/00-methodology)
- **Need reference numbers?** See [Component Reference Tables](/12-interview-prep/capacity-estimation/01-reference-tables/compute-sizing)
- **Ready to study?** Pick a domain from [Worked Scenarios](/12-interview-prep/capacity-estimation/02-worked-scenarios)
- **Interview tomorrow?** Go straight to [Practice Problems](/12-interview-prep/capacity-estimation/03-practice-problems)
