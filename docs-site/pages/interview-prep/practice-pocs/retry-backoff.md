# POC #76: Retry with Exponential Backoff

> **Difficulty:** 🟢 Beginner
> **Time:** 25 minutes
> **Prerequisites:** Async/await, understanding of network errors

## What You'll Build

A robust retry utility that:
- Retries transient failures automatically
- Uses exponential backoff to avoid thundering herd
- Adds jitter to prevent synchronized retries
- Respects maximum retry limits

## The Problem

```javascript
// Without retry: Single failure = complete failure
async function fetchData() {
  const response = await fetch('https://api.example.com/data');
  return response.json();
  // Network blip → Request fails → User sees error
}

// With retry: Transient failures are handled
async function fetchData() {
  return await retry(() => fetch('https://api.example.com/data'));
  // Network blip → Retry → Success → User happy
}
```

## Implementation

### Step 1: Basic Retry

```javascript
// retry.js
async function retry(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const shouldRetry = options.shouldRetry ?? isRetryableError;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      console.log(`Attempt ${attempt + 1} failed, retrying...`);
    }
  }

  throw lastError;
}

function isRetryableError(error) {
  // Network errors
  if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(error.code)) {
    return true;
  }

  // HTTP errors (5xx are typically retryable)
  if (error.response?.status >= 500) return true;

  // Rate limiting
  if (error.response?.status === 429) return true;

  return false;
}

module.exports = { retry, isRetryableError };
```

### Step 2: Add Exponential Backoff

```javascript
// retry-with-backoff.js
class RetryWithBackoff {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelay = options.baseDelay ?? 1000;  // 1 second
    this.maxDelay = options.maxDelay ?? 30000;   // 30 seconds
    this.factor = options.factor ?? 2;           // Double each time
    this.shouldRetry = options.shouldRetry ?? this.defaultShouldRetry;
    this.onRetry = options.onRetry ?? this.defaultOnRetry;
  }

  async execute(fn) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;

        if (attempt === this.maxRetries) {
          throw error;
        }

        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        this.onRetry(error, attempt, delay);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  calculateDelay(attempt) {
    // Exponential: base * factor^attempt
    // 1s, 2s, 4s, 8s, 16s...
    const delay = this.baseDelay * Math.pow(this.factor, attempt);
    return Math.min(delay, this.maxDelay);
  }

  defaultShouldRetry(error, attempt) {
    // Network errors
    const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'];
    if (networkErrors.includes(error.code)) return true;

    // HTTP 5xx errors
    if (error.response?.status >= 500) return true;

    // Rate limiting (429)
    if (error.response?.status === 429) return true;

    return false;
  }

  defaultOnRetry(error, attempt, delay) {
    console.log(
      `Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryWithBackoff;
```

### Step 3: Add Jitter

```javascript
// retry-with-jitter.js
class RetryWithJitter extends RetryWithBackoff {
  constructor(options = {}) {
    super(options);
    this.jitter = options.jitter ?? 0.2;  // ±20% randomization
  }

  calculateDelay(attempt) {
    // Get base exponential delay
    let delay = super.calculateDelay(attempt);

    // Add jitter: delay ± (delay * jitter)
    const jitterRange = delay * this.jitter;
    const randomJitter = (Math.random() * 2 - 1) * jitterRange;
    delay = delay + randomJitter;

    return Math.max(0, Math.round(delay));
  }
}

// Alternative: Full jitter (AWS recommendation)
class RetryWithFullJitter extends RetryWithBackoff {
  calculateDelay(attempt) {
    const maxDelay = super.calculateDelay(attempt);
    // Random between 0 and maxDelay
    return Math.random() * maxDelay;
  }
}

// Alternative: Decorrelated jitter
class RetryWithDecorrelatedJitter extends RetryWithBackoff {
  constructor(options) {
    super(options);
    this.lastDelay = this.baseDelay;
  }

  calculateDelay(attempt) {
    if (attempt === 0) {
      this.lastDelay = this.baseDelay;
      return this.baseDelay;
    }

    // delay = random between baseDelay and lastDelay * 3
    const min = this.baseDelay;
    const max = this.lastDelay * 3;
    this.lastDelay = Math.min(this.maxDelay, min + Math.random() * (max - min));

    return this.lastDelay;
  }
}

module.exports = {
  RetryWithJitter,
  RetryWithFullJitter,
  RetryWithDecorrelatedJitter
};
```

### Step 4: Respect Retry-After Header

```javascript
// retry-with-headers.js
class SmartRetry extends RetryWithBackoff {
  calculateDelay(attempt, error) {
    // Respect Retry-After header if present
    const retryAfter = this.getRetryAfter(error);
    if (retryAfter !== null) {
      return retryAfter;
    }

    // Otherwise use exponential backoff with jitter
    let delay = super.calculateDelay(attempt);
    const jitterRange = delay * 0.2;
    delay += (Math.random() * 2 - 1) * jitterRange;

    return Math.round(delay);
  }

