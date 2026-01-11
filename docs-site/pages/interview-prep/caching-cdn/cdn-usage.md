# CDN (Content Delivery Network) - Use Cases & Optimization

## Question
**"Explain what a CDN is, when to use it, and how to optimize its performance. What are the trade-offs?"**

Common in: System Design, DevOps, Performance Engineering interviews

---

## 📊 Quick Answer

**CDN** = Distributed network of servers that cache and serve static content from locations close to users

**Key Benefits**:
- **Faster Load Times** - Serve from nearest server (50-200ms → 10-50ms)
- **Reduced Server Load** - Offload 70-90% of traffic
- **Global Scalability** - Handle traffic spikes worldwide
- **DDoS Protection** - Distributed architecture absorbs attacks

**Common Use Cases**:
- Images, videos, CSS, JavaScript
- API responses (with cache headers)
- Static HTML pages
- Software downloads

---

## 🎯 Complete Solution

### How CDN Works

```
WITHOUT CDN:
User (India) → Origin Server (US)
  ↳ Latency: 200ms (slow!)

WITH CDN:
User (India) → CDN Edge (Mumbai) → Origin Server (US) [cache miss only]
  ↳ Cache Hit: 20ms (10x faster!)
  ↳ Cache Miss: 220ms (first request only)

CDN Architecture:
┌─────────────────────────────────────────────────┐
│              User Requests                      │
└───────┬─────────────────────────────────────────┘
        │
    ┌───▼────────────────────────────────┐
    │   DNS / CDN Routing                │
    │   (Route to nearest edge)          │
    └───┬────────────────────────────────┘
        │
   ┌────┴─────┬─────────┬─────────┐
   │          │         │         │
┌──▼──┐   ┌──▼──┐   ┌──▼──┐   ┌──▼──┐
│Edge │   │Edge │   │Edge │   │Edge │
│(US) │   │(EU) │   │(Asia│   │(AU) │
└──┬──┘   └──┬──┘   └──┬──┘   └──┬──┘
   │         │         │         │
   └─────────┴─────────┴─────────┘
              │
         ┌────▼──────┐
         │  Origin   │
         │  Server   │
         └───────────┘
```

---

## 💻 Implementation

### 1. Setting Up CDN (CloudFront Example)

```javascript
// aws-cloudfront-setup.js
const AWS = require('aws-sdk');
const cloudfront = new AWS.CloudFront();

async function createCDNDistribution() {
  const params = {
    DistributionConfig: {
      // Origin - where CDN fetches content
      Origins: {
        Quantity: 1,
        Items: [{
          Id: 'my-s3-origin',
          DomainName: 'my-bucket.s3.amazonaws.com',
          S3OriginConfig: {
            OriginAccessIdentity: ''
          }
        }]
      },

      // Default cache behavior
      DefaultCacheBehavior: {
        TargetOriginId: 'my-s3-origin',
        ViewerProtocolPolicy: 'redirect-to-https',

        // Cache policy
        CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // Managed-CachingOptimized

        // Allowed methods
        AllowedMethods: {
          Quantity: 2,
          Items: ['GET', 'HEAD']
        },

        // Compress objects
        Compress: true,

        // Lambda@Edge (optional)
        LambdaFunctionAssociations: {
          Quantity: 0
        }
      },

      // Enable CDN
      Enabled: true,

      // Comment
      Comment: 'My website CDN',

      // Price class (where to deploy)
      PriceClass: 'PriceClass_All', // All edge locations
      // PriceClass_100 - North America, Europe
      // PriceClass_200 - Above + Asia, Africa

      // SSL Certificate
      ViewerCertificate: {
        CloudFrontDefaultCertificate: true
        // Or use custom certificate:
        // ACMCertificateArn: 'arn:aws:acm:...',
        // SSLSupportMethod: 'sni-only'
      },

      // Custom domain
      Aliases: {
        Quantity: 1,
        Items: ['cdn.example.com']
      },

      // Default root object
      DefaultRootObject: 'index.html',

      // Logging (optional)
      Logging: {
        Enabled: true,
        IncludeCookies: false,
        Bucket: 'my-logs.s3.amazonaws.com',
        Prefix: 'cdn-logs/'
      }
    }
  };

  const result = await cloudfront.createDistribution(params).promise();
  console.log('CDN Distribution created:', result.Distribution.DomainName);
  // d111111abcdef8.cloudfront.net

  return result;
}
```

