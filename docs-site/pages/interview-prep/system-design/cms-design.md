# Content Management System (CMS) - System Design

**Interview Question**: *"How would you design a Content Management System? Consider cost optimization for 25,000 pages with high read, low write operations."*

**Difficulty**: 🟡 Intermediate
**Asked by**: Tech Companies, Media/Publishing
**Time to Answer**: 10-12 minutes

---

## 🎯 Quick Answer (30 seconds)

**CMS** = System to create, manage, and publish digital content (articles, pages, media)

**Key Requirements**:
1. **Content Creation**: Rich text editor, media upload
2. **Versioning**: Track changes, rollback
3. **Publishing**: Draft → Review → Publish workflow
4. **Multi-tenancy**: Multiple sites/brands
5. **Performance**: Fast page loads (caching)

**Tech Stack**:
- **Storage**: S3 (static files), DB (metadata)
- **Cache**: CDN (CloudFront), Redis
- **Backend**: Node.js/Python API
- **Frontend**: React/Next.js

**Cost Optimization**: Cache aggressively, S3 over database, CDN for static content

---

## 📚 Detailed Explanation

### Functional Requirements

**Content Management**:
- Create/edit/delete articles, pages
- Rich text editor (WYSIWYG)
- Media management (images, videos, PDFs)
- SEO metadata (title, description, keywords)
- Categories, tags, taxonomy

**Workflow**:
- Draft → Submit for Review → Approve → Publish → Archive
- Role-based access (Admin, Editor, Author, Viewer)
- Scheduled publishing
- Version control

**Publishing**:
- Static site generation (SSG)
- Server-side rendering (SSR)
- Preview before publish
- Multi-language support

### Non-Functional Requirements

**Performance**:
- Page load < 2 seconds
- Handle 100K concurrent readers
- Support 25,000+ pages

**Availability**:
- 99.9% uptime
- Zero downtime deployments

**Cost Optimization**:
- Read-heavy: 95% reads, 5% writes
- Aggressive caching
- S3 over database for static content

---

## 🏗️ High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     CDN (CloudFront)                      │
│            Cache static pages, images, assets             │
└────────────┬───────────────────────────┬──────────────────┘
             │                           │
    ┌────────▼────────┐         ┌────────▼────────┐
    │  Admin Portal   │         │  Public Website │
    │   (React SPA)   │         │   (Next.js SSG) │
    └────────┬────────┘         └────────┬────────┘
             │                           │
        ┌────▼────────────────────────────▼───┐
        │       API Gateway / Load Balancer   │
        └────────┬────────────────┬────────────┘
                 │                │
     ┌───────────▼─────┐    ┌─────▼───────────┐
     │  CMS API        │    │  Static Site    │
     │  (Node.js/Fast  │    │  Generator      │
     │   API)          │    │  (Build Service)│
     └───────┬─────────┘    └─────┬───────────┘
             │                    │
    ┌────────┼────────────────────┼──────────┐
    │        │                    │          │
┌───▼────┐ ┌▼──────┐  ┌──────────▼──┐  ┌────▼─────┐
│ Redis  │ │ RDS   │  │     S3      │  │  Search  │
│ Cache  │ │ (Meta)│  │  (Static)   │  │(Elastic) │
└────────┘ └───────┘  └─────────────┘  └──────────┘
```

---

## 🔧 Implementation: Content Model

### Database Schema

```sql
-- Content table (metadata only)
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  author_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL,  -- draft, review, published, archived
  content_url VARCHAR(1000),    -- S3 URL for HTML content
  excerpt TEXT,
  featured_image VARCHAR(1000),
  seo_title VARCHAR(200),
  seo_description VARCHAR(300),
  seo_keywords TEXT[],
  category_id UUID REFERENCES categories(id),
  tags TEXT[],
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  version INT DEFAULT 1
);

-- Content versions (for rollback)
CREATE TABLE content_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID REFERENCES content(id),
  version INT NOT NULL,
  content_url VARCHAR(1000),  -- S3 URL
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(content_id, version)
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Media library
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename VARCHAR(500) NOT NULL,
  file_url VARCHAR(1000) NOT NULL,  -- S3 URL
  file_type VARCHAR(50),
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_published_at ON content(published_at DESC);
CREATE INDEX idx_content_slug ON content(slug);
CREATE INDEX idx_content_category ON content(category_id);
```

### API Implementation (Node.js + Express)

```javascript
const express = require('express');
const AWS = require('aws-sdk');
const redis = require('redis');

const app = express();
const s3 = new AWS.S3();
const cacheClient = redis.createClient();

