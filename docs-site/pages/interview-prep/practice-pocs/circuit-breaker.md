# POC #75: Circuit Breaker Implementation

> **Difficulty:** 🟡 Intermediate
> **Time:** 35 minutes
> **Prerequisites:** Understanding of failure modes, async patterns

## What You'll Build

A production-ready circuit breaker that:
- Protects services from cascading failures
- Fails fast when downstream is unhealthy
- Automatically recovers when downstream heals
- Provides metrics and observability

## The Problem

```javascript
// Without circuit breaker: Slow death
async function getUser(userId) {
  // Downstream service is slow (30s timeout)
  // Every request waits 30 seconds
  // Thread pool exhausted
  // Entire system becomes unresponsive
  return await userService.fetch(userId);
}

// With circuit breaker: Fast failure
async function getUser(userId) {
  // After 5 failures, circuit opens
  // Subsequent requests fail immediately (no waiting)
  // System stays responsive
  // Fallback provides degraded experience
}
```

## Implementation

### Step 1: Core Circuit Breaker

```javascript
// circuit-breaker.js
const EventEmitter = require('events');

class CircuitBreaker extends EventEmitter {
  static States = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
  };

  constructor(options = {}) {
    super();

    // Configuration
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.timeout = options.timeout || 30000;  // Time before half-open
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;

    // State
    this.state = CircuitBreaker.States.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;

    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      stateChanges: []
    };
  }

  async execute(fn, fallback) {
    this.metrics.totalCalls++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitBreaker.States.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.transitionTo(CircuitBreaker.States.HALF_OPEN);
      } else {
        return this.handleRejection(fallback);
      }
    }

    // Limit calls in HALF_OPEN state
    if (this.state === CircuitBreaker.States.HALF_OPEN) {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        return this.handleRejection(fallback);
      }
      this.halfOpenCalls++;
    }

    // Execute the function
    try {
      const result = await fn();
      this.handleSuccess();
      return result;
    } catch (error) {
      this.handleFailure(error);
      throw error;
    }
  }

  handleSuccess() {
    this.metrics.successfulCalls++;
    this.failures = 0;

    if (this.state === CircuitBreaker.States.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo(CircuitBreaker.States.CLOSED);
      }
    }
  }

  handleFailure(error) {
    this.metrics.failedCalls++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreaker.States.HALF_OPEN) {
      this.transitionTo(CircuitBreaker.States.OPEN);
    } else if (this.failures >= this.failureThreshold) {
      this.transitionTo(CircuitBreaker.States.OPEN);
    }
  }

  handleRejection(fallback) {
    this.metrics.rejectedCalls++;

    if (fallback) {
      return typeof fallback === 'function' ? fallback() : fallback;
    }

    const error = new CircuitBreakerError(
      `Circuit ${this.name} is ${this.state}`
    );
    error.circuitState = this.state;
    throw error;
  }

  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    // Reset counters
    if (newState === CircuitBreaker.States.CLOSED) {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === CircuitBreaker.States.HALF_OPEN) {
      this.successes = 0;
      this.halfOpenCalls = 0;
    }

    // Record state change
    this.metrics.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: Date.now()
    });

    // Emit event
    this.emit('stateChange', { from: oldState, to: newState });
    console.log(`Circuit ${this.name}: ${oldState} → ${newState}`);
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      metrics: { ...this.metrics }
    };
  }

  // Force circuit to specific state (for testing/admin)
  forceOpen() {
    this.transitionTo(CircuitBreaker.States.OPEN);
    this.lastFailureTime = Date.now();
  }

  forceClose() {
    this.transitionTo(CircuitBreaker.States.CLOSED);
  }
}

class CircuitBreakerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

module.exports = { CircuitBreaker, CircuitBreakerError };
```

### Step 2: Circuit Breaker Registry

```javascript
// circuit-registry.js
const { CircuitBreaker } = require('./circuit-breaker');

class CircuitBreakerRegistry {
  constructor() {
    this.circuits = new Map();
  }

  get(name, options = {}) {
    if (!this.circuits.has(name)) {
      const circuit = new CircuitBreaker({ name, ...options });

      // Add monitoring
      circuit.on('stateChange', ({ from, to }) => {
        console.log(`[CircuitBreaker] ${name}: ${from} → ${to}`);

        if (to === 'OPEN') {
          // Alert when circuit opens
          this.alertCircuitOpen(name);
        }
      });

      this.circuits.set(name, circuit);
    }

    return this.circuits.get(name);
  }

  getAll() {
    const states = {};
    for (const [name, circuit] of this.circuits) {
      states[name] = circuit.getState();
    }
    return states;
  }

  alertCircuitOpen(name) {
    // Integration with alerting system
    console.warn(`🚨 ALERT: Circuit ${name} is OPEN`);
  }
}

// Singleton
const registry = new CircuitBreakerRegistry();
module.exports = registry;
```

### Step 3: Express Middleware

