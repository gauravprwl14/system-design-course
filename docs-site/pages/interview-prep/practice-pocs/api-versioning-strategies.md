# 5️⃣9️⃣ API Versioning Strategies

## 🎯 What You'll Learn
How Stripe maintains **99.999% uptime** while supporting **v1 API from 2015** (9+ years of backwards compatibility) without breaking existing integrations.

---

## 💰 The $47M Breaking Change

**Twilio's Lesson (2013):**
- **Breaking API change** forced 10,000+ customers to update code
- **$47M revenue impact** (customer churn, support costs)
- **6-month migration** period caused chaos
- **Trust damage** took years to recover

**What Changed:**
Renamed `from` → `from_number` in SMS API without version bump.

**Impact:**
```javascript
// Old code (stopped working overnight)
twilio.sendSMS({ from: '+1234567890', ... });

// New code (required)
twilio.sendSMS({ from_number: '+1234567890', ... });

// Result: 10,000 apps broke in production
```

**The Fix:**
Stripe's approach: **Never break backwards compatibility. Add new versions, keep old ones forever.**

---

## 🚫 Anti-Patterns (What NOT to Do)

### ❌ **Wrong: No Versioning at All**
```javascript
// Breaking change without warning
// Before (2023-01-01)
GET /api/users/123
{
  "name": "Alice Smith",
  "email": "alice@example.com"
}

// After (2023-06-01) - BREAKING CHANGE!
GET /api/users/123
{
  "first_name": "Alice",  // ← Changed field names
  "last_name": "Smith",
  "email": "alice@example.com"
}

// Problem: Every client breaks instantly
```

