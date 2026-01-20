# Feed Loading & Infinite Scroll - 60 FPS with 1000+ Media Items

> **Reading Time:** 18 minutes
> **Difficulty:** 🟡 Intermediate
> **Prerequisites:** [Image Optimization](/interview-prep/system-design/instagram-assets-series/prereq-image-optimization), [Part 2: Image Serving](/interview-prep/system-design/instagram-assets-series/02-image-serving-at-scale)
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The Janky Scroll That Loses Users

**A user opens their Instagram feed.**

```
Naive implementation:

Feed loads with 50 posts:
- 50 images (avg 300KB each) = 15 MB
- 10 videos (posters only) = 3 MB
- Total initial load: 18 MB

User scrolls:
- Frame 1: Rendering 50 images → 16ms ✅
- Frame 2: Loading 10 more → 45ms ❌ (frame drop)
- Frame 3: Layout recalculation → 32ms ❌
- Frame 4: Garbage collection → 80ms ❌ (visible jank)

User experience: Stuttery, frustrating
User action: Closes app, opens TikTok

What went wrong:
1. Loading too many images at once
2. Rendering off-screen items
3. Synchronous image decoding
4. Memory pressure triggering GC
5. Layout thrashing on scroll
```

Instagram's feed loads **instantly** and scrolls at **60 FPS** even with thousands of posts. Users see content immediately, never experience jank, and can scroll endlessly.

This article shows you how to build a buttery-smooth infinite scroll with media-heavy content.

---

## The Performance Budget

### Understanding 60 FPS

```
Target: 60 frames per second (FPS)
Frame budget: 1000ms / 60 = 16.67ms per frame

If ANY frame takes > 16.67ms:
- Frame is dropped
- User perceives "jank" or stutter

Breakdown of frame budget:
┌─────────────────────────────────────────────────────────────────┐
│                    16.67ms FRAME BUDGET                          │
├────────────┬──────────┬──────────┬──────────┬──────────┬────────┤
│   Input    │  Script  │  Style   │  Layout  │  Paint   │ Render │
│    1ms     │   4ms    │   2ms    │   3ms    │   3ms    │  2ms   │
├────────────┴──────────┴──────────┴──────────┴──────────┴────────┤
│                      = 15ms total                                │
│                      1.67ms buffer for safety                    │
└─────────────────────────────────────────────────────────────────┘

Common frame budget killers:
- Image decode: 10-50ms per large image
- Layout recalc: 5-20ms if many elements
- Garbage collection: 20-100ms (unpredictable)
- Main thread blocking: Any sync operation
```

---

## Core Optimization Techniques

### 1. Virtualization (Windowing)

```javascript
// Only render items visible in viewport (+buffer)

class VirtualizedFeed {
  constructor(container, itemHeight, bufferSize = 5) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.bufferSize = bufferSize;
    this.items = [];
    this.renderedItems = new Map();

    this.setupScrollListener();
  }

  setItems(items) {
    this.items = items;
    this.totalHeight = items.length * this.itemHeight;
    this.container.style.height = `${this.totalHeight}px`;
    this.render();
  }

  setupScrollListener() {
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.render();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  render() {
    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;

    // Calculate visible range with buffer
    const startIndex = Math.max(0,
      Math.floor(scrollTop / this.itemHeight) - this.bufferSize
    );
    const endIndex = Math.min(this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize
    );

    // Remove items no longer in view
    for (const [index, element] of this.renderedItems) {
      if (index < startIndex || index > endIndex) {
        element.remove();
        this.renderedItems.delete(index);
      }
    }

    // Add items now in view
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.renderedItems.has(i)) {
        const element = this.createItemElement(this.items[i], i);
        this.container.appendChild(element);
        this.renderedItems.set(i, element);
      }
    }
  }

  createItemElement(item, index) {
    const element = document.createElement('div');
    element.className = 'feed-item';
    element.style.cssText = `
      position: absolute;
      top: ${index * this.itemHeight}px;
      left: 0;
      right: 0;
      height: ${this.itemHeight}px;
    `;

    // Render item content
    element.innerHTML = this.renderItem(item);
    return element;
  }

  renderItem(item) {
    return `
      <div class="post">
        <img
          src="${item.placeholderUrl}"
          data-src="${item.imageUrl}"
          loading="lazy"
          class="lazy-image"
        />
        <div class="caption">${item.caption}</div>
      </div>
    `;
  }
}

// Result:
// 1000 items in feed, only ~15 rendered at any time
// Memory: 15 DOM nodes instead of 1000
// Performance: Constant O(1) regardless of feed size
```

