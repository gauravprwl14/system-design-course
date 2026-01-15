# POC #65: HTTP Caching Headers (ETags, Cache-Control)

> **Difficulty:** 🟢 Beginner
> **Time:** 20 minutes
> **Prerequisites:** HTTP basics, Node.js/Express

## What You'll Learn

Browser and CDN caching using HTTP headers:

```
HTTP CACHING FLOW:
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   Browser                     CDN                  Server  │
│      │                         │                      │    │
│      │ ── GET /api/data ─────▶│ ── GET /api/data ───▶│    │
│      │                         │◀─── 200 + ETag ─────│    │
│      │◀──── 200 + ETag ────────│                      │    │
│      │   (stored in cache)     │   (stored in CDN)   │    │
│      │                         │                      │    │
│      │ ── GET /api/data ─────▶│                      │    │
│      │   If-None-Match: etag   │                      │    │
│      │◀──── 304 Not Modified ──│                      │    │
│      │   (use cached version)  │                      │    │
│                                                            │
└────────────────────────────────────────────────────────────┘

CACHE-CONTROL DIRECTIVES:
┌────────────────────────────────────────────────────────────┐
│ max-age=3600     │ Cache for 1 hour                        │
│ s-maxage=86400   │ CDN can cache for 24 hours              │
│ no-cache         │ Always revalidate with server           │
│ no-store         │ Never cache (sensitive data)            │
│ private          │ Only browser can cache (not CDN)        │
│ public           │ Anyone can cache (CDN, proxies)         │
│ must-revalidate  │ Must check server when stale            │
│ immutable        │ Never changes (versioned assets)        │
└────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// http-caching.js
const express = require('express');
const crypto = require('crypto');

const app = express();

// Simulated database
const products = {
  1: { id: 1, name: 'Laptop', price: 999.99, updatedAt: Date.now() },
  2: { id: 2, name: 'Phone', price: 599.99, updatedAt: Date.now() },
  3: { id: 3, name: 'Tablet', price: 399.99, updatedAt: Date.now() }
};

// ==========================================
// HELPER: Generate ETag
// ==========================================

function generateETag(data) {
  const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  return `"${hash}"`;
}

// ==========================================
// PATTERN 1: Strong Caching (Immutable Assets)
// ==========================================

// For versioned static assets (JS, CSS with hash in filename)
app.get('/assets/:version/:file', (req, res) => {
  const { version, file } = req.params;

  console.log(`📦 Asset request: ${file} v${version}`);

  // Immutable - cache forever (1 year)
  res.set({
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': generateETag({ version, file }),
    'Last-Modified': new Date('2024-01-01').toUTCString()
  });

  res.json({
    file,
    version,
    content: `// ${file} content here`
  });
});

// ==========================================
// PATTERN 2: Revalidation (ETag)
// ==========================================

// For dynamic content that changes occasionally
app.get('/api/products/:id', (req, res) => {
  const product = products[req.params.id];

  if (!product) {
    return res.status(404).json({ error: 'Not found' });
  }

  const etag = generateETag(product);
  const clientETag = req.headers['if-none-match'];

  console.log(`🔍 Product ${req.params.id} request`);
  console.log(`   Server ETag: ${etag}`);
  console.log(`   Client ETag: ${clientETag || 'none'}`);

  // Check if client has current version
  if (clientETag === etag) {
    console.log(`   ✅ 304 Not Modified (client cache valid)`);
    return res.status(304).end();
  }

  console.log(`   📤 200 OK (sending full response)`);

  res.set({
    'Cache-Control': 'private, no-cache', // Always revalidate
    'ETag': etag,
    'Last-Modified': new Date(product.updatedAt).toUTCString()
  });

  res.json(product);
});

// ==========================================
// PATTERN 3: Time-Based + Revalidation
// ==========================================

