# 5️⃣6️⃣ RESTful API Best Practices

## 🎯 What You'll Learn
How Stripe built **the world's best API** with REST principles that handles **1 billion+ requests/day** and generated **$95B in payment volume** (2023).

---

## 💰 The $95B API

**Stripe's Success Story:**
- **Developer experience** so good it became competitive advantage
- **99.999% uptime** (5 minutes downtime/year)
- **Idempotent requests** prevent $847M in duplicate charges
- **Clear error messages** save developers 1,000+ hours debugging

**What Makes It Great:**
- **Predictable resource URLs** (`/v1/customers/cus_123`)
- **Comprehensive error responses** (exactly what went wrong + how to fix)
- **Idempotency keys** (retry safely)
- **Versioned API** (backwards compatibility for years)

---

## 🚫 Anti-Patterns (What NOT to Do)

### ❌ **Wrong: Verbs in URLs**
```javascript
// BAD: Using verbs instead of nouns
POST /api/createUser
POST /api/getUser
POST /api/updateUser
POST /api/deleteUser

// Problem: Not RESTful, violates HTTP semantics
// Solution: Use HTTP methods with noun resources
```

**Why This Fails:**
- **Confusing:** HTTP already has verbs (GET, POST, PUT, DELETE)
- **Not cacheable:** Everything is POST
- **Breaks conventions:** REST is resource-based, not action-based

### ❌ **Wrong: Inconsistent Resource Naming**
```javascript
// BAD: Inconsistent naming
GET  /api/user/123      // Singular
GET  /api/products      // Plural
POST /api/CreateOrder   // PascalCase
PUT  /api/update-cart   // Kebab-case + verb

// Problem: Developers have to memorize each endpoint
```

**Why This Fails:**
- **Cognitive load:** No pattern to follow
- **Autocomplete broken:** Can't guess next endpoint
- **Documentation hell:** Every endpoint is unique

### ❌ **Wrong: Generic Error Messages**
```javascript
// BAD: Unhelpful error response
{
  "error": "Bad request"
}

// Developer thinks: "What's bad? Which field? How to fix?"
// Result: 30 minutes debugging, angry developers
```

