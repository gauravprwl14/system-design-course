---
title: "Practice Problems — 100 Capacity Estimation Exercises"
layer: interview-q
section: "12-interview-prep/capacity-estimation/03-practice-problems"
difficulty: intermediate
tags: [capacity-estimation, interview-prep, practice, system-design]
category: architecture
prerequisites: ["12-interview-prep/capacity-estimation/00-methodology"]
---

# 💪 Capacity Estimation Practice Problems

100 problems, no answers visible. Attempt each on paper or a whiteboard before checking the worked solution.

> **How to use this page**
>
> 1. Read the [6-Step Methodology](/12-interview-prep/capacity-estimation/00-methodology) first — internalize the framework.
> 2. For each problem below, spend **10–15 minutes** estimating on paper.
> 3. Write down your numbers for all 5 components: **traffic · storage · compute · cache · cost**.
> 4. Only then click the "Worked Solution" link.
> 5. Compare your assumptions, not just final numbers. Off by 2x is fine; off by 100x means a bad assumption — find it.

---

## How to Self-Grade

| Accuracy | Meaning |
|----------|---------|
| Within 2x on all components | Excellent — interview-ready |
| Within 5x on 4/5 components | Good — review the one you missed |
| Off by 10x+ on any component | Re-read the methodology and reference tables |
| Wrong order of magnitude | Practice the unit conversion drills at the end of this page |

---

## 📱 Domain 1 — Social Media (10 Problems)

### P-01. Instagram at 500M DAU

You are designing the core Instagram service. Given 500 million daily active users:

- 20% post content; 80% only consume
- Average user uploads 1 photo/day (when active poster); each photo = 3MB original
- Each user views 100 photos/day in feed
- Stories disappear after 24h; 30% of users post 1 story/day

Estimate: **peak read QPS, peak write QPS, daily storage growth, CDN bandwidth, number of app servers, monthly AWS cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/instagram-500m-dau)

---

### P-02. Twitter at 300M DAU

Twitter with 300M daily active users:

- Average user sends 2 tweets/day; each tweet ≤ 280 chars (~300 bytes)
- Each user follows 200 accounts; home timeline = last 100 tweets from followed accounts
- 10% of users are "power users" with 10,000+ followers (fan-out challenge)
- Media (images/video) attached to 30% of tweets; average attachment = 500KB

Estimate: **tweet write QPS, timeline read QPS, fan-out write amplification at p99, total storage after 5 years, cache size for hot timelines**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/twitter-300m-dau)

---

### P-03. TikTok at 1B DAU

TikTok with 1 billion DAU:

- Average session = 52 minutes/day; average video length = 30 seconds
- 5% of users upload 1 video/day; raw upload size = 200MB; transcoded to 5 bitrate variants
- Each video served from CDN; p50 video = 50MB at 720p/30s
- Recommendation engine scores 500 videos per feed refresh; user refreshes 10x/day

Estimate: **video upload throughput (GB/s), transcoding CPU hours/day, CDN egress (Tbps), recommendation engine QPS, total storage after 1 year, monthly CDN cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/tiktok-1b-dau)

---

### P-04. LinkedIn at 100M DAU

LinkedIn with 100M DAU (700M registered):

- 3% post content per day (articles, posts, job updates)
- Feed has 20 posts per load; user loads feed 3x/day
- Job search: 20M users search jobs per day; 200M job listings
- Each connection event writes to social graph (avg 500 connections/user)

Estimate: **feed read QPS, job search QPS, social graph storage, notification throughput, monthly infrastructure cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/linkedin-100m-dau)

---

### P-05. Reddit at 50M DAU

Reddit with 50M DAU:

- 500K posts/day; average post = 2KB text + optional image link
- 5M comments/day; average comment = 500 bytes
- Vote events: 50M upvotes + 10M downvotes per day
- 100K active subreddits; top 1,000 subreddits get 80% of traffic

Estimate: **comment write QPS, vote QPS, hot post cache size, front page re-ranking frequency, storage growth/year**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/reddit-50m-dau)

---

### P-06. Snapchat at 200M DAU

Snapchat with 200M DAU:

- 4 billion snaps sent per day; each snap = image (~200KB) or video (≤10s, ~2MB)
- 60% images, 40% videos; snaps deleted after first view (or 24h)
- Stories viewed 10B times/day; story segment = 10s video
- Disappearing content must be verifiably deleted from all replicas within 30 days

Estimate: **snap ingestion throughput, ephemeral storage pool size, story CDN bandwidth, deletion pipeline throughput, monthly storage cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/snapchat-200m-dau)

