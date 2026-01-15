# POC #81: Event Sourcing Basics

> **Difficulty:** 🔴 Advanced
> **Time:** 30 minutes
> **Prerequisites:** Node.js, Database concepts, Domain modeling

## What You'll Learn

Event Sourcing stores state changes as a sequence of events instead of current state. You can rebuild any past state by replaying events.

```
TRADITIONAL STATE:
┌─────────────────────────────────────────────────────────────────┐
│  Account: ACC-001                                               │
│  Balance: $500                                                  │
│  Status: Active                                                 │
│                                                                 │
│  ❓ How did we get to $500? No history!                         │
└─────────────────────────────────────────────────────────────────┘

EVENT SOURCING:
┌─────────────────────────────────────────────────────────────────┐
│  Event Stream: ACC-001                                          │
├─────────────────────────────────────────────────────────────────┤
│  1. AccountOpened    { balance: 0 }           → State: $0       │
│  2. MoneyDeposited   { amount: 1000 }         → State: $1000    │
│  3. MoneyWithdrawn   { amount: 300 }          → State: $700     │
│  4. MoneyWithdrawn   { amount: 200 }          → State: $500     │
│                                                                 │
│  ✅ Complete audit trail! Can replay to any point in time       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// event-sourcing.js

// ==========================================
// EVENT STORE (In-Memory for POC)
// ==========================================

class EventStore {
  constructor() {
    this.events = new Map();  // streamId -> events[]
    this.globalSequence = 0;
  }

  // Append events to a stream
  append(streamId, events, expectedVersion = null) {
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }

    const stream = this.events.get(streamId);
    const currentVersion = stream.length;

    // Optimistic concurrency check
    if (expectedVersion !== null && currentVersion !== expectedVersion) {
      throw new Error(
        `Concurrency conflict: expected version ${expectedVersion}, got ${currentVersion}`
      );
    }

    // Append events with metadata
    for (const event of events) {
      this.globalSequence++;
      stream.push({
        ...event,
        streamId,
        version: stream.length,
        globalSequence: this.globalSequence,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📝 Appended ${events.length} event(s) to stream ${streamId}`);
    return stream.length;
  }

  // Read events from a stream
  getStream(streamId, fromVersion = 0) {
    const stream = this.events.get(streamId) || [];
    return stream.slice(fromVersion);
  }

  // Read all events (for projections)
  getAllEvents(fromSequence = 0) {
    const allEvents = [];
    for (const [_, stream] of this.events) {
      allEvents.push(...stream);
    }
    return allEvents
      .filter(e => e.globalSequence > fromSequence)
      .sort((a, b) => a.globalSequence - b.globalSequence);
  }
}

// ==========================================
// AGGREGATE (Domain Model)
// ==========================================

class BankAccount {
  constructor() {
    this.id = null;
    this.balance = 0;
    this.status = null;
    this.version = 0;
    this.uncommittedEvents = [];
  }

  // Factory: Create new account
  static create(accountId, ownerName) {
    const account = new BankAccount();
    account.apply({
      type: 'AccountOpened',
      data: { accountId, ownerName, openedAt: new Date().toISOString() }
    });
    return account;
  }

  // Factory: Load from event stream
  static fromEvents(events) {
    const account = new BankAccount();
    for (const event of events) {
      account.applyEvent(event);
      account.version = event.version;
    }
    return account;
  }

  // Commands (business operations)
  deposit(amount) {
    if (this.status !== 'active') {
      throw new Error('Account is not active');
    }
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    this.apply({
      type: 'MoneyDeposited',
      data: { amount, balanceAfter: this.balance + amount }
    });
  }

  withdraw(amount) {
    if (this.status !== 'active') {
      throw new Error('Account is not active');
    }
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (amount > this.balance) {
      throw new Error('Insufficient funds');
    }

    this.apply({
      type: 'MoneyWithdrawn',
      data: { amount, balanceAfter: this.balance - amount }
    });
  }

  close(reason) {
    if (this.status === 'closed') {
      throw new Error('Account is already closed');
    }
    if (this.balance > 0) {
      throw new Error('Cannot close account with positive balance');
    }

    this.apply({
      type: 'AccountClosed',
      data: { reason, closedAt: new Date().toISOString() }
    });
  }

