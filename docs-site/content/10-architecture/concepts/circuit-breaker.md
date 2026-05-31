---
title: Circuit Breaker Pattern
layer: solution
section: system-design/patterns
difficulty: intermediate
prerequisites:
  - system-design/scalability/microservices-architecture
solves_with: []
related_problems:
  - problems-at-scale/availability/cascading-failures
  - problems-at-scale/availability/circuit-breaker-failure
  - problems-at-scale/availability/timeout-domino-effect
case_studies: []
see_poc:
  - interview-prep/practice-pocs/circuit-breaker
  - interview-prep/practice-pocs/retry-backoff
  - interview-prep/practice-pocs/timeout-configuration
linked_from:
  - 12-interview-prep/system-design/fundamentals/circuit-breaker-pattern
  - >-
    12-interview-prep/system-design/scale-and-reliability/observability-monitoring
tags:
  - resilience
  - microservices
  - availability
  - fault-tolerance
---

# Circuit Breaker Pattern

## 🗺️ Quick Overview

```mermaid
stateDiagram-v2
    [*] --> Closed: initial state
    Closed --> Open: error rate exceeds threshold
    Open --> HalfOpen: reset timeout expires
    HalfOpen --> Closed: test requests succeed
    HalfOpen --> Open: test request fails
    Closed --> Closed: requests pass through normally
    Open --> Open: fast-fail all requests
```
*Normal path: CLOSED state passes all requests. Trigger: error rate threshold breached. Recovery: after timeout, HALF-OPEN sends probe requests; success closes the breaker, failure re-opens it.*

**Difficulty**: 🟡 Intermediate
**Reading Time**: 15 minutes
**Practical Application**: Essential for any system calling external services

## 🎯 Problem Statement

```javascript
// ❌ PROBLEM: No circuit breaker
async function getUserData(userId) {
  // External service is down or slow
  const response = await externalAPI.getUser(userId);
  // Waits 30 seconds... times out... retries...
  // Meanwhile, requests pile up, threads exhausted, entire app crashes
  return response;
}

// Cascading failure:
// External API down → Your app slows down → Your app crashes
// User experience: Everything is broken
```

```javascript
// ✅ SOLUTION: Circuit breaker
const breaker = new CircuitBreaker(externalAPI.getUser, {
  timeout: 3000,      // Fail fast after 3s
  errorThreshold: 50, // Open after 50% errors
  resetTimeout: 30000 // Try again after 30s
});

async function getUserData(userId) {
  try {
    return await breaker.execute(userId);
  } catch (error) {
    // Circuit is open, fail fast
    return getCachedUserData(userId); // Fallback
  }
}

// Result: Fast failures, app stays responsive, automatic recovery
```

## 🌍 Real-World Context

**When you need this**:
- Calling external APIs (payment gateways, shipping APIs)
- Microservices communication
- Database queries (prevent overload)
- Third-party integrations

**Real Companies**:
- **Netflix**: Hystrix library (original circuit breaker)
- **AWS**: Built into API Gateway, Lambda
- **Stripe**: Payment API circuit breakers
- **Uber**: Service-to-service communication

**Impact**:
- **Without**: One service failure → entire system down
- **With**: Isolated failures, fast recovery, better UX

## 🏗️ Architecture

### Circuit Breaker States

```mermaid
stateDiagram-v2
    [*] --> Closed: Initial state

    Closed --> Open: Error threshold<br/>exceeded
    Closed --> Closed: Successful calls

    Open --> HalfOpen: Timeout expired
    Open --> Open: Requests rejected<br/>(fail fast)

    HalfOpen --> Closed: Test call<br/>succeeds
    HalfOpen --> Open: Test call<br/>fails

    note right of Closed
        Normal operation
        Requests pass through
        Count failures
    end note

    note right of Open
        Stop calling service
        Fail fast
        Return fallback
    end note

    note right of HalfOpen
        Test if service recovered
        Allow limited requests
        Decide next state
    end note
```

### Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant CircuitBreaker
    participant ExternalAPI

    Note over CircuitBreaker: State: CLOSED

    Client->>CircuitBreaker: Request
    CircuitBreaker->>ExternalAPI: Forward request
    ExternalAPI-->>CircuitBreaker: Success ✓
    CircuitBreaker-->>Client: Success ✓

    Note over CircuitBreaker: 5 failures in a row...

    Client->>CircuitBreaker: Request
    CircuitBreaker->>ExternalAPI: Forward request
    ExternalAPI--xCircuitBreaker: Error ✗

    Note over CircuitBreaker: State: OPEN

    Client->>CircuitBreaker: Request
    CircuitBreaker--xClient: Fail fast (no API call)
    Note over Client: Returns cached/fallback data

    Note over CircuitBreaker: Wait 30 seconds...
    Note over CircuitBreaker: State: HALF_OPEN

    Client->>CircuitBreaker: Request
    CircuitBreaker->>ExternalAPI: Test call
    ExternalAPI-->>CircuitBreaker: Success ✓

    Note over CircuitBreaker: State: CLOSED (recovered)
```

## 💻 Implementation

### Basic Circuit Breaker

```javascript
class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();

    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 3000;
    this.resetTimeout = options.resetTimeout || 60000;
  }

  async execute(...args) {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      // Check if it's time to try again
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }

      // Try half-open
      this.state = 'HALF_OPEN';
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(this.fn, args);

      // Success!
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      throw error;
    }
  }

  async executeWithTimeout(fn, args) {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), this.timeout)
      )
    ]);
  }

  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;

      // Enough successes, close circuit
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.successCount = 0;

    // Too many failures, open circuit
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: new Date(this.nextAttempt)
    };
  }
}

// Usage
const paymentBreaker = new CircuitBreaker(
  paymentAPI.charge,
  {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 3000,
    resetTimeout: 60000
  }
);

async function processPayment(amount, userId) {
  try {
    const result = await paymentBreaker.execute(amount, userId);
    return result;
  } catch (error) {
    if (error.message === 'Circuit breaker is OPEN') {
      // Payment service is down, queue for later
      await paymentQueue.add({ amount, userId });
      return { status: 'queued', message: 'Payment will be processed shortly' };
    }
    throw error;
  }
}
```

### Production-Grade Circuit Breaker

```javascript
const EventEmitter = require('events');

class AdvancedCircuitBreaker extends EventEmitter {
  constructor(fn, options = {}) {
    super();
    this.fn = fn;
    this.name = options.name || fn.name || 'anonymous';
    this.state = 'CLOSED';

    // Sliding window for error rate calculation
    this.window = [];
    this.windowSize = options.windowSize || 100;

    // Thresholds
    this.errorThresholdPercentage = options.errorThresholdPercentage || 50;
    this.volumeThreshold = options.volumeThreshold || 10;
    this.timeout = options.timeout || 3000;
    this.resetTimeout = options.resetTimeout || 60000;

    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0
    };

    // Fallback function
    this.fallback = options.fallback || null;
  }

  async execute(...args) {
    // Circuit is OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.metrics.rejectedCalls++;
        this.emit('reject', { name: this.name, state: this.state });

        // Execute fallback if available
        if (this.fallback) {
          return await this.fallback(...args);
        }

        throw new Error(`Circuit breaker [${this.name}] is OPEN`);
      }

      // Transition to HALF_OPEN
      this.transitionTo('HALF_OPEN');
    }

    // Execute function
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(this.fn, args);

      // Record success
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(Date.now() - startTime, error);

      // Execute fallback
      if (this.fallback) {
        return await this.fallback(...args);
      }

      throw error;
    }
  }

  async executeWithTimeout(fn, args) {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), this.timeout)
      )
    ]);
  }

  recordSuccess(duration) {
    this.metrics.totalCalls++;
    this.metrics.successfulCalls++;

    // Add to sliding window
    this.window.push({ success: true, timestamp: Date.now(), duration });
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }

    // Emit event
    this.emit('success', {
      name: this.name,
      duration,
      state: this.state
    });

    // State transitions
    if (this.state === 'HALF_OPEN') {
      // Enough successes in half-open, close circuit
      const recentSuccesses = this.window.filter(
        r => r.success && Date.now() - r.timestamp < 10000
      ).length;

      if (recentSuccesses >= 3) {
        this.transitionTo('CLOSED');
      }
    }
  }

  recordFailure(duration, error) {
    this.metrics.totalCalls++;
    this.metrics.failedCalls++;

    // Add to sliding window
    this.window.push({ success: false, timestamp: Date.now(), duration, error: error.message });
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }

    // Emit event
    this.emit('failure', {
      name: this.name,
      duration,
      error: error.message,
      state: this.state
    });

    // Calculate error rate
    const errorRate = this.calculateErrorRate();

    // Open circuit if error rate too high
    if (errorRate > this.errorThresholdPercentage && this.window.length >= this.volumeThreshold) {
      this.transitionTo('OPEN');
    }
  }

  calculateErrorRate() {
    if (this.window.length === 0) return 0;

    const failures = this.window.filter(r => !r.success).length;
    return (failures / this.window.length) * 100;
  }

  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'OPEN') {
      this.nextAttempt = Date.now() + this.resetTimeout;
    }

    if (newState === 'CLOSED') {
      this.window = [];
    }

    this.emit('stateChange', {
      name: this.name,
      from: oldState,
      to: newState,
      timestamp: Date.now()
    });

    console.log(`Circuit breaker [${this.name}]: ${oldState} → ${newState}`);
  }

  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      errorRate: this.calculateErrorRate().toFixed(2) + '%',
      ...this.metrics,
      window: this.window.slice(-10) // Last 10 calls
    };
  }

  reset() {
    this.window = [];
    this.transitionTo('CLOSED');
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0
    };
  }
}