---

### 2. Cache Control Headers (Critical!)

```javascript
// express-cache-headers.js
const express = require('express');
const app = express();

// Static assets - cache for 1 year
app.use('/static', express.static('public', {
  maxAge: '1y', // 31536000 seconds
  immutable: true,
  setHeaders: (res, path) => {
    // Fingerprinted assets (e.g., app.abc123.js)
    if (path.match(/\.[a-f0-9]{8,}\.(js|css|jpg|png|woff2)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// HTML - no cache (always fresh)
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache'); // HTTP/1.0
  res.setHeader('Expires', '0');
  res.sendFile('index.html');
});

// API responses - cache for 5 minutes
app.get('/api/products', async (req, res) => {
  const products = await db.getProducts();

  // Cache for 5 minutes, but allow stale for 1 hour
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');

  res.json(products);
});

// User-specific data - private cache
app.get('/api/profile', authenticate, async (req, res) => {
  const profile = await db.getUserProfile(req.user.id);

  // Cache in browser only (not CDN)
  res.setHeader('Cache-Control', 'private, max-age=300');

  res.json(profile);
});

// Dynamic content with ETag validation
app.get('/api/article/:id', async (req, res) => {
  const article = await db.getArticle(req.params.id);

  // Generate ETag from content hash
  const etag = `"${hashContent(article)}"`;

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');

  // Check if client has latest version
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end(); // Not Modified
  }

  res.json(article);
});

function hashContent(content) {
  const crypto = require('crypto');
  return crypto
    .createHash('md5')
    .update(JSON.stringify(content))
    .digest('hex');
}
```

**Cache-Control Directives Explained**:

| Directive | Meaning | Use Case |
|-----------|---------|----------|
| `public` | Can be cached by CDN and browsers | Static assets, public API |
| `private` | Browser cache only (not CDN) | User-specific data |
| `no-cache` | Revalidate with server before use | HTML pages |
| `no-store` | Never cache | Sensitive data |
| `max-age=N` | Cache for N seconds | All cacheable content |
| `immutable` | Never revalidate (until max-age) | Fingerprinted assets |
| `stale-while-revalidate=N` | Serve stale + refresh in background | API responses |

---

### 3. CDN Cache Invalidation

