# CDN Fundamentals - Serve Content 100x Faster Globally

> **Reading Time:** 15 minutes
> **Difficulty:** 🟢 Beginner
> **Prerequisites:** Basic understanding of HTTP, DNS
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The 3-Second Rule That Breaks Websites

**Your server is in Virginia. Your user is in Tokyo.**

```
Without CDN:
User (Tokyo) → Your Server (Virginia)
Distance: 10,800 km
Network hops: 15-20
Latency: 180-250ms per request

For a page with 50 assets:
50 × 200ms = 10 seconds load time
Result: 53% of users leave

With CDN:
User (Tokyo) → Edge Server (Tokyo)
Distance: 50 km
Network hops: 2-3
Latency: 10-20ms per request

50 × 15ms = 750ms load time
Result: Users stay, revenue grows
```

**The math is simple:** Every 100ms of latency costs 1% in conversions. A CDN can reduce latency by 80-90%, which directly translates to **8-9% more revenue**.

This article explains how CDNs work and why they're essential for serving media at scale.

---

## What is a CDN?

A **Content Delivery Network (CDN)** is a globally distributed network of servers that cache and serve content from locations closer to users.

### The Core Problem CDNs Solve

```
Traditional Architecture (Single Origin):

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  User (Sydney)  ─────────────────────────→  Server (NYC)    │
│       ↓                    180ms                  ↓         │
│  Request Image            ←──────────────   Send Image      │
│       ↓                    180ms                            │
│  Total: 360ms round trip                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

CDN Architecture (Distributed Edge):

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  User (Sydney)  ───────→  Edge (Sydney)  ───→  Origin (NYC) │
│       ↓            10ms        ↓          Only if not cached│
│  Request Image    ←────   Serve from                        │
│       ↓            10ms   local cache                       │
│  Total: 20ms round trip (18x faster!)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### How CDN Caching Works

```
First Request (Cache MISS):

1. User requests image.jpg
2. Edge server doesn't have it (MISS)
3. Edge fetches from origin server
4. Edge caches the image
5. Edge returns image to user

Subsequent Requests (Cache HIT):

1. User requests image.jpg
2. Edge server has it (HIT)
3. Edge returns image immediately
   (Origin server not involved)
```

---

## CDN Architecture Deep Dive

### The Three-Tier Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         TIER 1: EDGE LAYER                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │PoP NYC  │ │PoP LON  │ │PoP TYO  │ │PoP SYD  │ │PoP SIN  │    │
│  │ 10 TB   │ │ 10 TB   │ │ 10 TB   │ │ 10 TB   │ │ 10 TB   │    │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘    │
│       │           │           │           │           │          │
│  Closest to users, smallest cache, highest hit rate for hot     │
│  content. 200+ locations globally.                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 2: REGIONAL/SHIELD LAYER                 │
│       ┌──────────────┐        ┌──────────────┐                   │
│       │ Shield US    │        │ Shield EU    │                   │
│       │ 100 TB       │        │ 100 TB       │                   │
│       └──────┬───────┘        └──────┬───────┘                   │
│              │                       │                           │
│  Aggregates requests from multiple edge PoPs.                    │
│  Reduces load on origin by 90%+.                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TIER 3: ORIGIN LAYER                        │
│                    ┌──────────────────┐                          │
│                    │  Origin Server   │                          │
│                    │  (Your Server)   │                          │
│                    │  S3, Your API    │                          │
│                    └──────────────────┘                          │
│                                                                  │
│  Source of truth. Only hit on cache misses.                      │
│  With proper caching, <5% of requests reach origin.              │
└─────────────────────────────────────────────────────────────────┘
```

### Points of Presence (PoPs)

A **PoP** is a physical location with CDN servers. Major CDNs have 200+ PoPs:

| CDN | PoPs | Notable Coverage |
|-----|------|------------------|
| **Cloudflare** | 300+ | Every continent, strong in emerging markets |
| **AWS CloudFront** | 400+ | Deep AWS integration, Lambda@Edge |
| **Akamai** | 350+ | Enterprise focus, highest capacity |
| **Fastly** | 90+ | Real-time purging, edge compute |

### How Users Reach the Nearest PoP

```
DNS-Based Routing:

1. User's browser requests: cdn.instagram.com
2. DNS resolver asks CDN's authoritative DNS
3. CDN's DNS checks user's IP geolocation
4. Returns IP of nearest PoP

┌─────────────────────────────────────────────────────────────┐
│  User Query: cdn.instagram.com                              │
│       ↓                                                     │
│  CDN DNS (GeoDNS)                                           │
│       ↓                                                     │
│  Check user IP: 203.0.113.50 → Japan                        │
│       ↓                                                     │
│  Return: 198.51.100.25 (Tokyo PoP IP)                       │
│       ↓                                                     │
│  User connects to Tokyo edge server                         │
└─────────────────────────────────────────────────────────────┘
```