**Why This Fails:**
- **Zero migration time** (apps break immediately)
- **No rollback** (can't undo deployed code)
- **Customer anger** (forced emergency updates)

### ❌ **Wrong: Query Parameter Versioning**
```javascript
// BAD: Version in query string
GET /api/users?version=2

// Problems:
// 1. Hard to cache (CDN ignores query params)
// 2. Easy to forget (default version unclear)
// 3. Ugly URLs (not RESTful)
// 4. Proxy/firewall issues (some strip query params)
```

### ❌ **Wrong: Forcing Upgrades**
```javascript
// BAD: Sunset old version too quickly
GET /api/v1/users
Response: 410 Gone
{
  "error": "API v1 is deprecated. Please upgrade to v2."
}

// Problem: Breaks legacy integrations (mobile apps can't update instantly)
// Reality: iOS app review = 3-7 days, Android = 2-5 days
// Users take weeks/months to update apps
```

---

## 💡 Paradigm Shift

> **"The best API is one that never breaks existing integrations."**

**The Principle:** Add, don't change. Deprecate, don't remove.

**Stripe's Philosophy:**
- **v1 API (2015)** still works today (9+ years)
- **Breaking changes** get new major version
- **Non-breaking changes** use date-based versioning
- Result: 99.999% uptime, zero forced migrations

---

## ✅ The Solution: Multi-Strategy Versioning

### **1. URL Versioning (Major Versions)**

**Best for:** Major breaking changes (field renames, type changes, removed fields)

```javascript
// Express.js implementation
const express = require('express');
const app = express();

// v1 API (original, deprecated but still supported)
const v1Router = express.Router();

v1Router.get('/users/:id', (req, res) => {
  const user = db.users.findById(req.params.id);

  // v1 response format
  res.json({
    name: user.fullName,  // Single field
    email: user.email,
    created: user.createdAt.toISOString()
  });
});

// Add deprecation headers
v1Router.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');  // When it dies
  res.setHeader('Link', '</docs/migration-v2>; rel="deprecation"');
  next();
});

app.use('/v1', v1Router);

// v2 API (current, breaking changes)
const v2Router = express.Router();

v2Router.get('/users/:id', (req, res) => {
  const user = db.users.findById(req.params.id);

  // v2 response format (BREAKING: split name into first/last)
  res.json({
    first_name: user.firstName,  // ← Changed!
    last_name: user.lastName,
    email: user.email,
    created_at: user.createdAt.toISOString()  // ← Renamed
  });
});

app.use('/v2', v2Router);

// Default version (redirect to latest)
app.get('/users/:id', (req, res) => {
  res.redirect(308, `/v2/users/${req.params.id}`);  // 308 = permanent redirect
});
```

**Pros:**
- ✅ **Explicit versioning** (clear which version you're using)
- ✅ **Easy to cache** (CDN-friendly)
- ✅ **Proxy-friendly** (URL-based routing)

**Cons:**
- ❌ **URL pollution** (`/v1/`, `/v2/`, `/v3/`)
- ❌ **Code duplication** (maintain multiple implementations)

---

### **2. Header Versioning (Minor Versions)**

**Best for:** Non-breaking additions (new fields, new optional params)

```javascript
// Stripe's approach: Date-based versioning
app.use((req, res, next) => {
  // Get version from header (default to latest)
  const apiVersion = req.headers['stripe-version'] || '2024-11-20';

  req.apiVersion = apiVersion;
  next();
});

app.get('/v1/charges/:id', (req, res) => {
  const charge = db.charges.findById(req.params.id);

  // Transform response based on API version
  const response = transformCharge(charge, req.apiVersion);

  res.setHeader('Stripe-Version', req.apiVersion);
  res.json(response);
});

function transformCharge(charge, version) {
  const base = {
    id: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    created: charge.created
  };

  // Version-specific fields
  if (version >= '2023-08-16') {
    // New field added on 2023-08-16
    base.payment_method_details = charge.paymentMethodDetails;
  }

  if (version >= '2024-01-15') {
    // Field renamed on 2024-01-15
    base.receipt_email = charge.receiptEmail;
  } else {
    // Old field name (backwards compatibility)
    base.email = charge.receiptEmail;
  }

  if (version >= '2024-11-20') {
    // New field added recently
    base.fraud_score = charge.fraudScore;
  }

  return base;
}
```

**Version Header Examples:**
```bash
# Use latest version (default)
curl https://api.stripe.com/v1/charges/ch_123

# Pin to specific version (recommended)
curl https://api.stripe.com/v1/charges/ch_123 \
  -H "Stripe-Version: 2023-08-16"

# Upgrade to newer version
curl https://api.stripe.com/v1/charges/ch_123 \
  -H "Stripe-Version: 2024-11-20"
```

**Pros:**
- ✅ **Clean URLs** (no version in path)
- ✅ **Gradual migration** (test new version without code changes)
- ✅ **Fine-grained control** (pin to exact date)

**Cons:**
- ❌ **Harder to cache** (CDN must respect header)
- ❌ **Hidden complexity** (version not obvious from URL)

---

### **3. Content Negotiation (Accept Header)**

**Best for:** Response format changes (JSON vs XML, API vs UI)

```javascript
// GitHub's approach
app.get('/repos/:owner/:repo', (req, res) => {
  const repo = db.repos.find({ owner: req.params.owner, name: req.params.repo });

  const accept = req.headers.accept || 'application/json';

  // Version via Accept header
  if (accept.includes('application/vnd.github.v3+json')) {
    // v3 API (current)
    return res.json({
      id: repo.id,
      name: repo.name,
      full_name: `${repo.owner}/${repo.name}`,
      owner: { login: repo.owner }
    });
  }

  if (accept.includes('application/vnd.github.v4+json')) {
    // v4 API (future, different structure)
    return res.json({
      node_id: repo.nodeId,
      name: repo.name,
      nameWithOwner: `${repo.owner}/${repo.name}`,
      owner: { login: repo.owner }
    });
  }

  // Default (latest)
  res.json({ id: repo.id, name: repo.name });
});
```

**Usage:**
```bash
# v3 API
curl https://api.github.com/repos/facebook/react \
  -H "Accept: application/vnd.github.v3+json"

# v4 API
curl https://api.github.com/repos/facebook/react \
  -H "Accept: application/vnd.github.v4+json"
```

**Pros:**
- ✅ **HTTP standard** (follows REST principles)
- ✅ **Multiple formats** (JSON, XML, etc.)

**Cons:**
- ❌ **Complex** (hard to debug, non-obvious)
- ❌ **Poor tooling** (Postman/curl harder to use)

---

### **4. Hybrid Approach (Stripe's Model)**

**Combine strategies for best results:**

```javascript
// Major versions in URL, minor versions in header
const express = require('express');
const app = express();

// Middleware: Parse API version from header
app.use((req, res, next) => {
  req.apiVersion = req.headers['stripe-version'] || '2024-11-20';
  req.majorVersion = req.path.split('/')[1];  // Extract from URL: /v1/...
  next();
});

// v1 endpoints (major version)
const v1Router = express.Router();

v1Router.get('/charges/:id', (req, res) => {
  const charge = db.charges.findById(req.params.id);

  // Apply minor version transformations
  const response = applyVersionTransforms(charge, req.apiVersion);

  res.setHeader('Stripe-Version', req.apiVersion);
  res.json(response);
});

app.use('/v1', v1Router);

// v2 endpoints (breaking changes)
const v2Router = express.Router();

v2Router.get('/payments/:id', (req, res) => {  // ← Renamed endpoint
  // v2 has completely different structure
  const payment = db.payments.findById(req.params.id);

  res.json({
    payment_intent_id: payment.id,  // Different field names
    amount_cents: payment.amount,   // Different units
    status: payment.status
  });
});

app.use('/v2', v2Router);

function applyVersionTransforms(charge, version) {
  const response = { ...charge };

  // Version-specific transformations
  if (version < '2023-08-16') {
    delete response.payment_method_details;  // Remove new field
  }

  if (version < '2024-01-15') {
    response.email = response.receipt_email;  // Use old field name
    delete response.receipt_email;
  }

  return response;
}
```

---

## 🔥 Complete Docker POC

### **docker-compose.yml**
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/versioning_db
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: versioning_db
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
```

### **server.js** (Complete Implementation)
```javascript
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Versioning middleware
app.use((req, res, next) => {
  // Parse version from header (Stripe-style)
  const headerVersion = req.headers['api-version'];

  // Parse major version from URL
  const urlMatch = req.path.match(/^\/v(\d+)\//);
  const majorVersion = urlMatch ? parseInt(urlMatch[1]) : null;

  req.versions = {
    major: majorVersion || 1,  // Default to v1
    minor: headerVersion || '2024-11-20'  // Default to latest
  };

  next();
});

// ===== V1 API =====
const v1Router = express.Router();

// Deprecation middleware for v1
v1Router.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');
  res.setHeader('Link', '<https://docs.example.com/migration-v2>; rel="deprecation"');
  next();
});

v1Router.get('/users/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];

  // v1 response format
  const response = {
    name: `${user.first_name} ${user.last_name}`,  // Combined name
    email: user.email,
    created: user.created_at
  };

  // Minor version adjustments
  if (req.versions.minor >= '2024-01-15') {
    response.avatar_url = user.avatar;  // New field added
  }

  res.setHeader('API-Version', req.versions.minor);
  res.json(response);
});

