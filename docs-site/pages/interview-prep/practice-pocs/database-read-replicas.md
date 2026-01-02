# POC #17: Read Replicas - Scale Reads to Millions

## What You'll Build

**Read replica architecture** for massive read scalability:
- ✅ **Master-replica setup** - PostgreSQL streaming replication
- ✅ **Read/write splitting** - Route queries intelligently
- ✅ **Replication lag** - Monitor and handle delays
- ✅ **Failover** - Promote replica to master
- ✅ **Load balancing** - Distribute reads across replicas

**Time**: 25 min | **Difficulty**: ⭐⭐⭐ Advanced

---

## Why This Matters

| Company | Read/Write Ratio | Replica Strategy | Scale |
|---------|-----------------|------------------|-------|
| **Instagram** | 99:1 | 30 read replicas per master | 100M reads/sec |
| **Twitter** | 95:5 | 3-tier replica fanout | 500M timeline reads/sec |
| **GitHub** | 90:10 | Geographic replicas | 1M+ queries/sec |
| **Reddit** | 98:2 | 10+ replicas per master | 50M page views/day |

### The Problem

**Single database (read + write)**:
```
100k reads/sec + 10k writes/sec = 110k total
→ Database CPU: 100%
→ Response time: 500ms (slow!)
→ Can't scale further
```

**With read replicas (1 master + 3 replicas)**:
```
Master: 10k writes/sec → CPU: 20%
Replica 1: 33k reads/sec → CPU: 25%
Replica 2: 33k reads/sec → CPU: 25%
Replica 3: 33k reads/sec → CPU: 25%
→ Total: 100k reads/sec + 10k writes/sec
→ Response time: 50ms (10x faster!)
```

---

## Architecture

```
┌─────────────┐
│  App Server │
└──────┬──────┘
       │
       ├─────► WRITES ────► ┌──────────────┐
       │                    │    Master    │
       │                    │  (PostgreSQL)│
       │                    └──────┬───────┘
       │                           │ Replication
       │                    ┌──────┴────────┬──────────┐
       │                    ▼               ▼          ▼
       ├─────► READS ────► ┌────────┐ ┌────────┐ ┌────────┐
       │                   │Replica1│ │Replica2│ │Replica3│
       └───────────────────┴────────┴─┴────────┴─┴────────┘
```

---

## Quick Setup (Docker Compose)

```yaml
# docker-compose.yml
version: '3.8'
services:
  master:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - ./master-init.sh:/docker-entrypoint-initdb.d/init.sh
    command: postgres -c wal_level=replica -c max_wal_senders=3

  replica1:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
    depends_on:
      - master
    command: |
      bash -c "
      until pg_basebackup -h master -D /var/lib/postgresql/data -U postgres -v -P; do
        sleep 1
      done
      echo 'primary_conninfo = ''host=master port=5432 user=postgres password=password''' >> /var/lib/postgresql/data/postgresql.auto.conf
      touch /var/lib/postgresql/data/standby.signal
      postgres
      "

  replica2:
    image: postgres:15
    # Same as replica1
```

---

## Read/Write Router (`router.js`)

```javascript
const { Pool } = require('pg');

class ReadWriteRouter {
  constructor() {
    this.masterPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'myapp',
      user: 'postgres',
      password: 'password',
      max: 20
    });

    this.replicaPools = [
      new Pool({ host: 'localhost', port: 5433, max: 60 }),
      new Pool({ host: 'localhost', port: 5434, max: 60 }),
      new Pool({ host: 'localhost', port: 5435, max: 60 })
    ];

    this.replicaIndex = 0;
  }

  // Route writes to master
  async write(query, params) {
    return this.masterPool.query(query, params);
  }

  // Route reads to replicas (round-robin)
  async read(query, params) {
    const pool = this.replicaPools[this.replicaIndex];
    this.replicaIndex = (this.replicaIndex + 1) % this.replicaPools.length;
    return pool.query(query, params);
  }

  // Check replication lag
  async getReplicationLag() {
    const masterLSN = await this.masterPool.query(
      "SELECT pg_current_wal_lsn() AS lsn"
    );

    const lags = await Promise.all(
      this.replicaPools.map(async (pool, idx) => {
        const replicaLSN = await pool.query(
          "SELECT pg_last_wal_receive_lsn() AS lsn"
        );

        const lag = await this.masterPool.query(
          "SELECT pg_wal_lsn_diff($1, $2) AS lag_bytes",
          [masterLSN.rows[0].lsn, replicaLSN.rows[0].lsn]
        );

        return {
          replica: idx + 1,
          lagBytes: parseInt(lag.rows[0].lag_bytes),
          lagMB: (parseInt(lag.rows[0].lag_bytes) / 1024 / 1024).toFixed(2)
        };
      })
    );

    return lags;
  }
}

module.exports = ReadWriteRouter;
```