// Usage with fallback
const userServiceBreaker = new AdvancedCircuitBreaker(
  userService.getUser,
  {
    name: 'UserService',
    errorThresholdPercentage: 50,
    volumeThreshold: 10,
    timeout: 3000,
    resetTimeout: 60000,
    fallback: async (userId) => {
      // Return cached user data
      return await cache.get(`user:${userId}`) || { id: userId, name: 'Unknown' };
    }
  }
);

// Monitor state changes
userServiceBreaker.on('stateChange', ({ name, from, to }) => {
  console.log(`[${name}] Circuit breaker: ${from} → ${to}`);

  // Alert on OPEN
  if (to === 'OPEN') {
    alerting.send({
      severity: 'error',
      message: `Circuit breaker [${name}] is OPEN`,
      service: name
    });
  }

  // Celebrate recovery
  if (to === 'CLOSED' && from === 'HALF_OPEN') {
    alerting.send({
      severity: 'info',
      message: `Circuit breaker [${name}] recovered`,
      service: name
    });
  }
});

// Usage
async function getUser(userId) {
  return await userServiceBreaker.execute(userId);
}
```

## 🎯 Real-World Examples

### Example 1: Payment Gateway

```javascript
class PaymentService {
  constructor() {
    this.stripeBreaker = new AdvancedCircuitBreaker(
      stripe.charges.create,
      {
        name: 'Stripe',
        timeout: 5000,
        errorThresholdPercentage: 30,
        resetTimeout: 120000, // 2 minutes
        fallback: async (charge) => {
          // Queue payment for later processing
          await paymentQueue.add('process-payment', charge);
          return { status: 'queued', id: generateTempId() };
        }
      }
    );
  }

  async charge(amount, customerId, metadata) {
    try {
      return await this.stripeBreaker.execute({
        amount,
        customer: customerId,
        currency: 'usd',
        metadata
      });
    } catch (error) {
      // Circuit is open, payment queued via fallback
      console.error('Payment failed, queued for retry');
      throw error;
    }
  }
}
```

### Example 2: Microservices Communication

```javascript
class OrderService {
  constructor() {
    // Circuit breakers for each dependency
    this.breakers = {
      inventory: new AdvancedCircuitBreaker(
        inventoryService.checkStock,
        {
          name: 'Inventory',
          timeout: 2000,
          fallback: async () => ({ available: true }) // Assume available
        }
      ),

      payment: new AdvancedCircuitBreaker(
        paymentService.charge,
        {
          name: 'Payment',
          timeout: 5000,
          fallback: async (charge) => {
            await paymentQueue.add(charge);
            return { status: 'queued' };
          }
        }
      ),

      shipping: new AdvancedCircuitBreaker(
        shippingService.createShipment,
        {
          name: 'Shipping',
          timeout: 3000,
          fallback: async (order) => {
            await shippingQueue.add(order);
            return { status: 'queued' };
          }
        }
      )
    };
  }

  async createOrder(orderData) {
    try {
      // Check inventory (with fallback)
      const stock = await this.breakers.inventory.execute(
        orderData.productId,
        orderData.quantity
      );

      if (!stock.available) {
        throw new Error('Out of stock');
      }

      // Charge payment (with fallback to queue)
      const payment = await this.breakers.payment.execute({
        amount: orderData.total,
        customerId: orderData.customerId
      });

      // Create shipment (with fallback to queue)
      const shipment = await this.breakers.shipping.execute({
        orderId: orderData.id,
        address: orderData.shippingAddress
      });

      return {
        success: true,
        payment,
        shipment
      };
    } catch (error) {
      console.error('Order creation failed:', error);
      throw error;
    }
  }