---

### P-07. Pinterest at 100M DAU

Pinterest with 100M DAU:

- 300M pins saved/day; each pin = URL + image (~500KB) + metadata
- Image deduplication: ~40% of pins are re-pins of existing images
- Search: 2B search queries/month; visual similarity search (vector)
- Board graph: 2B boards, avg 100 pins/board

Estimate: **pin write QPS, deduplicated storage size, visual search vector index size, board read QPS, CDN bandwidth**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/pinterest-100m-dau)

---

### P-08. Facebook at 2B DAU

Facebook with 2 billion DAU:

- 500M photos/day; average = 2.5MB; stored at 4 resolutions
- News Feed: each load fetches 50 posts; user loads 5x/day
- Messenger: 100B messages/day; avg 1KB/message including metadata
- Social graph: 2.7B users, avg 338 friends each — 900B edges

Estimate: **photo storage growth rate (PB/year), news feed aggregation QPS, messenger throughput (GB/day), social graph memory footprint, total infra cost tier**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/facebook-2b-dau)

---

### P-09. Discord at 150M DAU

Discord with 150M DAU:

- 19M active servers; median server = 15 members; top servers = 500K+ members
- 4B messages/day; avg = 200 bytes; must be persisted
- Voice: 8M concurrent voice users at peak; each voice channel = 32Kbps per user
- Presence system: online/offline/idle status for all 150M DAU users, updated in real-time

Estimate: **WebSocket connection count, message write QPS, voice bandwidth (Gbps), presence update rate, storage after 1 year, server count**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/discord-150m-dau)

---

### P-10. Substack at 10M DAU

Substack with 10M DAU (50M subscribers total):

- 100K active newsletters; average newsletter = 3 emails/week to 500 subscribers
- Paid newsletters: 5% of newsletters, avg 1,000 paying subscribers at $10/month
- Email delivery: subscriber count can be 1 to 500,000 per newsletter
- Web traffic: 10M page views/day to newsletter posts

Estimate: **email delivery throughput (emails/hour at peak send time), web server QPS, payment transaction volume, storage for email archives, monthly SES/email cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/social-media/substack-10m-dau)

---

## 🎬 Domain 2 — Streaming (10 Problems)

### P-11. YouTube at 2B DAU

500 hours of video uploaded per minute. Estimate: **upload ingestion bandwidth, transcoding throughput (variants x resolution), CDN egress at peak, storage growth per year, recommendation QPS**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/youtube-2b-dau)

---

### P-12. Netflix at 200M Subscribers

37% of US internet traffic at peak (9pm ET). Estimate: **peak streaming bandwidth (Tbps), CDN cache hit ratio needed, encoding variants per title, storage for entire catalog, Open Connect appliance sizing**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/netflix-200m-subscribers)

---

### P-13. Twitch at 30M DAU

8M concurrent streams at peak; 3M concurrent broadcasters. Estimate: **ingest throughput, transcoding servers, viewer-to-broadcaster ratio's impact on fan-out, chat message QPS, VOD storage**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/twitch-30m-dau)

---

### P-14. Spotify at 50M DAU (Music)

Spotify with 50M simultaneous streams. Estimate: **concurrent stream bandwidth, song storage (30M tracks x 3 formats), offline cache sync throughput, recommendation pipeline QPS, CDN vs origin split**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/spotify-50m-dau)

---

### P-15. Podcast Platform at 20M DAU

20M DAU podcast listening app. Estimate: **audio file storage (50M episodes x avg 45min x 3 bitrates), RSS feed poll frequency, stream vs download ratio, metadata search QPS, monthly bandwidth cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/podcast-platform-20m-dau)

---

### P-16. Live Event at 50M Concurrent Viewers

A single live sporting event with 50M concurrent viewers (Super Bowl scale). Estimate: **peak CDN bandwidth, HLS segment generation rate, origin shield capacity, failover RTO requirement, cost for 4-hour event**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/live-event-50m-concurrent)

---

### P-17. Zoom at 100M DAU

Zoom with 100M daily meeting participants. Estimate: **concurrent video stream bandwidth (720p = 1.5Mbps/stream), TURN server capacity, recording storage growth, meeting metadata DB size, WebRTC signaling QPS**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/zoom-100m-dau)

---

### P-18. Music Streaming at 100M DAU (Generic)

Generic music streaming service at 100M DAU. Estimate: **concurrent stream count at peak (8pm local time), adaptive bitrate tiers (128/256/320Kbps), catalog size, CDN cache warm-up time, monthly bandwidth bill**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/music-streaming-100m-dau)

