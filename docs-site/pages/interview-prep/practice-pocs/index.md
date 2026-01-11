# Practice POCs: Learn by Building

## What Are These POCs?

**POC** = Proof of Concept

These are **runnable, production-ready mini-projects** that teach you system design through hands-on practice. Each POC:

- ✅ **Runs in 15-20 minutes** (Docker + Node.js)
- ✅ **Independent** (learn one concept at a time)
- ✅ **Composable** (combine into larger systems)
- ✅ **Real-world** (used by Netflix, Uber, Twitter, etc.)
- ✅ **Production patterns** (not toy examples)

---

## 🎯 Learning Philosophy

### Traditional Approach ❌
```
Read theory → Try to build → Get stuck → Give up
```

### Our Approach ✅
```
Build POC (15 min) → See results → Understand deeply → Build more → Master it
```

**Example**: Instead of reading "how Redis caching works", you'll:
1. Build a cache system (15 min)
2. See 22x performance improvement
3. Test race conditions
4. Measure database load reduction (95%)
5. **Understand** because you built it

---

## 📊 Progress Tracker

| Category | POCs Completed | Target | Progress |
|----------|----------------|--------|----------|
| **Redis Patterns** | **10** | 100 | 10% |
| **Database Patterns** | **20** | 150 | 13% |
| Message Queues | 0 | 100 | 0% |
| API Design | 0 | 80 | 0% |
| Real-Time Systems | 0 | 70 | 0% |
| **TOTAL** | **30** | **1000+** | **3%** |

---

## 🔥 Redis Patterns (10/100 POCs)

### ✅ Core Redis Operations (POCs 1-5)

#### 1. [Redis Key-Value Cache](/interview-prep/practice-pocs/redis-key-value-cache)
**What**: Cache database queries to speed up your API
**Performance**: 22x faster (45ms → 2ms)
**Used by**: Netflix, Twitter, Instagram
**Time**: 15 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- Cache-aside pattern
- TTL expiration
- Cache invalidation
- Load test showing 95% database load reduction

**Key learning**: How caching makes systems 10-100x faster

---

#### 2. [Redis Counter with INCR](/interview-prep/practice-pocs/redis-counter)
**What**: Atomic counters for analytics, likes, votes, views
**Performance**: 500x faster than database counters
**Used by**: Reddit, YouTube, Twitter, Medium
**Time**: 15 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- Page view counter
- Like/unlike system
- Rate limiting with counters
- Race condition prevention

**Key learning**: Atomic operations prevent race conditions

---

#### 3. [Distributed Lock with Redis](/interview-prep/practice-pocs/redis-distributed-lock)
**What**: Prevent race conditions in distributed systems
**Performance**: 100% accuracy vs 87% with database locks
**Used by**: Stripe, Uber, Airbnb
**Time**: 15 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- SETNX-based lock
- Automatic expiration (prevent deadlock)
- Token-based release
- Inventory system with/without lock comparison

**Key learning**: How to prevent overselling, double-booking, duplicate charges

---

#### 4. [Job Queue with Redis Lists](/interview-prep/practice-pocs/redis-job-queue)
**What**: Background processing for slow tasks (email, images, reports)
**Performance**: 1,100x faster user response (11s → 10ms)
**Used by**: GitHub, Shopify, Instagram
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Producer-consumer pattern
- Multiple workers
- Job retry logic
- Priority queue

**Key learning**: Async processing makes apps feel instant

---

#### 5. [Leaderboard with Redis Sorted Sets](/interview-prep/practice-pocs/redis-leaderboard)
**What**: Real-time rankings for games, social apps, competitions
**Performance**: 1000x faster than database rankings
**Used by**: Fortnite, Duolingo, Stack Overflow
**Time**: 15 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- Global leaderboard
- Weekly/daily leaderboards
- Player rank lookup
- "Players around me" feature
- Tier system (Bronze, Silver, Gold)