  // Health check endpoint
  getHealthStatus() {
    return Object.entries(this.breakers).map(([name, breaker]) => ({
      service: name,
      ...breaker.getMetrics()
    }));
  }
}
```

### Example 3: Database Queries

```javascript
class DatabaseCircuitBreaker {
  constructor() {
    this.breaker = new AdvancedCircuitBreaker(
      db.query,
      {
        name: 'Database',
        timeout: 5000,
        errorThresholdPercentage: 50,
        volumeThreshold: 20,
        fallback: async (query, params) => {
          // Try read replica or cache
          if (query.startsWith('SELECT')) {
            return await this.tryReadReplica(query, params);
          }
          throw new Error('Database unavailable for writes');
        }
      }
    );
  }

  async query(query, params) {
    return await this.breaker.execute(query, params);
  }

  async tryReadReplica(query, params) {
    // Try read replicas in order
    const replicas = [readReplica1, readReplica2, readReplica3];

    for (const replica of replicas) {
      try {
        return await replica.query(query, params);
      } catch (error) {
        continue;
      }
    }

    throw new Error('All database instances unavailable');
  }
}
```

## 📊 Monitoring & Metrics

```javascript
class CircuitBreakerMonitoring {
  constructor() {
    this.breakers = new Map();
  }

  register(breaker) {
    this.breakers.set(breaker.name, breaker);

    // Monitor state changes
    breaker.on('stateChange', (event) => {
      this.logStateChange(event);
      this.updateMetrics(event);
      this.sendAlerts(event);
    });

    // Monitor failures
    breaker.on('failure', (event) => {
      this.logFailure(event);
    });
  }

  logStateChange(event) {
    console.log(`[${event.name}] ${event.from} → ${event.to}`);
  }

  updateMetrics(event) {
    // Send to monitoring system (Prometheus, Datadog, etc.)
    metrics.gauge(`circuit_breaker.state`, event.to === 'OPEN' ? 1 : 0, {
      service: event.name
    });
  }

  sendAlerts(event) {
    if (event.to === 'OPEN') {
      alerting.send({
        severity: 'error',
        title: `Circuit breaker OPEN: ${event.name}`,
        message: `Service ${event.name} is experiencing failures`,
        timestamp: event.timestamp
      });
    }
  }

  logFailure(event) {
    console.error(`[${event.name}] Failure:`, event.error);

    // Track error rates
    metrics.increment('circuit_breaker.failures', {
      service: event.name,
      error: event.error
    });
  }

  // Dashboard endpoint
  getDashboard() {
    return Array.from(this.breakers.values()).map(breaker => breaker.getMetrics());
  }
}

// Express endpoint
app.get('/health/circuit-breakers', (req, res) => {
  res.json(monitoring.getDashboard());
});
```

## ⚠️ Common Pitfalls

### 1. Too Aggressive Thresholds

```javascript
// ❌ BAD: Opens too quickly
new CircuitBreaker(fn, {
  failureThreshold: 1, // Opens after 1 failure!
  resetTimeout: 300000 // Waits 5 minutes!
});

// ✅ GOOD: Reasonable thresholds
new CircuitBreaker(fn, {
  errorThresholdPercentage: 50, // 50% error rate
  volumeThreshold: 10,          // Need at least 10 requests
  resetTimeout: 60000           // Retry after 1 minute
});
```

### 2. No Fallback

```javascript
// ❌ BAD: No fallback, users see errors
async function getUser(userId) {
  return await breaker.execute(userId);
  // Throws error when circuit is open
}

// ✅ GOOD: Graceful degradation
async function getUser(userId) {
  try {
    return await breaker.execute(userId);
  } catch (error) {
    // Return cached data
    const cached = await cache.get(`user:${userId}`);
    if (cached) return cached;

    // Return minimal data
    return { id: userId, name: 'Unknown', limited: true };
  }
}
```

### 3. Not Monitoring State

```javascript
// ❌ BAD: Silent failures
const breaker = new CircuitBreaker(fn);

// ✅ GOOD: Monitor and alert
const breaker = new CircuitBreaker(fn);