---

### P-19. HLS CDN at 1B Requests/day

A CDN serving HLS video segments (2-second segments, 500KB each) at 1B segment requests/day. Estimate: **segment request QPS, cache storage per PoP (30 PoPs worldwide), origin offload %, bandwidth per PoP, monthly CDN cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/hls-cdn-1b-requests)

---

### P-20. Clubhouse (Audio) at 5M DAU

Audio-only social app with 5M DAU; rooms of 2–5,000 listeners. Estimate: **concurrent audio stream bandwidth (Opus codec 64Kbps), room state storage, speaker/listener fan-out, WebSocket connection count, TURN/STUN server sizing**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/streaming/clubhouse-5m-dau)

---

## 🛒 Domain 3 — E-Commerce (10 Problems)

### P-21. Amazon Marketplace at 300M DAU

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/amazon-marketplace-300m-dau)

Estimate: **product search QPS (300M DAU x 10 searches/day), product page read QPS, order write QPS, inventory lock throughput, recommendation QPS, total infrastructure cost**.

---

### P-22. Flash Sale — 10M Concurrent Users

10M users hammer "buy now" at 12:00:00 for a limited-stock item (10,000 units). Estimate: **peak QPS spike (requests in first second), inventory deduction throughput, queue depth needed, time to sell out, required rate limiting**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/flash-sale-10m-concurrent)

---

### P-23. Payment Gateway at 100M Tx/day

Payment gateway processing 100M transactions/day. Estimate: **transaction QPS (uniform vs peak), p99 latency SLA impact on concurrency, idempotency key storage, audit log size/year, PCI-DSS log retention cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/payment-gateway-100m-tx)

---

### P-24. Recommendation Engine at 100M DAU

Recommendation engine serving 100M DAU. Estimate: **inference QPS, model size in memory, feature store read QPS, batch re-training data size/day, A/B test infrastructure overhead**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/recommendation-engine-100m-dau)

---

### P-25. Inventory Service at 10M SKUs

Inventory service for 10M SKUs across 50 warehouses. Estimate: **inventory read QPS (product pages), inventory write QPS (orders + restocks), cache invalidation rate, stock reservation lock contention at peak, total DB size**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/inventory-10m-sku)

---

### P-26. Shopping Cart at 50M DAU

Estimate: **cart read QPS, cart write QPS (add/remove item), session storage size (50M active carts), abandoned cart TTL storage, checkout conversion write burst**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/shopping-cart-50m-dau)

---

### P-27. Product Catalog at 50M DAU

50M product listings, 50M DAU browsing. Estimate: **catalog read QPS, full-text search index size (Elasticsearch), image asset storage (10 images/product), CDN bandwidth for product images, metadata DB size**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/product-catalog-50m-dau)

---

### P-28. Order Tracking at 20M DAU

20M DAU checking order status; 5M orders shipped/day. Estimate: **tracking event write QPS (carrier webhooks), status read QPS, push notification throughput at delivery, event log storage/year, map display API calls**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/order-tracking-20m-dau)

---

### P-29. Review & Rating System at 30M DAU

30M DAU reading/writing product reviews. Estimate: **review write QPS, aggregate rating recompute frequency, review read QPS (product page load), spam ML scoring throughput, review storage (text + helpfulness votes)**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/review-rating-30m-dau)

---

### P-30. B2B Marketplace at 5M DAU

B2B marketplace: 5M DAU buyers, 500K seller companies, 50M products. Estimate: **RFQ (request for quote) throughput, catalog sync from 500K sellers, contract storage, ERP integration API calls/day, audit trail size**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ecommerce/b2b-marketplace-5m-dau)

---

## 💬 Domain 4 — Messaging (10 Problems)

### P-31. WhatsApp at 2B DAU

100B messages/day, end-to-end encrypted. Estimate: **message write QPS, delivery fan-out (groups of 256), encryption overhead, message queue depth for offline users, total message storage with 30-day retention**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/whatsapp-2b-dau)

---

### P-32. Slack at 10M DAU

10M DAU; 1,000 messages/user/day across channels. Estimate: **message write QPS, WebSocket connection count, channel history search QPS (Elasticsearch), file upload throughput, workspace metadata DB size**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/slack-10m-dau)

---

### P-33. SMS Gateway at 100M Messages/day

Carrier SMS gateway processing 100M messages/day. Estimate: **message ingest QPS, SMPP connection pool size to carriers, delivery receipt throughput, short code vs long code routing table size, monthly carrier termination cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/sms-gateway-100m-day)

