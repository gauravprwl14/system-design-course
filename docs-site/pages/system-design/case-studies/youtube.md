---
title: YouTube System Design
layer: case-study
section: system-design/case-studies
difficulty: advanced
prerequisites:
  - system-design/caching/caching-fundamentals
  - system-design/databases/read-replicas
  - system-design/scalability/cdn-edge-computing
  - system-design/queues/message-queue-basics
  - system-design/scalability/async-processing
solves_with: []
related_problems:
  - problems-at-scale/scalability/hot-partition
  - problems-at-scale/performance/connection-pool-starvation
  - problems-at-scale/cost-optimization/storage-bloat
case_studies: []
see_poc:
  - interview-prep/practice-pocs/kafka-basics-producer-consumer
  - interview-prep/practice-pocs/redis-key-value-cache
  - interview-prep/practice-pocs/redis-counter
  - interview-prep/practice-pocs/http-caching-headers
linked_from:
  - interview-prep/caching-cdn/cdn-usage
  - interview-prep/system-design/cdn-edge-computing-media
  - interview-prep/system-design/live-streaming-twitch
  - interview-prep/system-design/video-streaming-platform
  - problems-at-scale/availability/thundering-herd
  - problems-at-scale/concurrency/counter-race
  - problems-at-scale/scalability/hot-partition
  - system-design/caching/caching-strategies
  - system-design/databases/data-archival-strategies
  - system-design/databases/read-replicas
  - system-design/performance/connection-pool-management
  - system-design/queues/kafka-vs-rabbitmq
  - system-design/queues/message-queue-basics
  - system-design/scalability/async-processing
  - system-design/scalability/backpressure
  - system-design/scalability/cdn-edge-computing
  - system-design/scalability/multi-region
tags:
  - youtube
  - video-streaming
  - cdn
  - transcoding
  - adaptive-bitrate
  - distributed-storage
---

# Design YouTube (Video Streaming Platform)

**Difficulty**: Advanced
**Time**: 60 minutes
**Companies**: Google, Amazon, Netflix, Meta, TikTok (Common for senior roles)

## 1. Problem Statement

Design a video sharing and streaming platform where users upload, transcode, and stream videos at global scale.

**Scale reference (YouTube):**

```
Daily active users: 2 billion+
Videos watched per day: 1 billion hours
Video uploads per minute: 500+ hours of content
Storage: Exabytes (1 EB = 1,000 PB)
Peak bandwidth: 100+ Tbps globally
Video formats per upload: 20+ resolutions/codecs
```

## 2. Requirements

### Functional Requirements
1. Upload videos (up to 12 hours, 256 GB)
2. Transcode videos into multiple formats and resolutions
3. Stream videos with adaptive bitrate
4. Video search and discovery
5. View counts, likes, comments

### Non-Functional Requirements
1. **Low latency streaming** (< 200ms start time)
2. **Scalable** (1B+ hours of video watched per day)
3. **Available** (99.99% for streaming, 99.9% for upload)
4. **Durable** (never lose an uploaded video)
5. **Global** (serve from nearest edge location)

### Out of Scope
- Live streaming
- Monetization / ads
- Recommendation algorithm details
- Comments and social features

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Upload Flow                                │
│                                                                  │
│  ┌──────┐  upload  ┌──────────┐  store   ┌──────────┐            │
│  │Client│────────▶│ Upload   │────────▶│   S3     │            │
│  │      │         │ Service  │  raw    │ (Raw)    │            │
│  └──────┘         └────┬─────┘         └──────────┘            │
│                        │ event                                  │
│                   ┌────▼──────────────────────────┐              │
│                   │     Transcoding Pipeline      │              │
│                   │                               │              │
│                   │ ┌──────┐ ┌──────┐ ┌──────┐    │              │
│                   │ │1080p │ │ 720p │ │ 480p │... │              │
│                   │ │H.264 │ │H.264 │ │H.264 │    │              │
│                   │ │VP9   │ │VP9   │ │VP9   │    │              │
│                   │ └──┬───┘ └──┬───┘ └──┬───┘    │              │
│                   └────┼────────┼────────┼────────┘              │
│                        │        │        │                      │
│                   ┌────▼────────▼────────▼────┐                  │
│                   │     S3 (Transcoded)       │                  │
│                   └────────────┬───────────────┘                  │
│                                │ distribute                      │
│                   ┌────────────▼───────────────┐                  │
│                   │          CDN               │                  │
│                   │  (Global edge caching)     │                  │
│                   └────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       Streaming Flow                             │
│                                                                  │
│  ┌──────┐  play   ┌──────────┐  manifest  ┌──────────┐          │
│  │Client│───────▶│ API      │──────────▶│ Client   │          │
│  │      │        │ Server   │           │ Player   │          │
│  └──────┘        └──────────┘           └────┬─────┘          │
│                                              │ fetch segments  │
│                                         ┌────▼─────┐          │
│                                         │   CDN    │          │
│                                         │  (edge)  │          │
│                                         └──────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

