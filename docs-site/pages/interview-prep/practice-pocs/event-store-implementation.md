# POC #83: Event Store Implementation

> **Difficulty:** 🔴 Advanced
> **Time:** 35 minutes
> **Prerequisites:** Node.js, PostgreSQL, Event Sourcing concepts

## What You'll Learn

Build a production-grade event store with PostgreSQL that supports append-only storage, optimistic concurrency, and efficient stream reading.

```
EVENT STORE ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────┐
│                        EVENT STORE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    events table                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ global_position │ stream_id │ version │ type │ data    │   │
│  ├─────────────────┼───────────┼─────────┼──────┼─────────┤   │
│  │ 1               │ order-123 │ 1       │ ...  │ {...}   │   │
│  │ 2               │ order-123 │ 2       │ ...  │ {...}   │   │
│  │ 3               │ order-456 │ 1       │ ...  │ {...}   │   │
│  │ 4               │ order-123 │ 3       │ ...  │ {...}   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Features:                                                      │
│  ✅ Append-only (immutable)                                     │
│  ✅ Optimistic concurrency (version check)                      │
│  ✅ Global ordering (for projections)                           │
│  ✅ Stream ordering (for aggregates)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- event_store.sql

-- Main events table
CREATE TABLE events (
    global_position BIGSERIAL PRIMARY KEY,
    stream_id VARCHAR(255) NOT NULL,
    stream_version INT NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique version per stream (optimistic concurrency)
    CONSTRAINT unique_stream_version UNIQUE (stream_id, stream_version)
);

-- Indexes for efficient querying
CREATE INDEX idx_events_stream_id ON events(stream_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);

-- Streams metadata table (optional, for stream info)
CREATE TABLE streams (
    stream_id VARCHAR(255) PRIMARY KEY,
    stream_type VARCHAR(255),
    current_version INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table (for tracking projection positions)
CREATE TABLE subscriptions (
    subscription_id VARCHAR(255) PRIMARY KEY,
    last_processed_position BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Snapshots table (for performance optimization)
CREATE TABLE snapshots (
    stream_id VARCHAR(255) PRIMARY KEY,
    stream_version INT NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Implementation

```javascript
// event-store.js
const { Pool } = require('pg');

// ==========================================
// EVENT STORE CLASS
// ==========================================

class PostgresEventStore {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async initialize() {
    // Create tables if not exist (for POC)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        global_position BIGSERIAL PRIMARY KEY,
        stream_id VARCHAR(255) NOT NULL,
        stream_version INT NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        event_data JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_stream_version UNIQUE (stream_id, stream_version)
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        subscription_id VARCHAR(255) PRIMARY KEY,
        last_processed_position BIGINT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Event store initialized');
  }

  // ==========================================
  // APPEND EVENTS
  // ==========================================

  async appendToStream(streamId, events, expectedVersion = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get current version
      const versionResult = await client.query(
        'SELECT COALESCE(MAX(stream_version), 0) as version FROM events WHERE stream_id = $1',
        [streamId]
      );
      const currentVersion = versionResult.rows[0].version;

      // Optimistic concurrency check
      if (expectedVersion !== null && currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          `Expected version ${expectedVersion}, but stream is at version ${currentVersion}`
        );
      }

      // Append events
      let version = currentVersion;
      const appendedEvents = [];

      for (const event of events) {
        version++;
        const result = await client.query(
          `INSERT INTO events (stream_id, stream_version, event_type, event_data, metadata)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING global_position, created_at`,
          [
            streamId,
            version,
            event.type,
            JSON.stringify(event.data),
            JSON.stringify(event.metadata || {})
          ]
        );

        appendedEvents.push({
          globalPosition: result.rows[0].global_position,
          streamId,
          streamVersion: version,
          eventType: event.type,
          eventData: event.data,
          metadata: event.metadata,
          createdAt: result.rows[0].created_at
        });
      }

      await client.query('COMMIT');