**Key learning**: Sorted Sets are perfect for rankings

---

### ✅ Advanced Redis Patterns (POCs 6-10)

#### 6. [Session Management with Redis Hashes](/interview-prep/practice-pocs/redis-session-management)
**What**: Multi-server session storage for horizontal scaling
**Performance**: Instant session sharing across servers
**Used by**: Netflix, Amazon, LinkedIn
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Centralized session store
- Multi-device support
- Sliding expiration
- Session data updates (cart, preferences)

**Key learning**: Hashes enable stateless server scaling

---

#### 7. [API Rate Limiting with Sliding Window](/interview-prep/practice-pocs/redis-rate-limiting)
**What**: Protect APIs from abuse with accurate rate limiting
**Performance**: 100x more accurate than fixed window
**Used by**: Stripe, Twitter, GitHub, Shopify
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Sliding window algorithm
- Per-user and per-IP limits
- Multiple tiers (free, premium)
- Distributed rate limiting

**Key learning**: Sliding windows prevent burst exploitation

---

#### 8. [Real-Time Notifications with Pub/Sub](/interview-prep/practice-pocs/redis-pubsub)
**What**: Real-time message broadcasting across servers
**Performance**: 20x faster than polling (sub-50ms delivery)
**Used by**: Slack, Discord, Trading platforms
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Publisher-subscriber pattern
- Multi-server message delivery
- WebSocket integration
- Channel patterns (user:*, order:*)

**Key learning**: Pub/Sub enables real-time cross-server communication

---

#### 9. [Event Sourcing with Redis Streams](/interview-prep/practice-pocs/redis-streams)
**What**: Capture all state changes as immutable events
**Performance**: 37x faster than PostgreSQL event log
**Used by**: Uber, Amazon, Stripe, Netflix
**Time**: 20 minutes
**Difficulty**: ⭐⭐⭐ Advanced

**You'll build**:
- Event append and replay
- Consumer groups for parallel processing
- Guaranteed delivery
- Time-travel debugging

**Key learning**: Event sourcing provides complete audit trails

---

#### 10. [Unique Counting with HyperLogLog](/interview-prep/practice-pocs/redis-hyperloglog)
**What**: Count millions of unique items with 12KB memory
**Performance**: 99.6% memory reduction vs Sets
**Used by**: Twitter, Reddit, Google Analytics
**Time**: 15 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Unique visitor tracking
- Daily/weekly active users (union)
- Memory comparison (HLL vs Set)
- Multi-dimensional analytics

**Key learning**: Trade 0.81% accuracy for 266x memory savings

---

## 💾 Database Patterns (10/150 POCs)

### ✅ Core Database Operations (POCs 11-15)

#### 11. [Production CRUD Operations](/interview-prep/practice-pocs/database-crud)
**What**: Production-ready Create, Read, Update, Delete with PostgreSQL
**Performance**: 25x faster with connection pooling (45ms → 1.8ms)
**Used by**: Instagram, Uber, Airbnb, GitHub
**Time**: 20 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- Connection pooling (reuse connections)
- Prepared statements (SQL injection protection)
- Transaction management (ACID guarantees)
- Bulk operations (62x faster inserts)
- Pagination for millions of records

**Key learning**: Connection pooling is NOT optional in production

---

#### 12. [B-Tree Indexes for Query Performance](/interview-prep/practice-pocs/database-indexes)
**What**: Make queries 1000x faster with proper indexing
**Performance**: 128ms → 2ms with single index (64x faster)
**Used by**: Twitter, GitHub, Stripe, Stack Overflow
**Time**: 25 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Single-column B-Tree indexes
- Composite indexes (multi-column)
- Partial indexes (filtered, save 80% space)
- Functional indexes (LOWER, expressions)
- Index analysis with EXPLAIN

**Key learning**: Indexes are a read/write trade-off - choose wisely

---