## 4. Video Upload Pipeline

### Chunked Upload

```
Problem: 2GB video file — what if upload fails at 1.8GB?

Solution: Chunked upload with resume capability

Client splits video into 5MB chunks:
  Chunk 1: bytes 0 - 5MB       → Upload → ✅
  Chunk 2: bytes 5MB - 10MB    → Upload → ✅
  Chunk 3: bytes 10MB - 15MB   → Upload → ❌ Network error
  ... Resume ...
  Chunk 3: bytes 10MB - 15MB   → Upload → ✅ (retry only this chunk)
  Chunk 4: bytes 15MB - 20MB   → Upload → ✅
  ...

Upload API:
  POST /upload/init
    → { uploadId: "up-123", chunkSize: 5242880 }

  PUT /upload/up-123/chunk/3
    Content-Range: bytes 10485760-15728639/2147483648
    Body: [5MB binary data]
    → { status: "received", chunksComplete: 3, chunksTotal: 410 }

  POST /upload/up-123/complete
    → { videoId: "v-abc", status: "processing" }

Storage:
  Chunks → S3 multipart upload
  Reassembled into single object after all chunks received
```

### Upload Processing

```
After upload completes:

1. Virus scan (safety check)
2. Extract metadata (duration, resolution, codec, audio)
3. Generate initial thumbnail
4. Store raw video in S3 (cold storage backup)
5. Enqueue for transcoding
6. Create video record in database (status: PROCESSING)

Video metadata record:
{
  videoId: "v-abc123",
  userId: "u-456",
  title: "My Trip to Tokyo",
  description: "...",
  status: "PROCESSING",    // PROCESSING → READY → PUBLISHED
  uploadedAt: "2026-01-15T10:00:00Z",
  rawFile: {
    s3Key: "raw/v-abc123.mp4",
    size: 2147483648,       // 2GB
    codec: "H.264",
    resolution: "3840x2160", // 4K
    duration: 600,           // 10 minutes
    fps: 30
  },
  transcodingProgress: 0,   // 0-100%
  thumbnails: [],
  transcodedVersions: []
}
```

## 5. Video Transcoding

### Why Transcode?

```
Raw upload: 4K H.264, 2GB, 10 minutes

But users have different devices and connections:
  4K TV + fiber:     4K H.265 (best quality)
  Laptop + WiFi:     1080p H.264 (standard)
  Phone + 4G:        720p H.264 (medium)
  Phone + 3G:        480p H.264 (low)
  Slow connection:   360p H.264 (minimum)

One video → 20+ versions:
  4K  (2160p): H.264, H.265, VP9, AV1
  1080p:       H.264, H.265, VP9, AV1
  720p:        H.264, H.265, VP9
  480p:        H.264, VP9
  360p:        H.264
  Audio only:  AAC, Opus
```

### Transcoding Pipeline

