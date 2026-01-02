# Flash Sales Architecture - High Traffic Design

**Interview Question**: *"How do you prepare for flash sales to handle high traffic efficiently? Design a system to handle millions of concurrent users."*

**Difficulty**: 🔴 Advanced
**Asked by**: Amazon, Flipkart, E-commerce Companies
**Time to Answer**: 10-15 minutes

---

## 🎯 Quick Answer (30 seconds)

**Flash Sale** = Limited inventory sold for short time → massive concurrent traffic spike

**Key Challenges**:
1. **Traffic Spike**: 10-100x normal load in seconds
2. **Inventory Management**: Prevent overselling
3. **Fairness**: First-come, first-served
4. **User Experience**: Fast checkout, no crashes

**Solution Architecture**:
1. **CDN** - Static assets, reduce backend load
2. **Queue System** - Control traffic flow
3. **Cache** - Redis for product data, inventory
4. **Database Sharding** - Distribute write load
5. **Message Queue** - Async order processing

---

## 📚 Detailed Explanation

### Problem Breakdown

**Normal Traffic**: 1,000 requests/second
**Flash Sale Traffic**: 100,000+ requests/second (100x spike)
**Duration**: 10 minutes to 1 hour
**Inventory**: Limited (e.g., 1,000 items for 1 million users)

**What Can Go Wrong**:
- ❌ Database overwhelmed (100k writes/sec)
- ❌ Inventory oversold (race conditions)
- ❌ Server crashes (out of memory)
- ❌ Poor UX (timeout errors, slow checkout)

---

## 🏗️ High-Level Architecture

```
                                    ┌─────────────┐
                                    │   CDN       │
                                    │ (Static)    │
                                    └──────┬──────┘
                                           │
┌──────────┐           ┌──────────────────▼──────────────┐
│  Users   │──────────▶│    Load Balancer (ALB/ELB)     │
│(Millions)│           └──────┬──────────────────┬───────┘
└──────────┘                  │                  │
                    ┌─────────▼─────────┐  ┌────▼────────┐
                    │   API Gateway     │  │  Rate       │
                    │   (Kong/Nginx)    │  │  Limiter    │
                    └─────────┬─────────┘  └─────────────┘
                              │
                  ┌───────────▼────────────┐
                  │   Virtual Waiting      │
                  │   Room (Redis Queue)   │
                  └───────────┬────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌─────────▼────────┐  ┌────────▼───────┐
│  App Server 1  │  │  App Server 2    │  │ App Server N   │
└───────┬────────┘  └─────────┬────────┘  └────────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐
    │    Redis     │  │   Message    │  │  Database   │
    │  (Inventory) │  │    Queue     │  │  (Orders)   │
    └──────────────┘  └───────┬──────┘  └─────────────┘
                              │
                      ┌───────▼────────┐
                      │ Order Processing│
                      │    Workers      │
                      └─────────────────┘
```

---

## 🔧 Implementation: Virtual Waiting Room

### Why Waiting Room?

Instead of letting 1 million users hit checkout simultaneously:
- Queue users in waiting room
- Let them through in controlled batches
- Prevents database overload

### Implementation (Node.js + Redis)