**Why This Fails:**
- **Wasted developer time** (debugging generic errors)
- **Support tickets** (developers can't self-serve)
- **Abandoned integrations** (too frustrating)

### ❌ **Wrong: No Idempotency**
```javascript
// BAD: Charge credit card without idempotency
POST /api/charges
{ "amount": 10000, "currency": "usd" }

// Network timeout → Developer retries
POST /api/charges
{ "amount": 10000, "currency": "usd" }

// Result: Customer charged TWICE! $100 duplicate charge
```

**Why This Fails:**
- **Duplicate charges** ($847M prevented by Stripe with idempotency)
- **Data corruption** (duplicate orders, inventory issues)
- **Customer complaints** (refund requests, support tickets)

---

## 💡 Paradigm Shift

> **"The best API is so intuitive, developers don't need documentation."**

**Stripe's Philosophy:**
- **Consistency** > clever naming
- **Clarity** > brevity
- **Developer experience** = competitive advantage

**The Pattern:**
```
GET    /v1/{resource}          → List all
GET    /v1/{resource}/{id}     → Get one
POST   /v1/{resource}          → Create
PUT    /v1/{resource}/{id}     → Update (full replacement)
PATCH  /v1/{resource}/{id}     → Update (partial)
DELETE /v1/{resource}/{id}     → Delete
```

---

## ✅ The Solution: Stripe-Quality REST API

### **1. Resource Naming Conventions**

```javascript
// ✅ CORRECT: Plural nouns, hierarchical relationships

// Collections (plural)
GET    /v1/customers
POST   /v1/customers

// Individual resources
GET    /v1/customers/cus_123
PUT    /v1/customers/cus_123
DELETE /v1/customers/cus_123

// Nested resources (use parent ID in URL)
GET    /v1/customers/cus_123/subscriptions
POST   /v1/customers/cus_123/subscriptions
GET    /v1/customers/cus_123/subscriptions/sub_456

// Filters (query params, not URLs)
GET /v1/customers?email=alice@example.com
GET /v1/charges?limit=100&starting_after=ch_123
```

**Naming Rules:**
- ✅ Use **plural nouns** (`/customers`, not `/customer`)
- ✅ Use **lowercase** (`/v1/payment-methods`, not `/v1/PaymentMethods`)
- ✅ Use **hyphens** for multi-word resources (`/payment-methods`, not `/paymentMethods`)
- ✅ **Nest resources** max 2 levels deep (`/customers/{id}/subscriptions`)
- ✅ Use **query params** for filtering, sorting, pagination

---

### **2. HTTP Methods & Status Codes**

```javascript
// Express.js implementation
const express = require('express');
const app = express();

// GET: Retrieve resources (safe, idempotent, cacheable)
app.get('/v1/customers/:id', async (req, res) => {
  const customer = await db.customers.findById(req.params.id);

  if (!customer) {
    return res.status(404).json({
      error: {
        type: 'not_found',
        message: 'No such customer: cus_123',
        param: 'id'
      }
    });
  }

  res.status(200).json(customer);  // 200 OK
});

// POST: Create new resource (not idempotent unless using idempotency key)
app.post('/v1/customers', async (req, res) => {
  // Validation
  if (!req.body.email) {
    return res.status(400).json({
      error: {
        type: 'invalid_request_error',
        message: 'Missing required param: email',
        param: 'email'
      }
    });
  }

  // Check idempotency key (retry safety)
  const idempotencyKey = req.headers['idempotency-key'];
  if (idempotencyKey) {
    const existing = await db.idempotency.get(idempotencyKey);
    if (existing) {
      return res.status(200).json(existing.response);  // Return cached response
    }
  }

  // Create customer
  const customer = await db.customers.create({
    email: req.body.email,
    name: req.body.name
  });

  // Cache response for idempotency
  if (idempotencyKey) {
    await db.idempotency.set(idempotencyKey, { response: customer }, { ttl: 86400 });
  }

  res.status(201).json(customer);  // 201 Created
});

// PUT: Full replacement (idempotent)
app.put('/v1/customers/:id', async (req, res) => {
  const customer = await db.customers.findByIdAndUpdate(
    req.params.id,
    req.body,  // Replace entire document
    { new: true, overwrite: true }
  );

  res.status(200).json(customer);  // 200 OK
});

// PATCH: Partial update (idempotent)
app.patch('/v1/customers/:id', async (req, res) => {
  const customer = await db.customers.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },  // Update only provided fields
    { new: true }
  );

  res.status(200).json(customer);  // 200 OK
});

// DELETE: Remove resource (idempotent)
app.delete('/v1/customers/:id', async (req, res) => {
  await db.customers.findByIdAndDelete(req.params.id);

  res.status(204).send();  // 204 No Content
});
```

**HTTP Status Codes (Use Correctly!):**

| Code | Meaning | When to Use |
|------|---------|-------------|
| **200** | OK | Successful GET, PUT, PATCH |
| **201** | Created | Successful POST (resource created) |
| **204** | No Content | Successful DELETE |
| **400** | Bad Request | Invalid parameters, validation errors |
| **401** | Unauthorized | Missing or invalid authentication |
| **403** | Forbidden | Valid auth, but no permission |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate resource, version conflict |
| **422** | Unprocessable Entity | Semantic errors (e.g., invalid card number) |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server-side bugs |
| **503** | Service Unavailable | Database down, maintenance |

---

### **3. Error Handling (Stripe Standard)**

```javascript
// Error response format
{
  "error": {
    "type": "invalid_request_error",     // Error category
    "message": "Invalid email address",   // Human-readable message
    "param": "email",                     // Which parameter caused error
    "code": "invalid_email",              // Machine-readable code
    "doc_url": "https://docs.example.com/errors/invalid_email"  // Help link
  }
}

// Implementation
class APIError extends Error {
  constructor(type, message, param = null, code = null, statusCode = 400) {
    super(message);
    this.type = type;
    this.param = param;
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      error: {
        type: this.type,
        message: this.message,
        ...(this.param && { param: this.param }),
        ...(this.code && { code: this.code }),
        doc_url: `https://docs.example.com/errors/${this.code}`
      }
    };
  }
}