breaker.on('stateChange', ({ name, to }) => {
  if (to === 'OPEN') {
    logger.error(`Circuit breaker ${name} is OPEN`);
    alerting.notify(`Service ${name} is down`);
  }
});
```

## 🎯 Interview Questions

### Common Interview Questions on Circuit Breaker

#### Q1: Explain the circuit breaker pattern and why it's needed in microservices.
**What interviewers look for**: Understanding of failure isolation, state machine design, and ability to connect the pattern to real-world cascading failure scenarios.

**Answer framework**:
1. **The problem**: Without protection, a slow or failing downstream service holds threads, exhausts thread pools, and cascades failures upward — one service failure brings down the whole system within 1-3 minutes.
2. **The pattern**: A circuit breaker wraps outgoing calls and tracks failure rates. It moves through three states — CLOSED (normal), OPEN (fail fast), HALF_OPEN (probe for recovery) — like an electrical fuse that can reset itself.
3. **The benefit**: In OPEN state, requests fail in microseconds instead of waiting 30+ seconds for a timeout; the calling service stays healthy, and the downstream service gets breathing room to recover.

**Key numbers to mention**: Netflix's Hystrix uses 50% error rate threshold over a rolling 10-second window with a minimum of 20 requests; reset timeout is typically 30–60 seconds; recovery requires 3 consecutive successes in HALF_OPEN state.

---

#### Q2: How do you tune circuit breaker thresholds for a production system?
**What interviewers look for**: Practical knowledge of volume thresholds, error rate percentages, reset timeouts, and understanding that wrong tuning causes false positives.

**Answer framework**:
1. **Volume threshold first**: Never open on a single failure — require at least 10–20 requests in the window before evaluating error rate (prevents cold-start false positives).
2. **Error rate percentage**: 50% is Netflix's default; for critical paths like payments, use 30% to be more aggressive; for non-critical services, 70% gives more tolerance.
3. **Reset timeout**: 30–60 seconds allows the downstream service time to recover without being flooded by test requests; use exponential backoff on the reset timeout if repeated open cycles occur (30s → 60s → 120s).

**Key numbers to mention**: `volumeThreshold: 10`, `errorThresholdPercentage: 50`, `resetTimeout: 60000ms` are sensible defaults; Stripe uses stricter 30% thresholds for payment circuits; Amazon API Gateway has 5-second default.

---

#### Q3: What is the difference between a circuit breaker and a retry with exponential backoff? When do you use each?
**What interviewers look for**: Ability to differentiate complementary patterns and explain when combining them is correct vs. dangerous.

**Answer framework**:
1. **Retry** handles transient failures (network blip, single 500 error) — same request, tried again after a delay; appropriate when failure is expected to be temporary and the operation is idempotent.
2. **Circuit breaker** handles sustained failures (service is down or overloaded) — stops all attempts for a reset period; appropriate when the downstream is in a degraded state and more requests would make it worse.
3. **Combined correctly**: Wrap the circuit breaker around the retry — retries handle transient blips, circuit breaker trips if retries keep failing; never retry when the circuit is open (that defeats the purpose).

**Key numbers to mention**: Retry max 3 attempts with base delay 1s, factor 2x, jitter ±10%; circuit breaker reset timeout 30–60s; combined strategy means max 3 retries before recording a failure in the circuit breaker's window.

---

#### Q4: How would you implement fallback behavior when a circuit is open?
**What interviewers look for**: Design thinking around graceful degradation — not just "throw an error" but concrete fallback strategies appropriate to the service being called.

**Answer framework**:
1. **Cached data**: If you have a Redis cache for the dependency, serve the last known good value with a staleness indicator — works for user profiles, product catalogs, pricing.
2. **Default/static response**: Return a safe default — empty list for recommendations, `{ available: true }` for inventory checks when you'd rather risk an oversell than block checkout.
3. **Queue for later**: For non-idempotent writes (payments, order creation), enqueue the operation and return a `202 Accepted` / "processing" response — process when the circuit closes.

**Key numbers to mention**: Netflix serves 10+ fallback tiers for recommendations; cache TTL for fallbacks should be 5–15 minutes; payment queues should have a retry deadline of 24 hours before alerting for manual intervention.

---

#### Q5: How does circuit breaker state affect your monitoring and alerting strategy?
**What interviewers look for**: Operational maturity — understanding that circuit state changes are first-class events that need to be tracked and alerted on.

**Answer framework**:
1. **CLOSED → OPEN**: This is a P1/P2 alert — a service dependency is unhealthy; page the on-call engineer and log the exact error rate and timestamps.
2. **OPEN → HALF_OPEN → CLOSED**: Recovery event — send an informational alert, verify the service is truly healthy, not just passing one test request; check error rate over the next 5 minutes.
3. **Metrics to track**: Circuit state (0=CLOSED, 1=OPEN) as a Prometheus gauge; `circuit_breaker_failures_total` counter; `circuit_breaker_rejected_total` for requests dropped in OPEN state; P99 latency before and after a trip.

**Key numbers to mention**: Alert threshold: circuit open for >2 minutes = page; circuit flapping (open/close >3 times in 10 minutes) = escalate; rejected calls >1% of total traffic = investigate; Netflix monitors 700+ circuit breakers via a real-time dashboard.

---

#### Q6: How would you design a circuit breaker for a payment service specifically?
**What interviewers look for**: Domain-specific thinking — payments have stricter requirements than general services (no silent data loss, idempotency, regulatory considerations).

**Answer framework**:
1. **Lower error threshold**: Use 30% instead of 50% because payment failures directly cause revenue loss and user trust issues; fail fast before the situation compounds.
2. **Mandatory fallback queue**: Never silently drop payment attempts — when circuit opens, enqueue the charge request with a unique idempotency key; process when circuit closes; send user a "processing" confirmation.
3. **Idempotency on retry**: Generate a unique payment ID before the circuit breaker call; use it as the Stripe/payment provider idempotency key so that retries after circuit recovery don't double-charge.

**Key numbers to mention**: Stripe circuit breaker timeout 5 seconds (vs. 3s for general services); reset timeout 120 seconds (2 minutes) to ensure Stripe has recovered; payment queue max age 24 hours before alerting; idempotency key format: `pay_<userId>_<orderId>_<timestamp>`.

---

#### Q7: What is the "thundering herd" problem and how does the circuit breaker's HALF_OPEN state solve it?
**What interviewers look for**: Understanding of the subtle danger in circuit recovery — naively allowing all traffic when the circuit tests healthy can immediately re-open it.

**Answer framework**:
1. **Thundering herd**: When a circuit transitions from OPEN to HALF_OPEN, all the pent-up requests try to go through at once; if the downstream just recovered, this flood re-overwhelms it and the circuit reopens immediately.
2. **HALF_OPEN as a rate limiter**: Allow only 1 probe request (or a configurable small number like 3) through; all other requests still fail fast; only close the circuit after `successThreshold` consecutive successes.
3. **Additional mitigation**: Add jitter to the reset timeout so multiple circuit breakers for the same service don't all probe simultaneously (e.g., 30s ± 5s random); use gradual traffic ramping in HALF_OPEN (10% → 50% → 100%) for high-traffic services.

**Key numbers to mention**: Netflix uses 1 probe in HALF_OPEN; Resilience4j allows configuring `permittedNumberOfCallsInHalfOpenState` (default: 10); recovery jitter of ±5–10% of reset timeout; some systems use a 5-minute gradual ramp after recovery before declaring fully healthy.

---

## 🎓 Key Takeaways

1. ✅ **Prevent cascading failures** - One service down ≠ entire system down
2. ✅ **Fail fast** - Don't wait for timeout, return immediately
3. ✅ **Self-healing** - Automatically test and recover
4. ✅ **Provide fallbacks** - Cached data, queued requests, default values
5. ✅ **Monitor state** - Alert when circuits open
6. ✅ **Tune thresholds** - Based on actual traffic patterns

## 🔗 Next Steps

- [Retry Pattern](/10-architecture/hands-on/retry-backoff) - Exponential backoff for transient failures
- [Bulkhead Pattern](/10-architecture/concepts/bulkhead-pattern) - Isolate failures to pools
- [Timeout Pattern](/10-architecture/hands-on/timeout-configuration) - Fail fast on slow services
- [Circuit Breaker Interview Prep](/12-interview-prep/system-design/fundamentals/circuit-breaker-pattern) - Detailed Q&A for system design interviews

## 📚 Further Reading

- Netflix Hystrix: https://github.com/Netflix/Hystrix/wiki
- Martin Fowler on Circuit Breaker: https://martinfowler.com/bliki/CircuitBreaker.html
- Resilience4j (Java): https://resilience4j.readme.io/
- Opossum (Node.js): https://nodeshift.dev/opossum/