### 2. React Native FlatList (Optimized)

```javascript
import { FlatList, View, Image, Text } from 'react-native';
import FastImage from 'react-native-fast-image';

function OptimizedFeed({ posts }) {
  const renderPost = useCallback(({ item, index }) => (
    <PostItem post={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: POST_HEIGHT,
    offset: POST_HEIGHT * index,
    index
  }), []);

  return (
    <FlatList
      data={posts}
      renderItem={renderPost}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}  // Skip measurement

      // Virtualization settings
      windowSize={5}                  // Render 5 viewports worth
      initialNumToRender={5}          // Initial items
      maxToRenderPerBatch={3}         // Items per render batch
      updateCellsBatchingPeriod={50}  // Batch updates

      // Performance
      removeClippedSubviews={true}    // Unmount off-screen
      maintainVisibleContentPosition={{
        minIndexForVisible: 0
      }}

      // Memory
      onEndReached={loadMorePosts}
      onEndReachedThreshold={0.5}     // Load more at 50% from bottom
    />
  );
}

const PostItem = React.memo(({ post, index }) => {
  return (
    <View style={styles.post}>
      <FastImage
        source={{
          uri: post.imageUrl,
          priority: FastImage.priority.normal,
          cache: FastImage.cacheControl.immutable
        }}
        style={styles.image}
        resizeMode={FastImage.resizeMode.cover}
      />
      <Text style={styles.caption}>{post.caption}</Text>
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if post ID changes
  return prevProps.post.id === nextProps.post.id;
});
```

### 3. Image Loading Strategy

```javascript
// Progressive image loading with placeholders

class ProgressiveImage {
  constructor(container) {
    this.container = container;
    this.observer = this.createObserver();
    this.imageCache = new Map();
  }

  createObserver() {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
          }
        });
      },
      {
        rootMargin: '200px',  // Start loading 200px before visible
        threshold: 0.01
      }
    );
  }

  setupImage(imgElement, thumbnailUrl, fullUrl, blurhash) {
    // 1. Render blurhash immediately (inline, no network)
    const canvas = this.renderBlurhash(blurhash, 32, 32);
    imgElement.style.backgroundImage = `url(${canvas.toDataURL()})`;
    imgElement.style.backgroundSize = 'cover';

    // 2. Store full URL for lazy loading
    imgElement.dataset.fullUrl = fullUrl;
    imgElement.dataset.thumbnailUrl = thumbnailUrl;

    // 3. Observe for viewport intersection
    this.observer.observe(imgElement);
  }

  async loadImage(imgElement) {
    this.observer.unobserve(imgElement);

    const thumbnailUrl = imgElement.dataset.thumbnailUrl;
    const fullUrl = imgElement.dataset.fullUrl;

    try {
      // Step 1: Load low-quality thumbnail (fast)
      await this.preloadImage(thumbnailUrl);
      imgElement.src = thumbnailUrl;
      imgElement.classList.add('thumbnail-loaded');

      // Step 2: Load full quality in background
      await this.preloadImage(fullUrl);
      imgElement.src = fullUrl;
      imgElement.classList.add('full-loaded');

    } catch (error) {
      console.error('Failed to load image:', error);
      imgElement.classList.add('load-error');
    }
  }

  preloadImage(url) {
    if (this.imageCache.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(url, true);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  renderBlurhash(blurhash, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const pixels = decode(blurhash, width, height);
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }
}
```

---

## Prefetching Strategy

### Predictive Prefetching