// For content that's safe to be stale briefly
app.get('/api/products', (req, res) => {
  const productList = Object.values(products);
  const etag = generateETag(productList);
  const clientETag = req.headers['if-none-match'];

  console.log(`📋 Product list request`);

  if (clientETag === etag) {
    console.log(`   ✅ 304 Not Modified`);
    return res.status(304).end();
  }

  // Cache for 5 minutes, but can serve stale for 1 minute while revalidating
  res.set({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    'ETag': etag,
    'Vary': 'Accept-Encoding' // Different cache for gzip vs plain
  });

  console.log(`   📤 200 OK with 5-minute cache`);
  res.json(productList);
});

// ==========================================
// PATTERN 4: No Caching (Sensitive Data)
// ==========================================

// For user-specific or sensitive data
app.get('/api/user/profile', (req, res) => {
  console.log(`🔒 User profile request (no caching)`);

  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache', // HTTP/1.0 compatibility
    'Expires': '0'
  });

  res.json({
    userId: 'user-123',
    email: 'user@example.com',
    balance: 1000.00
  });
});

// ==========================================
// PATTERN 5: CDN-Optimized Caching
// ==========================================

// Different TTL for browser vs CDN
app.get('/api/trending', (req, res) => {
  console.log(`📈 Trending request (CDN-optimized)`);

  res.set({
    // Browser: 1 minute, CDN: 5 minutes
    'Cache-Control': 'public, max-age=60, s-maxage=300',
    'Surrogate-Control': 'max-age=300', // For Fastly/Varnish
    'CDN-Cache-Control': 'max-age=300', // For Cloudflare
    'ETag': generateETag({ timestamp: Math.floor(Date.now() / 60000) }) // Changes every minute
  });

  res.json({
    trending: ['Laptop', 'Phone', 'Tablet'],
    generatedAt: new Date().toISOString()
  });
});

// ==========================================
// PATTERN 6: Conditional GET with Last-Modified
// ==========================================

app.get('/api/articles/:id', (req, res) => {
  const article = {
    id: req.params.id,
    title: 'Sample Article',
    content: 'Article content here...',
    updatedAt: new Date('2024-01-15T10:00:00Z')
  };

  const lastModified = article.updatedAt;
  const ifModifiedSince = req.headers['if-modified-since'];

  console.log(`📰 Article ${req.params.id} request`);
  console.log(`   Last-Modified: ${lastModified.toUTCString()}`);
  console.log(`   If-Modified-Since: ${ifModifiedSince || 'none'}`);

  if (ifModifiedSince) {
    const clientDate = new Date(ifModifiedSince);
    if (clientDate >= lastModified) {
      console.log(`   ✅ 304 Not Modified (based on date)`);
      return res.status(304).end();
    }
  }

  res.set({
    'Cache-Control': 'public, max-age=3600',
    'Last-Modified': lastModified.toUTCString(),
    'ETag': generateETag(article)
  });

  console.log(`   📤 200 OK`);
  res.json(article);
});

// ==========================================
// UPDATE ENDPOINT (Invalidates Cache)
// ==========================================

app.put('/api/products/:id', express.json(), (req, res) => {
  const product = products[req.params.id];

  if (!product) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Update product
  Object.assign(product, req.body, { updatedAt: Date.now() });

  console.log(`✏️ Product ${req.params.id} updated - clients must revalidate`);

  // Response with new ETag (forces cache refresh on next request)
  res.set({
    'Cache-Control': 'no-cache',
    'ETag': generateETag(product)
  });

  res.json(product);
});

// ==========================================
// DEMONSTRATION ENDPOINT
// ==========================================

app.get('/', (req, res) => {
  res.send(`
    <h1>HTTP Caching Demo</h1>
    <h2>Try these endpoints:</h2>
    <ul>
      <li><a href="/assets/v1.2.3/app.js">/assets/v1.2.3/app.js</a> - Immutable (1 year cache)</li>
      <li><a href="/api/products/1">/api/products/1</a> - ETag revalidation</li>
      <li><a href="/api/products">/api/products</a> - 5-minute cache + revalidation</li>
      <li><a href="/api/user/profile">/api/user/profile</a> - No caching</li>
      <li><a href="/api/trending">/api/trending</a> - CDN-optimized</li>
      <li><a href="/api/articles/1">/api/articles/1</a> - Last-Modified based</li>
    </ul>
    <h2>Test with curl:</h2>
    <pre>
# First request - get full response
curl -v http://localhost:3000/api/products/1

# Second request - send ETag for revalidation
curl -v -H 'If-None-Match: "abc123..."' http://localhost:3000/api/products/1
    </pre>
  `);
});