      console.log(`📝 Appended ${events.length} event(s) to stream ${streamId} (v${version})`);
      return { newVersion: version, events: appendedEvents };

    } catch (error) {
      await client.query('ROLLBACK');

      // Handle unique constraint violation (concurrent write)
      if (error.code === '23505') {
        throw new ConcurrencyError('Concurrent write detected');
      }
      throw error;

    } finally {
      client.release();
    }
  }

  // ==========================================
  // READ STREAM
  // ==========================================

  async readStream(streamId, fromVersion = 0, maxCount = 1000) {
    const result = await this.pool.query(
      `SELECT global_position, stream_id, stream_version, event_type,
              event_data, metadata, created_at
       FROM events
       WHERE stream_id = $1 AND stream_version > $2
       ORDER BY stream_version ASC
       LIMIT $3`,
      [streamId, fromVersion, maxCount]
    );

    return result.rows.map(row => ({
      globalPosition: row.global_position,
      streamId: row.stream_id,
      streamVersion: row.stream_version,
      eventType: row.event_type,
      eventData: row.event_data,
      metadata: row.metadata,
      createdAt: row.created_at
    }));
  }

  // ==========================================
  // READ ALL (For Projections)
  // ==========================================

  async readAll(fromPosition = 0, maxCount = 1000) {
    const result = await this.pool.query(
      `SELECT global_position, stream_id, stream_version, event_type,
              event_data, metadata, created_at
       FROM events
       WHERE global_position > $1
       ORDER BY global_position ASC
       LIMIT $2`,
      [fromPosition, maxCount]
    );

    return result.rows.map(row => ({
      globalPosition: row.global_position,
      streamId: row.stream_id,
      streamVersion: row.stream_version,
      eventType: row.event_type,
      eventData: row.event_data,
      metadata: row.metadata,
      createdAt: row.created_at
    }));
  }

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================

  async getSubscriptionPosition(subscriptionId) {
    const result = await this.pool.query(
      'SELECT last_processed_position FROM subscriptions WHERE subscription_id = $1',
      [subscriptionId]
    );
    return result.rows[0]?.last_processed_position || 0;
  }

  async updateSubscriptionPosition(subscriptionId, position) {
    await this.pool.query(
      `INSERT INTO subscriptions (subscription_id, last_processed_position, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (subscription_id)
       DO UPDATE SET last_processed_position = $2, updated_at = NOW()`,
      [subscriptionId, position]
    );
  }

  // ==========================================
  // STREAM INFO
  // ==========================================

  async getStreamVersion(streamId) {
    const result = await this.pool.query(
      'SELECT COALESCE(MAX(stream_version), 0) as version FROM events WHERE stream_id = $1',
      [streamId]
    );
    return result.rows[0].version;
  }

  async streamExists(streamId) {
    const result = await this.pool.query(
      'SELECT 1 FROM events WHERE stream_id = $1 LIMIT 1',
      [streamId]
    );
    return result.rows.length > 0;
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  async close() {
    await this.pool.end();
  }
}

// Custom error for concurrency conflicts
class ConcurrencyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

// ==========================================
// SUBSCRIPTION PROCESSOR
// ==========================================

class SubscriptionProcessor {
  constructor(eventStore, subscriptionId, handler) {
    this.eventStore = eventStore;
    this.subscriptionId = subscriptionId;
    this.handler = handler;
    this.running = false;
    this.batchSize = 100;
    this.pollInterval = 1000;
  }

  async start() {
    this.running = true;
    console.log(`🔄 Starting subscription: ${this.subscriptionId}`);

    while (this.running) {
      try {
        const position = await this.eventStore.getSubscriptionPosition(this.subscriptionId);
        const events = await this.eventStore.readAll(position, this.batchSize);

        if (events.length > 0) {
          for (const event of events) {
            await this.handler(event);
            await this.eventStore.updateSubscriptionPosition(
              this.subscriptionId,
              event.globalPosition
            );
          }
          console.log(`📊 Processed ${events.length} events (position: ${events[events.length - 1].globalPosition})`);
        } else {
          // No new events, wait before polling again
          await new Promise(r => setTimeout(r, this.pollInterval));
        }
      } catch (error) {
        console.error('Subscription error:', error);
        await new Promise(r => setTimeout(r, 5000)); // Wait before retry
      }
    }
  }

  stop() {
    this.running = false;
    console.log(`⏹️ Stopping subscription: ${this.subscriptionId}`);
  }
}

// ==========================================
// DEMONSTRATION (In-Memory Mock)
// ==========================================

// Mock for demonstration without actual PostgreSQL
class InMemoryEventStore {
  constructor() {
    this.events = [];
    this.subscriptions = new Map();
    this.globalPosition = 0;
  }

  async initialize() {
    console.log('✅ In-memory event store initialized');
  }

  async appendToStream(streamId, events, expectedVersion = null) {
    const streamEvents = this.events.filter(e => e.streamId === streamId);
    const currentVersion = streamEvents.length > 0
      ? Math.max(...streamEvents.map(e => e.streamVersion))
      : 0;

    if (expectedVersion !== null && currentVersion !== expectedVersion) {
      throw new ConcurrencyError(
        `Expected version ${expectedVersion}, but stream is at version ${currentVersion}`
      );
    }

    let version = currentVersion;
    const appendedEvents = [];

    for (const event of events) {
      version++;
      this.globalPosition++;

      const storedEvent = {
        globalPosition: this.globalPosition,
        streamId,
        streamVersion: version,
        eventType: event.type,
        eventData: event.data,
        metadata: event.metadata || {},
        createdAt: new Date()
      };

      this.events.push(storedEvent);
      appendedEvents.push(storedEvent);
    }

    console.log(`📝 Appended ${events.length} event(s) to stream ${streamId} (v${version})`);
    return { newVersion: version, events: appendedEvents };
  }

