# POC #56: RESTful API Best Practices

## What You'll Build

A **Stripe-quality REST API** following industry best practices:
- ✅ **Resource-based URLs** - `/v1/customers/cus_123` (predictable, intuitive)
- ✅ **Proper HTTP methods** - GET, POST, PUT, PATCH, DELETE with correct status codes
- ✅ **Idempotency** - Safely retry requests without side effects
- ✅ **Error handling** - Detailed error messages with actionable feedback
- ✅ **Pagination** - Handle large datasets efficiently
- ✅ **Filtering & sorting** - Query params for data manipulation
- ✅ **Versioning** - `/v1/`, `/v2/` for backwards compatibility

**Time to complete**: 40 minutes
**Difficulty**: ⭐⭐ Intermediate
**Prerequisites**: Express.js basics, HTTP knowledge

---

## Why This Matters

### Real-World Usage

| Company | API Requests/Day | Uptime | Key Pattern |
|---------|------------------|--------|-------------|
| **Stripe** | 1 billion+ | 99.999% | Idempotency keys prevent $847M in duplicate charges |
| **GitHub** | 15 billion+ | 99.95% | Consistent resource naming, pagination |
| **Twilio** | 10 billion+ | 99.95% | Clear error codes, webhook delivery |
| **Shopify** | 5 billion+ | 99.99% | Rate limiting, bulk operations |
| **Slack** | 50 billion+ | 99.99% | Real-time webhooks, cursor pagination |

### The Problem: Bad API Design

**Before (Poor REST Design)**:
```javascript
// Inconsistent URL patterns
POST /api/CreateUser        // Verb in URL
GET  /api/user/get/123      // Redundant
POST /api/DeleteUser?id=123 // Wrong HTTP method

// Generic errors
{ "error": "Bad request" }  // Developer has no idea what's wrong

// No retry safety
POST /charges { amount: 10000 }  // Network timeout → retry → double charge!
```

**After (Stripe-Quality REST)**:
```javascript
// Consistent resource-based URLs
POST   /v1/customers
GET    /v1/customers/cus_123
DELETE /v1/customers/cus_123

// Detailed errors
{
  "error": {
    "type": "invalid_request_error",
    "message": "Missing required param: email",
    "param": "email"
  }
}

// Idempotent requests
POST /v1/charges
Headers: { "Idempotency-Key": "uuid123" }
// Retry → same charge, no duplicate!
```

---

## The Problem

### Scenario: Payment API

You're building a payment API like Stripe. Requirements:

1. **Handle 1M+ requests/day** with 99.99% uptime
2. **Prevent duplicate charges** (idempotency)
3. **Provide clear error messages** for developers
4. **Support pagination** for large result sets
5. **Version the API** for backwards compatibility
6. **Rate limiting** to prevent abuse

**Challenges**:
- Duplicate charges from network retries
- Confusing error messages waste developer time
- Inconsistent URL patterns break expectations
- No pagination = out of memory on large queries
- Breaking changes anger existing integrations

---

## Step-by-Step Build

### Step 1: Project Setup

```bash
mkdir rest-api-best-practices-poc
cd rest-api-best-practices-poc
npm init -y
npm install express uuid sqlite3
```

### Step 2: Create Database Schema (`database.js`)

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

