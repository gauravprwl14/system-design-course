---
title: Integration Testing Patterns
layer: poc
section: interview-prep/practice-pocs
difficulty: intermediate
prerequisites:
  - system-design/scalability/microservices-architecture
solves_with: []
related_problems: []
case_studies: []
see_poc: []
linked_from: []
tags:
  - integration-testing
  - docker
  - testcontainers
  - api-testing
  - end-to-end
---

# POC #95: Integration Testing Patterns

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Node.js, Docker basics, Testing fundamentals

## 🗺️ Quick Overview

```mermaid
graph TD
    Suite["Test Suite\nbeforeAll / afterAll / beforeEach"] --> Infra["Test Infrastructure\nDocker containers"]
    Infra --> Postgres["PostgreSQL\n(real DB)"]
    Infra --> Redis["Redis\n(real cache)"]
    Suite --> App["App Under Test\nOrderService"]
    App --> Postgres
    App --> Redis
    App --> Mock["External Service Mock\nPaymentAPI"]
    Suite -->|"assert side effects"| Assertions["Verify DB rows\nVerify cache keys\nVerify mock calls"]
```

*Spin up real dependencies in containers, wire the app to them, then assert end-to-end behavior.*

## What You'll Learn

Integration tests verify that multiple components work together correctly. This covers testing APIs, databases, external services, and message queues as a system.

```
INTEGRATION TESTING SCOPE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  UNIT TEST          INTEGRATION TEST        E2E TEST            │
│  ─────────          ────────────────        ────────            │
│                                                                 │
│  ┌───────┐          ┌───────────────┐       ┌───────────────┐  │
│  │Service│          │ API + DB +    │       │ Full App +    │  │
│  │ Only  │          │ Cache + Queue │       │ Browser + UI  │  │
│  └───────┘          └───────────────┘       └───────────────┘  │
│                                                                 │
│  Mocked deps        Real deps (Docker)      Real everything    │
│  Milliseconds       Seconds                 Minutes            │
│  Many tests         Some tests              Few tests          │
│                                                                 │
│  INTEGRATION TEST COMPONENTS:                                   │
│  ─────────────────────────────                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Test Container                        │   │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌───────┐  ┌─────────┐     │   │
│  │  │ API │──│ DB  │──│Redis│──│ Kafka │──│ External│     │   │
│  │  └─────┘  └─────┘  └─────┘  └───────┘  │  Mock   │     │   │
│  │                                         └─────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// integration-testing.js

// ==========================================
// TEST INFRASTRUCTURE
// ==========================================

class TestInfrastructure {
  constructor() {
    this.services = new Map();
    this.startedServices = [];
  }

  // Register a service
  register(name, config) {
    this.services.set(name, {
      name,
      config,
      instance: null,
      started: false
    });
    return this;
  }

  // Start all services
  async startAll() {
    console.log('🚀 Starting test infrastructure...\n');

    for (const [name, service] of this.services) {
      await this.start(name);
    }

    console.log('\n✅ All services started');
    return this;
  }

  async start(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Unknown service: ${name}`);
    if (service.started) return service.instance;

    console.log(`   Starting ${name}...`);

    // Simulate Docker container startup
    service.instance = await this.createInstance(service.config);
    service.started = true;
    this.startedServices.push(name);

    return service.instance;
  }

  async createInstance(config) {
    // In real code: use testcontainers or docker-compose
    await new Promise(r => setTimeout(r, 100));  // Simulate startup

    switch (config.type) {
      case 'postgres':
        return new MockPostgres(config);
      case 'redis':
        return new MockRedis(config);
      case 'api':
        return new MockAPI(config);
      default:
        throw new Error(`Unknown service type: ${config.type}`);
    }
  }

  // Stop all services
  async stopAll() {
    console.log('\n🛑 Stopping test infrastructure...');

    for (const name of this.startedServices.reverse()) {
      const service = this.services.get(name);
      if (service?.instance?.stop) {
        await service.instance.stop();
      }
      service.started = false;
    }

    this.startedServices = [];
    console.log('✅ All services stopped');
  }

  get(name) {
    return this.services.get(name)?.instance;
  }
}