```javascript
// middleware/circuit-breaker.js
const registry = require('../circuit-registry');

function circuitBreakerMiddleware(options = {}) {
  return (req, res, next) => {
    // Get or create circuit for this route
    const circuitName = options.name || `${req.method}:${req.baseUrl}`;
    const circuit = registry.get(circuitName, options);

    // Attach to request for use in route handlers
    req.circuit = circuit;

    // Add state to response headers
    res.on('finish', () => {
      res.set('X-Circuit-State', circuit.state);
    });

    next();
  };
}

// Helper for wrapping async route handlers
function withCircuitBreaker(handler, options = {}) {
  return async (req, res, next) => {
    const circuit = req.circuit;

    try {
      await circuit.execute(
        () => handler(req, res, next),
        options.fallback
      );
    } catch (error) {
      if (error.name === 'CircuitBreakerError') {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          circuitState: error.circuitState,
          retryAfter: Math.ceil(circuit.timeout / 1000)
        });
      } else {
        next(error);
      }
    }
  };
}

module.exports = { circuitBreakerMiddleware, withCircuitBreaker };
```

### Step 4: API Usage Example

```javascript
// routes/users.js
const express = require('express');
const { circuitBreakerMiddleware, withCircuitBreaker } = require('../middleware/circuit-breaker');

const router = express.Router();

// Apply circuit breaker to all user routes
router.use(circuitBreakerMiddleware({
  name: 'user-service',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000
}));

// Route with circuit breaker
router.get('/:id', withCircuitBreaker(
  async (req, res) => {
    const user = await userService.getById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  },
  {
    fallback: () => ({
      id: req.params.id,
      name: 'Unknown User',
      _cached: true,
      _circuitOpen: true
    })
  }
));

module.exports = router;
```

### Step 5: Health Endpoint

```javascript
// routes/health.js
const registry = require('../circuit-registry');

router.get('/circuits', (req, res) => {
  const circuits = registry.getAll();

  const unhealthy = Object.values(circuits)
    .filter(c => c.state !== 'CLOSED');

  res.json({
    status: unhealthy.length === 0 ? 'healthy' : 'degraded',
    circuits,
    unhealthyCount: unhealthy.length
  });
});
```

## Testing

### Test Script

```javascript
// test-circuit-breaker.js
const { CircuitBreaker } = require('./circuit-breaker');

async function runTests() {
  const circuit = new CircuitBreaker({
    name: 'test',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 5000
  });

  console.log('Test 1: Normal operation (CLOSED)');
  await circuit.execute(() => Promise.resolve('success'));
  console.log('State:', circuit.state); // CLOSED

  console.log('\nTest 2: Failures trigger OPEN');
  for (let i = 0; i < 3; i++) {
    try {
      await circuit.execute(() => Promise.reject(new Error('fail')));
    } catch (e) {}
  }
  console.log('State:', circuit.state); // OPEN

  console.log('\nTest 3: Requests rejected when OPEN');
  try {
    await circuit.execute(() => Promise.resolve('success'));
  } catch (e) {
    console.log('Caught:', e.message); // Circuit test is OPEN
  }

  console.log('\nTest 4: Wait for HALF_OPEN');
  await new Promise(r => setTimeout(r, 5100));
  console.log('State:', circuit.state); // HALF_OPEN

  console.log('\nTest 5: Successes in HALF_OPEN close circuit');
  await circuit.execute(() => Promise.resolve('success'));
  await circuit.execute(() => Promise.resolve('success'));
  console.log('State:', circuit.state); // CLOSED

  console.log('\nMetrics:', circuit.getState().metrics);
}

runTests();
```

## Expected Output

```
Test 1: Normal operation (CLOSED)
State: CLOSED

Test 2: Failures trigger OPEN
Circuit test: CLOSED → OPEN
State: OPEN

Test 3: Requests rejected when OPEN
Caught: Circuit test is OPEN

Test 4: Wait for HALF_OPEN
Circuit test: OPEN → HALF_OPEN
State: HALF_OPEN

Test 5: Successes in HALF_OPEN close circuit
Circuit test: HALF_OPEN → CLOSED
State: CLOSED

Metrics: {
  totalCalls: 6,
  successfulCalls: 3,
  failedCalls: 3,
  rejectedCalls: 1,
  stateChanges: [...]
}
```

## Key Takeaways

1. **Fail fast** - Don't wait for slow services to timeout
2. **Automatic recovery** - Circuit reopens after timeout
3. **Fallbacks** - Provide degraded functionality when open
4. **Observability** - Emit events and track metrics
5. **Per-dependency** - Separate circuit per downstream service

## Common Configuration

| Service Type | Failure Threshold | Timeout | Success Threshold |
|--------------|-------------------|---------|-------------------|
| Critical | 3 | 60s | 5 |
| Standard | 5 | 30s | 3 |
| Non-critical | 10 | 15s | 2 |

## Related POCs

- [POC #76: Retry with Backoff](/interview-prep/practice-pocs/retry-backoff)
- [POC #71: Connection Pool Sizing](/interview-prep/practice-pocs/connection-pool-sizing)
- [Timeouts & Backpressure](/system-design/patterns/timeouts-backpressure)