v1Router.post('/users', async (req, res) => {
  // v1 expects single "name" field
  const nameParts = req.body.name.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  const result = await db.query(
    'INSERT INTO users (first_name, last_name, email, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
    [firstName, lastName, req.body.email]
  );

  res.status(201).json({
    name: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
    email: result.rows[0].email
  });
});

app.use('/v1', v1Router);

// ===== V2 API =====
const v2Router = express.Router();

v2Router.get('/users/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = result.rows[0];

  // v2 response format (BREAKING: separate first/last name)
  const response = {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    created_at: user.created_at,
    avatar_url: user.avatar
  };

  res.setHeader('API-Version', req.versions.minor);
  res.json(response);
});

v2Router.post('/users', async (req, res) => {
  // v2 expects separate first_name/last_name
  const result = await db.query(
    'INSERT INTO users (first_name, last_name, email, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
    [req.body.first_name, req.body.last_name, req.body.email]
  );

  res.status(201).json(result.rows[0]);
});

app.use('/v2', v2Router);

// Default route (redirect to latest)
app.get('/users/:id', (req, res) => {
  res.redirect(308, `/v2/users/${req.params.id}`);
});

app.listen(3000, () => console.log('API listening on :3000'));
```

### **init.sql**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  avatar VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (first_name, last_name, email, avatar) VALUES
  ('Alice', 'Smith', 'alice@example.com', 'https://i.pravatar.cc/150?img=1'),
  ('Bob', 'Johnson', 'bob@example.com', 'https://i.pravatar.cc/150?img=2');
```