**Anycast** is another routing method where multiple servers share the same IP, and BGP routes to the nearest one.

---

## Cache Headers: Controlling What Gets Cached

### The Essential Headers

```http
# From Origin to CDN (Response Headers)

Cache-Control: public, max-age=31536000
# public: CDN can cache this
# max-age: Cache for 1 year (immutable content)

Cache-Control: private, no-cache
# private: Don't cache in CDN (user-specific)
# no-cache: Always revalidate with origin

Cache-Control: public, max-age=3600, stale-while-revalidate=86400
# max-age: Fresh for 1 hour
# stale-while-revalidate: Serve stale while fetching new (1 day)

ETag: "abc123"
# Unique identifier for this version
# Used for conditional requests (If-None-Match)

Vary: Accept-Encoding, Accept
# Cache different versions based on these headers
# Important for WebP/AVIF format selection
```

### Cache Header Strategy by Content Type

```javascript
// Content-specific cache headers

const cacheHeaders = {
  // Static assets with hash in filename (immutable)
  'image-hashed': {
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Cache forever - filename changes when content changes
    // Example: photo-abc123.jpg
  },

  // User profile pictures (can change)
  'profile-picture': {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'ETag': generateETag(content),
    // 1 hour fresh, serve stale up to 1 day while revalidating
  },

  // User-specific content (feed)
  'personalized-feed': {
    'Cache-Control': 'private, no-store',
    // Never cache - personalized per user
  },

  // API responses
  'api-response': {
    'Cache-Control': 'public, max-age=60, stale-if-error=300',
    // 1 minute fresh, serve stale up to 5 min if origin errors
  }
};
```

---

## Cache Invalidation: The Hard Problem

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

### Why Cache Invalidation is Hard

```
The Problem:

1. You update a user's profile picture
2. New image uploaded to origin
3. But 200+ edge servers still have old image cached
4. Some users see old, some see new (inconsistency!)

The Challenge:
- Can't wait for TTL expiry (could be 1 year)
- Need to invalidate across 200+ PoPs
- Invalidation takes time to propagate
- High-traffic content = more stale copies
```

### Invalidation Strategies

#### Strategy 1: URL Versioning (Recommended for Immutable Content)

```javascript
// ✅ Best for static assets

// Old URL (cached forever)
const oldUrl = 'https://cdn.instagram.com/photos/abc123.jpg';

// New URL (new cache entry)
const newUrl = 'https://cdn.instagram.com/photos/abc123-v2.jpg';
// OR
const hashedUrl = 'https://cdn.instagram.com/photos/abc123.d41d8cd9.jpg';

// Benefits:
// - Instant "invalidation" (it's a new URL)
// - Old cached content still served until TTL
// - No propagation delay
// - Atomic updates (old or new, never partial)
```

#### Strategy 2: Purge API (For Dynamic Content)

```javascript
// Invalidate specific URLs via CDN API

// Cloudflare example
async function purgeFromCloudflare(urls) {
  await fetch('https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: urls  // Array of URLs to purge
    })
  });
}

// CloudFront example
async function purgeFromCloudFront(paths) {
  await cloudfront.createInvalidation({
    DistributionId: DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: paths.length,
        Items: paths  // e.g., ['/photos/user123/*']
      }
    }
  });
}

// Usage
await purgeFromCloudflare([
  'https://cdn.instagram.com/profiles/user123.jpg'
]);

// Propagation time:
// Cloudflare: ~30 seconds globally
// CloudFront: 5-10 minutes
// Akamai: 5-10 minutes
```

#### Strategy 3: Soft Purge / Stale-While-Revalidate

```javascript
// Don't delete from cache, mark as stale

// Fastly's Soft Purge
await fetch(`https://api.fastly.com/purge/${SURROGATE_KEY}`, {
  method: 'POST',
  headers: {
    'Fastly-Key': API_KEY,
    'Fastly-Soft-Purge': '1'  // Soft purge
  }
});

// Result:
// - Content marked "stale" in cache
// - Next request triggers background revalidation
// - User gets stale content immediately (fast!)
// - Cache updates in background
```

#### Strategy 4: Surrogate Keys (Best for Complex Invalidation)

```javascript
// Tag content with surrogate keys for bulk invalidation

// When serving content, add surrogate key header:
response.headers['Surrogate-Key'] = 'user-123 post-456 feed-home';

// Later, invalidate all content for a user:
await fastly.purge('user-123');
// Invalidates ALL content tagged with 'user-123'

