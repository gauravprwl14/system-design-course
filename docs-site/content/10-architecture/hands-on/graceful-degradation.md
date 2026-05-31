---
title: Graceful Degradation Patterns
layer: poc
section: interview-prep/practice-pocs
difficulty: intermediate
prerequisites:
  - system-design/patterns/circuit-breaker
  - system-design/scalability/high-availability
solves_with: []
related_problems:
  - problems-at-scale/availability/cascading-failures
  - problems-at-scale/availability/circuit-breaker-failure
case_studies: []
see_poc: []
linked_from: []
tags:
  - resilience
  - graceful-degradation
  - fallback
  - availability
  - user-experience
---

# POC #78: Graceful Degradation

> **Difficulty:** 🟡 Intermediate
> **Time:** 20 minutes
> **Prerequisites:** Node.js, Circuit breaker concepts

## 🗺️ Quick Overview

```mermaid
graph TD
    Load["System Load Monitor"] -->|"load < 50%"| Full["Full Mode\nall features enabled"]
    Load -->|"50-70%"| Partial["Partial Mode\nreviews + recs disabled"]
    Load -->|"70-90%"| Reduced["Reduced Mode\npersonalization disabled"]
    Load -->|"90%+"| Minimal["Minimal Mode\nstatic prices + cached data only"]
    Full -->|"service error"| Fallback["Try cached / default value"]
    Partial --> Fallback
    Reduced --> Fallback
    Minimal --> Fallback
```

*Drop non-critical features under load in priority order so the core user journey always works.*

## What You'll Learn

Graceful degradation keeps your system functional when dependencies fail, by falling back to cached data, default values, or reduced functionality.