// Usage in routes
app.post('/v1/charges', async (req, res, next) => {
  try {
    // Validation
    if (!req.body.amount || req.body.amount <= 0) {
      throw new APIError(
        'invalid_request_error',
        'Amount must be a positive integer',
        'amount',
        'invalid_amount',
        400
      );
    }

    // Business logic error
    const balance = await getBalance(req.body.source);
    if (balance < req.body.amount) {
      throw new APIError(
        'card_error',
        'Your card has insufficient funds',
        'source',
        'insufficient_funds',
        402  // Payment Required
      );
    }

    // Success
    const charge = await createCharge(req.body);
    res.status(201).json(charge);

  } catch (error) {
    next(error);  // Pass to error handler
  }
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Unexpected errors (log for debugging, don't expose details)
  console.error('Unexpected error:', err);

  res.status(500).json({
    error: {
      type: 'api_error',
      message: 'An unexpected error occurred. Please try again.'
    }
  });
});
```

**Error Types (Stripe Convention):**
- `invalid_request_error` - Client sent bad data
- `api_error` - Server-side issue (our fault)
- `card_error` - Payment declined, insufficient funds
- `rate_limit_error` - Too many requests
- `authentication_error` - Invalid API key

---

### **4. Pagination (Cursor-Based)**

```javascript
// ✅ CORRECT: Cursor-based pagination (consistent results)
GET /v1/customers?limit=100&starting_after=cus_123

// Response
{
  "object": "list",
  "data": [
    { "id": "cus_124", "email": "alice@example.com", ... },
    { "id": "cus_125", "email": "bob@example.com", ... }
  ],
  "has_more": true,
  "url": "/v1/customers"
}

// Implementation
app.get('/v1/customers', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);  // Default 10, max 100
  const startingAfter = req.query.starting_after;

  const query = {};
  if (startingAfter) {
    query._id = { $gt: startingAfter };  // MongoDB: IDs after cursor
  }

  const customers = await db.customers
    .find(query)
    .sort({ _id: 1 })
    .limit(limit + 1);  // Fetch +1 to check if more exist

  const hasMore = customers.length > limit;
  if (hasMore) customers.pop();  // Remove extra item

  res.json({
    object: 'list',
    data: customers,
    has_more: hasMore,
    url: '/v1/customers'
  });
});
```

**Why Cursor-Based > Offset-Based:**
- ✅ **Consistent results** (offset skips items if new data inserted)
- ✅ **Better performance** (databases optimize cursor queries)
- ✅ **No deep pagination issues** (offset 1,000,000 is slow)

---

### **5. Idempotency (Retry Safety)**

```javascript
// Client sends idempotency key to prevent duplicates
POST /v1/charges
Headers: { "Idempotency-Key": "unique_key_abc123" }
Body: { "amount": 10000, "currency": "usd" }

// If request times out, client retries with SAME key
POST /v1/charges
Headers: { "Idempotency-Key": "unique_key_abc123" }  // ← Same key!
Body: { "amount": 10000, "currency": "usd" }

// Server returns CACHED response (no duplicate charge!)

// Implementation
const idempotencyCache = new Map();  // Use Redis in production

app.post('/v1/charges', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({
      error: {
        type: 'invalid_request_error',
        message: 'Idempotency-Key header is required for this endpoint',
        param: 'idempotency_key'
      }
    });
  }

  // Check if we've seen this key before
  if (idempotencyCache.has(idempotencyKey)) {
    const cachedResponse = idempotencyCache.get(idempotencyKey);
    console.log('Returning cached response for idempotency key:', idempotencyKey);
    return res.status(cachedResponse.status).json(cachedResponse.body);
  }

  try {
    // Process charge
    const charge = await createCharge(req.body);

    // Cache response (24-hour TTL)
    const responseData = { status: 201, body: charge };
    idempotencyCache.set(idempotencyKey, responseData);
    setTimeout(() => idempotencyCache.delete(idempotencyKey), 86400000);  // 24 hours

    res.status(201).json(charge);

  } catch (error) {
    // Cache error responses too!
    const errorData = { status: error.statusCode || 500, body: error.toJSON() };
    idempotencyCache.set(idempotencyKey, errorData);
    setTimeout(() => idempotencyCache.delete(idempotencyKey), 86400000);

    throw error;
  }
});
```

**Idempotency Best Practices:**
- ✅ Use **UUID v4** for idempotency keys (client-generated)
- ✅ Store **24-hour cache** (balance between safety and storage)
- ✅ Cache **both success and error responses**
- ✅ **Require** idempotency keys for dangerous operations (payments, orders)

---

### **6. API Versioning**

```javascript
// ✅ CORRECT: URL versioning (explicit, cacheable)
GET /v1/customers/cus_123  // Current version
GET /v2/customers/cus_123  // New version (different response shape)

