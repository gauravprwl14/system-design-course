# Image Serving at Global Scale - Sub-100ms Delivery Worldwide

> **Reading Time:** 18 minutes
> **Difficulty:** 🟡 Intermediate
> **Prerequisites:** [CDN Fundamentals](/interview-prep/system-design/instagram-assets-series/prereq-cdn-fundamentals), [Image Optimization](/interview-prep/system-design/instagram-assets-series/prereq-image-optimization), [Part 1: Upload Pipeline](/interview-prep/system-design/instagram-assets-series/01-image-upload-pipeline)
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The 2-Second Image That Kills Engagement

**A user in Mumbai opens Instagram.**

```
Scenario without optimized serving:

User location: Mumbai, India
Closest datacenter: Mumbai (if exists)
Image origin: US-West-2 (Oregon)
Distance: 14,000 km

Request path:
User → Mumbai ISP → Undersea cable → US → Oregon datacenter → S3
Latency: 180ms minimum (speed of light)

For one feed scroll (20 images):
20 × 180ms = 3.6 seconds

But wait, it's worse:
- No CDN: 180ms per request
- No HTTP/2: Sequential loading
- Wrong format: JPEG instead of WebP
- Wrong size: 2000px served to 375px phone

Actual load time: 8-12 seconds

Result: User closes app, engagement drops 40%
```

Instagram serves **10 billion+ image requests daily** to users across **195 countries**. Every millisecond matters.

**The goal:** Serve any image to any user in **under 100ms**.

This article shows you how Instagram achieves global sub-100ms image delivery through CDN architecture, intelligent format selection, and aggressive caching.

---

## The $1 Million/Day Latency Problem

**Case Study: E-Commerce Giant (2020)**

```
Before optimization:
- Average image load time: 2.3 seconds
- CDN hit rate: 65%
- Format: JPEG only
- No responsive images

Monthly metrics:
- Page views: 500 million
- Conversion rate: 2.1%
- Average order: $85

After optimization (3 months):
- Average image load time: 340ms (85% faster)
- CDN hit rate: 97%
- Format: WebP/AVIF with JPEG fallback
- Responsive images across breakpoints

Results:
- Conversion rate: 2.8% (+33%)
- Bounce rate: -25%
- Mobile conversion: +45%

Revenue impact:
Before: 500M × 2.1% × $85 = $892M/month
After:  500M × 2.8% × $85 = $1.19B/month
Increase: $298M/month = ~$10M/day

Investment: $2M (CDN, engineering, infrastructure)
ROI: 149x in first month
```

**The lesson:** Image delivery optimization is one of the highest-ROI investments for any visual platform.

---

## Multi-Tier CDN Architecture

### Instagram's CDN Layer Cake

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMAGE SERVING ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────┘

                    ┌────────────────────┐
                    │     USER DEVICE    │
                    │  (Browser/App)     │
                    └─────────┬──────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: EDGE LAYER (200+ PoPs)                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Mumbai   │ │Tokyo    │ │London   │ │São Paulo│ │Sydney   │   │
│  │Edge     │ │Edge     │ │Edge     │ │Edge     │ │Edge     │   │
│  │ 5TB     │ │ 5TB     │ │ 5TB     │ │ 5TB     │ │ 5TB     │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │           │         │
│  Latency: <20ms  Cache: Hot content (last 24h popular)          │
│  Hit rate: 85-90% of requests served here                       │
└─────────────────────────────────────────────────────────────────┘
                              │ Cache MISS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: REGIONAL SHIELD (6 locations)                          │
│       ┌──────────────┐        ┌──────────────┐                  │
│       │ US Shield    │        │ EU Shield    │                  │
│       │ (Virginia)   │        │ (Frankfurt)  │                  │
│       │ 50 TB        │        │ 50 TB        │                  │
│       └──────┬───────┘        └──────┬───────┘                  │
│              │                       │                          │
│  Latency: 50-80ms from edge                                     │
│  Hit rate: 95% of edge misses served here                       │
│  Purpose: Aggregate requests, reduce origin load                │
└─────────────────────────────────────────────────────────────────┘
                              │ Cache MISS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 3: ORIGIN (S3 + Image Optimization)                       │
│                    ┌──────────────────┐                         │
│                    │  Origin Server   │                         │
│                    │  + On-the-fly    │                         │
│                    │    optimization  │                         │
│                    └────────┬─────────┘                         │
│                             │                                   │
│                    ┌────────┴─────────┐                         │
│                    │        S3        │                         │
│                    │   (all variants) │                         │
│                    └──────────────────┘                         │
│                                                                 │
│  Only ~0.5% of requests reach origin                            │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Hit Rate Math