```javascript
// cdn-invalidation.js
const AWS = require('aws-sdk');
const cloudfront = new AWS.CloudFront();

class CDNInvalidation {
  constructor(distributionId) {
    this.distributionId = distributionId;
  }

  // Invalidate specific paths
  async invalidatePaths(paths) {
    const params = {
      DistributionId: this.distributionId,
      InvalidationBatch: {
        CallerReference: `invalidation-${Date.now()}`,
        Paths: {
          Quantity: paths.length,
          Items: paths // ['/images/logo.png', '/css/style.css']
        }
      }
    };

    const result = await cloudfront.createInvalidation(params).promise();
    console.log('Invalidation created:', result.Invalidation.Id);
    return result;
  }

  // Invalidate all files
  async invalidateAll() {
    return await this.invalidatePaths(['/*']);
  }

  // Invalidate by prefix
  async invalidatePrefix(prefix) {
    return await this.invalidatePaths([`${prefix}/*`]);
  }

  // Wait for invalidation to complete
  async waitForInvalidation(invalidationId) {
    const params = {
      DistributionId: this.distributionId,
      Id: invalidationId
    };

    while (true) {
      const result = await cloudfront.getInvalidation(params).promise();
      const status = result.Invalidation.Status;

      console.log('Invalidation status:', status);

      if (status === 'Completed') {
        return true;
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Usage in deployment pipeline
const cdn = new CDNInvalidation('E1234567890ABC');

// After deploying new version
async function deployNewVersion() {
  // 1. Upload new files to S3 with versioned filenames
  await uploadToS3('app.v2.js', 'public/app.v2.js');

  // 2. Update HTML to reference new version
  await uploadToS3('index.html', 'public/index.html');

  // 3. Invalidate only HTML (not fingerprinted assets!)
  await cdn.invalidatePaths(['/index.html', '/']);

  console.log('Deployment complete!');
}

// IMPORTANT: Invalidations cost money!
// CloudFront: First 1000 paths/month free, then $0.005 per path
// Better: Use versioned filenames (app.abc123.js) instead of invalidation
```

---

### 4. Versioned Assets (Best Practice)

```javascript
// webpack.config.js - Asset fingerprinting
module.exports = {
  output: {
    filename: '[name].[contenthash].js', // app.abc123def.js
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      // Automatically inject versioned scripts
      inject: 'body'
    })
  ]
};

// Generated HTML:
// <script src="/static/app.abc123def.js"></script>
// <link href="/static/style.xyz789gh.css" rel="stylesheet">

// When you deploy, old URLs stop being requested automatically!
// No CDN invalidation needed! ✓
```

---

## 🎯 CDN Use Cases

### 1. Static Website Hosting

```
Architecture:
S3 Bucket → CloudFront CDN → Users

Benefits:
- No server management
- Global distribution
- Auto-scaling
- $0.50/month for 10GB + 50k requests
```

```javascript
// upload-to-s3.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

async function uploadDirectory(localDir, s3Bucket, s3Prefix = '') {
  const files = fs.readdirSync(localDir, { recursive: true });

  for (const file of files) {
    const filePath = path.join(localDir, file);

    if (fs.statSync(filePath).isDirectory()) continue;

    const key = path.join(s3Prefix, file);
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    // Set cache headers based on file type
    let cacheControl;
    if (filePath.match(/\.(js|css|jpg|png|woff2)$/)) {
      cacheControl = 'public, max-age=31536000, immutable'; // 1 year
    } else if (filePath.endsWith('.html')) {
      cacheControl = 'no-cache'; // Always revalidate
    } else {
      cacheControl = 'public, max-age=3600'; // 1 hour
    }

    await s3.putObject({
      Bucket: s3Bucket,
      Key: key,
      Body: fs.readFileSync(filePath),
      ContentType: contentType,
      CacheControl: cacheControl
    }).promise();

    console.log(`Uploaded: ${key}`);
  }
}

// Usage
uploadDirectory('./dist', 'my-website-bucket', 'static/');
```

---

### 2. Video Streaming with CDN

```javascript
// video-streaming-cdn.js
app.get('/api/video/:videoId', async (req, res) => {
  const { videoId } = req.params;

  // Get video metadata from database
  const video = await db.getVideo(videoId);

  // Return CDN URL (not direct S3 URL!)
  const cdnUrl = `https://d111111abcdef8.cloudfront.net/videos/${video.filename}`;

  res.json({
    title: video.title,
    url: cdnUrl,
    // HLS for adaptive streaming
    formats: {
      hls: `${cdnUrl}/playlist.m3u8`,
      '1080p': `${cdnUrl}/1080p.mp4`,
      '720p': `${cdnUrl}/720p.mp4`,
      '480p': `${cdnUrl}/480p.mp4`
    }
  });
});

// HTML5 video with CDN
/*
<video controls>
  <source src="https://cdn.example.com/videos/sample.mp4" type="video/mp4">
</video>
*/
```

---

### 3. API Response Caching

```javascript
// api-cdn-caching.js
// IMPORTANT: Only cache public, non-personalized API responses!

app.get('/api/public/products', async (req, res) => {
  const products = await db.getProducts();

  // Cache at CDN for 5 minutes
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  // s-maxage: CDN cache duration (different from browser)

  // Vary header - cache different versions based on these headers
  res.setHeader('Vary', 'Accept-Encoding, Accept-Language');

  res.json(products);
});

// Invalidate API cache on update
app.post('/api/admin/products', async (req, res) => {
  await db.createProduct(req.body);

  // Invalidate CDN cache
  await cdn.invalidatePaths(['/api/public/products']);

  res.json({ success: true });
});
```

---

### 4. Signed URLs for Private Content

```javascript
// cloudfront-signed-urls.js
const AWS = require('aws-sdk');
const cf = new AWS.CloudFront.Signer(
  process.env.CF_KEY_PAIR_ID,
  process.env.CF_PRIVATE_KEY
);

function generateSignedUrl(resourceUrl, expiresIn = 3600) {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;

  const signedUrl = cf.getSignedUrl({
    url: resourceUrl,
    expires
  });

  return signedUrl;
}

// Usage: Private video access
app.get('/api/premium/video/:id', authenticate, async (req, res) => {
  const user = req.user;
  const { id } = req.params;

  // Check if user has access
  if (!user.isPremium) {
    return res.status(403).json({ error: 'Premium subscription required' });
  }

  // Generate signed URL valid for 1 hour
  const cdnUrl = `https://d111111abcdef8.cloudfront.net/premium/${id}.mp4`;
  const signedUrl = generateSignedUrl(cdnUrl, 3600);

  res.json({
    videoUrl: signedUrl,
    expiresIn: 3600
  });
});
```

---

## 📈 Performance Optimization

### 1. Image Optimization with CDN

```javascript
// cloudfront-image-optimization.js
// Use CloudFront Functions or Lambda@Edge