  getRetryAfter(error) {
    const retryAfter = error.response?.headers?.['retry-after'];
    if (!retryAfter) return null;

    // Retry-After can be seconds or a date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Parse as date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return null;
  }
}

module.exports = SmartRetry;
```

### Step 5: Complete Utility

```javascript
// index.js
const RetryWithBackoff = require('./retry-with-backoff');
const { RetryWithJitter, RetryWithFullJitter } = require('./retry-with-jitter');
const SmartRetry = require('./retry-with-headers');

// Convenience function
async function retryWithBackoff(fn, options = {}) {
  const retry = new RetryWithJitter(options);
  return retry.execute(fn);
}

// Axios interceptor
function createRetryInterceptor(options = {}) {
  const retry = new SmartRetry(options);

  return async (error) => {
    const config = error.config;

    // Don't retry if already retried max times
    config._retryCount = config._retryCount || 0;
    if (config._retryCount >= (options.maxRetries || 3)) {
      return Promise.reject(error);
    }

    // Check if should retry
    if (!retry.defaultShouldRetry(error)) {
      return Promise.reject(error);
    }

    config._retryCount++;
    const delay = retry.calculateDelay(config._retryCount - 1, error);

    console.log(`Retrying request in ${delay}ms (attempt ${config._retryCount})`);
    await retry.sleep(delay);

    return axios(config);
  };
}

module.exports = {
  RetryWithBackoff,
  RetryWithJitter,
  RetryWithFullJitter,
  SmartRetry,
  retryWithBackoff,
  createRetryInterceptor
};
```

## Usage Examples

```javascript
const { retryWithBackoff, createRetryInterceptor } = require('./retry');

// Basic usage
const data = await retryWithBackoff(
  () => fetch('https://api.example.com/data').then(r => r.json()),
  { maxRetries: 3, baseDelay: 1000 }
);

// With axios interceptor
const axios = require('axios');
axios.interceptors.response.use(
  response => response,
  createRetryInterceptor({ maxRetries: 3 })
);

// Custom retry logic
const retry = new RetryWithJitter({
  maxRetries: 5,
  baseDelay: 500,
  maxDelay: 10000,
  shouldRetry: (error) => {
    // Only retry specific errors
    return error.response?.status === 503;
  },
  onRetry: (error, attempt, delay) => {
    console.log(`Custom log: Retry ${attempt + 1} in ${delay}ms`);
    metrics.increment('api.retries', { attempt });
  }
});

await retry.execute(() => apiClient.submitOrder(order));
```

## Testing

```javascript
// test-retry.js
const { RetryWithJitter } = require('./retry');

async function runTests() {
  console.log('Test 1: Successful on first try');
  const retry = new RetryWithJitter({ maxRetries: 3 });
  const result = await retry.execute(() => Promise.resolve('success'));
  console.log('Result:', result);

  console.log('\nTest 2: Fails then succeeds');
  let attempts = 0;
  const result2 = await retry.execute(() => {
    attempts++;
    if (attempts < 3) {
      const error = new Error('Transient failure');
      error.code = 'ECONNRESET';
      throw error;
    }
    return 'success after retries';
  });
  console.log('Result:', result2, 'Attempts:', attempts);

  console.log('\nTest 3: Exhausts retries');
  try {
    await retry.execute(() => {
      const error = new Error('Always fails');
      error.code = 'ECONNRESET';
      throw error;
    });
  } catch (e) {
    console.log('Correctly threw after max retries');
  }

  console.log('\nTest 4: Non-retryable error');
  try {
    await retry.execute(() => {
      throw new Error('Non-retryable error');
    });
  } catch (e) {
    console.log('Correctly threw immediately for non-retryable error');
  }
}

runTests();
```

## Expected Output

```
Test 1: Successful on first try
Result: success

Test 2: Fails then succeeds
Attempt 1 failed: Transient failure. Retrying in 1000ms...
Attempt 2 failed: Transient failure. Retrying in 2000ms...
Result: success after retries Attempts: 3

Test 3: Exhausts retries
Attempt 1 failed: Always fails. Retrying in 1000ms...
Attempt 2 failed: Always fails. Retrying in 2000ms...
Attempt 3 failed: Always fails. Retrying in 4000ms...
Correctly threw after max retries

Test 4: Non-retryable error
Correctly threw immediately for non-retryable error
```

## Key Takeaways

1. **Exponential backoff** prevents thundering herd
2. **Jitter** prevents synchronized retries across instances
3. **Retry-After** headers should be respected
4. **Non-retryable errors** should fail immediately
5. **Limit retries** to prevent infinite loops

## Backoff Visualization

```
Attempt   Delay (base: 1s, factor: 2)   With Jitter (±20%)
   1            1s                        0.8s - 1.2s
   2            2s                        1.6s - 2.4s
   3            4s                        3.2s - 4.8s
   4            8s                        6.4s - 9.6s
   5           16s                       12.8s - 19.2s
```

## Related POCs

- [POC #75: Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)
- [POC #73: Idempotency Keys](/interview-prep/practice-pocs/idempotency-keys)
- [Timeouts & Backpressure](/system-design/patterns/timeouts-backpressure)