---

### P-34. Push Notifications at 500M Users

Push notification service for 500M registered devices (iOS + Android). Estimate: **notification write QPS, APNs/FCM connection pool, device token storage, batch blast throughput (send to 100M users in < 5 minutes), retry queue depth**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/push-notifications-500m-users)

---

### P-35. Email Delivery at 10B Messages/month

Transactional + marketing email platform: 10B emails/month. Estimate: **send QPS, SMTP connection pool, bounce/complaint rate storage, SPF/DKIM signing overhead, suppression list size, monthly SES cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/email-delivery-10b-month)

---

### P-36. Telegram at 500M DAU

500M DAU; supports channels with 500K+ subscribers. Estimate: **message QPS, channel broadcast fan-out at scale, media file deduplication storage savings, secret chat key exchange overhead, CDN for media**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/telegram-500m-dau)

---

### P-37. Customer Support Chat at 10M Concurrent

Live customer chat with 10M concurrent sessions. Estimate: **WebSocket server count (10K connections/server), message throughput, agent:customer ratio impact, chat transcript storage/year, sentiment analysis ML QPS**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/customer-chat-10m-concurrent)

---

### P-38. IoT Messaging at 100M Devices

100M IoT devices sending sensor readings. Estimate: **MQTT connection pool, message ingest QPS (1 msg/device/minute), time-series DB write throughput, alert rule evaluation QPS, data retention cost (raw + aggregated)**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/iot-messaging-100m-devices)

---

### P-39. Notification Fanout at 200M Users

A social network must fanout a notification to all followers when a celebrity (10M followers) posts. Estimate: **fanout write QPS spike, notification queue depth, delivery time SLA (all 10M delivered in < 30s?), infrastructure cost for fanout burst**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/notification-fanout-200m-users)

---

### P-40. Video Signaling at 50M DAU

WebRTC signaling server for a video calling app with 50M DAU. Estimate: **concurrent call sessions, signaling message QPS (ICE candidates, SDP), TURN server bandwidth (for symmetric NAT users, ~15%), WebSocket server count**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/messaging/video-signaling-50m-dau)

---

## 🔍 Domain 5 — Search (10 Problems)

### P-41. Web Search at 8B Queries/day

Google-scale: 8B queries/day. Estimate: **query QPS, index size (50B web pages x 1KB metadata), query latency budget breakdown, result ranking compute, daily crawl throughput**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/web-search-8b-queries)

---

### P-42. Typeahead / Autocomplete at 100M DAU

100M DAU with autocomplete on every keypress (avg 5 chars typed before selecting). Estimate: **autocomplete QPS (5x amplification), trie/prefix data structure size for top-10M queries, p99 latency target, cache hit ratio needed**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/typeahead-100m-dau)

---

### P-43. E-Commerce Search at 50M DAU

50M DAU searching a catalog of 200M products. Estimate: **search QPS, Elasticsearch index size (200M docs x 5KB), filter/facet cardinality, spell correction index, relevance ranking compute per query**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/ecommerce-search-50m-dau)

---

### P-44. Log Search at 1TB/day

Application log ingestion at 1TB/day (1,000 microservices). Estimate: **log ingest QPS (events/second), Elasticsearch index storage (hot + warm + cold tiers), retention policy impact on cost, search query QPS, alerting rule evaluation frequency**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/log-search-1tb-day)

---

### P-45. Semantic Vector Search at 10M DAU

Vector search over 100M documents (embeddings = 1536 dimensions, float32). Estimate: **vector index size in memory, approximate nearest neighbor (ANN) query QPS, embedding generation throughput for new documents, GPU requirement**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/semantic-vector-search-10m-dau)

---

### P-46. Document Search at 5M DAU

Enterprise document search over 10B internal documents (emails, Confluence, Docs). Estimate: **index size, incremental crawl throughput, permission-aware search overhead (ACL checks per query), full-text vs semantic split**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/document-search-5m-dau)

---

### P-47. Image Search at 50M DAU

Reverse image search and visual similarity (Pinterest/Google Lens style) at 50M DAU. Estimate: **feature vector index (10B images x 512 dims), ANN query latency, GPU inference throughput for feature extraction, storage for processed vectors**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/image-search-50m-dau)

---

### P-48. Realtime News Search at 20M DAU

News search with freshness SLA: articles must be searchable within 5 seconds of publication. Estimate: **index update QPS, crawler throughput, freshness-optimized index vs relevance index trade-off, breaking news QPS spike**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/realtime-news-search-20m-dau)