// Create content
app.post('/api/content', async (req, res) => {
  const { title, body, slug, categoryId, tags, seoTitle } = req.body;
  const authorId = req.user.id;

  try {
    // 1. Save HTML content to S3
    const contentKey = `content/${slug}-${Date.now()}.html`;
    await s3.putObject({
      Bucket: 'cms-content-bucket',
      Key: contentKey,
      Body: body,
      ContentType: 'text/html',
      ACL: 'private'  // Not public yet (draft)
    }).promise();

    const contentUrl = `https://s3.amazonaws.com/cms-content-bucket/${contentKey}`;

    // 2. Save metadata to database
    const content = await db.content.create({
      title,
      slug,
      authorId,
      status: 'draft',
      contentUrl,
      excerpt: extractExcerpt(body),
      categoryId,
      tags,
      seoTitle,
      version: 1
    });

    // 3. Save version
    await db.contentVersions.create({
      contentId: content.id,
      version: 1,
      contentUrl,
      changedBy: authorId
    });

    res.json({ success: true, contentId: content.id });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Publish content
app.post('/api/content/:id/publish', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Get content from DB
    const content = await db.content.findById(id);

    if (content.status === 'published') {
      return res.status(400).json({ error: 'Already published' });
    }

    // 2. Generate static HTML page
    const htmlPage = await generateStaticPage(content);

    // 3. Upload to S3 (public)
    const publicKey = `public/${content.slug}.html`;
    await s3.putObject({
      Bucket: 'cms-public-bucket',
      Key: publicKey,
      Body: htmlPage,
      ContentType: 'text/html',
      ACL: 'public-read',
      CacheControl: 'max-age=3600'
    }).promise();

    // 4. Update status in DB
    await db.content.update(
      { status: 'published', publishedAt: new Date() },
      { where: { id } }
    );

    // 5. Invalidate CDN cache
    await invalidateCDNCache(`/${content.slug}`);

    // 6. Clear Redis cache
    await cacheClient.del(`content:${content.slug}`);

    res.json({ success: true, url: `https://example.com/${content.slug}` });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get published content (public API)
app.get('/api/content/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    // 1. Check Redis cache first
    const cached = await cacheClient.get(`content:${slug}`);
    if (cached) {
      console.log('Cache hit');
      return res.json(JSON.parse(cached));
    }

    // 2. Get from database
    const content = await db.content.findOne({
      where: { slug, status: 'published' },
      include: ['category', 'author']
    });

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // 3. Get HTML from S3
    const s3Object = await s3.getObject({
      Bucket: 'cms-public-bucket',
      Key: `public/${slug}.html`
    }).promise();

    const result = {
      ...content.toJSON(),
      body: s3Object.Body.toString()
    };

    // 4. Cache for 1 hour
    await cacheClient.setex(`content:${slug}`, 3600, JSON.stringify(result));

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Generate static HTML page
function generateStaticPage(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.seoTitle || content.title}</title>
  <meta name="description" content="${content.seoDescription}">
  <meta name="keywords" content="${content.seoKeywords?.join(', ')}">
  <link rel="stylesheet" href="/static/css/main.css">
</head>
<body>
  <article>
    <h1>${content.title}</h1>
    <div class="meta">
      <span class="author">${content.author.name}</span>
      <time>${content.publishedAt}</time>
    </div>
    <div class="content">
      ${content.body}
    </div>
  </article>
  <script src="/static/js/main.js"></script>
</body>
</html>
  `;
}

// Helper: Invalidate CDN cache
async function invalidateCDNCache(path) {
  const cloudfront = new AWS.CloudFront();

  await cloudfront.createInvalidation({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `${Date.now()}`,
      Paths: {
        Quantity: 1,
        Items: [path]
      }
    }
  }).promise();
}
```

---

## 🔧 Cost Optimization Strategies

### 1. S3 over Database for Content

**Problem**: Storing 25,000 HTML pages in database is expensive
- PostgreSQL: $200/month for 100GB
- Frequent reads add load, cost for read replicas

**Solution**: Store HTML in S3
- S3: $2.30/month for 100GB
- Unlimited reads (cached by CDN)
- Database only stores metadata (< 1GB)

```javascript
// Cost comparison
// Database storage: 25,000 pages × 50KB = 1.25GB metadata + 100GB content
// Total: ~$200/month

// S3 + Database: 1.25GB metadata ($0) + 100GB S3 ($2.30)
// Total: ~$3/month for storage (65x cheaper!)
```

### 2. CDN for Static Content

**Problem**: Direct S3 reads cost $0.0004 per 1000 requests
- 1 million reads/month = $400

**Solution**: CloudFront CDN
- First 10TB/month: $0.085/GB
- 90% cache hit rate → only 10% hits S3
- Cost: ~$40/month (10x cheaper)

```javascript
// Without CDN
// 1M requests × $0.0004 = $400/month

// With CDN (90% cache hit)
// 100K S3 requests × $0.0004 = $40/month
```

### 3. Static Site Generation (SSG)

**Problem**: Server-side rendering (SSR) costs
- 1,000 requests/sec → 50+ servers
- $500/month in compute

**Solution**: Pre-generate HTML (SSG)
- Generate once, serve millions
- No server needed (pure static)
- Served from CDN

```javascript
// Build-time SSG (Next.js)
export async function getStaticProps({ params }) {
  const content = await fetchContent(params.slug);

  return {
    props: { content },
    revalidate: 3600  // Regenerate every hour
  };
}

export async function getStaticPaths() {
  const allContent = await fetchAllContentSlugs();

  return {
    paths: allContent.map(slug => ({ params: { slug } })),
    fallback: 'blocking'
  };
}
```

### 4. Aggressive Caching

```javascript
// Cache layers
1. CDN (CloudFront): 24 hours
2. Browser: 1 hour
3. Redis: 1 hour
4. Database query cache: 15 minutes

// Cache headers
res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
res.setHeader('CDN-Cache-Control', 'max-age=86400');
```

---

## 🏢 Real-World Example: WordPress-like System

```javascript
class CMSSystem {
  // Scheduled publishing
  async schedulePublish(contentId, publishAt) {
    const delay = publishAt - Date.now();

    setTimeout(async () => {
      await this.publishContent(contentId);
    }, delay);

    // More reliable: Use cron job or queue
    await queue.add('publish-content', {
      contentId,
      publishAt
    }, {
      delay
    });
  }

  // Bulk import (25,000 pages)
  async bulkImport(pages) {
    const batchSize = 100;

    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);

      // Upload to S3 in parallel
      await Promise.all(
        batch.map(page => this.uploadPageToS3(page))
      );

      // Save metadata to DB
      await db.content.bulkCreate(
        batch.map(page => ({
          title: page.title,
          slug: page.slug,
          contentUrl: page.s3Url,
          status: 'draft'
        }))
      );

      console.log(`Imported ${i + batch.length}/${pages.length}`);
    }
  }

  // Search (Elasticsearch)
  async search(query) {
    const results = await elasticsearch.search({
      index: 'content',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['title^3', 'excerpt^2', 'body']
          }
        },
        highlight: {
          fields: {
            body: {},
            title: {}
          }
        }
      }
    });

    return results.hits.hits;
  }

  // Analytics
  async trackPageView(slug) {
    // Increment view count
    await redis.incr(`views:${slug}`);

    // Send to analytics (async)
    await analyticsQueue.add('track-view', {
      slug,
      timestamp: Date.now()
    });
  }
}
```

---

## 📊 Capacity Planning

### Storage Requirements

```
25,000 pages × 50KB = 1.25GB (metadata)
25,000 pages × 100KB = 2.5GB (HTML content)
Media (images, videos) = 50GB
Total: ~55GB

S3 cost: 55GB × $0.023 = $1.27/month
Database: 1.25GB metadata (free tier)
```

### Traffic Handling

```
100K concurrent users
Average page size: 200KB (HTML + images)
Bandwidth: 100K × 200KB = 20GB/sec

With CDN (95% cache hit):
S3 bandwidth: 1GB/sec
CDN bandwidth: 19GB/sec

Cost:
- CloudFront: 19GB × $0.085 = $1.62/sec → $4,300/day
- S3: 1GB × $0.09 = $0.09/sec → $240/day
```

---

## 💡 Best Practices

### 1. Version Control

```javascript
// Auto-save drafts every 30 seconds
setInterval(async () => {
  await saveDraft(contentId, editorContent);
}, 30000);

// Create version on publish
await createVersion(contentId, version + 1);
```

### 2. Media Optimization

```javascript
// Resize images on upload
const sharp = require('sharp');

await sharp(imageBuffer)
  .resize(1200, 800, { fit: 'inside' })
  .webp({ quality: 80 })
  .toFile(`optimized/${filename}.webp`);

// Generate thumbnails
await sharp(imageBuffer)
  .resize(300, 200)
  .toFile(`thumbnails/${filename}.jpg`);
```

### 3. SEO Optimization

```javascript
// Generate sitemap.xml
app.get('/sitemap.xml', async (req, res) => {
  const allContent = await db.content.findAll({
    where: { status: 'published' },
    order: [['publishedAt', 'DESC']]
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allContent.map(content => `
  <url>
    <loc>https://example.com/${content.slug}</loc>
    <lastmod>${content.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`).join('')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});
```

---

## 💡 Key Takeaways

1. ✅ **S3 over Database** - 65x cheaper for content storage
2. ✅ **CDN Caching** - 90%+ cache hit rate saves costs
3. ✅ **Static Site Generation** - Pre-render pages
4. ✅ **Metadata in DB, Content in S3** - Best of both worlds
5. ✅ **Version Control** - Track all changes
6. ✅ **Search with Elasticsearch** - Fast full-text search
7. ✅ **Role-based Access** - Admin, Editor, Author workflows
8. ✅ **Scheduled Publishing** - Queue-based publishing

---

## 🔗 Related Questions

- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Rate Limiting Implementation](/interview-prep/system-design/rate-limiting)

---

## 📚 Further Reading

- **Headless CMS**: https://www.contentful.com/headless-cms/
- **WordPress Architecture**: https://wordpress.org/about/architecture/
- **Next.js SSG**: https://nextjs.org/docs/basic-features/pages#static-generation
- **S3 Pricing**: https://aws.amazon.com/s3/pricing/