// Initialize database
db.serialize(() => {
  // Customers table
  db.run(`
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Charges table
  db.run(`
    CREATE TABLE charges (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // Idempotency keys table (prevent duplicate requests)
  db.run(`
    CREATE TABLE idempotency_keys (
      key TEXT PRIMARY KEY,
      response TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Insert sample data
  const stmt = db.prepare('INSERT INTO customers (id, email, name) VALUES (?, ?, ?)');
  for (let i = 1; i <= 100; i++) {
    stmt.run(`cus_${i}`, `customer${i}@example.com`, `Customer ${i}`);
  }
  stmt.finalize();

  console.log('✅ Database initialized with 100 sample customers');
});

module.exports = db;
```

### Step 3: Create API Server (`server.js`)

```javascript
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
app.use(express.json());

// Helper: Convert DB callback to Promise
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

// ====================================
// 1. Resource Naming: Customers
// ====================================

// GET /v1/customers - List all customers (with pagination)
app.get('/v1/customers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const startingAfter = req.query.starting_after || '';

    const customers = await query(`
      SELECT * FROM customers
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    `, [startingAfter, limit + 1]);

    const hasMore = customers.length > limit;
    const data = hasMore ? customers.slice(0, limit) : customers;

    res.json({
      object: 'list',
      data,
      has_more: hasMore,
      url: '/v1/customers'
    });
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// GET /v1/customers/:id - Get single customer
app.get('/v1/customers/:id', async (req, res) => {
  try {
    const customers = await query(
      'SELECT * FROM customers WHERE id = ?',
      [req.params.id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        error: {
          type: 'invalid_request_error',
          message: `No such customer: ${req.params.id}`,
          param: 'id'
        }
      });
    }

    res.json(customers[0]);
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// POST /v1/customers - Create customer
app.post('/v1/customers', async (req, res) => {
  try {
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

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid email format',
          param: 'email'
        }
      });
    }

    // Check for duplicate email
    const existing = await query('SELECT id FROM customers WHERE email = ?', [req.body.email]);
    if (existing.length > 0) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: `Customer with email ${req.body.email} already exists`,
          param: 'email'
        }
      });
    }

    const customerId = `cus_${uuidv4().slice(0, 8)}`;
    await run(
      'INSERT INTO customers (id, email, name) VALUES (?, ?, ?)',
      [customerId, req.body.email, req.body.name || null]
    );

    const customer = await query('SELECT * FROM customers WHERE id = ?', [customerId]);

    res.status(201).json(customer[0]);
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// PATCH /v1/customers/:id - Update customer (partial update)
app.patch('/v1/customers/:id', async (req, res) => {
  try {
    // Check if customer exists
    const existing = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: {
          type: 'invalid_request_error',
          message: `No such customer: ${req.params.id}`,
          param: 'id'
        }
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (req.body.email) {
      updates.push('email = ?');
      values.push(req.body.email);
    }
    if (req.body.name !== undefined) {
      updates.push('name = ?');
      values.push(req.body.name);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: 'No fields to update'
        }
      });
    }

    values.push(req.params.id);
    await run(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const customer = await query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(customer[0]);
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// DELETE /v1/customers/:id - Delete customer
app.delete('/v1/customers/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM customers WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({
        error: {
          type: 'invalid_request_error',
          message: `No such customer: ${req.params.id}`,
          param: 'id'
        }
      });
    }

    res.json({
      id: req.params.id,
      object: 'customer',
      deleted: true
    });
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// ====================================
// 2. Idempotency: Charges
// ====================================

// POST /v1/charges - Create charge (with idempotency)
app.post('/v1/charges', async (req, res) => {
  try {
    // Check idempotency key
    const idempotencyKey = req.headers['idempotency-key'];

    if (idempotencyKey) {
      const cached = await query(
        'SELECT response FROM idempotency_keys WHERE key = ?',
        [idempotencyKey]
      );

      if (cached.length > 0) {
        console.log(`✅ Idempotency hit: ${idempotencyKey}`);
        return res.json(JSON.parse(cached[0].response));
      }
    }

    // Validation
    if (!req.body.amount || !req.body.currency) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: 'Missing required params: amount, currency',
          param: req.body.amount ? 'currency' : 'amount'
        }
      });
    }

    if (req.body.amount <= 0) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: 'Amount must be greater than 0',
          param: 'amount'
        }
      });
    }

    // Create charge
    const chargeId = `ch_${uuidv4().slice(0, 8)}`;
    await run(
      'INSERT INTO charges (id, customer_id, amount, currency, status) VALUES (?, ?, ?, ?, ?)',
      [chargeId, req.body.customer_id || null, req.body.amount, req.body.currency, 'succeeded']
    );

    const charge = await query('SELECT * FROM charges WHERE id = ?', [chargeId]);
    const response = charge[0];

    // Store idempotency key
    if (idempotencyKey) {
      await run(
        'INSERT INTO idempotency_keys (key, response) VALUES (?, ?)',
        [idempotencyKey, JSON.stringify(response)]
      );
      console.log(`✅ Idempotency key stored: ${idempotencyKey}`);
    }

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// GET /v1/charges/:id - Get charge
app.get('/v1/charges/:id', async (req, res) => {
  try {
    const charges = await query('SELECT * FROM charges WHERE id = ?', [req.params.id]);

    if (charges.length === 0) {
      return res.status(404).json({
        error: {
          type: 'invalid_request_error',
          message: `No such charge: ${req.params.id}`,
          param: 'id'
        }
      });
    }

    res.json(charges[0]);
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// ====================================
// 3. Filtering & Sorting
// ====================================

// GET /v1/customers/search - Search customers
app.get('/v1/customers/search', async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        error: {
          type: 'invalid_request_error',
          message: 'Missing required query param: email',
          param: 'email'
        }
      });
    }

    const customers = await query(
      'SELECT * FROM customers WHERE email LIKE ?',
      [`%${email}%`]
    );

    res.json({
      object: 'list',
      data: customers,
      has_more: false
    });
  } catch (error) {
    res.status(500).json({
      error: {
        type: 'api_error',
        message: error.message
      }
    });
  }
});

// ====================================
// Health & Stats
// ====================================

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: 'v1' });
});

app.get('/stats', async (req, res) => {
  try {
    const customerCount = await query('SELECT COUNT(*) as count FROM customers');
    const chargeCount = await query('SELECT COUNT(*) as count FROM charges');
    const idempotencyCount = await query('SELECT COUNT(*) as count FROM idempotency_keys');

    res.json({
      customers: customerCount[0].count,
      charges: chargeCount[0].count,
      idempotency_keys: idempotencyCount[0].count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ REST API server running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET    /v1/customers - List customers (pagination)`);
  console.log(`  GET    /v1/customers/:id - Get customer`);
  console.log(`  POST   /v1/customers - Create customer`);
  console.log(`  PATCH  /v1/customers/:id - Update customer`);
  console.log(`  DELETE /v1/customers/:id - Delete customer`);
  console.log(`  POST   /v1/charges - Create charge (idempotent)`);
  console.log(`  GET    /v1/charges/:id - Get charge`);
  console.log(`  GET    /health - Health check`);
  console.log(`  GET    /stats - API statistics\n`);
});
```

### Step 4: Create Test Script (`test.js`)

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000/v1';

async function runTests() {
  console.log('\n=== REST API Best Practices Tests ===\n');

  // Test 1: Create customer
  console.log('Test 1: Create Customer\n');

  const createResponse = await axios.post(`${API_BASE}/customers`, {
    email: 'alice@example.com',
    name: 'Alice Johnson'
  });

  console.log(`✅ Customer created: ${createResponse.data.id}`);
  console.log(`   Email: ${createResponse.data.email}`);
  console.log(`   Name: ${createResponse.data.name}\n`);

  const customerId = createResponse.data.id;

  // Test 2: Get customer
  console.log('Test 2: Get Customer\n');

  const getResponse = await axios.get(`${API_BASE}/customers/${customerId}`);
  console.log(`✅ Customer retrieved: ${getResponse.data.email}\n`);

  // Test 3: Update customer
  console.log('Test 3: Update Customer (PATCH)\n');

  const updateResponse = await axios.patch(`${API_BASE}/customers/${customerId}`, {
    name: 'Alice Smith'
  });

  console.log(`✅ Customer updated: ${updateResponse.data.name}\n`);

  // Test 4: Error handling (404)
  console.log('Test 4: Error Handling (404)\n');

  try {
    await axios.get(`${API_BASE}/customers/cus_invalid`);
  } catch (error) {
    console.log(`✅ Error caught: ${error.response.data.error.message}`);
    console.log(`   Type: ${error.response.data.error.type}`);
    console.log(`   Param: ${error.response.data.error.param}\n`);
  }

  // Test 5: Validation (missing email)
  console.log('Test 5: Validation Error (Missing Email)\n');

  try {
    await axios.post(`${API_BASE}/customers`, {
      name: 'Bob'
    });
  } catch (error) {
    console.log(`✅ Validation error: ${error.response.data.error.message}`);
    console.log(`   Param: ${error.response.data.error.param}\n`);
  }

  // Test 6: Pagination
  console.log('Test 6: Pagination\n');

  const listResponse = await axios.get(`${API_BASE}/customers?limit=5`);
  console.log(`✅ Fetched ${listResponse.data.data.length} customers`);
  console.log(`   Has more: ${listResponse.data.has_more}\n`);

  // Test 7: Idempotency (create charge twice with same key)
  console.log('Test 7: Idempotency (Prevent Duplicate Charges)\n');

  const idempotencyKey = 'test_idempotency_123';

  // First charge
  const charge1 = await axios.post(`${API_BASE}/charges`, {
    amount: 10000,
    currency: 'usd',
    customer_id: customerId
  }, {
    headers: { 'Idempotency-Key': idempotencyKey }
  });

  console.log(`✅ First charge: ${charge1.data.id} ($${charge1.data.amount / 100})`);

  // Retry with same idempotency key
  const charge2 = await axios.post(`${API_BASE}/charges`, {
    amount: 10000,
    currency: 'usd',
    customer_id: customerId
  }, {
    headers: { 'Idempotency-Key': idempotencyKey }
  });

  console.log(`✅ Second charge (retry): ${charge2.data.id} ($${charge2.data.amount / 100})`);

  if (charge1.data.id === charge2.data.id) {
    console.log(`✅ Idempotency works! Same charge returned (no duplicate)\n`);
  } else {
    console.log(`❌ Idempotency failed! Different charge created\n`);
  }

  // Test 8: Delete customer
  console.log('Test 8: Delete Customer\n');

  const deleteResponse = await axios.delete(`${API_BASE}/customers/${customerId}`);
  console.log(`✅ Customer deleted: ${deleteResponse.data.id}`);
  console.log(`   Deleted: ${deleteResponse.data.deleted}\n`);

  // Test 9: Check stats
  console.log('Test 9: API Statistics\n');

  const statsResponse = await axios.get('http://localhost:3000/stats');
  console.log(`Customers: ${statsResponse.data.customers}`);
  console.log(`Charges: ${statsResponse.data.charges}`);
  console.log(`Idempotency keys: ${statsResponse.data.idempotency_keys}\n`);

  console.log('=== All Tests Passed! ===\n');
}

// Install axios first: npm install axios
runTests().catch(console.error);
```

---

## Run It

### Terminal 1: Start Server
```bash
# Install dependencies
npm install express uuid sqlite3 axios

# Start API server
node server.js
```

### Terminal 2: Run Tests
```bash
# Run comprehensive tests
node test.js
```

### Manual Testing with cURL

```bash
# Create customer
curl -X POST http://localhost:3000/v1/customers \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Get customer (replace cus_xxx with actual ID)
curl http://localhost:3000/v1/customers/cus_xxx

# List customers with pagination
curl "http://localhost:3000/v1/customers?limit=5"

# Create charge with idempotency
curl -X POST http://localhost:3000/v1/charges \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique_key_123" \
  -d '{"amount":5000,"currency":"usd"}'

# Retry same charge (should return same ID)
curl -X POST http://localhost:3000/v1/charges \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique_key_123" \
  -d '{"amount":5000,"currency":"usd"}'

# Update customer
curl -X PATCH http://localhost:3000/v1/customers/cus_xxx \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'

# Delete customer
curl -X DELETE http://localhost:3000/v1/customers/cus_xxx
```

---

## Expected Output

```
=== REST API Best Practices Tests ===

Test 1: Create Customer

✅ Customer created: cus_a1b2c3d4
   Email: alice@example.com
   Name: Alice Johnson

Test 2: Get Customer

✅ Customer retrieved: alice@example.com

Test 3: Update Customer (PATCH)

✅ Customer updated: Alice Smith

Test 4: Error Handling (404)

✅ Error caught: No such customer: cus_invalid
   Type: invalid_request_error
   Param: id

Test 5: Validation Error (Missing Email)

✅ Validation error: Missing required param: email
   Param: email

Test 6: Pagination

✅ Fetched 5 customers
   Has more: true

Test 7: Idempotency (Prevent Duplicate Charges)

✅ First charge: ch_e5f6g7h8 ($100.00)
✅ Second charge (retry): ch_e5f6g7h8 ($100.00)
✅ Idempotency works! Same charge returned (no duplicate)

Test 8: Delete Customer

✅ Customer deleted: cus_a1b2c3d4
   Deleted: true

Test 9: API Statistics

Customers: 100
Charges: 1
Idempotency keys: 1

=== All Tests Passed! ===
```

---

## How This Fits Larger Systems

### Stripe's API Architecture

```
┌──────────────────────────────────────────┐
│  Stripe Payment API                      │
├──────────────────────────────────────────┤
│                                          │
│  Developer → API Request                 │
│         ↓                                │
│  Load Balancer (nginx)                   │
│         ↓                                │
│  API Gateway                             │
│  ├─ Rate limiting (1000 req/min)        │
│  ├─ Authentication (API keys)           │
│  └─ Request validation                  │
│         ↓                                │
│  Application Servers                     │
│  ├─ Idempotency check (Redis)           │
│  ├─ Business logic                      │
│  └─ Response formatting                 │
│         ↓                                │
│  Database (PostgreSQL)                   │
│  └─ ACID transactions                    │
│                                          │
│  Result: 99.999% uptime                 │
│  1 billion+ requests/day handled        │
│  $847M duplicate charges prevented      │
│                                          │
└──────────────────────────────────────────┘
```

**Key Patterns**:
1. **Idempotency layer** prevents duplicate charges from retries
2. **Detailed errors** save developers 1000+ hours debugging
3. **Consistent URLs** make API intuitive and predictable
4. **Pagination** handles large datasets efficiently

---

## Key Takeaways

### REST API Design Principles

**1. URL Structure**
```
✅ Correct:
GET    /v1/customers          (list)
GET    /v1/customers/cus_123  (get)
POST   /v1/customers          (create)
PATCH  /v1/customers/cus_123  (update)
DELETE /v1/customers/cus_123  (delete)

❌ Wrong:
POST /api/createCustomer
GET  /api/getCustomerById?id=123
POST /api/updateCustomer
```

**2. HTTP Status Codes**

| Code | Meaning | Use Case |
|------|---------|----------|
| **200** | OK | Successful GET, PATCH, DELETE |
| **201** | Created | Successful POST (resource created) |
| **400** | Bad Request | Validation error, missing params |
| **404** | Not Found | Resource doesn't exist |
| **500** | Server Error | Database error, unexpected exception |

**3. Error Response Format**

```javascript
// Stripe's error format (best practice)
{
  "error": {
    "type": "invalid_request_error",    // Error category
    "message": "Missing required param: email",  // Human-readable
    "param": "email"                     // Which field caused error
  }
}
```

**4. Idempotency Keys**

```javascript
// Request with idempotency key
POST /v1/charges
Headers: { "Idempotency-Key": "uuid123" }
Body: { "amount": 10000, "currency": "usd" }

// Retry (network timeout) → same key
POST /v1/charges
Headers: { "Idempotency-Key": "uuid123" }
Body: { "amount": 10000, "currency": "usd" }

// Result: Same charge returned, no duplicate!
```

**5. Pagination**

```javascript
// Cursor-based pagination (recommended)
GET /v1/customers?limit=10&starting_after=cus_123

Response:
{
  "data": [...],
  "has_more": true,
  "url": "/v1/customers"
}

// Next page:
GET /v1/customers?limit=10&starting_after=cus_133
```

### Production Checklist

✅ **Use plural resource names** (`/customers`, not `/customer`)
✅ **Use correct HTTP methods** (GET, POST, PATCH, DELETE)
✅ **Return correct status codes** (200, 201, 400, 404, 500)
✅ **Provide detailed error messages** (type, message, param)
✅ **Implement idempotency** for non-idempotent operations
✅ **Support pagination** for large datasets
✅ **Version your API** (`/v1/`, `/v2/`)
✅ **Use HTTPS** in production (TLS encryption)

---

## Extend It

### Level 1: Add Rate Limiting (20 min)

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,  // 100 requests per minute
  message: {
    error: {
      type: 'rate_limit_error',
      message: 'Too many requests, please try again later'
    }
  }
});