---

### P-49. Code Search at 10M DAU

GitHub-style code search over 400M repositories. Estimate: **code index size (400M repos x avg 10MB source), trigram index overhead, symbol extraction throughput, blame/history search storage, query QPS distribution**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/code-search-10m-dau)

---

### P-50. Multi-tenant Search at 30M Users

SaaS search: 30M users across 10,000 tenants; each tenant has 1M–100M documents. Estimate: **index partitioning strategy, cross-tenant isolation storage overhead, per-tenant QPS variability, autoscaling trigger thresholds**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/search/multitenant-search-30m-users)

---

## 🗺️ Domain 6 — Maps & Geo (10 Problems)

### P-51. Uber Ridesharing at 50M DAU

50M DAU requesting rides. Estimate: **driver location update QPS (every 5s per active driver, 5M online), ETA computation QPS, geospatial index update rate, trip event storage/year, surge pricing computation frequency**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/uber-ridesharing-50m-dau)

---

### P-52. Maps & Navigation at 1B DAU

Google Maps at 1B DAU. Estimate: **map tile serve QPS, route computation QPS, real-time traffic update ingestion rate (from 500M Android phones), map tile CDN storage, satellite/street-view image storage**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/maps-navigation-1b-dau)

---

### P-53. Food Delivery at 20M DAU

Food delivery (DoorDash/Deliveroo style): 20M DAU, 5M orders/day. Estimate: **dasher location update QPS, ETA recomputation frequency, restaurant menu cache size, order state machine event throughput, geofence trigger QPS**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/food-delivery-20m-dau)

---

### P-54. Yelp Proximity Search at 10M DAU

Find businesses within X km. 150M business listings worldwide. Estimate: **geospatial index size (QuadTree/H3), proximity query QPS, review aggregation cache size, photo CDN bandwidth, index update rate from new reviews**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/yelp-proximity-10m-dau)

---

### P-55. Fleet Management at 1M Vehicles

Real-time tracking of 1M commercial vehicles (trucks, buses). Estimate: **GPS ping ingestion QPS (1 ping/30s/vehicle), time-series storage growth, geofence rule evaluation throughput, route deviation alert latency, dashboard read QPS**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/fleet-management-1m-vehicles)

---

### P-56. Geofencing at 10M DAU

10M mobile users; 1M active geofences (retailer apps, smart home, etc.). Estimate: **entry/exit event detection QPS, geofence index size in memory, false-positive rate from GPS jitter, notification throughput on zone entry**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/geofencing-10m-dau)

---

### P-57. Location Sharing at 10M DAU

Real-time location sharing (Google Maps sharing, Find My Friends). Estimate: **location update write QPS, location read QPS (friends polling), WebSocket vs poll latency trade-off, location history storage, battery impact of update frequency**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/location-sharing-10m-dau)

---

### P-58. Route Optimization at 5M Deliveries/day

Last-mile delivery: optimize routes for 500K drivers, 5M deliveries/day. Estimate: **route computation CPU hours, constraint graph size (time windows, capacity), re-route frequency from traffic updates, API call cost (Google Maps/HERE)**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/route-optimization-5m-deliveries)

---

### P-59. Location History at 20M DAU

Store and query full location history for 20M users (fitness app, travel log). Estimate: **location event ingestion QPS (1 point/30s/active user), storage growth per user per year, query patterns (date range, bounding box), archival cost after 1 year**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/location-history-20m-dau)

---

### P-60. POI / Store Finder at 30M DAU

"Find nearest store" for a retail chain: 30M DAU, 50K store locations. Estimate: **geospatial query QPS, index size (small — 50K POIs), store hours/inventory cache size, CDN for store images, peak load (Friday 5pm vs Monday 9am)**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/maps-geo/poi-store-finder-30m-dau)

---

## 🗄️ Domain 7 — Storage (10 Problems)

### P-61. Dropbox at 500M Users

500M registered users; avg 5GB stored/user. Estimate: **total storage (PB), daily delta sync throughput, block deduplication storage savings, metadata DB size (file tree for 500M users), sync conflict resolution rate**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/dropbox-500m-users)

---

### P-62. Google Drive at 1B Users

1B users; avg 15GB free tier. Estimate: **total storage (EB scale), real-time collaboration CRDT event QPS, version history storage overhead, shared drive access control check QPS, search index for Drive files**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/google-drive-1b-users)

---

### P-63. Object Storage at 100B Objects