### **Test the POC**
```bash
# Start services
docker-compose up -d

# Test v1 API (old format)
curl http://localhost:3000/v1/users/1
# { "name": "Alice Smith", "email": "alice@example.com", ... }

# Test v2 API (new format)
curl http://localhost:3000/v2/users/1
# { "first_name": "Alice", "last_name": "Smith", "email": "alice@example.com", ... }

# Test v1 with newer minor version (gets avatar_url)
curl http://localhost:3000/v1/users/1 \
  -H "API-Version: 2024-01-15"
# { "name": "Alice Smith", "email": "...", "avatar_url": "..." }

# Create user (v1 - single name field)
curl -X POST http://localhost:3000/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie Brown","email":"charlie@example.com"}'

# Create user (v2 - separate fields)
curl -X POST http://localhost:3000/v2/users \
  -H "Content-Type: application/json" \
  -d '{"first_name":"David","last_name":"Wilson","email":"david@example.com"}'
```

---

## 🏆 Key Takeaways

### **Versioning Strategy Decision Matrix**

| Strategy | Use Case | Example |
|----------|----------|---------|
| **URL Versioning** | Major breaking changes | Stripe `/v1/`, `/v2/` |
| **Header Versioning** | Minor non-breaking changes | Stripe `Stripe-Version: 2024-11-20` |
| **Content Negotiation** | Multiple response formats | GitHub `Accept: application/vnd.github.v3+json` |
| **Hybrid** | Best of both worlds | Stripe (URL + header) |

### **Best Practices**

1. **Never break backwards compatibility**
   - Add new fields, don't remove old ones
   - Deprecate gradually (12-24 month sunset)

2. **Use semantic versioning**
   - Major (v1 → v2): Breaking changes
   - Minor (date-based): New optional fields

3. **Add deprecation headers**
   ```http
   Deprecation: true
   Sunset: Sat, 31 Dec 2025 23:59:59 GMT
   Link: </docs/migration>; rel="deprecation"
   ```

4. **Document migration path**
   - Show before/after examples
   - Provide upgrade guide
   - Offer migration tools

5. **Monitor version usage**
   - Track which versions are used
   - Alert when old versions spike
   - Identify migration blockers

---

## 🚀 Real-World Impact

**Stripe:**
- **v1 API (2015)** still works 9 years later
- **99.999% uptime** (never broke integrations)
- **Zero forced migrations** (customers upgrade when ready)
- **Developer trust** = competitive advantage

**Twilio:**
- **Learned from 2013 mistake** (breaking change)
- **Now:** 5+ years backwards compatibility
- **Versioning policy** public and documented

**GitHub:**
- **v3 REST API (2012)** still supported
- **v4 GraphQL (2016)** runs in parallel
- **Both versions** maintained forever

---

## 🎯 Next Steps

1. **Choose URL versioning** for major versions
2. **Add header versioning** for minor changes
3. **Document breaking changes** clearly
4. **Give 12+ months** migration time
5. **Monitor version adoption** metrics

**Up Next:** POC #60 - API Gateway with Rate Limiting (How to protect your API from abuse)

---

## 📚 References

- [Stripe API Versioning](https://stripe.com/docs/api/versioning)
- [Semantic Versioning](https://semver.org/)
- [GitHub API Versioning](https://docs.github.com/en/rest/overview/api-versions)
- [Twilio API Versioning](https://www.twilio.com/docs/glossary/what-is-api-versioning)