// Use cases:
// - User deletes account → purge 'user-{id}'
// - Post deleted → purge 'post-{id}'
// - New follower → purge 'feed-{follower-id}'
```

---

## CDN Performance Metrics

### Key Metrics to Monitor

```javascript
const cdnMetrics = {
  // Cache effectiveness
  cacheHitRatio: {
    target: '>95%',
    calculate: (hits, total) => hits / total * 100,
    alertThreshold: '<90%'  // Investigate if drops
  },

  // Performance
  ttfb: {  // Time To First Byte
    target: '<50ms for edge hits',
    p50: '20ms',
    p95: '80ms',
    p99: '150ms'
  },

  // Bandwidth
  bandwidthSaved: {
    formula: 'origin_bandwidth_without_cdn - origin_bandwidth_with_cdn',
    typical: '85-95% reduction'
  },

  // Origin shield effectiveness
  originHitRatio: {
    target: '<5% of total requests',
    description: 'Requests that reach your origin'
  },

  // Error rates
  errorRates: {
    '5xx': '<0.1%',  // Origin errors
    '4xx': '<1%',    // Client errors (404s, etc.)
    '503': '<0.01%'  // Origin overload
  }
};
```

### Real-World Performance Comparison

| Metric | Without CDN | With CDN | Improvement |
|--------|-------------|----------|-------------|
| **Latency (Tokyo user)** | 280ms | 25ms | **91% faster** |
| **Latency (London user)** | 90ms | 12ms | **87% faster** |
| **Origin bandwidth** | 10 Gbps | 500 Mbps | **95% reduction** |
| **Origin requests** | 100K/sec | 5K/sec | **95% reduction** |
| **Global availability** | 99.5% | 99.99% | **10x fewer outages** |

---

## CDN Selection Guide

### When to Use Which CDN

```javascript
const cdnSelectionGuide = {
  'AWS CloudFront': {
    bestFor: [
      'AWS-hosted origins (S3, EC2, ALB)',
      'Lambda@Edge for edge compute',
      'Tight AWS ecosystem integration'
    ],
    pricing: 'Pay-per-use, volume discounts',
    edgeCompute: 'Lambda@Edge, CloudFront Functions'
  },

  'Cloudflare': {
    bestFor: [
      'Free tier for small sites',
      'DDoS protection included',
      'Simple setup, fast onboarding',
      'Workers for edge compute'
    ],
    pricing: 'Free tier, then $20+/month',
    edgeCompute: 'Cloudflare Workers'
  },

  'Fastly': {
    bestFor: [
      'Real-time purging (<150ms globally)',
      'VCL for advanced cache logic',
      'Streaming media',
      'API responses'
    ],
    pricing: 'Premium, usage-based',
    edgeCompute: 'Compute@Edge (Wasm)'
  },

  'Akamai': {
    bestFor: [
      'Largest network (most PoPs)',
      'Enterprise SLAs',
      'Video streaming at scale',
      'Highest traffic volumes'
    ],
    pricing: 'Enterprise contracts',
    edgeCompute: 'EdgeWorkers'
  }
};
```

---

## Quick Win: Add CDN to Your App in 15 Minutes

### Using AWS CloudFront with S3

```bash
# Step 1: Create S3 bucket for static assets
aws s3 mb s3://my-app-static-assets

# Step 2: Upload assets
aws s3 sync ./public s3://my-app-static-assets \
  --cache-control "public, max-age=31536000"

# Step 3: Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name my-app-static-assets.s3.amazonaws.com \
  --default-cache-behavior '{
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }'

# Step 4: Update your app to use CloudFront URL
# Old: https://my-app-static-assets.s3.amazonaws.com/image.jpg
# New: https://d1234567890.cloudfront.net/image.jpg
```

### Using Cloudflare (Even Easier)

```bash
# Step 1: Add site to Cloudflare (change nameservers)
# Step 2: Enable "Proxied" (orange cloud) for your domain
# Step 3: Done! Cloudflare now caches your content

# Customize caching with Page Rules:
# *.yoursite.com/static/* → Cache Level: Cache Everything, Edge TTL: 1 month
```

**What you achieved in 15 minutes:**
- ✅ Global content distribution (200+ PoPs)
- ✅ 80-90% latency reduction for static assets
- ✅ 85-95% bandwidth savings on origin
- ✅ Built-in DDoS protection
- ✅ HTTPS by default

---

## Key Takeaways

**What you learned:**
- CDNs cache content at edge locations close to users
- Cache-Control headers control what gets cached and for how long
- Cache invalidation requires strategy: versioning, purging, or surrogate keys
- A good cache hit ratio is >95%

**The formula:**
```
User Latency = Network Round Trip + Processing Time
With CDN: ~20ms (edge hit)
Without CDN: ~200ms (origin)
```

**Quick reference:**
```
Content Type          | Cache Strategy
----------------------|----------------------------------
Static assets (hash)  | max-age=31536000, immutable
User avatars          | max-age=3600, stale-while-revalidate
API responses         | max-age=60, stale-if-error=300
Personalized content  | private, no-store (don't cache)
```

---

## What's Next?

Now that you understand CDN fundamentals, learn how to optimize the content being served:

**Next Article:** [Image Optimization & Formats](/interview-prep/system-design/instagram-assets-series/prereq-image-optimization) — Reduce image sizes by 80% with modern formats and compression techniques.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