```javascript
class FeedPrefetcher {
  constructor(feedData) {
    this.feedData = feedData;
    this.prefetchedUrls = new Set();
    this.prefetchQueue = [];
    this.isPrefetching = false;
    this.scrollVelocity = 0;
    this.lastScrollPosition = 0;
  }

  onScroll(scrollPosition, viewportHeight) {
    // Calculate scroll velocity
    this.scrollVelocity = scrollPosition - this.lastScrollPosition;
    this.lastScrollPosition = scrollPosition;

    // Determine prefetch range based on scroll direction and velocity
    const currentIndex = Math.floor(scrollPosition / this.itemHeight);
    const prefetchCount = this.calculatePrefetchCount();

    let startIndex, endIndex;

    if (this.scrollVelocity > 0) {
      // Scrolling down - prefetch ahead
      startIndex = currentIndex + this.visibleCount;
      endIndex = startIndex + prefetchCount;
    } else if (this.scrollVelocity < 0) {
      // Scrolling up - prefetch behind
      endIndex = currentIndex;
      startIndex = Math.max(0, endIndex - prefetchCount);
    } else {
      // Stationary - prefetch both directions
      startIndex = Math.max(0, currentIndex - 2);
      endIndex = currentIndex + this.visibleCount + 2;
    }

    this.prefetchRange(startIndex, endIndex);
  }

  calculatePrefetchCount() {
    const absVelocity = Math.abs(this.scrollVelocity);

    if (absVelocity > 50) {
      // Fast scroll - prefetch more
      return 10;
    } else if (absVelocity > 20) {
      // Medium scroll
      return 5;
    } else {
      // Slow/stationary
      return 3;
    }
  }

  prefetchRange(startIndex, endIndex) {
    for (let i = startIndex; i < endIndex && i < this.feedData.length; i++) {
      const item = this.feedData[i];

      if (!this.prefetchedUrls.has(item.imageUrl)) {
        this.prefetchQueue.push({
          url: item.imageUrl,
          priority: this.calculatePriority(i, startIndex, endIndex)
        });
      }
    }

    // Sort by priority and process
    this.prefetchQueue.sort((a, b) => b.priority - a.priority);
    this.processPrefetchQueue();
  }

  calculatePriority(index, startIndex, endIndex) {
    // Items closer to current viewport get higher priority
    const distanceFromCenter = Math.abs(index - (startIndex + endIndex) / 2);
    return 100 - distanceFromCenter;
  }

  async processPrefetchQueue() {
    if (this.isPrefetching) return;
    this.isPrefetching = true;

    while (this.prefetchQueue.length > 0) {
      const { url } = this.prefetchQueue.shift();

      if (this.prefetchedUrls.has(url)) continue;

      try {
        // Use low-priority fetch
        await this.prefetchImage(url);
        this.prefetchedUrls.add(url);
      } catch (error) {
        // Ignore prefetch failures
      }

      // Small delay to not overwhelm network
      await this.delay(50);
    }

    this.isPrefetching = false;
  }

  prefetchImage(url) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'image';
      link.href = url;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Memory Management

### Image Cache with LRU Eviction

```javascript
class ImageMemoryCache {
  constructor(maxSizeMB = 100) {
    this.maxSize = maxSizeMB * 1024 * 1024;  // Convert to bytes
    this.currentSize = 0;
    this.cache = new Map();  // url -> { data, size, lastAccess }
  }

  get(url) {
    const entry = this.cache.get(url);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.data;
    }
    return null;
  }

  set(url, imageData, sizeBytes) {
    // Evict if needed
    while (this.currentSize + sizeBytes > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    // Don't cache if single item is too large
    if (sizeBytes > this.maxSize * 0.25) {
      return;
    }

    this.cache.set(url, {
      data: imageData,
      size: sizeBytes,
      lastAccess: Date.now()
    });
    this.currentSize += sizeBytes;
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache) {
      if (value.lastAccess < oldestTime) {
        oldestTime = value.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.currentSize -= entry.size;
      this.cache.delete(oldestKey);
    }
  }

  // Proactive cleanup when app goes to background
  onAppBackground() {
    // Keep only 25% of cache
    const targetSize = this.maxSize * 0.25;
    while (this.currentSize > targetSize && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  // Complete clear on memory warning
  onMemoryWarning() {
    this.cache.clear();
    this.currentSize = 0;
  }
}
```

### React Native Memory Optimization

```javascript
import { AppState, InteractionManager } from 'react-native';
import FastImage from 'react-native-fast-image';

class FeedMemoryManager {
  constructor() {
    this.setupAppStateListener();
    this.setupMemoryWarningListener();
  }

  setupAppStateListener() {
    AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        // Clear image cache when app goes to background
        this.clearImageCache();
      }
    });
  }

  setupMemoryWarningListener() {
    // iOS memory warning
    if (Platform.OS === 'ios') {
      NativeEventEmitter.addListener('memoryWarning', () => {
        this.handleMemoryWarning();
      });
    }
  }

  clearImageCache() {
    // Clear FastImage cache
    FastImage.clearMemoryCache();

    // Also trigger garbage collection if available
    if (global.gc) {
      InteractionManager.runAfterInteractions(() => {
        global.gc();
      });
    }
  }

  handleMemoryWarning() {
    // Aggressive cleanup
    FastImage.clearMemoryCache();
    FastImage.clearDiskCache();

    // Force unmount non-visible items
    this.eventEmitter.emit('forceUnmount');
  }
}