// Implementation
const app = express();

// v1 routes (deprecated but still supported)
const v1Router = express.Router();
v1Router.get('/customers/:id', (req, res) => {
  // Old response format
  res.json({
    id: 'cus_123',
    email: 'alice@example.com',
    full_name: 'Alice Smith'  // ← v1 field
  });
});
app.use('/v1', v1Router);

// v2 routes (current version)
const v2Router = express.Router();
v2Router.get('/customers/:id', (req, res) => {
  // New response format
  res.json({
    id: 'cus_123',
    email: 'alice@example.com',
    name: {  // ← v2 nested object
      first: 'Alice',
      last: 'Smith'
    }
  });
});
app.use('/v2', v2Router);

// Support sunset headers
app.use('/v1', (req, res, next) => {
  res.setHeader('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');  // v1 will be removed
  res.setHeader('Deprecation', 'true');
  next();
});
```

**Versioning Strategies:**
- ✅ **URL versioning** (`/v1/`, `/v2/`) - Stripe, Twilio (best for caching)
- ⚠️ **Header versioning** (`Accept: application/vnd.api+json;version=2`) - GitHub
- ❌ **Query param** (`/customers?version=2`) - Hard to cache, ugly

**Stripe's Approach:**
- **Major versions** in URL (`/v1/`)
- **Minor changes** via API version header (`Stripe-Version: 2023-10-16`)
- **Backwards compatibility** for years (v1 still works from 2015!)

---

### **7. Rate Limiting**

```javascript
// Rate limit headers (Stripe standard)
HTTP/1.1 200 OK
X-RateLimit-Limit: 100           // Max requests per window
X-RateLimit-Remaining: 73        // Requests left in window
X-RateLimit-Reset: 1640995200    // Unix timestamp when limit resets
Retry-After: 60                  // Seconds until retry (on 429)

// Implementation (using express-rate-limit)
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis();

const limiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:'
  }),
  windowMs: 60 * 1000,  // 1 minute
  max: 100,             // 100 requests per minute
  message: {
    error: {
      type: 'rate_limit_error',
      message: 'Too many requests. Please try again in 60 seconds.',
      code: 'rate_limit_exceeded'
    }
  },
  statusCode: 429,
  headers: true  // Send X-RateLimit-* headers
});

app.use('/v1', limiter);

// Different limits for different endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,  // Only 10 charges per minute
  message: { error: { type: 'rate_limit_error', message: 'Charge rate limit exceeded' } }
});

app.post('/v1/charges', strictLimiter, async (req, res) => {
  // Handle charge
});
```

**Rate Limiting Tiers:**
- **Free tier:** 100 req/min
- **Paid tier:** 1,000 req/min
- **Enterprise:** 10,000 req/min
- **Burst allowance:** 2x limit for 10 seconds

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
      POSTGRES_URL: postgres://postgres:postgres@postgres:5432/api_db
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: api_db
    volumes:
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### **Dockerfile**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### **server.js** (Complete Implementation)
```javascript
const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Database connections
const db = new Pool({ connectionString: process.env.POSTGRES_URL });
const redis = new Redis(process.env.REDIS_URL);

// Rate limiter
const limiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:' }),
  windowMs: 60 * 1000,
  max: 100,
  headers: true
});
app.use('/v1', limiter);

// Error classes
class APIError extends Error {
  constructor(type, message, param = null, code = null, statusCode = 400) {
    super(message);
    this.type = type;
    this.param = param;
    this.code = code;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      error: {
        type: this.type,
        message: this.message,
        ...(this.param && { param: this.param }),
        ...(this.code && { code: this.code })
      }
    };
  }
}

// Idempotency middleware
async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key) {
    return next(new APIError('invalid_request_error', 'Idempotency-Key required', 'idempotency_key', null, 400));
  }

  const cached = await redis.get(`idem:${key}`);
  if (cached) {
    const data = JSON.parse(cached);
    return res.status(data.status).json(data.body);
  }

  // Store original send function
  const originalSend = res.send.bind(res);
  res.send = function(body) {
    // Cache response
    redis.setex(`idem:${key}`, 86400, JSON.stringify({
      status: res.statusCode,
      body: typeof body === 'string' ? JSON.parse(body) : body
    }));

    return originalSend(body);
  };

  next();
}