```
GRACEFUL DEGRADATION:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Full Functionality          Degraded Mode         Minimal Mode │
│  ──────────────────          ─────────────         ──────────── │
│                                                                 │
│  Recommendations: ✅         Recommendations: ❌   Static page   │
│  Personalization: ✅         Personalization: ❌   Basic checkout│
│  Real-time prices: ✅        Cached prices: ✅     Fixed prices  │
│  Live inventory: ✅          Cached inventory: ✅  "In stock"    │
│                                                                 │
│  100% features              70% features           30% features │
│  All services up            Some services down     Major outage │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// graceful-degradation.js

// ==========================================
// FEATURE FLAGS FOR DEGRADATION
// ==========================================

class FeatureFlags {
  constructor() {
    this.flags = new Map([
      ['recommendations', { enabled: true, fallback: 'popular' }],
      ['personalization', { enabled: true, fallback: 'generic' }],
      ['realtime-inventory', { enabled: true, fallback: 'cached' }],
      ['dynamic-pricing', { enabled: true, fallback: 'base-price' }],
      ['reviews', { enabled: true, fallback: 'none' }]
    ]);
  }

  isEnabled(feature) {
    return this.flags.get(feature)?.enabled ?? false;
  }

  disable(feature) {
    const flag = this.flags.get(feature);
    if (flag) {
      flag.enabled = false;
      console.log(`🔴 DISABLED: ${feature} (fallback: ${flag.fallback})`);
    }
  }

  enable(feature) {
    const flag = this.flags.get(feature);
    if (flag) {
      flag.enabled = true;
      console.log(`🟢 ENABLED: ${feature}`);
    }
  }

  getFallback(feature) {
    return this.flags.get(feature)?.fallback;
  }
}

// ==========================================
// DEGRADABLE SERVICE
// ==========================================

class ProductService {
  constructor(featureFlags) {
    this.flags = featureFlags;
    this.cache = new Map();
    this.baseProducts = [
      { id: 1, name: 'Laptop', basePrice: 999 },
      { id: 2, name: 'Phone', basePrice: 599 },
      { id: 3, name: 'Tablet', basePrice: 399 }
    ];
  }

  async getProduct(productId) {
    const base = this.baseProducts.find(p => p.id === productId);
    if (!base) return null;

    const product = { ...base };

    // Dynamic pricing (degradable)
    if (this.flags.isEnabled('dynamic-pricing')) {
      try {
        product.price = await this.getDynamicPrice(productId);
      } catch (e) {
        console.log(`⚠️ Dynamic pricing failed, using base price`);
        product.price = base.basePrice;
        product.priceSource = 'fallback';
      }
    } else {
      product.price = base.basePrice;
      product.priceSource = 'base';
    }

    // Real-time inventory (degradable)
    if (this.flags.isEnabled('realtime-inventory')) {
      try {
        product.inventory = await this.getRealtimeInventory(productId);
      } catch (e) {
        console.log(`⚠️ Inventory service failed, using cached`);
        product.inventory = this.cache.get(`inventory:${productId}`) || { available: true, count: 'unknown' };
        product.inventorySource = 'cached';
      }
    } else {
      product.inventory = { available: true, count: 'unknown' };
      product.inventorySource = 'degraded';
    }

    // Reviews (degradable, non-critical)
    if (this.flags.isEnabled('reviews')) {
      try {
        product.reviews = await this.getReviews(productId);
      } catch (e) {
        product.reviews = [];
        product.reviewsSource = 'unavailable';
      }
    } else {
      product.reviews = [];
      product.reviewsSource = 'disabled';
    }

    return product;
  }

  // Simulated external services
  async getDynamicPrice(productId) {
    // Simulate occasional failure
    if (Math.random() < 0.3) throw new Error('Pricing service unavailable');
    await new Promise(r => setTimeout(r, 100));
    return this.baseProducts.find(p => p.id === productId).basePrice * (1 + Math.random() * 0.1);
  }

  async getRealtimeInventory(productId) {
    if (Math.random() < 0.2) throw new Error('Inventory service unavailable');
    await new Promise(r => setTimeout(r, 50));
    const count = Math.floor(Math.random() * 100);
    const result = { available: count > 0, count };
    this.cache.set(`inventory:${productId}`, result);  // Cache for fallback
    return result;
  }

  async getReviews(productId) {
    if (Math.random() < 0.4) throw new Error('Reviews service unavailable');
    await new Promise(r => setTimeout(r, 200));
    return [{ rating: 5, text: 'Great product!' }];
  }
}

// ==========================================
// RECOMMENDATION SERVICE (DEGRADABLE)
// ==========================================

class RecommendationService {
  constructor(featureFlags) {
    this.flags = featureFlags;
    this.popularProducts = [1, 2, 3];  // Fallback: popular items
  }

  async getRecommendations(userId) {
    if (!this.flags.isEnabled('recommendations')) {
      return {
        items: this.popularProducts,
        source: 'popular-fallback',
        personalized: false
      };
    }

    if (!this.flags.isEnabled('personalization')) {
      return {
        items: this.popularProducts,
        source: 'popular-no-personalization',
        personalized: false
      };
    }

    try {
      // Try personalized recommendations
      const personalized = await this.getPersonalizedRecs(userId);
      return {
        items: personalized,
        source: 'ml-model',
        personalized: true
      };
    } catch (e) {
      console.log(`⚠️ Personalization failed, using popular items`);
      return {
        items: this.popularProducts,
        source: 'popular-fallback',
        personalized: false
      };
    }
  }

  async getPersonalizedRecs(userId) {
    if (Math.random() < 0.3) throw new Error('ML service unavailable');
    await new Promise(r => setTimeout(r, 300));
    return [2, 3, 1];  // Simulated personalized order
  }
}

// ==========================================
// LOAD SHEDDING
// ==========================================

class LoadShedder {
  constructor(featureFlags, thresholds) {
    this.flags = featureFlags;
    this.thresholds = thresholds || {
      'reviews': 0.5,           // Disable at 50% load
      'recommendations': 0.6,   // Disable at 60% load
      'personalization': 0.7,   // Disable at 70% load
      'dynamic-pricing': 0.8,   // Disable at 80% load
      'realtime-inventory': 0.9 // Disable at 90% load
    };
  }

  adjustForLoad(loadPercent) {
    console.log(`\n📊 Current load: ${(loadPercent * 100).toFixed(0)}%`);

    for (const [feature, threshold] of Object.entries(this.thresholds)) {
      if (loadPercent >= threshold) {
        if (this.flags.isEnabled(feature)) {
          this.flags.disable(feature);
        }
      } else {
        if (!this.flags.isEnabled(feature)) {
          this.flags.enable(feature);
        }
      }
    }
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('GRACEFUL DEGRADATION');
  console.log('='.repeat(60));

  const flags = new FeatureFlags();
  const productService = new ProductService(flags);
  const recService = new RecommendationService(flags);
  const loadShedder = new LoadShedder(flags);

  // Scenario 1: Normal operation
  console.log('\n--- Scenario 1: Normal Load (30%) ---');
  loadShedder.adjustForLoad(0.3);

  let product = await productService.getProduct(1);
  console.log('Product:', JSON.stringify(product, null, 2));

  let recs = await recService.getRecommendations('user-123');
  console.log('Recommendations:', recs);

  // Scenario 2: High load
  console.log('\n--- Scenario 2: High Load (75%) ---');
  loadShedder.adjustForLoad(0.75);

  product = await productService.getProduct(1);
  console.log('Product:', JSON.stringify(product, null, 2));

  recs = await recService.getRecommendations('user-123');
  console.log('Recommendations:', recs);

  // Scenario 3: Critical load
  console.log('\n--- Scenario 3: Critical Load (95%) ---');
  loadShedder.adjustForLoad(0.95);

  product = await productService.getProduct(1);
  console.log('Product:', JSON.stringify(product, null, 2));

  recs = await recService.getRecommendations('user-123');
  console.log('Recommendations:', recs);

  // Scenario 4: Recovery
  console.log('\n--- Scenario 4: Recovery (40%) ---');
  loadShedder.adjustForLoad(0.4);

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Degradation Tiers

| Load Level | Disabled Features | User Experience |
|------------|-------------------|-----------------|
| 0-50% | None | Full experience |
| 50-60% | Reviews | Minor reduction |
| 60-70% | Recommendations | Less discovery |
| 70-80% | Personalization | Generic content |
| 80-90% | Dynamic pricing | Fixed prices |
| 90%+ | Real-time inventory | Cached data |

---

## Netflix's Approach

```
NETFLIX DEGRADATION LEVELS:

Level 0 (Normal):
├── 4K streaming
├── Personalized recommendations
├── Real-time "Continue Watching"
└── Social features

Level 1 (Elevated):
├── HD streaming (no 4K)
├── Cached recommendations
├── Delayed "Continue Watching"
└── Social features disabled

Level 2 (Critical):
├── SD streaming only
├── Popular content only
├── Basic playback only
└── Minimal metadata
```

---

## ⚡ Quick Reference Implementation

```javascript
// Minimal graceful degradation wrapper — copy-paste template
async function withFallback(primaryFn, fallbackFn, { timeout = 2000 } = {}) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  );
  try {
    return await Promise.race([primaryFn(), timeoutPromise]);
  } catch (err) {
    console.warn(`Primary failed (${err.message}), using fallback`);
    return fallbackFn();  // Always sync — never let fallback fail
  }
}

// Usage
const price = await withFallback(
  () => pricingService.getDynamic(productId),   // Real-time
  () => product.basePrice,                       // Static fallback
  { timeout: 500 }
);
```

---

## 🎯 Interview Questions

### Implementation-Focused Interview Questions

#### Q1: How do you implement a fallback cache when the primary data source is down?

**What interviewers look for**: Stale-while-revalidate pattern, cache seeding strategy, and the tradeoffs of serving stale data.

**Answer framework**:
1. Cache every successful response before returning it: `cache.set(key, result)` as a side effect of normal reads
2. On primary failure, read from the cache: `cachedValue = cache.get(key)` — may be stale but better than nothing
3. Tag cached values with a source marker so the UI can show "prices may be delayed"
4. Set appropriate TTL based on how stale is acceptable: product prices can be 5 minutes old; account balances probably cannot

**Code snippet that impresses**:
```javascript
async function getProductWithFallback(productId, cache) {
  try {
    const product = await productService.get(productId);
    // Write-through: populate cache on every successful read
    await cache.set(`product:${productId}`, product, { ttl: 300 });
    return { ...product, dataSource: 'live' };
  } catch (err) {
    const cached = await cache.get(`product:${productId}`);
    if (cached) return { ...cached, dataSource: 'cached', stalePossible: true };
    return { id: productId, name: 'Unknown', price: null, dataSource: 'unavailable' };
  }
}
```

---

#### Q2: What is the difference between graceful degradation and a circuit breaker? When would you use each?

**What interviewers look for**: Conceptual precision — these are related but serve different purposes.

**Answer framework**:
1. **Circuit breaker**: a binary switch on a single downstream dependency — CLOSED (normal), OPEN (stop calling), HALF_OPEN (test recovery). Protects the system from cascading failures.
2. **Graceful degradation**: a multi-tier strategy for the overall service feature set — the system continues operating at reduced functionality as load increases or dependencies fail
3. They complement each other: the circuit breaker detects that a dependency is unhealthy; graceful degradation defines what to serve instead
4. Circuit breaker = infrastructure concern; graceful degradation = product/UX concern

---

#### Q3: How do you decide which features to disable first under high load? Describe a priority framework.

**What interviewers look for**: Structured thinking about feature criticality and business impact.

**Answer framework**:
1. **Tier 1 (never disable)**: core user journey — checkout, login, order status, payment
2. **Tier 2 (disable under high load)**: enrichment features — recommendations, real-time search suggestions, social proof ("10 people viewing this")
3. **Tier 3 (disable early)**: luxury features — reviews, personalization, A/B test variants, analytics events
4. Order of disable: Tier 3 first (most users won't notice), then Tier 2, Tier 1 is the last resort
5. Encode this priority ordering in your `LoadShedder` thresholds table — don't decide during an incident

---

#### Q4: How do you implement a "static mode" fallback for a completely unavailable backend?

**What interviewers look for**: CDN edge fallback, pre-rendered pages, and the architecture of resilient front-ends.

**Answer framework**:
1. Pre-render a minimal static version of key pages at deploy time (Next.js static generation, or a weekly snapshot job)
2. Store static pages in S3 or a CDN
3. Configure CDN edge rules: if origin returns 5xx, serve the pre-rendered fallback HTML
4. Static mode shows last-known prices/inventory with a banner "Experiencing issues — data may be delayed"

**Code snippet that impresses**:
```javascript
// CDN origin shield fallback configuration (Cloudflare Workers example)
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const response = await fetch(request);  // Try origin
  if (response.status >= 500) {
    const staticFallback = await STATIC_PAGES.get(request.url);
    if (staticFallback) {
      return new Response(staticFallback, {
        headers: { 'X-Served-By': 'static-fallback', 'Cache-Control': 'no-store' }
      });
    }
  }
  return response;
}
```

---

#### Q5: How do you test that your degradation tiers actually work? What would a degradation drill look like?

**What interviewers look for**: Operational testing discipline and chaos engineering mindset.

**Answer framework**:
1. **Unit test**: call `loadShedder.adjustForLoad(0.75)` and assert specific flags are disabled
2. **Integration test**: mock the underlying services to throw errors, assert the API returns degraded data with appropriate markers
3. **Chaos drill** (staging): artificially raise the load metric (or kill a dependency), verify the system degrades gracefully without user-visible errors
4. **Runbook**: document what each degradation tier looks like from a user perspective so on-call engineers can verify quickly

---

## Related POCs

- [Circuit Breaker](/10-architecture/hands-on/circuit-breaker)
- [Timeout Configuration](/10-architecture/hands-on/timeout-configuration)
- [Backpressure](/04-messaging/hands-on/backpressure-queues)

## Further Reading

**Concept articles:**
- [Circuit Breaker Concept](/10-architecture/concepts/circuit-breaker)
- [Bulkhead Pattern](/10-architecture/concepts/bulkhead-pattern)

**Interview prep:**
- [High Concurrency API Design](/12-interview-prep/system-design/fundamentals/high-concurrency-api)

**Failure modes:**
- [Cascading Failures](/10-architecture/failures/cascading-failures)
- [Circuit Breaker Failure](/10-architecture/failures/circuit-breaker-failure)