S3-scale: 100 billion objects, avg object = 1MB. Estimate: **total capacity (PB), metadata index size (object key → location), PUT/GET QPS at global scale, multi-region replication throughput, lifecycle policy (tier to Glacier) trigger rate**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/object-storage-100b-objects)

---

### P-64. CDN Static Assets at 1B Requests/day

CDN serving JS/CSS/images for a web platform: 1B requests/day. Estimate: **request QPS, average object size (50KB), bandwidth (Tbps), cache hit ratio needed to contain origin cost, PoP count and sizing**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/cdn-static-1b-requests)

---

### P-65. Image Processing CDN at 500M Images

On-the-fly image resizing CDN: 500M source images; each served in 10+ variants. Estimate: **transform request QPS, transformation cache size (source images x variants), origin fetch rate, bandwidth, monthly processing cost (Lambda@Edge vs Cloudinary)**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/image-processing-cdn-500m)

---

### P-66. Video Storage & Transcoding at 500M Videos

Video hosting platform with 500M stored videos. Estimate: **raw storage (avg 200MB upload), transcoded variant storage (5 variants), transcoding throughput needed for new uploads (500 hours/min), cold storage migration after 1 year**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/video-storage-transcoding-500m)

---

### P-67. Backup Service at 10M Users

Cloud backup service: 10M users; avg 100GB backed up/user. Estimate: **initial backup ingestion bandwidth, incremental backup daily delta, deduplication ratio (typ. 3:1), restore throughput SLA, storage cost at 5-year retention**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/backup-service-10m-users)

---

### P-68. File Sharing at 50M DAU

Secure file sharing (WeTransfer/SharePoint style): 50M DAU. Estimate: **upload throughput, shared link access QPS, access control check latency, file expiry cleanup job throughput, virus scan pipeline capacity**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/file-sharing-50m-dau)

---

### P-69. Photo Backup at 100M Users

Automatic phone photo backup (Google Photos style). Estimate: **upload ingestion (avg 5 new photos/day/user, each 3MB), deduplication storage savings, thumbnail generation throughput, ML labeling QPS, 10-year storage cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/photo-backup-100m-users)

---

### P-70. Document Storage at 20M DAU

Enterprise document management: 20M DAU; 1B documents. Estimate: **document write QPS (new + versions), full-text index size, permission inheritance check cost, e-signature workflow event throughput, compliance archive cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/storage/document-storage-20m-dau)

---

## 🎮 Domain 8 — Gaming (10 Problems)

### P-71. Online Game Server at 1M Concurrent

Real-time multiplayer game: 1M concurrent players. Estimate: **game state sync messages/second (10 updates/s/player), server tick rate (20Hz), UDP vs TCP bandwidth, server shard count (2K players/shard), monthly EC2 cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/online-game-server-1m-concurrent)

---

### P-72. Leaderboard at 100M DAU

Global leaderboard for 100M DAU: real-time ranking by score. Estimate: **score update QPS, rank query QPS, Redis Sorted Set memory for 100M users, top-100 vs global rank query latency, seasonal reset throughput**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/leaderboard-100m-dau)

---

### P-73. Matchmaking at 10M DAU

Matchmaking system for 10M DAU competitive game. Estimate: **matchmaking queue depth at peak, skill rating (MMR) update QPS, match creation latency SLA (< 30s), lobby state storage, match history DB size**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/matchmaking-10m-dau)

---

### P-74. Game State Sync at 500K Concurrent

Real-time game state sync for 500K concurrent sessions. Estimate: **state delta broadcast QPS, WebSocket message size (compressed game state), conflict resolution for concurrent updates, server authoritative model overhead, region pinning**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/game-state-sync-500k-concurrent)

---

### P-75. In-Game Chat at 5M Concurrent

In-game chat with 5M concurrent users; guild channels (max 500 members) and whispers. Estimate: **message QPS, WebSocket connection count, guild channel fan-out, chat history storage, profanity filter ML throughput**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/ingame-chat-5m-concurrent)

---

### P-76. Achievements System at 50M DAU

50M DAU triggering achievement checks. Estimate: **achievement event QPS (every game action triggers evaluation), rule engine throughput, achievement unlock notification throughput, badge image CDN, progress tracking storage per user**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/achievements-50m-dau)

---

### P-77. FPS Game Server at 500K Concurrent

First-person shooter with 500K concurrent players; 32-player servers. Estimate: **game server instance count (500K/32), tick rate bandwidth per server (32 players x 1KB/tick x 60Hz), anti-cheat event QPS, spectator mode overhead**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/fps-game-500k-concurrent)

---

### P-78. Game Analytics at 1B Events/day