// In FlatList usage
function OptimizedFeed() {
  const [mountedRange, setMountedRange] = useState({ start: 0, end: 20 });

  useEffect(() => {
    const subscription = memoryManager.eventEmitter.addListener(
      'forceUnmount',
      () => {
        // Reduce mounted items to minimum
        setMountedRange({ start: currentIndex - 2, end: currentIndex + 2 });
      }
    );

    return () => subscription.remove();
  }, [currentIndex]);

  return (
    <FlatList
      // ... other props
      removeClippedSubviews={true}
      windowSize={3}  // Aggressive during memory pressure
    />
  );
}
```

---

## API Response Optimization

### Feed API Response Structure

```javascript
// Optimized API response for feed

const feedResponse = {
  posts: [
    {
      id: "abc123",
      type: "image",
      user: {
        id: "user1",
        username: "johndoe",
        avatarUrl: "https://cdn.instagram.com/avatars/user1_s.jpg"
      },

      // Image variants (client picks based on viewport)
      media: {
        blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",  // Inline, no network
        thumbnail: "https://cdn.instagram.com/p/abc123/s150.webp",
        small: "https://cdn.instagram.com/p/abc123/s320.webp",
        medium: "https://cdn.instagram.com/p/abc123/s640.webp",
        large: "https://cdn.instagram.com/p/abc123/s1080.webp",
        aspectRatio: 1.0  // Pre-calculated for layout
      },

      // Minimal metadata (more loaded on demand)
      likes: 1234,
      commentsCount: 56,
      caption: "Great day!",  // Truncated in feed
      timestamp: 1642000000000
    }
  ],

  // Pagination
  cursor: "eyJvZmZzZXQiOjIwfQ==",
  hasMore: true,

  // Prefetch hints
  prefetch: [
    "https://cdn.instagram.com/p/def456/s640.webp",
    "https://cdn.instagram.com/p/ghi789/s640.webp"
  ]
};

// Response size comparison:
// Naive (all data): 50 KB per page
// Optimized: 8 KB per page (84% smaller)
```

### Cursor-Based Pagination

```javascript
// Server-side: Generate cursor
function generateCursor(lastPost, sortField) {
  const cursor = {
    id: lastPost.id,
    [sortField]: lastPost[sortField],
    timestamp: Date.now()
  };

  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

// Server-side: Parse and query
async function getFeedPage(userId, cursor, limit = 20) {
  let query = db('posts')
    .select('*')
    .where('user_id', 'in', getFollowingIds(userId))
    .orderBy('created_at', 'desc')
    .limit(limit);

  if (cursor) {
    const { id, created_at } = JSON.parse(
      Buffer.from(cursor, 'base64').toString()
    );

    // Keyset pagination (fast, consistent)
    query = query.where(function() {
      this.where('created_at', '<', created_at)
        .orWhere(function() {
          this.where('created_at', '=', created_at)
            .andWhere('id', '<', id);
        });
    });
  }

  const posts = await query;
  const newCursor = posts.length === limit
    ? generateCursor(posts[posts.length - 1], 'created_at')
    : null;

  return { posts, cursor: newCursor, hasMore: !!newCursor };
}
```

---

## Scroll Performance Optimizations

### Scroll Event Throttling

```javascript
class ScrollOptimizer {
  constructor(callback, options = {}) {
    this.callback = callback;
    this.throttleMs = options.throttleMs || 16;  // ~60fps
    this.useRAF = options.useRAF !== false;

    this.lastScrollTime = 0;
    this.rafId = null;
    this.isScrolling = false;

    this.setupListener();
  }

  setupListener() {
    window.addEventListener('scroll', this.handleScroll.bind(this), {
      passive: true  // Important for performance!
    });
  }

  handleScroll(event) {
    if (this.useRAF) {
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.callback(window.scrollY);
          this.rafId = null;
        });
      }
    } else {
      const now = Date.now();
      if (now - this.lastScrollTime >= this.throttleMs) {
        this.lastScrollTime = now;
        this.callback(window.scrollY);
      }
    }
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('scroll', this.handleScroll);
  }
}
```

### CSS Optimizations

```css
/* Feed container optimizations */
.feed-container {
  /* Create new stacking context */
  isolation: isolate;

  /* Enable GPU compositing */
  will-change: transform;
  transform: translateZ(0);

  /* Prevent layout thrashing */
  contain: layout style;
}