  // Apply event (record + mutate state)
  apply(event) {
    this.uncommittedEvents.push(event);
    this.applyEvent(event);
  }

  // Event handlers (state mutations)
  applyEvent(event) {
    switch (event.type) {
      case 'AccountOpened':
        this.id = event.data.accountId;
        this.balance = 0;
        this.status = 'active';
        break;

      case 'MoneyDeposited':
        this.balance += event.data.amount;
        break;

      case 'MoneyWithdrawn':
        this.balance -= event.data.amount;
        break;

      case 'AccountClosed':
        this.status = 'closed';
        break;

      default:
        console.warn(`Unknown event type: ${event.type}`);
    }
  }

  // Get uncommitted events and clear
  getUncommittedEvents() {
    const events = [...this.uncommittedEvents];
    this.uncommittedEvents = [];
    return events;
  }
}

// ==========================================
// REPOSITORY (Persistence)
// ==========================================

class BankAccountRepository {
  constructor(eventStore) {
    this.eventStore = eventStore;
  }

  // Load aggregate from event store
  async load(accountId) {
    const events = this.eventStore.getStream(accountId);
    if (events.length === 0) {
      return null;
    }
    return BankAccount.fromEvents(events);
  }

  // Save aggregate (append new events)
  async save(account) {
    const events = account.getUncommittedEvents();
    if (events.length === 0) return;

    const newVersion = this.eventStore.append(
      account.id,
      events,
      account.version
    );
    account.version = newVersion;
  }
}

// ==========================================
// PROJECTION (Read Model)
// ==========================================

class AccountBalanceProjection {
  constructor() {
    this.balances = new Map();  // accountId -> { balance, status, lastUpdated }
    this.lastProcessedSequence = 0;
  }

  // Process events to build read model
  project(events) {
    for (const event of events) {
      if (event.globalSequence <= this.lastProcessedSequence) continue;

      switch (event.type) {
        case 'AccountOpened':
          this.balances.set(event.data.accountId, {
            balance: 0,
            status: 'active',
            owner: event.data.ownerName,
            lastUpdated: event.timestamp
          });
          break;

        case 'MoneyDeposited':
        case 'MoneyWithdrawn':
          const account = this.balances.get(event.streamId);
          if (account) {
            account.balance = event.data.balanceAfter;
            account.lastUpdated = event.timestamp;
          }
          break;

        case 'AccountClosed':
          const closedAccount = this.balances.get(event.streamId);
          if (closedAccount) {
            closedAccount.status = 'closed';
            closedAccount.lastUpdated = event.timestamp;
          }
          break;
      }

      this.lastProcessedSequence = event.globalSequence;
    }
  }

  // Query methods
  getBalance(accountId) {
    return this.balances.get(accountId);
  }

  getAllAccounts() {
    return Array.from(this.balances.entries()).map(([id, data]) => ({
      accountId: id,
      ...data
    }));
  }

  getTotalDeposits() {
    let total = 0;
    for (const [_, data] of this.balances) {
      total += data.balance;
    }
    return total;
  }
}

// ==========================================
// SNAPSHOT (Performance Optimization)
// ==========================================

class SnapshotStore {
  constructor() {
    this.snapshots = new Map();  // streamId -> { state, version }
  }

  save(streamId, state, version) {
    this.snapshots.set(streamId, { state, version });
    console.log(`📸 Snapshot saved for ${streamId} at version ${version}`);
  }

  get(streamId) {
    return this.snapshots.get(streamId);
  }
}

class SnapshottedRepository {
  constructor(eventStore, snapshotStore, snapshotInterval = 10) {
    this.eventStore = eventStore;
    this.snapshotStore = snapshotStore;
    this.snapshotInterval = snapshotInterval;
  }

