# POC #82: CQRS Pattern

> **Difficulty:** 🔴 Advanced
> **Time:** 30 minutes
> **Prerequisites:** Node.js, Event Sourcing basics

## What You'll Learn

CQRS (Command Query Responsibility Segregation) separates read and write operations into different models, allowing independent optimization.

```
TRADITIONAL ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  API ──────────────▶ Service ──────────────▶ Database          │
│                        │                        │               │
│                    Reads + Writes          Single Model         │
│                                                                 │
│  Problem: Read and write patterns are different!                │
│  - Reads: Complex queries, joins, aggregations                  │
│  - Writes: Business logic, validation, transactions             │
└─────────────────────────────────────────────────────────────────┘

CQRS ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Commands ──▶ Command Handler ──▶ Write DB (Normalized)        │
│                     │                                           │
│                     ▼                                           │
│              Event Publisher                                    │
│                     │                                           │
│                     ▼                                           │
│  Queries ───▶ Query Handler ───▶ Read DB (Denormalized)        │
│                                                                 │
│  Benefits: Optimize each side independently!                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// cqrs-pattern.js

// ==========================================
// COMMAND SIDE (Write Model)
// ==========================================

// Commands - Intent to change state
class CreateOrderCommand {
  constructor(orderId, customerId, items) {
    this.type = 'CreateOrder';
    this.orderId = orderId;
    this.customerId = customerId;
    this.items = items;
    this.timestamp = new Date();
  }
}

class AddItemCommand {
  constructor(orderId, item) {
    this.type = 'AddItem';
    this.orderId = orderId;
    this.item = item;
    this.timestamp = new Date();
  }
}

class SubmitOrderCommand {
  constructor(orderId) {
    this.type = 'SubmitOrder';
    this.orderId = orderId;
    this.timestamp = new Date();
  }
}

// Write Model - Handles business logic
class Order {
  constructor() {
    this.id = null;
    this.customerId = null;
    this.items = [];
    this.status = null;
    this.total = 0;
    this.events = [];
  }

  static create(orderId, customerId, items) {
    const order = new Order();
    order.apply({
      type: 'OrderCreated',
      orderId,
      customerId,
      items,
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    });
    return order;
  }

  addItem(item) {
    if (this.status !== 'draft') {
      throw new Error('Cannot modify submitted order');
    }
    this.apply({
      type: 'ItemAdded',
      orderId: this.id,
      item,
      newTotal: this.total + item.price * item.quantity
    });
  }

  submit() {
    if (this.status !== 'draft') {
      throw new Error('Order already submitted');
    }
    if (this.items.length === 0) {
      throw new Error('Cannot submit empty order');
    }
    this.apply({
      type: 'OrderSubmitted',
      orderId: this.id,
      submittedAt: new Date().toISOString()
    });
  }

  apply(event) {
    this.events.push(event);
    this.when(event);
  }

  when(event) {
    switch (event.type) {
      case 'OrderCreated':
        this.id = event.orderId;
        this.customerId = event.customerId;
        this.items = [...event.items];
        this.total = event.total;
        this.status = 'draft';
        break;
      case 'ItemAdded':
        this.items.push(event.item);
        this.total = event.newTotal;
        break;
      case 'OrderSubmitted':
        this.status = 'submitted';
        break;
    }
  }

  getUncommittedEvents() {
    const events = [...this.events];
    this.events = [];
    return events;
  }
}

// Command Handler - Orchestrates commands
class OrderCommandHandler {
  constructor(writeRepository, eventPublisher) {
    this.repository = writeRepository;
    this.eventPublisher = eventPublisher;
  }

  async handle(command) {
    console.log(`\n📥 Handling command: ${command.type}`);

    switch (command.type) {
      case 'CreateOrder':
        return this.handleCreateOrder(command);
      case 'AddItem':
        return this.handleAddItem(command);
      case 'SubmitOrder':
        return this.handleSubmitOrder(command);
      default:
        throw new Error(`Unknown command: ${command.type}`);
    }
  }

  async handleCreateOrder(cmd) {
    const order = Order.create(cmd.orderId, cmd.customerId, cmd.items);
    await this.repository.save(order);
    await this.publishEvents(order);
    return order.id;
  }

  async handleAddItem(cmd) {
    const order = await this.repository.load(cmd.orderId);
    if (!order) throw new Error('Order not found');
    order.addItem(cmd.item);
    await this.repository.save(order);
    await this.publishEvents(order);
  }

  async handleSubmitOrder(cmd) {
    const order = await this.repository.load(cmd.orderId);
    if (!order) throw new Error('Order not found');
    order.submit();
    await this.repository.save(order);
    await this.publishEvents(order);
  }

  async publishEvents(order) {
    const events = order.getUncommittedEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}

// ==========================================
// QUERY SIDE (Read Model)
// ==========================================

// Read Model - Optimized for queries
class OrderReadModel {
  constructor() {
    // Denormalized views
    this.orders = new Map();
    this.ordersByCustomer = new Map();
    this.ordersByStatus = new Map();
    this.dailyStats = new Map();
  }

  // Event handlers - Build read model from events
  handleEvent(event) {
    switch (event.type) {
      case 'OrderCreated':
        this.onOrderCreated(event);
        break;
      case 'ItemAdded':
        this.onItemAdded(event);
        break;
      case 'OrderSubmitted':
        this.onOrderSubmitted(event);
        break;
    }
  }

  onOrderCreated(event) {
    const order = {
      id: event.orderId,
      customerId: event.customerId,
      items: event.items,
      total: event.total,
      status: 'draft',
      itemCount: event.items.length,
      createdAt: new Date().toISOString()
    };

    // Main orders view
    this.orders.set(event.orderId, order);

    // By customer index
    if (!this.ordersByCustomer.has(event.customerId)) {
      this.ordersByCustomer.set(event.customerId, []);
    }
    this.ordersByCustomer.get(event.customerId).push(event.orderId);

    // By status index
    if (!this.ordersByStatus.has('draft')) {
      this.ordersByStatus.set('draft', []);
    }
    this.ordersByStatus.get('draft').push(event.orderId);

    console.log(`📊 Read model updated: Order ${event.orderId} created`);
  }

  onItemAdded(event) {
    const order = this.orders.get(event.orderId);
    if (order) {
      order.items.push(event.item);
      order.total = event.newTotal;
      order.itemCount = order.items.length;
    }
  }

  onOrderSubmitted(event) {
    const order = this.orders.get(event.orderId);
    if (order) {
      // Update status
      const oldStatus = order.status;
      order.status = 'submitted';
      order.submittedAt = event.submittedAt;

      // Update status index
      const oldIndex = this.ordersByStatus.get(oldStatus);
      if (oldIndex) {
        const idx = oldIndex.indexOf(event.orderId);
        if (idx > -1) oldIndex.splice(idx, 1);
      }

      if (!this.ordersByStatus.has('submitted')) {
        this.ordersByStatus.set('submitted', []);
      }
      this.ordersByStatus.get('submitted').push(event.orderId);

      // Update daily stats
      const date = event.submittedAt.split('T')[0];
      if (!this.dailyStats.has(date)) {
        this.dailyStats.set(date, { count: 0, revenue: 0 });
      }
      const stats = this.dailyStats.get(date);
      stats.count++;
      stats.revenue += order.total;
    }
  }
}

// Query Handler - Serves read requests
class OrderQueryHandler {
  constructor(readModel) {
    this.readModel = readModel;
  }

  // Get single order
  getOrder(orderId) {
    return this.readModel.orders.get(orderId);
  }

  // Get orders by customer
  getOrdersByCustomer(customerId) {
    const orderIds = this.readModel.ordersByCustomer.get(customerId) || [];
    return orderIds.map(id => this.readModel.orders.get(id));
  }

  // Get orders by status
  getOrdersByStatus(status) {
    const orderIds = this.readModel.ordersByStatus.get(status) || [];
    return orderIds.map(id => this.readModel.orders.get(id));
  }

  // Get dashboard stats
  getDashboardStats() {
    let totalOrders = 0;
    let totalRevenue = 0;
    let draftOrders = 0;
    let submittedOrders = 0;

    for (const [_, order] of this.readModel.orders) {
      totalOrders++;
      totalRevenue += order.total;
      if (order.status === 'draft') draftOrders++;
      if (order.status === 'submitted') submittedOrders++;
    }

    return {
      totalOrders,
      totalRevenue,
      draftOrders,
      submittedOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
    };
  }

  // Get daily stats (pre-computed)
  getDailyStats() {
    return Array.from(this.readModel.dailyStats.entries())
      .map(([date, stats]) => ({ date, ...stats }));
  }
}

// ==========================================
// INFRASTRUCTURE
// ==========================================

// Simple in-memory write repository
class OrderWriteRepository {
  constructor() {
    this.orders = new Map();
  }

  async save(order) {
    this.orders.set(order.id, order);
  }

  async load(orderId) {
    return this.orders.get(orderId);
  }
}

// Event Publisher (synchronizes read model)
class EventPublisher {
  constructor() {
    this.subscribers = [];
  }

  subscribe(handler) {
    this.subscribers.push(handler);
  }

  async publish(event) {
    console.log(`📤 Publishing event: ${event.type}`);
    for (const handler of this.subscribers) {
      handler(event);
    }
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('CQRS PATTERN');
  console.log('='.repeat(60));

  // Setup infrastructure
  const writeRepository = new OrderWriteRepository();
  const eventPublisher = new EventPublisher();
  const readModel = new OrderReadModel();
  const commandHandler = new OrderCommandHandler(writeRepository, eventPublisher);
  const queryHandler = new OrderQueryHandler(readModel);

  // Connect read model to event publisher
  eventPublisher.subscribe(event => readModel.handleEvent(event));

  // === COMMAND SIDE ===
  console.log('\n--- COMMAND SIDE (Writes) ---');

  // Create order
  await commandHandler.handle(new CreateOrderCommand(
    'ORD-001',
    'CUST-123',
    [
      { name: 'Laptop', price: 999, quantity: 1 },
      { name: 'Mouse', price: 49, quantity: 2 }
    ]
  ));

  // Add item
  await commandHandler.handle(new AddItemCommand('ORD-001', {
    name: 'Keyboard',
    price: 79,
    quantity: 1
  }));

  // Submit order
  await commandHandler.handle(new SubmitOrderCommand('ORD-001'));

  // Create another order
  await commandHandler.handle(new CreateOrderCommand(
    'ORD-002',
    'CUST-123',
    [{ name: 'Monitor', price: 399, quantity: 1 }]
  ));

  // === QUERY SIDE ===
  console.log('\n--- QUERY SIDE (Reads) ---');

  // Get single order
  console.log('\nOrder ORD-001:', queryHandler.getOrder('ORD-001'));

  // Get orders by customer
  console.log('\nOrders for CUST-123:', queryHandler.getOrdersByCustomer('CUST-123'));

  // Get orders by status
  console.log('\nDraft orders:', queryHandler.getOrdersByStatus('draft'));
  console.log('Submitted orders:', queryHandler.getOrdersByStatus('submitted'));

  // Dashboard stats
  console.log('\nDashboard Stats:', queryHandler.getDashboardStats());

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## CQRS vs Traditional Architecture

| Aspect | Traditional | CQRS |
|--------|-------------|------|
| **Model** | Single model for reads/writes | Separate read/write models |
| **Database** | One database | Can use different DBs |
| **Scaling** | Scale together | Scale independently |
| **Complexity** | Lower | Higher |
| **Query Performance** | Limited by normalization | Optimized denormalized views |

---

## When to Use CQRS

```
✅ GOOD FIT:
├── High read-to-write ratio (100:1 or more)
├── Complex queries with many joins
├── Different scaling needs for reads vs writes
├── Event Sourcing systems
└── Microservices with eventual consistency

❌ POOR FIT:
├── Simple CRUD applications
├── Low traffic systems
├── Strong consistency requirements
├── Small teams without DDD experience
└── Prototypes or MVPs
```

---

## Real-World Examples

```
AMAZON:
├── Write: Order placement (normalized, ACID)
├── Read: Product catalog (denormalized, cached)
└── Ratio: ~100 reads per write

TWITTER:
├── Write: Tweet creation (fan-out on write)
├── Read: Timeline (pre-computed per user)
└── Optimization: Eventual consistency OK

NETFLIX:
├── Write: User actions, ratings
├── Read: Recommendations (ML-optimized)
└── Separation: Different teams, different DBs
```

---

## Related POCs

- [Event Sourcing Basics](/interview-prep/practice-pocs/event-sourcing-basics)
- [Saga Pattern](/interview-prep/practice-pocs/saga-pattern)
- [Outbox Pattern](/interview-prep/practice-pocs/outbox-pattern)