#### 13. [Fix the N+1 Query Problem](/interview-prep/practice-pocs/database-n-plus-one)
**What**: Eliminate the hidden performance killer
**Performance**: 2450ms → 25ms with DataLoader (98x faster)
**Used by**: Instagram, Shopify, GitHub, GraphQL apps
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- N+1 problem demonstration
- JOIN-based solutions
- DataLoader pattern (batching)
- GraphQL optimization

**Key learning**: 1 query with JOIN beats N separate queries

---

#### 14. [Master EXPLAIN - Read Query Plans](/interview-prep/practice-pocs/database-explain)
**What**: Understand and optimize PostgreSQL query execution
**Performance**: Find and fix slow queries (500ms → 5ms)
**Used by**: Twitter, Uber, Airbnb (all production DBs)
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- EXPLAIN ANALYZE interpretation
- Seq Scan vs Index Scan identification
- Cost estimation understanding
- Query optimization strategies

**Key learning**: EXPLAIN is your best friend for optimization

---

#### 15. [Advanced Connection Pooling](/interview-prep/practice-pocs/database-connection-pooling)
**What**: Scale to 100k requests/sec with optimal pooling
**Performance**: Handle 10k req/sec with 20 connections
**Used by**: Instagram, Uber, GitHub, Discord
**Time**: 25 minutes
**Difficulty**: ⭐⭐⭐ Advanced

**You'll build**:
- Optimal pool sizing formula
- Read/write pool splitting
- PgBouncer setup (10k+ connections)
- Pool monitoring and metrics
- Connection lifecycle management

**Key learning**: Pool size = (cores × 2) + 1, not max_connections

---

### ✅ Advanced Database Patterns (POCs 16-20)

#### 16. [Database Transactions & Isolation Levels](/interview-prep/practice-pocs/database-transactions)
**What**: ACID transactions and preventing race conditions
**Performance**: Guarantee data consistency under concurrent load
**Used by**: Stripe, Uber, Amazon, PayPal
**Time**: 25 minutes
**Difficulty**: ⭐⭐⭐ Advanced

**You'll build**:
- BEGIN/COMMIT/ROLLBACK patterns
- Isolation levels (Read Committed, Serializable)
- Pessimistic locking (SELECT FOR UPDATE)
- Optimistic locking (version columns)
- Deadlock detection and prevention

**Key learning**: Transactions guarantee ACID properties

---

#### 17. [Read Replicas - Scale Reads to Millions](/interview-prep/practice-pocs/database-read-replicas)
**What**: Master-replica architecture for massive read scalability
**Performance**: 8.3x more throughput with 3 replicas
**Used by**: Instagram, Twitter, GitHub, Reddit
**Time**: 25 minutes
**Difficulty**: ⭐⭐⭐ Advanced

**You'll build**:
- PostgreSQL streaming replication
- Read/write routing (master for writes, replicas for reads)
- Replication lag monitoring
- Read-after-write consistency handling
- Failover and promotion

**Key learning**: Replicas scale reads, not writes

---

#### 18. [Database Sharding - Scale Writes to Billions](/interview-prep/practice-pocs/database-sharding)
**What**: Horizontal partitioning for unlimited write scalability
**Performance**: 4x write throughput with 4 shards
**Used by**: Instagram, Uber, Discord, Pinterest
**Time**: 30 minutes
**Difficulty**: ⭐⭐⭐ Advanced

**You'll build**:
- Hash-based sharding (even distribution)
- Range-based sharding (geographic, time-based)
- Shard routing logic
- Cross-shard queries (scatter-gather)
- Consistent hashing for resharding

**Key learning**: Sharding is a last resort - try replicas first

---