```javascript
const Redis = require('ioredis');
const redis = new Redis();

class VirtualWaitingRoom {
  constructor() {
    this.QUEUE_KEY = 'flash_sale:waiting_room';
    this.ACTIVE_USERS_KEY = 'flash_sale:active_users';
    this.MAX_ACTIVE_USERS = 10000; // Process 10k users at a time
    this.PROCESSING_RATE = 100;    // Let 100 users/second through
  }

  // User enters waiting room
  async joinWaitingRoom(userId) {
    const timestamp = Date.now();
    const score = timestamp; // FIFO: first-come, first-served

    // Add to sorted set (priority queue)
    await redis.zadd(this.QUEUE_KEY, score, userId);

    // Get position in queue
    const position = await redis.zrank(this.QUEUE_KEY, userId);

    // Estimate wait time
    const estimatedWaitMinutes = Math.ceil(position / (this.PROCESSING_RATE * 60));

    return {
      position: position + 1,
      estimatedWait: estimatedWaitMinutes,
      message: `You are #${position + 1} in line`
    };
  }

  // Check if user can proceed to checkout
  async canProceedToCheckout(userId) {
    // Check if user is in active session
    const isActive = await redis.sismember(this.ACTIVE_USERS_KEY, userId);
    if (isActive) {
      return { allowed: true, message: 'You can proceed to checkout' };
    }

    // Check queue position
    const position = await redis.zrank(this.QUEUE_KEY, userId);
    if (position === null) {
      return { allowed: false, message: 'Not in queue' };
    }

    return {
      allowed: false,
      position: position + 1,
      message: 'Still in waiting room'
    };
  }

  // Background job: Move users from queue to active
  async processQueue() {
    const activeCount = await redis.scard(this.ACTIVE_USERS_KEY);
    const availableSlots = this.MAX_ACTIVE_USERS - activeCount;

    if (availableSlots > 0) {
      // Get next users from queue (FIFO)
      const users = await redis.zrange(
        this.QUEUE_KEY,
        0,
        Math.min(availableSlots - 1, this.PROCESSING_RATE - 1)
      );

      if (users.length > 0) {
        // Move to active users
        await redis.sadd(this.ACTIVE_USERS_KEY, ...users);

        // Remove from queue
        await redis.zrem(this.QUEUE_KEY, ...users);

        // Set expiry (10 minutes to complete checkout)
        for (const user of users) {
          await redis.expire(`${this.ACTIVE_USERS_KEY}:${user}`, 600);
        }

        console.log(`Moved ${users.length} users to checkout`);
      }
    }
  }

  // User completes checkout (free up slot)
  async completeCheckout(userId) {
    await redis.srem(this.ACTIVE_USERS_KEY, userId);
  }
}

// Express middleware
const waitingRoom = new VirtualWaitingRoom();

app.post('/flash-sale/join', async (req, res) => {
  const userId = req.user.id;
  const result = await waitingRoom.joinWaitingRoom(userId);

  res.json(result);
});

app.get('/flash-sale/status', async (req, res) => {
  const userId = req.user.id;
  const result = await waitingRoom.canProceedToCheckout(userId);

  res.json(result);
});

app.post('/checkout', async (req, res) => {
  const userId = req.user.id;
  const canProceed = await waitingRoom.canProceedToCheckout(userId);

  if (!canProceed.allowed) {
    return res.status(403).json({ error: 'Not authorized to checkout' });
  }

  // Process checkout...
  await processOrder(req.body);

  // Free up slot
  await waitingRoom.completeCheckout(userId);

  res.json({ success: true });
});

// Background job (run every second)
setInterval(() => waitingRoom.processQueue(), 1000);
```

---

## 🔧 Implementation: Inventory Management

### Problem: Prevent Overselling

```
Scenario:
- 100 items available
- 10,000 users click "Buy" simultaneously
- Without proper handling: Sell 10,000 items (oversold!)
```

### Solution: Redis Atomic Operations

```javascript
class InventoryManager {
  async reserveInventory(productId, quantity) {
    const key = `inventory:${productId}`;

    // Lua script for atomic operation
    const script = `
      local key = KEYS[1]
      local quantity = tonumber(ARGV[1])

      local current = redis.call('GET', key)
      if not current then
        return -1  -- Product not found
      end

      current = tonumber(current)
      if current < quantity then
        return 0  -- Not enough inventory
      end

      redis.call('DECRBY', key, quantity)
      return current - quantity  -- Remaining inventory
    `;

    const remaining = await redis.eval(
      script,
      1,
      key,
      quantity
    );

    if (remaining === -1) {
      throw new Error('Product not found');
    }

    if (remaining === 0) {
      return { success: false, message: 'Out of stock' };
    }

    return {
      success: true,
      remaining,
      message: 'Reserved successfully'
    };
  }

  // Initialize inventory for flash sale
  async initializeInventory(productId, quantity) {
    const key = `inventory:${productId}`;
    await redis.set(key, quantity);
    await redis.expire(key, 3600); // 1 hour expiry
  }