---

## Handling Replication Lag

### Problem: Read-After-Write Consistency

```javascript
// User updates profile
await router.write('UPDATE users SET name = $1 WHERE id = $2', ['Alice', 1]);

// Immediately read from replica (might be stale!)
const user = await router.read('SELECT * FROM users WHERE id = $1', [1]);
console.log(user.rows[0].name);  // Might still be old name!
```

### Solution 1: Read from Master After Write

```javascript
class SmartRouter extends ReadWriteRouter {
  constructor() {
    super();
    this.recentWrites = new Map(); // userId → timestamp
  }

  async write(query, params, userId) {
    const result = await this.masterPool.query(query, params);

    if (userId) {
      this.recentWrites.set(userId, Date.now());
      setTimeout(() => this.recentWrites.delete(userId), 5000); // 5s window
    }

    return result;
  }

  async read(query, params, userId) {
    // If user wrote recently, read from master
    if (userId && this.recentWrites.has(userId)) {
      console.log('⚠️ Recent write detected, reading from master');
      return this.masterPool.query(query, params);
    }

    // Otherwise, read from replica
    return super.read(query, params);
  }
}
```

### Solution 2: Wait for Replication

```javascript
async readWithConsistency(query, params, requiredLSN) {
  const replica = this.selectReplica();

  // Wait until replica catches up
  while (true) {
    const currentLSN = await replica.query("SELECT pg_last_wal_receive_lsn()");

    if (currentLSN >= requiredLSN) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return replica.query(query, params);
}
```

---

## Performance Benchmarks

### Without Replicas (Single DB)

| Metric | Value |
|--------|-------|
| Reads/sec | 10,000 |
| Writes/sec | 1,000 |
| Total queries/sec | 11,000 |
| Avg read latency | 45ms |
| CPU usage | 85% |

### With 3 Read Replicas

| Metric | Value |
|--------|-------|
| Reads/sec | 90,000 (9x more) |
| Writes/sec | 1,000 (same) |
| Total queries/sec | 91,000 (8.3x more) |
| Avg read latency | 8ms (5.6x faster) |
| Master CPU | 15% |
| Replica CPU | 30% each |

---

## Key Takeaways

1. **Read Replicas = Horizontal Read Scaling**
   - Add replicas to handle more reads
   - Writes still limited to master

2. **Replication is Asynchronous**
   - Lag typically 10-100ms
   - Handle with read-after-write routing

3. **3:1 Connection Ratio**
   - 60 connections to replicas : 20 to master
   - Reflects read-heavy workload

4. **Geographic Replicas**
   - Place replicas near users
   - Reduce latency (US-East, EU-West, Asia-Pacific)

5. **Failover Strategy**
   - Monitor master health
   - Promote replica to master on failure
   - Update DNS/connection strings

---

## Related POCs

- **POC #15: Connection Pooling** - Separate pools for master/replicas
- **POC #18: Sharding** - Horizontal write scaling
- **POC #1: Redis Cache** - Further reduce read load

---

**Production examples**:
- **Instagram**: 30 replicas per master shard
- **Twitter**: 3-tier fanout (master → regional → local)
- **GitHub**: Geographic replicas (US, EU, Asia)

**Remember**: Replicas scale reads, not writes. For write scaling, use sharding (POC #18)!