// ==========================================
// MOCK SERVICES (Simplified)
// ==========================================

class MockPostgres {
  constructor(config) {
    this.config = config;
    this.data = new Map();
    this.port = config.port || 5432;
  }

  async query(sql, params = []) {
    // Simplified mock implementation
    return { rows: [], rowCount: 0 };
  }

  async stop() {
    console.log(`   Stopping PostgreSQL on port ${this.port}`);
  }
}

class MockRedis {
  constructor(config) {
    this.config = config;
    this.data = new Map();
    this.port = config.port || 6379;
  }

  async get(key) {
    return this.data.get(key);
  }

  async set(key, value, options = {}) {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key) {
    return this.data.delete(key) ? 1 : 0;
  }

  async stop() {
    console.log(`   Stopping Redis on port ${this.port}`);
  }
}

class MockAPI {
  constructor(config) {
    this.config = config;
    this.port = config.port || 3000;
    this.routes = new Map();
    this.requests = [];
  }

  route(method, path, handler) {
    this.routes.set(`${method}:${path}`, handler);
  }

  async request(method, path, options = {}) {
    const key = `${method}:${path}`;
    const handler = this.routes.get(key);

    this.requests.push({ method, path, options, timestamp: Date.now() });

    if (handler) {
      return handler(options);
    }

    return { status: 404, body: { error: 'Not found' } };
  }

  getRequests() {
    return this.requests;
  }

  clearRequests() {
    this.requests = [];
  }

  async stop() {
    console.log(`   Stopping API on port ${this.port}`);
  }
}

// ==========================================
// APPLICATION UNDER TEST
// ==========================================

class OrderService {
  constructor(db, cache, paymentClient) {
    this.db = db;
    this.cache = cache;
    this.paymentClient = paymentClient;
  }

  async createOrder(userId, items) {
    // Calculate total
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Check user in cache first
    let user = await this.cache.get(`user:${userId}`);
    if (!user) {
      // Fetch from DB (simplified)
      user = { id: userId, name: 'Test User' };
      await this.cache.set(`user:${userId}`, JSON.stringify(user), { ex: 300 });
    }

    // Process payment
    const payment = await this.paymentClient.request('POST', '/payments', {
      body: { userId, amount: total }
    });

    if (payment.status !== 200) {
      throw new Error('Payment failed');
    }

    // Create order
    const orderId = `ord_${Date.now()}`;
    const order = {
      id: orderId,
      userId,
      items,
      total,
      paymentId: payment.body.paymentId,
      status: 'confirmed',
      createdAt: new Date()
    };

    // Save to DB (simplified)
    await this.db.query(
      'INSERT INTO orders (id, user_id, total, status) VALUES ($1, $2, $3, $4)',
      [order.id, order.userId, order.total, order.status]
    );

    // Invalidate cache
    await this.cache.del(`orders:${userId}`);

    return order;
  }

  async getOrder(orderId) {
    // Try cache first
    const cached = await this.cache.get(`order:${orderId}`);
    if (cached) return JSON.parse(cached);

    // Fetch from DB
    const result = await this.db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (result.rows.length > 0) {
      await this.cache.set(`order:${orderId}`, JSON.stringify(result.rows[0]), { ex: 300 });
      return result.rows[0];
    }

    return null;
  }
}

// ==========================================
// INTEGRATION TEST SUITE
// ==========================================

class IntegrationTestSuite {
  constructor(infrastructure) {
    this.infrastructure = infrastructure;
    this.tests = [];
    this.results = [];
    this.beforeAllFn = null;
    this.afterAllFn = null;
    this.beforeEachFn = null;
    this.afterEachFn = null;
  }