```javascript
const cacheAnalysis = {
  totalRequests: 10_000_000_000,  // 10B daily

  tier1_edge: {
    hitRate: 0.88,
    requestsServed: 8_800_000_000,
    latency: '15ms',
    cost: 'Lowest'
  },

  tier2_shield: {
    missesFromEdge: 1_200_000_000,
    hitRate: 0.95,
    requestsServed: 1_140_000_000,
    latency: '60ms',
    cost: 'Low'
  },

  tier3_origin: {
    missesFromShield: 60_000_000,
    requestsServed: 60_000_000,  // 0.6% of total
    latency: '150ms',
    cost: 'Highest'
  },

  // Overall metrics
  effectiveCacheHitRate: '99.4%',
  averageLatency: '22ms',  // Weighted average
  originBandwidth: '0.6% of total'  // Massive savings
};
```

---

## Intelligent Format Selection

### Content Negotiation at the Edge

```javascript
// Edge function: Select optimal image format

async function handleImageRequest(request) {
  const url = new URL(request.url);
  const acceptHeader = request.headers.get('Accept') || '';

  // Determine best format based on client support
  let format = 'jpeg';  // Default fallback

  if (acceptHeader.includes('image/avif')) {
    format = 'avif';  // Best compression
  } else if (acceptHeader.includes('image/webp')) {
    format = 'webp';  // Good compression, wide support
  }

  // Modify request to fetch correct format
  const originalPath = url.pathname;  // /photos/abc123/l
  const newPath = `${originalPath}.${format}`;

  // Fetch from origin/cache
  const response = await fetch(new Request(url.origin + newPath, request));

  // Add Vary header for proper caching
  const headers = new Headers(response.headers);
  headers.set('Vary', 'Accept');
  headers.set('Content-Type', `image/${format}`);

  return new Response(response.body, {
    status: response.status,
    headers
  });
}
```

### Format Selection by Client

```
Client Detection Matrix:

┌─────────────────────────────────────────────────────────────────┐
│ Client Type         │ Accept Header       │ Format Served      │
├─────────────────────┼─────────────────────┼────────────────────┤
│ Chrome 85+          │ image/avif,webp,*/* │ AVIF               │
│ Chrome 32-84        │ image/webp,*/*      │ WebP               │
│ Safari 16+          │ image/avif,webp,*/* │ AVIF               │
│ Safari 14-15        │ image/webp,*/*      │ WebP               │
│ Safari <14          │ image/*             │ JPEG               │
│ Firefox 93+         │ image/avif,webp,*/* │ AVIF               │
│ Firefox 65-92       │ image/webp,*/*      │ WebP               │
│ Edge 79+            │ image/avif,webp,*/* │ AVIF               │
│ IE 11               │ image/*             │ JPEG               │
│ Instagram iOS App   │ custom header       │ WebP (forced)      │
│ Instagram Android   │ custom header       │ WebP (forced)      │
└─────────────────────────────────────────────────────────────────┘

// Mobile apps control the Accept header, forcing optimal format
// Web relies on browser Accept header
```

### Bandwidth Savings by Format

```javascript
// Real measurements from production traffic

const formatComparison = {
  // Same visual quality (SSIM 0.98)
  photo_landscape: {
    jpeg: { size: 245_000, baseline: true },
    webp: { size: 165_000, savings: '33%' },
    avif: { size: 115_000, savings: '53%' }
  },

  photo_portrait: {
    jpeg: { size: 312_000, baseline: true },
    webp: { size: 218_000, savings: '30%' },
    avif: { size: 156_000, savings: '50%' }
  },

  // Daily bandwidth impact at Instagram scale
  dailyBandwidth: {
    jpeg_only: '2.4 PB',
    webp_for_supported: '1.7 PB',  // 30% savings
    avif_for_supported: '1.3 PB'   // 46% savings
  },

  monthlySavings: {
    bandwidth: '33 PB',
    cost: '$2.8M'  // At CDN egress rates
  }
};
```

---

## Responsive Image Serving

### Device-Aware Size Selection