// CloudFront Function (lightweight, edge-level)
function handler(event) {
  const request = event.request;
  const uri = request.uri;

  // Auto-WebP conversion
  const acceptHeader = request.headers['accept'];
  if (acceptHeader && acceptHeader.value.includes('image/webp')) {
    // Request WebP version
    request.uri = uri.replace(/\.(jpg|png)$/, '.webp');
  }

  // Responsive images by query param
  // /image.jpg?width=800 → /image_800w.jpg
  const params = request.querystring;
  if (params.width) {
    const width = params.width.value;
    request.uri = uri.replace(/(\.\w+)$/, `_${width}w$1`);
  }

  return request;
}

// Usage in HTML:
/*
<picture>
  <source srcset="https://cdn.example.com/image.webp?width=800" type="image/webp">
  <img src="https://cdn.example.com/image.jpg?width=800" alt="Product">
</picture>
*/
```

---

### 2. Compression

```javascript
// Enable compression in CloudFront
// ✓ Automatic Gzip/Brotli compression for:
//   - text/html, text/css, application/javascript
//   - application/json, image/svg+xml

// Verify compression
app.get('/test-compression', (req, res) => {
  const largeText = 'Hello '.repeat(10000);

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  res.send(largeText);
  // Without compression: 60KB
  // With Gzip: 6KB (10x smaller!)
  // With Brotli: 4KB (15x smaller!)
});
```

---

### 3. Prefetching and Preconnect

```html
<!-- HTML optimization -->
<!DOCTYPE html>
<html>
<head>
  <!-- DNS prefetch -->
  <link rel="dns-prefetch" href="https://d111111abcdef8.cloudfront.net">

  <!-- Preconnect (DNS + TCP + TLS handshake) -->
  <link rel="preconnect" href="https://d111111abcdef8.cloudfront.net">

  <!-- Prefetch critical assets -->
  <link rel="prefetch" href="https://cdn.example.com/app.abc123.js">

  <!-- Preload (high priority) -->
  <link rel="preload" href="https://cdn.example.com/font.woff2" as="font" type="font/woff2" crossorigin>

  <link rel="stylesheet" href="https://cdn.example.com/style.xyz789.css">
</head>
<body>
  <img src="https://cdn.example.com/hero.jpg" alt="Hero">
  <script src="https://cdn.example.com/app.abc123.js"></script>
</body>
</html>
```

---

## 🎓 Interview Tips

### Common Questions

**Q: When should you NOT use a CDN?**
A: "For dynamic, personalized content (user dashboards, real-time data), very small websites (not worth the cost/complexity), or content that changes every second (live scores - better to use WebSockets)."

**Q: How do you handle cache invalidation?**
A: "Best practice: use versioned filenames (app.v2.js) so old URLs naturally stop being used. For HTML: short TTL (5-10 min). For urgent updates: CloudFront invalidation API, but it costs money after 1000 paths/month."

**Q: CDN vs Caching (Redis)?**
A: "CDN: Geographic distribution, static files, reduces bandwidth. Redis: Application-level, dynamic data, database query results, session storage. Use both together!"

**Q: How do you monitor CDN performance?**
A: "CloudFront access logs, cache hit ratio (aim for >80%), origin request rate, error rates (4xx, 5xx), latency by region. Tools: CloudWatch, Datadog, New Relic."

**Q: Cost optimization for CDN?**
A: "Use appropriate cache TTLs, compress assets, use reserved capacity, choose cheaper price classes (exclude regions you don't need), use S3 Transfer Acceleration for uploads."

---

## 🔗 Related Questions

- [Redis Caching Fundamentals](/interview-prep/caching-cdn/redis-fundamentals)
- [Cache Strategies](/interview-prep/caching-cdn/cache-strategies)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Performance Bottleneck Identification](/interview-prep/caching-cdn/performance-bottlenecks)

---

## 📚 Additional Resources

- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Cloudflare CDN Best Practices](https://www.cloudflare.com/learning/cdn/what-is-a-cdn/)
- [HTTP Caching Guide](https://web.dev/http-cache/)
- [Cache-Control Header Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
