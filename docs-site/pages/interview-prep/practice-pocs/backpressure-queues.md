# POC #77: Backpressure with Queues

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Node.js, Queue concepts

## What You'll Learn

Backpressure prevents system overload by controlling the rate at which work is accepted.

```
WITHOUT BACKPRESSURE:
┌──────────┐    1000/sec    ┌──────────┐    100/sec    ┌──────────┐
│ Producer │ ──────────────▶│  Queue   │ ─────────────▶│ Consumer │
└──────────┘                │ OVERFLOW │               └──────────┘
                            │   OOM!   │
                            └──────────┘

WITH BACKPRESSURE:
┌──────────┐    100/sec     ┌──────────┐    100/sec    ┌──────────┐
│ Producer │ ──────────────▶│  Queue   │ ─────────────▶│ Consumer │
│ (slowed) │◀── SLOW DOWN ──│ (bounded)│               └──────────┘
└──────────┘                └──────────┘
```

---

## Implementation

```javascript
// backpressure.js
const { EventEmitter } = require('events');

// ==========================================
// BOUNDED QUEUE WITH BACKPRESSURE
// ==========================================

class BoundedQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxSize = options.maxSize || 1000;
    this.highWaterMark = options.highWaterMark || 0.8;  // 80%
    this.lowWaterMark = options.lowWaterMark || 0.2;   // 20%
    this.queue = [];
    this.paused = false;
    this.stats = { enqueued: 0, dequeued: 0, rejected: 0 };
  }

  enqueue(item) {
    const utilization = this.queue.length / this.maxSize;

    // Hard limit: reject if full
    if (this.queue.length >= this.maxSize) {
      this.stats.rejected++;
      this.emit('rejected', { item, reason: 'Queue full' });
      return false;
    }

    // Soft limit: signal backpressure
    if (utilization >= this.highWaterMark && !this.paused) {
      this.paused = true;
      this.emit('pause');  // Tell producer to slow down
    }

    this.queue.push(item);
    this.stats.enqueued++;
    this.emit('enqueue', { item, size: this.queue.length });
    return true;
  }

  dequeue() {
    if (this.queue.length === 0) return null;

    const item = this.queue.shift();
    this.stats.dequeued++;

    const utilization = this.queue.length / this.maxSize;

    // Resume if below low water mark
    if (utilization <= this.lowWaterMark && this.paused) {
      this.paused = false;
      this.emit('resume');  // Tell producer to speed up
    }

    this.emit('dequeue', { item, size: this.queue.length });
    return item;
  }

  size() { return this.queue.length; }
  isFull() { return this.queue.length >= this.maxSize; }
  isPaused() { return this.paused; }
  getStats() { return { ...this.stats, currentSize: this.queue.length }; }
}

// ==========================================
// RATE-LIMITED PRODUCER
// ==========================================

class BackpressureAwareProducer {
  constructor(queue, options = {}) {
    this.queue = queue;
    this.baseRate = options.baseRate || 100;  // items/sec
    this.minRate = options.minRate || 10;
    this.currentRate = this.baseRate;
    this.produced = 0;
    this.interval = null;

    // Listen to backpressure signals
    queue.on('pause', () => {
      console.log('⚠️ BACKPRESSURE: Slowing down production');
      this.currentRate = this.minRate;
    });

    queue.on('resume', () => {
      console.log('✅ RESUMED: Speeding up production');
      this.currentRate = this.baseRate;
    });

    queue.on('rejected', ({ reason }) => {
      console.log(`❌ REJECTED: ${reason}`);
    });
  }

  start() {
    const produce = () => {
      const item = { id: ++this.produced, timestamp: Date.now() };
      this.queue.enqueue(item);

      // Schedule next production based on current rate
      const delay = 1000 / this.currentRate;
      this.interval = setTimeout(produce, delay);
    };

    produce();
  }

  stop() {
    clearTimeout(this.interval);
  }
}

// ==========================================
// CONSUMER WITH VARIABLE SPEED
// ==========================================

class Consumer {
  constructor(queue, options = {}) {
    this.queue = queue;
    this.processingTime = options.processingTime || 50;  // ms per item
    this.consumed = 0;
    this.running = false;
  }

  async start() {
    this.running = true;
    while (this.running) {
      const item = this.queue.dequeue();
      if (item) {
        await this.process(item);
        this.consumed++;
      } else {
        await new Promise(r => setTimeout(r, 10));  // Wait for items
      }
    }
  }

  async process(item) {
    // Simulate variable processing time
    const jitter = Math.random() * this.processingTime;
    await new Promise(r => setTimeout(r, this.processingTime + jitter));
  }

  stop() {
    this.running = false;
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('BACKPRESSURE WITH QUEUES');
  console.log('='.repeat(60));

  const queue = new BoundedQueue({
    maxSize: 100,
    highWaterMark: 0.7,  // Pause at 70%
    lowWaterMark: 0.3    // Resume at 30%
  });

  const producer = new BackpressureAwareProducer(queue, {
    baseRate: 50,   // 50 items/sec normally
    minRate: 10     // 10 items/sec under pressure
  });

  const consumer = new Consumer(queue, {
    processingTime: 30  // 30ms per item (~33 items/sec max)
  });

  // Monitor queue status
  const monitor = setInterval(() => {
    const stats = queue.getStats();
    const bar = '█'.repeat(Math.floor(stats.currentSize / 5));
    console.log(
      `Queue: [${bar.padEnd(20)}] ${stats.currentSize}/100 | ` +
      `In: ${stats.enqueued} | Out: ${stats.dequeued} | Rejected: ${stats.rejected}`
    );
  }, 1000);

  // Start producer and consumer
  producer.start();
  consumer.start();

  // Run for 15 seconds
  await new Promise(r => setTimeout(r, 15000));

  // Cleanup
  producer.stop();
  consumer.stop();
  clearInterval(monitor);

  console.log('\n--- Final Statistics ---');
  console.log(queue.getStats());
}

demonstrate().catch(console.error);
```

---

## Expected Output

```
BACKPRESSURE WITH QUEUES

Queue: [████                ] 20/100 | In: 50 | Out: 30 | Rejected: 0
Queue: [████████████        ] 60/100 | In: 100 | Out: 40 | Rejected: 0
⚠️ BACKPRESSURE: Slowing down production
Queue: [██████████████      ] 70/100 | In: 110 | Out: 40 | Rejected: 0
Queue: [████████████        ] 60/100 | In: 120 | Out: 60 | Rejected: 0
Queue: [████████            ] 40/100 | In: 130 | Out: 90 | Rejected: 0
✅ RESUMED: Speeding up production
Queue: [████                ] 20/100 | In: 150 | Out: 130 | Rejected: 0
```

---

## Backpressure Strategies

| Strategy | How It Works | Use Case |
|----------|--------------|----------|
| **Drop** | Reject new items | Metrics, logs |
| **Block** | Producer waits | Critical data |
| **Buffer** | Spill to disk | Large batches |
| **Sample** | Keep 1 in N | High-volume streams |
| **Throttle** | Rate limit producer | API ingestion |

---

## Related POCs

- [Timeout Configuration](/interview-prep/practice-pocs/timeout-configuration)
- [Circuit Breaker](/interview-prep/practice-pocs/circuit-breaker)
- [Kafka Consumer Groups](/interview-prep/practice-pocs/kafka-consumer-groups-load-balancing)