```javascript
// URL pattern for different sizes
// https://cdn.instagram.com/photos/{id}/s{size}x{size}

const sizeMatrix = {
  // Device Pixel Ratio consideration
  mobile_1x: {
    screenWidth: 375,
    dpr: 1,
    imageNeeded: 375,
    sizeServed: 's320'  // Slightly smaller for speed
  },

  mobile_2x: {
    screenWidth: 375,
    dpr: 2,
    imageNeeded: 750,
    sizeServed: 's640'  // Close match
  },

  mobile_3x: {
    screenWidth: 375,
    dpr: 3,
    imageNeeded: 1125,
    sizeServed: 's1080'  // Slight oversizing is ok
  },

  tablet: {
    screenWidth: 768,
    dpr: 2,
    imageNeeded: 1536,
    sizeServed: 's1080'  // Trade-off: quality vs speed
  },

  desktop: {
    screenWidth: 1920,
    dpr: 1,
    imageNeeded: 1920,
    sizeServed: 's2048'
  }
};
```

### Client-Side Size Selection

```javascript
// React Native example

function getImageUrl(photoId, containerWidth) {
  const dpr = PixelRatio.get();
  const neededWidth = containerWidth * dpr;

  // Available sizes on server
  const sizes = [150, 320, 640, 1080, 2048];

  // Find smallest size that's >= needed width
  const optimalSize = sizes.find(s => s >= neededWidth) || sizes[sizes.length - 1];

  return `https://cdn.instagram.com/photos/${photoId}/s${optimalSize}`;
}

// Usage in component
function Photo({ photoId, width }) {
  const imageUrl = getImageUrl(photoId, width);

  return (
    <FastImage
      source={{ uri: imageUrl }}
      style={{ width, height: width }}
      resizeMode="cover"
    />
  );
}
```

### Web Implementation with srcset

```html
<!-- Server renders optimal srcset -->
<img
  src="https://cdn.instagram.com/photos/abc123/s640.webp"
  srcset="
    https://cdn.instagram.com/photos/abc123/s320.webp 320w,
    https://cdn.instagram.com/photos/abc123/s640.webp 640w,
    https://cdn.instagram.com/photos/abc123/s1080.webp 1080w,
    https://cdn.instagram.com/photos/abc123/s2048.webp 2048w
  "
  sizes="
    (max-width: 600px) 100vw,
    (max-width: 1200px) 50vw,
    640px
  "
  loading="lazy"
  decoding="async"
  alt="User photo"
/>
```

---

## Cache Header Strategy

### Optimal Headers by Content Type

```javascript
// Cache header configuration by content type

const cacheHeaders = {
  // User photos (immutable with versioned URLs)
  'photo_variant': {
    'Cache-Control': 'public, max-age=31536000, immutable',
    // 1 year cache, immutable (URL changes when content changes)
    // CDN caches indefinitely
    // Browser caches indefinitely
  },

  // Profile pictures (can change)
  'profile_picture': {
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    // 24 hours fresh
    // Serve stale up to 7 days while revalidating
    // Balance between freshness and performance
    'ETag': 'W/"abc123"'  // Weak ETag for validation
  },

  // Stories (ephemeral, 24h expiry)
  'story_media': {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=82800',
    // 1 hour fresh
    // Stale for 23 more hours (covers story lifetime)
  },

  // Feed API response (personalized)
  'feed_response': {
    'Cache-Control': 'private, no-store',
    // Never cache (personalized per user)
    // CDN passes through to origin
  }
};

// Express middleware
app.use('/photos/:photoId/:variant', (req, res, next) => {
  res.set(cacheHeaders.photo_variant);
  next();
});
```

### Cache Key Strategy

```javascript
// CDN cache key configuration (Cloudflare example)

const cacheKeyRules = {
  // Include these in cache key
  include: [
    'pathname',        // /photos/abc123/s640
    'accept_header',   // For format selection (AVIF/WebP/JPEG)
  ],

  // Exclude these (prevent cache fragmentation)
  exclude: [
    'query_string',    // Ignore cache busters like ?v=123
    'user_agent',      // Don't vary by UA (use Accept instead)
    'cookies',         // Photos don't need auth for viewing
    'device_type',     // Handle via Accept and URL
  ]
};

// Result: Fewer cache variants, higher hit rate
// Bad:  /photos/abc/s640?user=1&ts=123&ua=Chrome  (millions of variants)
// Good: /photos/abc/s640 + Accept: image/webp     (3 variants per size)
```

---

## CDN Performance Optimization

### Origin Shield Configuration

```javascript
// CloudFront origin shield setup