// Routes
app.get('/v1/customers', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const startingAfter = req.query.starting_after;

    let query = 'SELECT * FROM customers';
    const params = [];

    if (startingAfter) {
      query += ' WHERE id > $1';
      params.push(startingAfter);
    }

    query += ' ORDER BY id ASC LIMIT $' + (params.length + 1);
    params.push(limit + 1);

    const result = await db.query(query, params);
    const hasMore = result.rows.length > limit;
    if (hasMore) result.rows.pop();

    res.json({
      object: 'list',
      data: result.rows,
      has_more: hasMore,
      url: '/v1/customers'
    });
  } catch (error) {
    next(error);
  }
});

app.get('/v1/customers/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      throw new APIError('not_found', `No such customer: ${req.params.id}`, 'id', 'resource_missing', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/v1/customers', idempotency, async (req, res, next) => {
  try {
    if (!req.body.email) {
      throw new APIError('invalid_request_error', 'Missing required param: email', 'email', 'missing_param', 400);
    }

    const result = await db.query(
      'INSERT INTO customers (email, name, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [req.body.email, req.body.name || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch('/v1/customers/:id', async (req, res, next) => {
  try {
    const updates = [];
    const values = [];
    let i = 1;

    if (req.body.email) {
      updates.push(`email = $${i++}`);
      values.push(req.body.email);
    }
    if (req.body.name) {
      updates.push(`name = $${i++}`);
      values.push(req.body.name);
    }

    if (updates.length === 0) {
      throw new APIError('invalid_request_error', 'No fields to update', null, 'no_updates', 400);
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new APIError('not_found', `No such customer: ${req.params.id}`, 'id', 'resource_missing', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/v1/customers/:id', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      throw new APIError('not_found', `No such customer: ${req.params.id}`, 'id', 'resource_missing', 404);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    error: {
      type: 'api_error',
      message: 'An unexpected error occurred'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
```

### **init.sql**
```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sample data
INSERT INTO customers (email, name) VALUES
  ('alice@example.com', 'Alice Smith'),
  ('bob@example.com', 'Bob Johnson'),
  ('charlie@example.com', 'Charlie Brown');
```

### **Run the POC**
```bash
# Start services
docker-compose up -d

# Test endpoints
# List customers
curl http://localhost:3000/v1/customers

# Get customer
curl http://localhost:3000/v1/customers/1

# Create customer (with idempotency)
curl -X POST http://localhost:3000/v1/customers \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Update customer
curl -X PATCH http://localhost:3000/v1/customers/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Johnson"}'

# Delete customer
curl -X DELETE http://localhost:3000/v1/customers/1

# Test rate limiting (send 101 requests)
for i in {1..101}; do
  curl http://localhost:3000/v1/customers
done
# Last request returns 429 Too Many Requests
```

---

## 🏆 Key Takeaways

### **The Stripe Standard**

1. **Predictable URLs**
   - Plural nouns, hierarchical resources
   - Use query params for filters/pagination

2. **Clear errors**
   - Include type, message, param, code
   - Link to documentation

3. **Idempotency**
   - Required for non-idempotent operations
   - 24-hour cache window

4. **Versioning**
   - URL versioning for major changes
   - Backwards compatibility for years

5. **Rate limiting**
   - Return X-RateLimit-* headers
   - Different limits per endpoint

---

## 🚀 Real-World Impact

**Stripe:**
- **99.999% uptime** (5 min/year downtime)
- **$95B payment volume** processed (2023)
- **$847M duplicates prevented** with idempotency
- **Developer NPS: 73** (industry average: 30)

**Twilio:**
- **RESTful API** = competitive advantage
- **10 million developers** use their API
- **$3.8B revenue** (2022)

**GitHub:**
- **15 billion+ API calls/day**
- **99.95% uptime** for REST API
- **v3 API** still supported since 2012 (backwards compatibility)

---

## 🎯 Next Steps

1. **Follow Stripe's patterns** (copy what works)
2. **Implement idempotency** for dangerous operations
3. **Add comprehensive error messages** (save developer time)
4. **Use cursor-based pagination** (consistent results)
5. **Version your API** (never break existing clients)

**Up Next:** Week 2 Day 5 - Caching strategies + POCs

---

## 📚 References

- [Stripe API Design Best Practices](https://stripe.com/docs/api)
- [REST API Tutorial](https://restfulapi.net/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [Idempotency in APIs](https://stripe.com/blog/idempotency)