Game telemetry pipeline: 1B events/day (click, kill, purchase, level-up). Estimate: **event ingest QPS, Kafka partition count, batch aggregation job size, data warehouse storage (Snowflake/BigQuery), funnel analysis query time**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/game-analytics-1b-events)

---

### P-79. Virtual Economy at 10M DAU

In-game virtual currency and marketplace: 10M DAU. Estimate: **transaction QPS, double-spend prevention lock contention, economy balance ledger size, fraud detection ML scoring QPS, audit log retention**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/virtual-economy-10m-dau)

---

### P-80. Game Replay at 5M DAU

Record and playback match replays for 5M DAU. Estimate: **replay recording write throughput (game input stream, 1KB/s/player), storage for 5M daily matches (avg 15 min), replay streaming read QPS, compression ratio for input vs full state**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/gaming/game-replay-5m-dau)

---

## 💰 Domain 9 — Finance (10 Problems)

### P-81. Banking App at 50M DAU

Retail bank with 50M DAU. Estimate: **transaction write QPS, account read QPS, balance consistency requirement (strong reads cost), statement generation batch throughput, fraud check latency budget, 7-year audit log storage**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/banking-app-50m-dau)

---

### P-82. Stock Trading at 10M DAU

Stock trading platform with 10M DAU; NYSE opens at 9:30am. Estimate: **order QPS (heavy burst at open), order book memory (10M orders in-flight), market data feed throughput (500K price updates/second), trade settlement write QPS**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/stock-trading-10m-dau)

---

### P-83. Crypto Exchange at 5M DAU

Crypto exchange with 5M DAU; 200 trading pairs. Estimate: **order QPS (crypto trades 24/7, no market hours), matching engine throughput, order book memory (per-pair depth 1,000 levels), WebSocket price feed bandwidth, cold wallet signing throughput**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/crypto-exchange-5m-dau)

---

### P-84. Payment Processor at 100M Tx/day

Payment processor (Stripe/PayPal style): 100M transactions/day. Estimate: **transaction QPS, idempotency key TTL storage, 3DS authentication overhead, chargeback event QPS, ledger DB write throughput, monthly cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/payment-processor-100m-tx)

---

### P-85. Fraud Detection at 100M Tx/day

Real-time fraud detection scoring every transaction. Estimate: **ML inference QPS, feature store read latency budget (< 50ms total), model size in memory, false positive rate impact on customer service volume, rule engine throughput**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/fraud-detection-100m-tx)

---

### P-86. Digital Wallet at 100M DAU

Mobile digital wallet: 100M DAU, 20M transactions/day. Estimate: **transaction write QPS, wallet balance read QPS (shown on every app open), P2P transfer throughput, KYC document storage, regulatory reporting batch size**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/digital-wallet-100m-dau)

---

### P-87. Market Data Feed at 10M Subscribers

Real-time market data: 10M subscribers receiving price ticks. Estimate: **publish QPS (500K price updates/s from exchanges), fan-out bandwidth, subscriber WebSocket connection count, tick data storage (raw + OHLCV aggregates), latency SLA (microseconds for algo traders)**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/market-data-feed-10m-subscribers)

---

### P-88. Loan Origination at 1M Applications/day

Loan origination platform processing 1M applications/day. Estimate: **application write QPS, credit bureau API call throughput, document OCR processing queue depth, underwriting decision ML QPS, audit trail storage per application**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/loan-origination-1m-day)

---

### P-89. Audit Log at 100M Events/day

Immutable audit log for a financial platform: 100M events/day. Estimate: **event write QPS, append-only storage growth, cryptographic hash chaining overhead, compliance query latency (date range + user filter), 7-year retention cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/audit-log-100m-events)

---

### P-90. Tax Filing at 10M (Seasonal)

Tax filing platform: 10M users filing in April (US deadline). Estimate: **peak day QPS vs average day QPS ratio (50x spike), form submission write throughput, PDF generation compute burst, IRS e-file API rate limit management, 7-year storage retention**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/finance/tax-filing-10m-seasonal)

---

## 🤖 Domain 10 — AI & ML (10 Problems)

### P-91. LLM API Service at 10M DAU

LLM inference API (GPT-4 class model) serving 10M DAU. Estimate: **inference QPS, GPU count (A100: 3 req/s at 1K tokens), token throughput (tokens/s), KV cache memory per request, prompt caching savings, monthly GPU cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/llm-api-service-10m-dau)

---

### P-92. Recommendation Engine at 100M DAU