  beforeAll(fn) { this.beforeAllFn = fn; }
  afterAll(fn) { this.afterAllFn = fn; }
  beforeEach(fn) { this.beforeEachFn = fn; }
  afterEach(fn) { this.afterEachFn = fn; }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🧪 Running integration tests...\n');

    if (this.beforeAllFn) await this.beforeAllFn();

    for (const test of this.tests) {
      try {
        if (this.beforeEachFn) await this.beforeEachFn();

        await test.fn();

        if (this.afterEachFn) await this.afterEachFn();

        this.results.push({ name: test.name, passed: true });
        console.log(`  ✅ ${test.name}`);
      } catch (error) {
        this.results.push({ name: test.name, passed: false, error: error.message });
        console.log(`  ❌ ${test.name}`);
        console.log(`     ${error.message}`);
      }
    }

    if (this.afterAllFn) await this.afterAllFn();

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    return { passed, failed };
  }
}

// Assertion helper
function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ==========================================
// EXTERNAL SERVICE MOCK
// ==========================================

class ExternalServiceMock {
  constructor() {
    this.responses = new Map();
    this.requests = [];
  }

  // Configure mock response
  when(method, path) {
    const key = `${method}:${path}`;
    return {
      respond: (response) => {
        this.responses.set(key, response);
      }
    };
  }

  // Handle request
  async request(method, path, options = {}) {
    const key = `${method}:${path}`;
    this.requests.push({ method, path, options });

    const response = this.responses.get(key);
    if (response) {
      if (typeof response === 'function') {
        return response(options);
      }
      return response;
    }

    return { status: 500, body: { error: 'Not mocked' } };
  }

  // Verify requests were made
  verify(method, path, times = 1) {
    const count = this.requests.filter(
      r => r.method === method && r.path === path
    ).length;

    if (count !== times) {
      throw new Error(
        `Expected ${times} calls to ${method} ${path}, got ${count}`
      );
    }
  }