  async load(accountId) {
    // Try to load from snapshot
    const snapshot = this.snapshotStore.get(accountId);
    let account;
    let fromVersion = 0;

    if (snapshot) {
      account = new BankAccount();
      Object.assign(account, snapshot.state);
      account.version = snapshot.version;
      fromVersion = snapshot.version;
      console.log(`📸 Loaded from snapshot at version ${fromVersion}`);
    } else {
      account = new BankAccount();
    }

    // Apply events since snapshot
    const events = this.eventStore.getStream(accountId, fromVersion);
    for (const event of events) {
      account.applyEvent(event);
      account.version = event.version;
    }

    return account.id ? account : null;
  }

  async save(account) {
    const events = account.getUncommittedEvents();
    if (events.length === 0) return;

    const newVersion = this.eventStore.append(account.id, events, account.version);
    account.version = newVersion;

    // Create snapshot if interval reached
    if (newVersion % this.snapshotInterval === 0) {
      this.snapshotStore.save(account.id, {
        id: account.id,
        balance: account.balance,
        status: account.status
      }, newVersion);
    }
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('EVENT SOURCING BASICS');
  console.log('='.repeat(60));

  const eventStore = new EventStore();
  const repository = new BankAccountRepository(eventStore);
  const projection = new AccountBalanceProjection();

  // Create new account
  console.log('\n--- Creating Account ---');
  const account = BankAccount.create('ACC-001', 'John Doe');
  await repository.save(account);

  // Perform operations
  console.log('\n--- Performing Transactions ---');
  account.deposit(1000);
  account.deposit(500);
  account.withdraw(300);
  account.withdraw(200);
  await repository.save(account);

  // View event stream
  console.log('\n--- Event Stream ---');
  const events = eventStore.getStream('ACC-001');
  events.forEach((e, i) => {
    console.log(`${i + 1}. ${e.type}: ${JSON.stringify(e.data)}`);
  });

  // Build projection
  console.log('\n--- Building Projection ---');
  projection.project(eventStore.getAllEvents());
  console.log('Account State:', projection.getBalance('ACC-001'));

  // Create another account
  console.log('\n--- Creating Second Account ---');
  const account2 = BankAccount.create('ACC-002', 'Jane Smith');
  await repository.save(account2);
  account2.deposit(2000);
  await repository.save(account2);

  // Update projection
  projection.project(eventStore.getAllEvents());
  console.log('\n--- All Accounts ---');
  console.log(projection.getAllAccounts());
  console.log('Total in bank:', projection.getTotalDeposits());

  // Reload account from events (time travel!)
  console.log('\n--- Reloading Account from Events ---');
  const reloadedAccount = await repository.load('ACC-001');
  console.log('Reloaded balance:', reloadedAccount.balance);

  // Demonstrate optimistic concurrency
  console.log('\n--- Concurrency Conflict Demo ---');
  try {
    const acc1 = await repository.load('ACC-001');
    const acc2 = await repository.load('ACC-001');

    acc1.deposit(100);
    await repository.save(acc1);

    acc2.deposit(50);  // This will fail - version mismatch
    await repository.save(acc2);
  } catch (e) {
    console.log(`✅ Caught conflict: ${e.message}`);
  }

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## Event Sourcing Benefits

| Benefit | Description |
|---------|-------------|
| **Complete Audit Trail** | Every change is recorded, nothing lost |
| **Time Travel** | Rebuild state at any point in time |
| **Event Replay** | Fix bugs and regenerate projections |
| **Decoupling** | Write and read models can evolve independently |
| **Analytics** | Rich data for ML and business intelligence |

---

## When to Use Event Sourcing

```
✅ GOOD FIT:
├── Financial systems (banking, trading)
├── Audit-critical domains (healthcare, legal)
├── Collaborative editing (Google Docs)
├── Game state (multiplayer games)
└── Complex business workflows

❌ POOR FIT:
├── Simple CRUD applications
├── High-volume, low-value data
├── Systems with no audit requirements
└── Teams unfamiliar with the pattern
```

---

## Related POCs

- [CQRS Pattern](/interview-prep/practice-pocs/cqrs-pattern)
- [Saga Pattern](/interview-prep/practice-pocs/saga-pattern)
- [Outbox Pattern](/interview-prep/practice-pocs/outbox-pattern)