// ==========================================
// START SERVER
// ==========================================

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           HTTP Caching Demo Server                         ║
║           http://localhost:${PORT}                             ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║  /assets/:version/:file  - Immutable assets (1yr cache)    ║
║  /api/products/:id       - ETag revalidation               ║
║  /api/products           - Time-based + revalidation       ║
║  /api/user/profile       - No caching (sensitive)          ║
║  /api/trending           - CDN-optimized caching           ║
║  /api/articles/:id       - Last-Modified based             ║
╚════════════════════════════════════════════════════════════╝
  `);
});
```

---

## Run the POC

```bash
npm install express
node http-caching.js
```

---

## Testing with curl

```bash
# 1. First request - full response with ETag
curl -v http://localhost:3000/api/products/1
# Response: 200 OK with ETag header

# 2. Second request with ETag - 304 Not Modified
curl -v -H 'If-None-Match: "<etag-from-above>"' http://localhost:3000/api/products/1
# Response: 304 Not Modified (no body)

# 3. Test immutable assets
curl -v http://localhost:3000/assets/v1.2.3/app.js
# Response: Cache-Control: public, max-age=31536000, immutable

# 4. Test no-cache endpoint
curl -v http://localhost:3000/api/user/profile
# Response: Cache-Control: no-store, no-cache

# 5. Test Last-Modified
curl -v http://localhost:3000/api/articles/1
# Note the Last-Modified header

curl -v -H 'If-Modified-Since: Wed, 15 Jan 2024 10:00:00 GMT' http://localhost:3000/api/articles/1
# Response: 304 Not Modified
```

---

## Cache-Control Cheat Sheet

| Directive | Browser | CDN | Use Case |
|-----------|---------|-----|----------|
| `max-age=3600` | Cache 1h | Cache 1h | General caching |
| `s-maxage=86400` | Uses max-age | Cache 24h | CDN-specific TTL |
| `no-cache` | Must revalidate | Must revalidate | Always check freshness |
| `no-store` | Don't cache | Don't cache | Sensitive data |
| `private` | Can cache | Cannot cache | User-specific data |
| `public` | Can cache | Can cache | Shared content |
| `immutable` | Never revalidate | Never revalidate | Versioned assets |
| `must-revalidate` | Check when stale | Check when stale | Critical data |
| `stale-while-revalidate=60` | Serve stale, refresh bg | Same | Performance |

---

## Common Patterns

### Static Assets (Versioned)

```javascript
// URL: /assets/v1.2.3/app.js
Cache-Control: public, max-age=31536000, immutable
```

### API Data (Revalidation)

```javascript
// URL: /api/products/:id
Cache-Control: private, no-cache
ETag: "abc123"
```

### Public Lists (Time-Based)

```javascript
// URL: /api/products
Cache-Control: public, max-age=300, stale-while-revalidate=60
```

### Sensitive Data (No Cache)

```javascript
// URL: /api/user/balance
Cache-Control: no-store, no-cache, must-revalidate
```

---

## Production Checklist

- [ ] Versioned assets use `immutable` and long `max-age`
- [ ] API responses include appropriate `ETag` or `Last-Modified`
- [ ] Sensitive endpoints use `no-store`
- [ ] User-specific data uses `private`
- [ ] CDN-served content uses `s-maxage` for CDN TTL
- [ ] `Vary` header set for content negotiation (e.g., `Accept-Encoding`)
- [ ] 304 responses properly implemented for bandwidth savings

---

## Related Content

- [POC #61: Cache-Aside Pattern](/interview-prep/practice-pocs/cache-aside-pattern)
- [POC #63: Cache Invalidation Strategies](/interview-prep/practice-pocs/cache-invalidation-strategies)
- [Caching Strategies Article](/system-design/caching/caching-strategies)