  reset() {
    this.requests = [];
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('INTEGRATION TESTING PATTERNS');
  console.log('='.repeat(60));

  // Setup infrastructure
  const infra = new TestInfrastructure()
    .register('postgres', { type: 'postgres', port: 5433 })
    .register('redis', { type: 'redis', port: 6380 })
    .register('api', { type: 'api', port: 3001 });

  await infra.startAll();

  // Get service instances
  const db = infra.get('postgres');
  const cache = infra.get('redis');

  // Create payment service mock
  const paymentMock = new ExternalServiceMock();
  paymentMock.when('POST', '/payments').respond({
    status: 200,
    body: { paymentId: 'pay_123', status: 'success' }
  });

  // Create service under test
  const orderService = new OrderService(db, cache, paymentMock);

  // Create test suite
  const suite = new IntegrationTestSuite(infra);

  suite.beforeEach(() => {
    paymentMock.reset();
    cache.data.clear();
  });

  // Test: Create order flow
  suite.test('creates order with payment processing', async () => {
    const order = await orderService.createOrder('user-123', [
      { name: 'Item 1', price: 50, quantity: 2 }
    ]);

    assert(order.id, 'Order should have an ID');
    assert(order.total === 100, 'Total should be 100');
    assert(order.status === 'confirmed', 'Status should be confirmed');
    assert(order.paymentId === 'pay_123', 'Should have payment ID');

    // Verify payment service was called
    paymentMock.verify('POST', '/payments', 1);
  });

  // Test: Caching behavior
  suite.test('caches user data after first fetch', async () => {
    await orderService.createOrder('user-456', [
      { name: 'Item', price: 25, quantity: 1 }
    ]);

    const cachedUser = await cache.get('user:user-456');
    assert(cachedUser, 'User should be cached');
  });

  // Test: Payment failure handling
  suite.test('handles payment failure gracefully', async () => {
    paymentMock.when('POST', '/payments').respond({
      status: 400,
      body: { error: 'Insufficient funds' }
    });

    let error = null;
    try {
      await orderService.createOrder('user-789', [
        { name: 'Item', price: 1000, quantity: 1 }
      ]);
    } catch (e) {
      error = e;
    }

    assert(error !== null, 'Should throw error');
    assert(error.message === 'Payment failed', 'Error message should match');
  });

  // Test: Cache invalidation
  suite.test('invalidates order cache after creation', async () => {
    await cache.set('orders:user-100', JSON.stringify([{ id: 'old' }]));

    await orderService.createOrder('user-100', [
      { name: 'Item', price: 10, quantity: 1 }
    ]);

    const cachedOrders = await cache.get('orders:user-100');
    assert(!cachedOrders, 'Orders cache should be invalidated');
  });

  // Run tests
  await suite.run();

  // Cleanup
  await infra.stopAll();

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Docker Compose for Integration Tests

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  kafka:
    image: confluentinc/cp-kafka:7.0.0
    ports:
      - "9093:9093"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
```

---

## Test Categories

| Category | Focus | Example |
|----------|-------|---------|
| **API Integration** | HTTP endpoints | Create order → 201 |
| **Database Integration** | CRUD + queries | Insert + select works |
| **Cache Integration** | Cache hit/miss | Redis caching |
| **Message Queue** | Pub/sub flow | Event published |
| **External Services** | 3rd party APIs | Payment gateway |

---

## Best Practices

```
✅ DO:
├── Use Docker for dependencies
├── Reset state between tests
├── Mock external services
├── Test error scenarios
├── Verify side effects
└── Use meaningful assertions

❌ DON'T:
├── Share state between tests
├── Test implementation details
├── Skip cleanup
├── Use production services
├── Over-mock internals
└── Ignore timing issues
```

---

## ⚡ Quick Reference Implementation

```javascript
// Minimal integration test structure — copy-paste template
class IntegrationTest {
  static async setup() {
    // Start real dependencies once per suite
    this.db = await PostgresContainer.start({ image: 'postgres:15' });
    this.redis = await RedisContainer.start({ image: 'redis:7' });
    this.app = createApp({ db: this.db.client, cache: this.redis.client });
    await migrate(this.db.client);  // Run DB migrations
  }

  static async teardown() {
    await this.db.stop();
    await this.redis.stop();
  }

  static async resetBetweenTests() {
    await this.db.client.query('TRUNCATE orders, users CASCADE');
    await this.redis.client.flushdb();
  }
}
```

---

## 🎯 Interview Questions

### Implementation-Focused Interview Questions

#### Q1: How do you structure integration tests so they're fast and isolated?

**What interviewers look for**: Test lifecycle management, shared vs. per-test infrastructure, and state isolation.

**Answer framework**:
1. **Start containers once per suite** (not per test): Docker startup is slow (2-5s per container); use `beforeAll`/`afterAll` for container lifecycle
2. **Reset state between tests**: truncate tables or use transactions that roll back; never share state across tests
3. **Parallelize suites, not tests within a suite**: run multiple test suites (files) in parallel with separate DB instances; within a suite, run tests sequentially to avoid interference
4. **Fast assertions**: assert on side effects (DB row inserted, cache key set, mock called) — not on timing or order of async events

**Code snippet that impresses**:
```javascript
// Jest example: containers started once, state reset between each test
beforeAll(async () => {
  db = await startPostgresContainer();  // ~3s startup, amortized across all tests
  await runMigrations(db);
});

beforeEach(async () => {
  await db.query('BEGIN');  // Wrap each test in a transaction
});

afterEach(async () => {
  await db.query('ROLLBACK');  // Discard all changes — perfect isolation
});

afterAll(() => db.stop());
```

---

#### Q2: How do you mock external services (payment gateway, SMS provider) in integration tests?

**What interviewers look for**: The difference between mocking at the network level vs. the code level, and test fidelity trade-offs.

**Answer framework**:
1. **Code-level mock** (unit test style): inject a mock object that implements the interface — fast but tests your integration only up to the boundary
2. **HTTP server mock (WireMock, msw)**: spin up a local HTTP server that mimics the external API — tests the actual HTTP client code including headers, serialization, retries
3. **Contract stubs**: use the contract pact file to generate a mock — ensures the mock stays in sync with the real provider
4. For payment gateways: use sandbox environments provided by the vendor; for SMS: use a logging mock that asserts the right message was "sent"

**Code snippet that impresses**:
```javascript
// HTTP-level mock — tests real HTTP client behavior
const paymentMock = new ExternalServiceMock();
paymentMock.when('POST', '/charge').respond({
  status: 200,
  body: { chargeId: 'ch_test_123', status: 'succeeded' }
});

// After test: verify the mock was called with correct parameters
paymentMock.verify('POST', '/charge', 1);
const call = paymentMock.getRequests()[0];
expect(call.options.body.amount).toBe(9999);  // $99.99 in cents
```

---

#### Q3: How do you test that cache invalidation works correctly?

**What interviewers look for**: Asserting on infrastructure side effects, not just response values.

**Answer framework**:
1. Pre-seed the cache with known stale data before running the action under test
2. Execute the action (e.g., `updateUser`)
3. Assert the cache key is absent (or has the new value)
4. Verify the next read goes to the database (assert DB query count, or verify cache miss)

**Code snippet that impresses**:
```javascript
it('invalidates user cache after profile update', async () => {
  // Pre-seed stale cache data
  await redis.set('user:123', JSON.stringify({ name: 'Old Name' }));

  // Update the user
  await userService.updateProfile('123', { name: 'New Name' });

  // Assert cache was invalidated — not just updated
  const cached = await redis.get('user:123');
  expect(cached).toBeNull();

  // Next read should hit DB and return fresh data
  const user = await userService.getProfile('123');
  expect(user.name).toBe('New Name');
  // Cache should now be repopulated with new value
  const newCached = await redis.get('user:123');
  expect(JSON.parse(newCached).name).toBe('New Name');
});
```

---

#### Q4: How do you test message queue publishing and consuming in integration tests?

**What interviewers look for**: End-to-end event flow testing without timing dependencies.

**Answer framework**:
1. Publish a command or trigger an action, then consume from the queue and assert on the message content
2. Don't sleep() to wait for async processing — use polling with a timeout: `waitForCondition(() => consumer.received > 0, 5000)`
3. Use a real Kafka/RabbitMQ instance via Docker (testcontainers), not just an in-memory mock — tests the actual serialization and routing
4. Test both the happy path (message consumed and processed) and error cases (bad message goes to DLQ)

---

#### Q5: What is the difference between integration tests and end-to-end (E2E) tests? When should you use each?

**What interviewers look for**: Test pyramid knowledge and the appropriate scope for each test type.

**Answer framework**:
1. **Integration tests**: test the interaction between internal components (API + DB + cache) using real dependencies in Docker; milliseconds to seconds; run on every PR
2. **E2E tests**: test the entire stack from user perspective — UI, APIs, databases, external services; seconds to minutes; run before production deploy
3. **Trade-off**: integration tests are faster, more debuggable, and run more frequently; E2E tests catch full-stack issues but are slow and brittle
4. **Ideal ratio**: 70% unit + 20% integration + 10% E2E (the test pyramid)

---

## Related POCs

- [Contract Testing](/10-architecture/hands-on/contract-testing)
- [Database Testing](/01-databases/hands-on/database-testing)
- [Load Testing](/09-observability/hands-on/load-testing-k6)

## Further Reading

**Concept articles:**
- [Microservices Architecture](/10-architecture/concepts/microservices-architecture)
- [Microservices Communication](/10-architecture/concepts/microservices-communication)

**Interview prep:**
- [Monolith to Microservices](/12-interview-prep/system-design/scale-and-reliability/monolith-to-microservices)

**Failure modes:**
- [Cascading Failures](/10-architecture/failures/cascading-failures)