.feed-item {
  /* Fixed dimensions for performance */
  height: var(--item-height);
  width: 100%;

  /* GPU layer */
  transform: translateZ(0);

  /* Content containment */
  contain: content;

  /* Prevent paint on scroll */
  content-visibility: auto;
  contain-intrinsic-size: 0 var(--item-height);
}

.feed-image {
  /* Prevent layout shifts */
  aspect-ratio: var(--aspect-ratio);
  width: 100%;
  height: auto;

  /* Smooth loading transition */
  opacity: 0;
  transition: opacity 0.2s ease-out;
}

.feed-image.loaded {
  opacity: 1;
}

/* Reduce paint areas */
.feed-item:not(.visible) {
  content-visibility: hidden;
}
```

---

## Performance Metrics

### Key Metrics to Track

```javascript
const feedMetrics = {
  // Initial load
  timeToFirstPost: {
    target: '<500ms',
    p50: '320ms',
    p95: '650ms'
  },

  timeToInteractive: {
    target: '<1s',
    p50: '720ms',
    p95: '1.2s'
  },

  // Scroll performance
  framesPerSecond: {
    target: '>55fps',
    average: '58fps',
    droppedFrameRatio: '2%'
  },

  // Memory
  peakMemoryUsage: {
    target: '<150MB',
    typical: '95MB'
  },

  // Network
  dataPerScroll: {
    target: '<500KB per 10 items',
    actual: '380KB'
  }
};

// Measure frame rate
class FrameRateMonitor {
  constructor() {
    this.frames = [];
    this.isMonitoring = false;
  }

  start() {
    this.isMonitoring = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.loop();
  }

  loop() {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      const fps = (this.frameCount * 1000) / delta;
      this.frames.push(fps);
      this.frameCount = 0;
      this.lastTime = now;
    }

    this.frameCount++;
    requestAnimationFrame(() => this.loop());
  }

  stop() {
    this.isMonitoring = false;
    return {
      average: this.frames.reduce((a, b) => a + b, 0) / this.frames.length,
      min: Math.min(...this.frames),
      max: Math.max(...this.frames),
      samples: this.frames
    };
  }
}
```

---

## Quick Win: Implement Virtualized List (20 min)

```javascript
// Simple virtualized list implementation

class SimpleVirtualList {
  constructor(container, items, itemHeight, renderFn) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.renderFn = renderFn;

    this.setup();
  }

  setup() {
    // Set container height
    this.container.style.height = `${this.items.length * this.itemHeight}px`;
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';

    // Initial render
    this.render();

    // Scroll listener with RAF
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.render();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  render() {
    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;

    const startIndex = Math.floor(scrollTop / this.itemHeight) - 3;
    const endIndex = Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + 3;

    // Clear and re-render (simple approach)
    this.container.innerHTML = '';

    for (let i = Math.max(0, startIndex); i < Math.min(this.items.length, endIndex); i++) {
      const item = this.items[i];
      const element = document.createElement('div');

      element.style.cssText = `
        position: absolute;
        top: ${i * this.itemHeight}px;
        left: 0;
        right: 0;
        height: ${this.itemHeight}px;
      `;

      element.innerHTML = this.renderFn(item, i);
      this.container.appendChild(element);
    }
  }
}

// Usage
const feed = new SimpleVirtualList(
  document.getElementById('feed'),
  posts,
  400,  // 400px per item
  (post, index) => `
    <div class="post">
      <img src="${post.imageUrl}" loading="lazy" />
      <p>${post.caption}</p>
    </div>
  `
);
```

---

## Key Takeaways

**What you learned:**
- Virtualization renders only visible items (O(1) vs O(n))
- Predictive prefetching based on scroll velocity
- Memory management with LRU eviction prevents crashes
- Frame budget is 16.67ms - optimize everything

**The performance formula:**
```
Smooth scroll = Virtualization + Lazy loading + Memory limits + GPU compositing
```

**Implementation checklist:**
- [ ] Virtualized list (FlatList, react-window, etc.)
- [ ] Lazy image loading with IntersectionObserver
- [ ] BlurHash placeholders (inline, no network)
- [ ] Predictive prefetching based on scroll direction
- [ ] Memory cache with LRU eviction
- [ ] Passive scroll listeners with RAF
- [ ] CSS containment and GPU layers

---

## What's Next?

The feed scrolls smoothly. But Stories and Reels have unique challenges: ephemeral content, fullscreen video, and swipe navigation.

**Next Article:** [Part 6: Stories & Reels Architecture](/interview-prep/system-design/instagram-assets-series/06-stories-reels-architecture) — Ephemeral content, ring buffer preloading, and fullscreen video optimization.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