```
┌──────────┐     ┌──────────────────────────────────────┐
│ Raw Video│────▶│        Transcoding Pipeline           │
│ (S3)     │     │                                      │
└──────────┘     │  ┌────────────────────────────────┐  │
                 │  │ Step 1: Split into segments     │  │
                 │  │ 10 min video → 60 × 10s chunks  │  │
                 │  └──────────────┬─────────────────┘  │
                 │                 │                    │
                 │  ┌──────────────▼─────────────────┐  │
                 │  │ Step 2: Parallel transcode      │  │
                 │  │                                 │  │
                 │  │ Worker 1: chunk 1-10 → 1080p    │  │
                 │  │ Worker 2: chunk 11-20 → 1080p   │  │
                 │  │ Worker 3: chunk 1-10 → 720p     │  │
                 │  │ Worker 4: chunk 11-20 → 720p    │  │
                 │  │ ... (60 chunks × 5 resolutions  │  │
                 │  │      = 300 parallel tasks)      │  │
                 │  └──────────────┬─────────────────┘  │
                 │                 │                    │
                 │  ┌──────────────▼─────────────────┐  │
                 │  │ Step 3: Package for streaming   │  │
                 │  │ Generate HLS/DASH manifests     │  │
                 │  │ Create thumbnail sprites        │  │
                 │  └──────────────┬─────────────────┘  │
                 │                 │                    │
                 │  ┌──────────────▼─────────────────┐  │
                 │  │ Step 4: Upload to CDN origin    │  │
                 │  │ Store all versions in S3        │  │
                 │  └────────────────────────────────┘  │
                 └──────────────────────────────────────┘

Parallel transcoding:
  Sequential: 10 min video × 5 resolutions = 50 min total
  Parallel: 60 chunks × 5 resolutions on 300 workers = ~2 min total!

YouTube processes 500+ hours of video per minute.
Without parallel transcoding, this would be impossible.
```

### DAG-Based Processing

```
Transcoding as a DAG (Directed Acyclic Graph):

                    ┌─────────┐
                    │ Upload  │
                    │ Complete│
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │ Segment │
                    │ Splitter│
                    └────┬────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │Transcode │ │Transcode │ │Transcode │
      │ 1080p    │ │  720p    │ │  480p    │
      └────┬─────┘ └────┬─────┘ └────┬─────┘
           │             │            │
      ┌────▼─────┐  ┌────▼────┐  ┌───▼──────┐
      │Generate  │  │Generate │  │Generate  │
      │Thumbnails│  │Manifest │  │Subtitles │
      └────┬─────┘  └────┬────┘  └────┬─────┘
           │             │            │
           └─────────────┼────────────┘
                         │
                    ┌────▼────┐
                    │Publish  │
                    │to CDN   │
                    └─────────┘

Tools: Apache Airflow, AWS Step Functions, Temporal
Each step is a separate worker/container
Failures retry at the step level (not full pipeline)
```

## 6. Video Streaming (Adaptive Bitrate)

### How HLS/DASH Works

```
HLS (HTTP Live Streaming):

1. Server generates manifest (.m3u8):
   master.m3u8:
   #EXTM3U
   #EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
   1080p/playlist.m3u8
   #EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
   720p/playlist.m3u8
   #EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480
   480p/playlist.m3u8

   1080p/playlist.m3u8:
   #EXTM3U
   #EXTINF:10.0,
   segment-001.ts
   #EXTINF:10.0,
   segment-002.ts
   ...

2. Player flow:
   a. Fetch master.m3u8 (lists all quality levels)
   b. Measure bandwidth: 8 Mbps
   c. Select: 1080p (needs 5 Mbps) ✅
   d. Fetch segment-001.ts (10 seconds of video)
   e. Play segment, fetch next
   f. Bandwidth drops to 2 Mbps?
   g. Switch to 720p on next segment
   h. Seamless quality change!

File structure on CDN:
  /videos/v-abc123/
  ├── master.m3u8
  ├── 1080p/
  │   ├── playlist.m3u8
  │   ├── segment-001.ts (10s, ~6MB)
  │   ├── segment-002.ts
  │   └── ...
  ├── 720p/
  │   ├── playlist.m3u8
  │   ├── segment-001.ts (10s, ~3MB)
  │   └── ...
  └── 480p/
      ├── playlist.m3u8
      ├── segment-001.ts (10s, ~1.2MB)
      └── ...
```

### Streaming Architecture

```
┌──────────┐                            ┌──────────────┐
│  Client  │── GET master.m3u8 ────────▶│  CDN Edge    │
│  Player  │◀── manifest ──────────────│  (Mumbai)    │
│          │                            │              │
│          │── GET 1080p/seg-001.ts ──▶│  Cache HIT   │
│          │◀── video segment ─────────│  → serve     │
│          │                            │              │
│          │── GET 1080p/seg-002.ts ──▶│  Cache MISS  │
│          │                            │  → fetch     │
│          │                            │    from      │
│          │                            │    origin    │
│          │◀── video segment ─────────│  → cache     │
│          │                            │  → serve     │
└──────────┘                            └──────────────┘

CDN caching strategy:
  Popular videos: Cached at edge (95% cache hit rate)
  Recent uploads: Cached after first request
  Old/rare videos: Fetched from S3 origin on demand

Segment size trade-off:
  2 seconds:  Fast quality switching, more HTTP requests
  10 seconds: Fewer requests, slower quality adaptation
  Standard: 6-10 seconds (YouTube uses ~5 seconds)
```