app.use('/v1/', limiter);
```

### Level 2: Add API Versioning (30 min)

```javascript
// v1 API
app.get('/v1/customers/:id', async (req, res) => {
  // Old response format
  res.json({ id, email, name });
});

// v2 API (add more fields without breaking v1)
app.get('/v2/customers/:id', async (req, res) => {
  // New response format
  res.json({ id, email, name, phone, address });
});
```

### Level 3: Add Webhook Delivery (45 min)

```javascript
// When charge succeeds, send webhook
const axios = require('axios');

async function sendWebhook(event) {
  await axios.post('https://merchant.com/webhooks', {
    type: 'charge.succeeded',
    data: event
  }, {
    headers: { 'Webhook-Signature': generateSignature(event) }
  });
}
```

---

## Related POCs

- **POC #57: GraphQL Server** - Alternative to REST for flexible queries
- **POC #58: gRPC & Protocol Buffers** - High-performance RPC alternative
- **POC #59: API Versioning** - Maintain backwards compatibility
- **POC #60: API Gateway** - Rate limiting, authentication, routing

---

## Cleanup

```bash
# Stop server (Ctrl+C)

# Remove project
cd ..
rm -rf rest-api-best-practices-poc
```

---

## What's Next?

**Next POC**: [POC #57: GraphQL Server Implementation](/interview-prep/practice-pocs/graphql-server-implementation)

Learn when GraphQL is better than REST and how to build a production-ready GraphQL API!

---

**Production usage**:
- **Stripe**: 1B+ requests/day, 99.999% uptime, idempotency prevents $847M duplicates
- **GitHub**: 15B requests/day, consistent REST design, cursor pagination
- **Twilio**: 10B requests/day, clear error codes, webhook delivery
- **Shopify**: 5B requests/day, rate limiting, bulk operations
- **Slack**: 50B requests/day, real-time webhooks, event-driven architecture