#### 19. [JSONB in PostgreSQL - Flexible Schema](/interview-prep/practice-pocs/database-jsonb)
**What**: Schema flexibility without sacrificing performance
**Performance**: 15x faster queries with GIN indexes
**Used by**: Stripe, Uber, Shopify, Notion
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- JSONB storage and querying
- GIN indexes for JSON fields
- JSON operators (@>, ?, ->>, #>>)
- Partial JSONB updates
- Hybrid schema (columns + JSONB)

**Key learning**: JSONB gives NoSQL flexibility with SQL guarantees

---

#### 20. [Full-Text Search in PostgreSQL](/interview-prep/practice-pocs/database-full-text-search)
**What**: Production search without Elasticsearch
**Performance**: 56x faster than LIKE with GIN indexes
**Used by**: Stack Overflow, GitLab, Discourse
**Time**: 20 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- tsvector and tsquery for full-text search
- GIN indexes for fast searching
- Relevance ranking with ts_rank
- Search highlighting
- Trigram fuzzy search (typo tolerance)

**Key learning**: Start with PostgreSQL FTS, upgrade to Elasticsearch only when needed

---

### ✅ Advanced Database Patterns II (POCs 21-30)

#### 21. [Database Triggers - Auto-Update Data](/interview-prep/practice-pocs/database-triggers)
**What**: Auto-execute logic on INSERT/UPDATE/DELETE
**Performance**: Eliminate 95% of manual data updates
**Used by**: Stripe, Salesforce, Uber, GitHub
**Time**: 15 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Auto-update timestamps (created_at, updated_at)
- Audit logging (track all changes)
- Data validation triggers
- Cascading updates (derived data)

**Key learning**: Triggers enforce consistency at database level

---

#### 22. [Database Views - Simplify Complex Queries](/interview-prep/practice-pocs/database-views)
**What**: Encapsulate complex queries into reusable virtual tables
**Performance**: Reduce code by 80% (1 view vs 15 duplicated queries)
**Used by**: GitHub, Stripe, Salesforce, Netflix
**Time**: 10 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- Simple views (encapsulate JOINs)
- Security views (row-level filtering)
- Column renaming views
- Aggregation views

**Key learning**: Views are query macros - write once, use everywhere

---

#### 23. [Materialized Views - Cache Expensive Queries](/interview-prep/practice-pocs/database-materialized-views)
**What**: Pre-compute and cache query results for massive speed gains
**Performance**: 1000x faster (45s → 40ms)
**Used by**: Stripe, GitHub, Reddit, Netflix
**Time**: 15 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Materialized views with indexes
- Scheduled refresh (pg_cron)
- Concurrent refresh (no downtime)
- Incremental refresh strategies

**Key learning**: Materialized views trade freshness for speed

---

#### 24. [CTEs (Common Table Expressions) - Readable SQL](/interview-prep/practice-pocs/database-ctes)
**What**: Write SQL like code with intermediate variables
**Performance**: 4x faster than nested subqueries
**Used by**: Stripe, GitHub, Airbnb, Shopify
**Time**: 10 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Basic CTEs (refactor nested queries)
- Recursive CTEs (hierarchical data)
- Multi-step data pipelines
- Gap & islands pattern (streak detection)

**Key learning**: CTEs make SQL readable and debuggable

---

#### 25. [Window Functions - Advanced Analytics](/interview-prep/practice-pocs/database-window-functions)
**What**: Calculate aggregates WITHOUT collapsing rows
**Performance**: 708x faster than subquery approach
**Used by**: Google Analytics, Stripe, Shopify, Uber
**Time**: 15 minutes
**Difficulty**: ⭐⭐⭐ Advanced

**You'll build**:
- Rankings (ROW_NUMBER, RANK, DENSE_RANK)
- Running totals and moving averages
- LAG/LEAD (compare with previous/next rows)
- PARTITION BY (group calculations)

**Key learning**: Window functions keep all rows while adding calculations

---

#### 26. [Table Partitioning - 50x Faster Queries](/interview-prep/practice-pocs/database-partitioning)
**What**: Split large tables into smaller chunks for massive performance
**Performance**: 50x faster (45s → 850ms) with partition pruning
**Used by**: Instagram, Uber, Stripe, GitHub
**Time**: 20 minutes
**Difficulty**: ⭐⭐⭐ Advanced

**You'll build**:
- Range partitioning (by date)
- List partitioning (by region, status)
- Hash partitioning (even distribution)
- Automatic partition management (pg_partman)

**Key learning**: Partition queries scan only relevant partitions, not entire table

---

#### 27. [Foreign Keys - Prevent Data Corruption](/interview-prep/practice-pocs/database-foreign-keys)
**What**: Enforce referential integrity at database level
**Performance**: Zero orphaned records, zero data corruption
**Used by**: Stripe, GitHub, Shopify, Airbnb
**Time**: 10 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- Basic foreign keys (RESTRICT)
- ON DELETE CASCADE (auto-delete children)
- ON DELETE SET NULL (soft delete)
- Composite foreign keys

**Key learning**: Foreign keys prevent orphaned data impossible to bypass

---

#### 28. [Check Constraints - Validate Data](/interview-prep/practice-pocs/database-check-constraints)
**What**: Enforce validation rules at database level
**Performance**: Zero invalid data in database
**Used by**: Stripe, Airbnb, Uber, GitHub
**Time**: 5 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- Range constraints (price > 0, age 18-120)
- Format validation (email, phone, zipcode)
- Multi-column constraints (start_date < end_date)
- Enum-style constraints (status IN (...))

**Key learning**: Check constraints are final defense against invalid data

---

#### 29. [Database Sequences - Unique ID Generation](/interview-prep/practice-pocs/database-sequences)
**What**: Generate guaranteed-unique IDs without race conditions
**Performance**: 7x faster than application-generated IDs
**Used by**: Instagram, Stripe, GitHub, Twitter
**Time**: 5 minutes
**Difficulty**: ⭐ Beginner

**You'll build**:
- SERIAL auto-incrementing IDs
- Custom sequences (start, increment, cache)
- Shared sequences (global IDs)
- Sequence synchronization

**Key learning**: Let database generate IDs - faster, safer, simpler

---

#### 30. [VACUUM & Database Maintenance - Stop Bloat](/interview-prep/practice-pocs/database-vacuum)
**What**: Remove dead rows and reclaim disk space
**Performance**: 17x faster queries after VACUUM
**Used by**: Instagram, Stripe, GitHub, Reddit
**Time**: 10 minutes
**Difficulty**: ⭐⭐ Intermediate

**You'll build**:
- Manual VACUUM commands
- VACUUM FULL (reclaim disk space)
- Autovacuum tuning
- Bloat monitoring queries

**Key learning**: PostgreSQL needs periodic VACUUM to stay fast

---

## 🎓 How to Use These POCs

### Option 1: Linear Learning (Recommended for Beginners)
Start with POC #1, complete all 5 Redis POCs in order. Each builds on previous concepts.

### Option 2: Project-Based Learning
Pick a project you want to build, then complete relevant POCs:

**Want to build an e-commerce site?**
1. Cache (POC #1) - Product catalog
2. Lock (POC #3) - Inventory management
3. Counter (POC #2) - Product views, stock counts
4. Queue (POC #4) - Order processing, email confirmations

**Want to build a social app?**
1. Leaderboard (POC #5) - User rankings
2. Counter (POC #2) - Likes, views, followers
3. Cache (POC #1) - User profiles, feeds
4. Queue (POC #4) - Notification sending

**Want to build a gaming backend?**
1. Leaderboard (POC #5) - Player rankings
2. Counter (POC #2) - Scores, kills, achievements
3. Lock (POC #3) - Prevent cheating, ensure consistency
4. Queue (POC #4) - Match-making, replay processing

---

## 🔗 Composing POCs into Larger Systems

POCs are **building blocks**. Here's how they combine:

### Example: Medium Clone

```javascript
// Article viewing (POC #1 Cache + POC #2 Counter)
const article = await cache.get(`article:${id}`) || await db.fetch(id);
await counter.increment(`article:${id}:views`);

// Clapping (POC #3 Lock + POC #2 Counter)
await lock.withLock(`article:${id}:claps`, async () => {
  await counter.incrementBy(`article:${id}:claps`, 5);
});

// Generate reading stats (POC #4 Queue)
await queue.enqueue({ type: 'generate_stats', articleId: id });

// Author leaderboard (POC #5 Leaderboard)
await leaderboard.incrementScore(`author:${authorId}`, article.views);
```

**Result**: Full Medium-like features using 5 POCs!

---

## 📈 Real Impact: Before vs After

| Metric | Without POCs | With POCs | Improvement |
|--------|--------------|-----------|-------------|
| API response time | 45ms | 2ms | **22x faster** |
| Concurrent operations | 100 ops/sec | 50,000 ops/sec | **500x more** |
| Race condition accuracy | 87% | 100% | **No overselling** |
| User wait time (async) | 11 seconds | 10ms | **1,100x faster** |
| Leaderboard query | 500ms | 0.5ms | **1000x faster** |

---

## ⏭️ Coming Soon: Database POCs (0/150)

- Basic CRUD operations
- B-Tree indexes
- Composite indexes
- N+1 query problem
- Query optimization with EXPLAIN
- Master-slave replication
- Database sharding
- Connection pooling
- And 142 more...

---

## ⏭️ Coming Soon: Message Queue POCs (0/100)

- RabbitMQ basics
- Kafka partitions
- Consumer groups
- Dead letter queue
- Message retry patterns
- And 95 more...

---

## ⏭️ Coming Soon: API Design POCs (0/80)

- REST API patterns
- GraphQL schema design
- Rate limiting strategies
- JWT authentication
- API versioning
- And 75 more...

---

## 🎯 Your Learning Path

### Week 1: Redis Mastery
- Complete 5 core Redis POCs ✅
- Build a mini-project combining all 5
- **Goal**: Understand caching, counters, locks, queues, rankings

### Week 2-4: Redis Advanced (95 more POCs)
- Pub/Sub for real-time
- Streams for event sourcing
- Lua scripting
- Redis Cluster
- Sentinel for HA
- **Goal**: Production-ready Redis knowledge

### Week 5-8: Database Patterns (150 POCs)
- Indexes and query optimization
- Replication and sharding
- Transactions and ACID
- **Goal**: Scale databases like Instagram

### Week 9-12: Message Queues (100 POCs)
- RabbitMQ and Kafka
- Event-driven architecture
- **Goal**: Async processing like Uber

---

## 💡 Tips for Success

1. **Actually run the code** - Don't just read, execute it
2. **Modify and experiment** - Change TTLs, add features, break things
3. **Complete "Extend It" sections** - Each POC has 4 levels of advanced features
4. **Build mini-projects** - Combine POCs to build something useful
5. **Share what you built** - Teaching solidifies learning

---

## 🚀 Get Started

**Start here**: [POC #1: Redis Key-Value Cache](/interview-prep/practice-pocs/redis-key-value-cache)

**Prerequisites**:
- Docker installed
- Node.js 18+
- 15-20 minutes per POC

**No prior Redis knowledge needed!**

---

## 📚 Additional Resources

- **Main Articles**: [System Design Articles](/interview-prep/system-design) - Theory + real-world examples
- **Master Plan**: [1000+ POCs Roadmap](/MASTER_PLAN_1000_ARTICLES.md) - Complete learning path
- **Related**: [Database Patterns](/interview-prep/database-storage) - Database optimization articles

---

**Remember**: You don't learn system design by reading. You learn by **building**.

Start with POC #1, spend 15 minutes, see real results. Then move to POC #2. Before you know it, you'll be building production systems.

🎯 **Ready? Start now**: [POC #1: Redis Key-Value Cache](/interview-prep/practice-pocs/redis-key-value-cache)