## 7. Storage Architecture

```
Storage tiers:

┌─────────────────────────────────────────────────┐
│  Hot Storage (CDN edge + S3 Standard)           │
│  Popular videos: last 30 days, top 10% views    │
│  Access: < 50ms                                 │
│  Cost: $$$                                      │
├─────────────────────────────────────────────────┤
│  Warm Storage (S3 Standard-IA)                  │
│  Moderate videos: 30-365 days old               │
│  Access: < 100ms                                │
│  Cost: $$                                       │
├─────────────────────────────────────────────────┤
│  Cold Storage (S3 Glacier)                      │
│  Rarely accessed: > 1 year old, < 10 views/mo   │
│  Access: Minutes to hours                       │
│  Cost: $                                        │
├─────────────────────────────────────────────────┤
│  Archive (S3 Glacier Deep Archive)              │
│  Raw original uploads (backup/legal)            │
│  Access: 12+ hours                              │
│  Cost: ¢                                        │
└─────────────────────────────────────────────────┘

Lifecycle policy:
  Day 0:     Upload → S3 Standard + CDN
  Day 30:    Low views? → Move to S3-IA
  Day 365:   Very low views? → Move to Glacier
  Raw video: Immediately to Glacier (keep forever for re-encoding)

Cost at YouTube scale:
  Exabytes of storage
  ~$20M+/month on storage alone
  Tiering saves 60-70% vs storing everything in hot storage
```

## 8. Video Metadata & Search

```
Video metadata database (PostgreSQL + Elasticsearch):

PostgreSQL (source of truth):
  CREATE TABLE videos (
    video_id UUID PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'processing',
    duration_seconds INT,
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP,
    tags TEXT[],
    category TEXT,
    language TEXT
  );

Elasticsearch (search index):
  Synced via CDC (Change Data Capture)
  Full-text search on title + description
  Faceted filtering by category, duration, date
  Autocomplete suggestions

Search query:
  GET /search?q=tokyo+travel&category=travel&duration=medium
  → Elasticsearch: Full-text match + filters
  → Return ranked results (relevance + recency + popularity)
```

## 9. View Count at Scale

```
Problem: 1 billion video views per day
  Naive: UPDATE videos SET view_count = view_count + 1
  Result: Database melts from write contention

Solution: Aggregate in memory, flush periodically

┌──────────┐  view event  ┌──────────────┐
│  Client  │─────────────▶│ View Counter │
│  Player  │              │   Service    │
└──────────┘              └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │    Redis     │
                          │  INCR view:  │
                          │  v-abc:count │
                          └──────┬───────┘
                                 │ Flush every 30s
                          ┌──────▼───────┐
                          │  Database    │
                          │  Batch UPDATE│
                          │  1000 videos │
                          │  at once     │
                          └──────────────┘

Deduplication:
  Same user watching same video = 1 view
  Key: view:{videoId}:{userId}:{hourBucket}
  SET NX, EX 3600 (only count once per hour per user)

View count display:
  < 1000: Show exact count
  1K-999K: Show "15K views"
  1M+: Show "2.3M views"
  (Approximate is fine for display)
```

## 10. Key Takeaways

```
1. Chunked upload with resume is essential
   Large files will fail; resumable upload prevents re-upload

2. Parallel transcoding makes processing feasible
   Split video into segments, transcode in parallel
   500 hours/minute requires massive parallelism

3. Adaptive bitrate streaming (HLS/DASH) is standard
   Multiple quality levels, client switches based on bandwidth
   Segments cached independently at CDN edge

4. Storage tiering controls costs
   Hot → Warm → Cold → Archive lifecycle
   Only popular videos in expensive hot storage

5. CDN serves 95%+ of streaming traffic
   Edge caching for popular content
   Origin fetch for long-tail content

6. View counts need batching
   Aggregate in Redis, flush to database periodically
   Real-time accuracy not needed for display

7. DAG-based pipeline for video processing
   Each step independent, retryable, parallelizable
   Tools: Airflow, Step Functions, Temporal
```