const cloudFrontDistribution = {
  Origins: [{
    DomainName: 'instagram-photos.s3.us-west-2.amazonaws.com',
    S3OriginConfig: {
      OriginAccessIdentity: 'origin-access-identity/cloudfront/E1234'
    },
    OriginShield: {
      Enabled: true,
      OriginShieldRegion: 'us-west-2'  // Close to S3 bucket
    }
  }],

  // Benefits:
  // - 100 edge PoPs request from 1 shield (not S3 directly)
  // - 95%+ reduction in origin requests
  // - Single cache fill per region, not per PoP
};
```

### Prefetching for Feed

```javascript
// Predictive prefetching in mobile app

class FeedPrefetcher {
  constructor() {
    this.prefetchQueue = [];
    this.prefetching = false;
  }

  // Called when user scrolls
  onScroll(currentIndex, feedItems) {
    // Prefetch next 5 images that aren't in cache
    const prefetchRange = feedItems.slice(currentIndex + 1, currentIndex + 6);

    for (const item of prefetchRange) {
      if (!this.isInCache(item.imageUrl)) {
        this.prefetchQueue.push(item.imageUrl);
      }
    }

    this.processPrefetchQueue();
  }

  async processPrefetchQueue() {
    if (this.prefetching) return;
    this.prefetching = true;

    while (this.prefetchQueue.length > 0) {
      const url = this.prefetchQueue.shift();

      try {
        // Low-priority fetch (doesn't block UI)
        await Image.prefetch(url);
        this.addToCache(url);
      } catch (e) {
        // Ignore prefetch failures
      }

      // Small delay to avoid network congestion
      await sleep(50);
    }

    this.prefetching = false;
  }

  isInCache(url) {
    return this.cache.has(url);
  }
}
```

### Progressive Loading with BlurHash

```javascript
// Feed item component with progressive loading

function FeedImage({ photo }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="feed-image-container">
      {/* BlurHash placeholder (instant) */}
      <canvas
        ref={canvasRef}
        className={`placeholder ${loaded ? 'hidden' : ''}`}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%'
        }}
      />

      {/* Actual image (loads in background) */}
      <img
        src={photo.url}
        srcSet={photo.srcSet}
        sizes={photo.sizes}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        decoding="async"
        className={`actual-image ${loaded ? 'visible' : ''}`}
        alt={photo.caption}
      />
    </div>
  );
}

// CSS transition for smooth reveal
const styles = `
  .placeholder { transition: opacity 0.3s ease; }
  .placeholder.hidden { opacity: 0; }
  .actual-image { opacity: 0; transition: opacity 0.3s ease; }
  .actual-image.visible { opacity: 1; }
`;
```

---

## Hot Content & Celebrity Problem

### The Viral Photo Challenge

```
Scenario: Celebrity posts a photo

Normal photo:
- 1,000 views in first hour
- Easy for CDN to cache and serve

Celebrity photo (100M followers):
- 10,000,000 requests in first minute
- All requesting same URL
- Cold cache = all go to origin
- Origin: 💥 (overwhelmed)

This is called "Cache Stampede" or "Thundering Herd"
```

### Solution: Cache Warming

```javascript
// Pre-warm CDN for high-follower accounts

async function onPhotoPosted(photoId, userId) {
  const followerCount = await getFollowerCount(userId);

  if (followerCount > 1_000_000) {  // Celebrity threshold
    // Immediately warm all edge caches
    await warmCDNCaches(photoId);
  } else if (followerCount > 100_000) {
    // Warm regional caches
    await warmRegionalCaches(photoId);
  }
  // Normal users: on-demand caching
}

async function warmCDNCaches(photoId) {
  const edgeLocations = [
    'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
    'ap-northeast-1', 'ap-southeast-1', 'ap-south-1', 'sa-east-1'
  ];

  const variants = ['s320.webp', 's640.webp', 's1080.webp'];

  // Parallel requests from each edge location
  const warmingRequests = [];

  for (const location of edgeLocations) {
    for (const variant of variants) {
      warmingRequests.push(
        fetch(`https://cdn.instagram.com/photos/${photoId}/${variant}`, {
          headers: {
            'X-Warming-Request': 'true',
            'X-Origin-Region': location
          }
        })
      );
    }
  }

  await Promise.all(warmingRequests);
  console.log(`Warmed ${photoId} across ${edgeLocations.length} regions`);
}
```

### Request Coalescing

```javascript
// Nginx configuration for request coalescing

const nginxConfig = `
# Coalesce identical requests to origin
proxy_cache_lock on;
proxy_cache_lock_age 5s;
proxy_cache_lock_timeout 5s;

# When cache is stale, serve stale while fetching new
proxy_cache_use_stale updating error timeout;

# Background update without blocking request
proxy_cache_background_update on;
`;