  async readStream(streamId, fromVersion = 0) {
    return this.events
      .filter(e => e.streamId === streamId && e.streamVersion > fromVersion)
      .sort((a, b) => a.streamVersion - b.streamVersion);
  }

  async readAll(fromPosition = 0, maxCount = 1000) {
    return this.events
      .filter(e => e.globalPosition > fromPosition)
      .sort((a, b) => a.globalPosition - b.globalPosition)
      .slice(0, maxCount);
  }

  async getSubscriptionPosition(subscriptionId) {
    return this.subscriptions.get(subscriptionId) || 0;
  }

  async updateSubscriptionPosition(subscriptionId, position) {
    this.subscriptions.set(subscriptionId, position);
  }

  async getStreamVersion(streamId) {
    const streamEvents = this.events.filter(e => e.streamId === streamId);
    return streamEvents.length > 0
      ? Math.max(...streamEvents.map(e => e.streamVersion))
      : 0;
  }

  async close() {}
}

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('EVENT STORE IMPLEMENTATION');
  console.log('='.repeat(60));

  const eventStore = new InMemoryEventStore();
  await eventStore.initialize();

  // Append events to order stream
  console.log('\n--- Appending Events ---');

  await eventStore.appendToStream('order-123', [
    { type: 'OrderCreated', data: { customerId: 'cust-1', total: 99.99 } },
    { type: 'ItemAdded', data: { productId: 'prod-1', quantity: 2 } }
  ]);

  await eventStore.appendToStream('order-123', [
    { type: 'OrderSubmitted', data: { submittedAt: new Date().toISOString() } }
  ], 2); // Expected version = 2

  await eventStore.appendToStream('order-456', [
    { type: 'OrderCreated', data: { customerId: 'cust-2', total: 149.99 } }
  ]);

  // Read stream
  console.log('\n--- Reading Stream ---');
  const streamEvents = await eventStore.readStream('order-123');
  console.log('Order-123 events:');
  streamEvents.forEach(e => console.log(`  v${e.streamVersion}: ${e.eventType}`));

  // Read all (for projections)
  console.log('\n--- Reading All Events ---');
  const allEvents = await eventStore.readAll(0);
  console.log('All events in store:');
  allEvents.forEach(e => console.log(`  #${e.globalPosition}: ${e.streamId} - ${e.eventType}`));

  // Demonstrate concurrency conflict
  console.log('\n--- Concurrency Conflict Demo ---');
  try {
    await eventStore.appendToStream('order-123', [
      { type: 'ItemAdded', data: { productId: 'prod-2' } }
    ], 2); // Wrong expected version!
  } catch (e) {
    console.log(`✅ Caught: ${e.message}`);
  }

  // Subscription demo
  console.log('\n--- Subscription Demo ---');
  let processedCount = 0;
  const subscription = new SubscriptionProcessor(
    eventStore,
    'order-projection',
    async (event) => {
      processedCount++;
      console.log(`  Processing: ${event.eventType} (position ${event.globalPosition})`);
    }
  );

  // Process existing events
  const position = await eventStore.getSubscriptionPosition('order-projection');
  const events = await eventStore.readAll(position);
  for (const event of events) {
    await subscription.handler(event);
    await eventStore.updateSubscriptionPosition('order-projection', event.globalPosition);
  }

  console.log(`\n✅ Demo complete! Processed ${processedCount} events.`);
  await eventStore.close();
}

demonstrate().catch(console.error);

module.exports = { PostgresEventStore, InMemoryEventStore, ConcurrencyError, SubscriptionProcessor };
```

---

## Event Store Operations

| Operation | Description | Use Case |
|-----------|-------------|----------|
| `appendToStream` | Add events to a stream | Command handling |
| `readStream` | Read events for one aggregate | Aggregate rehydration |
| `readAll` | Read all events globally | Projections, catch-up |
| `getSubscriptionPosition` | Track projection progress | Resumable subscriptions |

---

## Production Considerations

```
SCALING EVENT STORES:

1. PARTITIONING
   └── Partition by stream_id hash for write scaling

2. ARCHIVAL
   └── Move old events to cold storage (S3, etc.)

3. SNAPSHOTS
   └── Store aggregate state every N events

4. INDEXES
   └── Index event_type for cross-stream queries

5. CACHING
   └── Cache hot streams in Redis

EXAMPLE: EventStoreDB
├── Built specifically for event sourcing
├── Optimized for append-only workloads
├── Built-in subscriptions
└── Projections with JavaScript
```

---

## Related POCs

- [Event Sourcing Basics](/interview-prep/practice-pocs/event-sourcing-basics)
- [CQRS Pattern](/interview-prep/practice-pocs/cqrs-pattern)
- [Saga Pattern](/interview-prep/practice-pocs/saga-pattern)