  // Release inventory if payment fails
  async releaseInventory(productId, quantity) {
    const key = `inventory:${productId}`;
    await redis.incrby(key, quantity);
  }
}

// Usage
const inventory = new InventoryManager();

// Before flash sale starts
await inventory.initializeInventory('product-123', 1000);

// During checkout
app.post('/checkout', async (req, res) => {
  const { productId, quantity } = req.body;

  try {
    // 1. Reserve inventory
    const reservation = await inventory.reserveInventory(productId, quantity);

    if (!reservation.success) {
      return res.status(409).json({ error: 'Product sold out' });
    }

    // 2. Create order (async)
    const orderId = await createOrder(req.user.id, productId, quantity);

    // 3. Process payment
    const payment = await processPayment(orderId);

    if (!payment.success) {
      // Release inventory if payment fails
      await inventory.releaseInventory(productId, quantity);
      return res.status(400).json({ error: 'Payment failed' });
    }

    res.json({
      success: true,
      orderId,
      remaining: reservation.remaining
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🔧 Implementation: Async Order Processing

### Use Message Queue for Order Processing

```javascript
const Bull = require('bull');
const orderQueue = new Bull('flash-sale-orders', {
  redis: { host: 'redis', port: 6379 }
});

// Producer: Add order to queue
async function createOrder(userId, productId, quantity) {
  const orderId = generateOrderId();

  // Add to queue (async processing)
  await orderQueue.add('process-order', {
    orderId,
    userId,
    productId,
    quantity,
    timestamp: Date.now()
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });

  return orderId;
}

// Consumer: Process orders
orderQueue.process('process-order', 10, async (job) => {
  const { orderId, userId, productId, quantity } = job.data;

  try {
    // 1. Save to database
    await db.orders.create({
      id: orderId,
      userId,
      productId,
      quantity,
      status: 'pending',
      createdAt: new Date()
    });

    // 2. Send confirmation email (async)
    await emailQueue.add('send-confirmation', { orderId, userId });

    // 3. Update analytics
    await analytics.trackPurchase(userId, productId, quantity);

    // 4. Update inventory in main DB
    await db.products.decrement('stock', {
      where: { id: productId },
      by: quantity
    });

    return { success: true };

  } catch (error) {
    console.error('Order processing failed:', error);
    throw error; // Retry
  }
});

// Monitor queue
orderQueue.on('completed', (job) => {
  console.log(`Order ${job.data.orderId} completed`);
});

orderQueue.on('failed', (job, err) => {
  console.error(`Order ${job.data.orderId} failed:`, err);
});
```

---

## 🏢 Real-World Example: Complete Flash Sale System

```javascript
class FlashSaleSystem {
  constructor() {
    this.waitingRoom = new VirtualWaitingRoom();
    this.inventory = new InventoryManager();
  }

  // 1. Pre-sale: Initialize system
  async initializeFlashSale(productId, inventory, startTime) {
    // Warm up cache
    await this.warmUpCache(productId);

    // Initialize inventory in Redis
    await this.inventory.initializeInventory(productId, inventory);

    // Schedule sale start
    const delay = startTime - Date.now();
    setTimeout(() => this.startSale(productId), delay);

    console.log(`Flash sale scheduled for ${new Date(startTime)}`);
  }

  // 2. Cache warming
  async warmUpCache(productId) {
    const product = await db.products.findById(productId);

    // Cache product details
    await redis.setex(
      `product:${productId}`,
      3600,
      JSON.stringify(product)
    );

    // Cache to CDN
    await cdn.purge(`/products/${productId}`);
  }

  // 3. Start sale
  async startSale(productId) {
    console.log(`Flash sale started for ${productId}`);

    // Enable waiting room
    await redis.set(`flash_sale:${productId}:active`, '1', 'EX', 3600);

    // Start queue processor
    this.startQueueProcessor();
  }

  // 4. Handle checkout
  async handleCheckout(userId, productId, quantity) {
    // Check if user can checkout
    const canProceed = await this.waitingRoom.canProceedToCheckout(userId);
    if (!canProceed.allowed) {
      throw new Error('Please wait in queue');
    }

    // Reserve inventory
    const reservation = await this.inventory.reserveInventory(productId, quantity);
    if (!reservation.success) {
      throw new Error('Sold out');
    }

    // Create order (async)
    const orderId = await createOrder(userId, productId, quantity);

    // Free up waiting room slot
    await this.waitingRoom.completeCheckout(userId);

    return { orderId, success: true };
  }

  // 5. Queue processor
  startQueueProcessor() {
    this.queueInterval = setInterval(
      () => this.waitingRoom.processQueue(),
      1000
    );
  }

  // 6. End sale
  async endSale(productId) {
    // Disable waiting room
    await redis.del(`flash_sale:${productId}:active`);

    // Stop queue processor
    clearInterval(this.queueInterval);

    // Clear remaining queue
    await redis.del(this.waitingRoom.QUEUE_KEY);

    console.log('Flash sale ended');
  }
}

// Usage
const flashSale = new FlashSaleSystem();

// Initialize flash sale (1000 items, starts in 1 hour)
await flashSale.initializeFlashSale(
  'product-123',
  1000,
  Date.now() + 3600000
);
```

---

## 📊 Capacity Planning

### Calculations

**Expected Traffic**: 1 million users
**Success Rate**: 1,000 items / 1,000,000 users = 0.1%
**Concurrent Requests**: 100,000/sec at peak

**Infrastructure Needed**:
```
Load Balancers: 2-3 (ALB)
App Servers: 50-100 (auto-scaling)
Redis Cluster: 3-5 nodes (HA)
Database: Read replicas (5+)
Message Queue: Kafka/RabbitMQ cluster
CDN: CloudFront/Cloudflare
```

**Cost Estimate (AWS)**:
- ALB: $20/hour
- EC2 (100 instances): $500/hour
- Redis: $50/hour
- RDS: $100/hour
- **Total: ~$700/hour** for peak (much cheaper at normal times with auto-scaling)

---

## 💡 Best Practices

### 1. Cache Everything

```javascript
// Product details
await redis.setex(`product:${id}`, 3600, JSON.stringify(product));

// User sessions
await redis.setex(`session:${userId}`, 1800, JSON.stringify(session));

// Static assets on CDN
// HTML, CSS, JS, images → CloudFront
```

### 2. Use Database Read Replicas

```javascript
// Writes → Master
await masterDB.orders.create(order);

// Reads → Replicas
const product = await replicaDB.products.findById(productId);
```

### 3. Auto-Scaling

```yaml
# AWS Auto Scaling
MinSize: 10
MaxSize: 100
TargetCPU: 70%
ScaleUpPolicy: +20 instances when CPU > 70%
ScaleDownPolicy: -10 instances when CPU < 30%
```

### 4. Monitor Everything

```javascript
// CloudWatch metrics
- RequestCount
- ErrorRate (4xx, 5xx)
- Latency (p50, p95, p99)
- CPU/Memory usage
- Queue length
- Inventory remaining

// Alerts
if (ErrorRate > 5%) → PagerDuty
if (QueueLength > 100000) → Scale up
if (Inventory < 100) → Notify team
```

---

## 💡 Key Takeaways

1. ✅ **Virtual Waiting Room** - Queue users, prevent overload
2. ✅ **Redis Atomic Ops** - Prevent overselling
3. ✅ **Async Processing** - Use message queues for orders
4. ✅ **Cache Aggressively** - CDN, Redis, database caching
5. ✅ **Auto-Scaling** - Handle traffic spikes
6. ✅ **Rate Limiting** - Protect backend
7. ✅ **Monitoring** - Real-time dashboards, alerts
8. ✅ **Pre-warming** - Cache before sale starts

---

## 🔗 Related Questions

- [Rate Limiting Implementation](/interview-prep/system-design/rate-limiting)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)

---

## 📚 Further Reading

- **Amazon Prime Day Architecture**: https://aws.amazon.com/blogs/aws/prime-day-2021/
- **Shopify Black Friday**: https://shopify.engineering/black-friday-cyber-monday-2020
- **Redis Rate Limiting**: https://redis.io/docs/reference/patterns/distributed-locks/
- **Queue Theory**: https://en.wikipedia.org/wiki/Queueing_theory