// Effect:
// - 1000 simultaneous requests for same uncached image
// - Only 1 request goes to origin
// - Other 999 wait for that request to complete
// - All 1000 served from cache

// Without coalescing:
// - 1000 requests → 1000 origin hits → origin overwhelmed
```

---

## Performance Monitoring

### Key Metrics Dashboard

```javascript
// Metrics to monitor for image serving

const imageServingMetrics = {
  // Latency
  latency: {
    p50: { target: '20ms', alert: '>50ms' },
    p95: { target: '80ms', alert: '>150ms' },
    p99: { target: '150ms', alert: '>300ms' }
  },

  // Cache performance
  cache: {
    edgeHitRate: { target: '>88%', alert: '<80%' },
    shieldHitRate: { target: '>95%', alert: '<90%' },
    originHitRate: { target: '<1%', alert: '>5%' }
  },

  // Error rates
  errors: {
    '4xx': { target: '<0.1%', alert: '>1%' },
    '5xx': { target: '<0.01%', alert: '>0.1%' },
    timeout: { target: '<0.001%', alert: '>0.01%' }
  },

  // Bandwidth efficiency
  efficiency: {
    avifServedPercent: { target: '>40%', alert: '<20%' },
    webpServedPercent: { target: '>50%', alert: '<30%' },
    avgImageSize: { target: '<200KB', alert: '>400KB' }
  }
};

// Grafana alert example
const grafanaAlert = {
  name: 'Image Latency P99 High',
  condition: 'avg(image_latency_p99) > 300',
  for: '5m',
  severity: 'critical',
  annotation: 'Image serving latency P99 exceeded 300ms for 5 minutes'
};
```

---

## Quick Win: Implement Format Selection (20 min)

### Cloudflare Worker

```javascript
// Deploy this as a Cloudflare Worker

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Only process image requests
  if (!url.pathname.startsWith('/images/')) {
    return fetch(request);
  }

  // Check client format support
  const accept = request.headers.get('Accept') || '';
  let format = 'jpg';

  if (accept.includes('image/avif')) {
    format = 'avif';
  } else if (accept.includes('image/webp')) {
    format = 'webp';
  }

  // Rewrite URL to include format
  const originalPath = url.pathname;  // /images/photo123
  const newPath = `${originalPath}.${format}`;

  // Create new request with modified URL
  const newUrl = new URL(request.url);
  newUrl.pathname = newPath;

  const response = await fetch(newUrl.toString(), {
    headers: request.headers
  });

  // Clone response and add headers
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Vary', 'Accept');
  newResponse.headers.set('X-Served-Format', format);

  return newResponse;
}
```

### Nginx Configuration

```nginx
# Nginx format selection based on Accept header

map $http_accept $image_suffix {
    default   ".jpg";
    "~*avif"  ".avif";
    "~*webp"  ".webp";
}

location /images/ {
    # Try format-specific file, fall back to original
    try_files $uri$image_suffix $uri =404;

    # Cache headers
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header Vary "Accept";
}
```

---

## Key Takeaways

**What you learned:**
- Multi-tier CDN (Edge → Shield → Origin) achieves 99%+ cache hit rate
- Format selection via Accept header saves 30-50% bandwidth
- Responsive images with srcset serve right size for each device
- Cache warming prevents thundering herd for viral content

**The latency formula:**
```
User Latency =
  DNS (5ms) +
  TCP/TLS (15ms) +
  Edge Cache Hit (5ms) +
  Transfer (size/bandwidth)

Best case: 25ms + transfer
Worst case: 300ms + transfer (origin hit)
Target: <100ms for 99% of requests
```

**Implementation checklist:**
- [ ] Multi-tier CDN with origin shield
- [ ] Format selection (AVIF → WebP → JPEG)
- [ ] Responsive image URLs with size variants
- [ ] Cache headers (immutable for versioned URLs)
- [ ] BlurHash placeholders for perceived performance
- [ ] Prefetching for feed scroll
- [ ] Cache warming for high-follower accounts
- [ ] Monitoring for latency and cache hit rate

---

## What's Next?

Images are served. But what about video? Instagram Reels process millions of videos daily with even more complexity.

**Next Article:** [Part 3: Video Processing & Transcoding Pipeline](/interview-prep/system-design/instagram-assets-series/03-video-processing-pipeline) — How to handle video uploads, transcoding, and adaptive bitrate packaging at scale.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