ML-based recommendation engine for 100M DAU. Estimate: **embedding store size (100M users x 256 dims + 10M items x 256 dims), online inference QPS, feature store read latency, daily model retraining data volume, A/B test infrastructure overhead**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/recommendation-engine-100m-dau)

---

### P-93. Fraud Detection ML at 100M Tx/day

Real-time ML fraud scoring at 100M transactions/day. Estimate: **inference QPS, feature computation latency budget (< 20ms), model size, GPU vs CPU inference trade-off, training data pipeline throughput, false positive cost at scale**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/fraud-detection-ml-100m)

---

### P-94. Image Recognition API at 50M Requests/day

Image classification/object detection API: 50M requests/day. Estimate: **inference QPS, GPU memory per model (ResNet-50 = 100MB, CLIP = 600MB), image preprocessing throughput, model serving latency p99, monthly GPU instance cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/image-recognition-api-50m)

---

### P-95. RAG Pipeline at 1M DAU

Retrieval-Augmented Generation system: 1M DAU asking questions over 10M documents. Estimate: **query QPS, embedding model throughput for new documents (indexing), vector DB size (10M docs x 1536 dims), LLM generation QPS, total latency budget (retrieval + generation)**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/rag-pipeline-1m-dau)

---

### P-96. ML Training Pipeline

Training a 70B parameter LLM from scratch. Estimate: **training data size (1T tokens x 2 bytes), GPU cluster size (A100 80GB needed), training time (FLOPs / GPU throughput), checkpoint storage (model size x checkpoint frequency), total training cost**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/ml-training-pipeline)

---

### P-97. A/B Testing at 100M DAU

A/B testing platform for 100M DAU; 1,000 simultaneous experiments. Estimate: **assignment computation QPS, experiment log event throughput, statistical significance computation frequency, experiment metadata storage, SDK overhead on app latency**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/ab-testing-100m-dau)

---

### P-98. Content Moderation at 100M Posts/day

ML content moderation: text + image + video, 100M posts/day. Estimate: **moderation inference QPS (multi-modal), image processing pipeline throughput, video frame sampling rate, false positive human review queue depth, appeal pipeline throughput**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/content-moderation-100m-posts)

---

### P-99. Speech Recognition at 10M Minutes/day

Speech-to-text API: 10M minutes of audio/day. Estimate: **audio ingestion bandwidth (16kHz 16-bit = 256KB/min), transcription GPU throughput (real-time factor), streaming vs batch mode trade-off, transcript storage, word error rate impact on downstream NLP**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/speech-recognition-10m-minutes)

---

### P-100. Autonomous Vehicle Data Pipeline

Self-driving car fleet: 10,000 vehicles, each generating 4TB of sensor data/day. Estimate: **total data ingestion (TB/day), cellular upload bandwidth per vehicle, edge preprocessing compression ratio, cloud storage cost, model retraining pipeline throughput**.

[View Worked Solution](/12-interview-prep/capacity-estimation/02-worked-scenarios/ai-ml/autonomous-vehicle-data)

---

## Unit Conversion Drills

Practice these until they are automatic — interviewers will notice if you pause to calculate them.

| Conversion | Value |
|-----------|-------|
| 1M req/day → QPS | **~12 QPS** |
| 10M req/day → QPS | **~115 QPS** |
| 100M req/day → QPS | **~1,160 QPS** |
| 1B req/day → QPS | **~11,600 QPS** |
| Peak = avg × peak factor | **3x for web, 10x for live events** |
| 1 char = 1 byte (ASCII) | use 2 bytes for Unicode avg |
| 1 KB = 1,000 bytes | 1 KiB = 1,024 bytes |
| 1 GB = 10^9 bytes | 1 TB = 10^12 bytes |
| 1 year ≈ 30M seconds | 1 day = 86,400 seconds |
| Disk read throughput (SSD) | ~500 MB/s sequential |
| Network throughput (10GbE) | ~1.25 GB/s usable |
| RAM latency | ~100ns; SSD ~100μs; HDD ~10ms |

---

## Self-Study Plan

| Week | Focus | Problems |
|------|-------|---------|
| Week 1 | Social + Messaging | P-01 to P-10, P-31 to P-40 |
| Week 2 | Streaming + Storage | P-11 to P-20, P-61 to P-70 |
| Week 3 | E-Commerce + Finance | P-21 to P-30, P-81 to P-90 |
| Week 4 | Search + Geo | P-41 to P-60 |
| Week 5 | Gaming + AI/ML | P-71 to P-80, P-91 to P-100 |
| Week 6 | Timed review | Random 2 problems per day, 15 min each |
