---
title: "Document Databases"
layer: interview-q
section: interview-prep/question-bank/databases
difficulty: intermediate
tags: [databases, mongodb, document-store, nosql, schema-design]
---

# Document Databases

10 questions covering document DB use cases, embedding vs referencing, ACID transactions, aggregation pipelines, sharding, and multi-region patterns.

---

## Q1: What is a document database and when to use MongoDB over PostgreSQL?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can identify the document shape and access patterns that favor MongoDB, without defaulting to it for all NoSQL needs.

### Answer in 60 seconds
- **Document DB:** Stores data as JSON/BSON documents — each document is self-contained with nested fields, arrays, and sub-documents; no schema enforcement by default
- **MongoDB wins when:** Data is hierarchically structured (user profile with nested address, preferences, payment methods), schema varies per record (product catalog where electronics have different fields than books), reads are predominantly by document ID
- **PostgreSQL wins when:** Strong relational integrity required (FK constraints), ad-hoc queries across multiple entities, ACID transactions spanning multiple documents/collections
- **Scale threshold:** MongoDB handles 100K reads/sec on a 3-node replica set; with sharding, 1M+ reads/sec — comparable to PostgreSQL with replicas

### Diagram

```mermaid
graph LR
  A{Document or Relational?}
  A -->|Hierarchical data, variable schema, per-document reads| B[MongoDB]
  A -->|Normalized data, multi-table joins, ACID required| C[PostgreSQL]
  B --> D[Product catalog, user profiles, CMS, e-commerce catalogs]
  C --> E[Orders, payments, user auth, inventory counts]
```

### Pitfalls
- ❌ **MongoDB for relational data:** Storing order items inside the order document then querying "all orders containing product X" requires scanning every order — no efficient join
- ❌ **Embedding unbounded arrays:** Storing all comments in a post document — MongoDB's 16MB document limit causes failures at ~50K comments per post

### Concept Reference

---

## Q2: How do you model one-to-many relationships in a document DB?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand the embed vs reference trade-off and can apply it based on read patterns and cardinality.

### Answer in 60 seconds
- **Embed (denormalize):** Put child documents inside the parent — e.g., store user's last 3 addresses embedded in the user document; fast reads (one lookup), but duplicates data and limits child count
- **Reference (normalize):** Store child IDs in the parent or parent ID in each child — like a SQL foreign key; requires multiple queries but handles unbounded children
- **Rule of thumb:** Embed when cardinality is bounded (<100 children) and children are always read with the parent; reference when children are queried independently or can grow unboundedly

### Diagram

```mermaid
graph TD
  A[User with addresses - one-to-few]
  A --> B[Embed: user doc contains addresses array]
  B --> C[Read user + addresses: 1 query]
  B --> D[Update one address: update whole doc - write amplification]

  E[User with orders - one-to-many - thousands]
  E --> F[Reference: order has user_id field]
  F --> G[Read user's orders: WHERE user_id=X query]
  F --> H[Orders queried independently by order_id]
```

### Pitfalls
- ❌ **Embedding all orders inside user document:** A user with 10,000 orders hits MongoDB's 16MB document limit — always reference for unbounded one-to-many
- ❌ **Referencing everything like SQL:** MongoDB's strength is embedding; over-referencing creates N+1 queries (load user, then N separate loads for each reference)

### Concept Reference

---

## Q3: How does MongoDB handle ACID transactions in a distributed cluster?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you know MongoDB's multi-document transaction model (added in 4.0), its limitations, and when to use it vs single-document operations.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Collections involved | 2 (orders + inventory) |
| Transaction type | Multi-document ACID |
| Write rate | 10K TPS |
| Latency budget | p99 < 100ms |

### Single-Document ACID (always available)

```mermaid
graph TD
  A[Single document operations are always ACID]
  A --> B[Atomic: entire document update is atomic]
  A --> C[Consistent: document-level constraints enforced]
  A --> D[Isolated: other readers see before or after, not during]
  A --> E[Durable: with w:majority write concern]
  A --> F[No transaction syntax needed - per-document by default]
```

### Multi-Document Transactions (MongoDB 4.0+)

```mermaid
sequenceDiagram
  participant App
  participant Mongos as mongos router
  participant S1 as Shard 1 (orders)
  participant S2 as Shard 2 (inventory)

  App->>Mongos: session.startTransaction()
  App->>S1: insertOne(order) within session
  App->>S2: updateOne(inventory, decrement) within session
  App->>Mongos: session.commitTransaction()
  Mongos->>S1: prepare (2PC phase 1)
  Mongos->>S2: prepare (2PC phase 1)
  S1-->>Mongos: prepared
  S2-->>Mongos: prepared
  Mongos->>S1: commit
  Mongos->>S2: commit
  Mongos-->>App: OK
```

| Dimension | Single-Document | Multi-Document Transaction |
|-----------|----------------|---------------------------|
| ACID | Yes (always) | Yes (MongoDB 4.0+) |
| Performance overhead | None | 2–5x write cost |
| Cross-shard | N/A | Yes (2PC overhead) |
| Max transaction size | 16MB doc limit | 16MB total across all docs |
| Timeout | None | 60 seconds default |

### Recommended Answer
Design to avoid multi-document transactions whenever possible — restructure the document model to make the critical operation single-document atomic. When unavoidable (order + inventory deduction in separate collections), use MongoDB 4.0+ multi-document transactions with `w:majority` write concern. Transactions incur 2–5x write cost and a 16MB total size limit across all modified documents.

### What a great answer includes
- [ ] Single-document atomicity as the primary design target (no transaction overhead)
- [ ] w:majority write concern: transactions require this for durability guarantee
- [ ] Cross-shard transactions (MongoDB 4.2+): require mongos coordinator, use 2PC, higher latency
- [ ] 16MB limit applies to the total size of all documents modified in one transaction

### Pitfalls
- ❌ **Using multi-document transactions as default:** Every simple insert/update should not use transactions — the 2–5x overhead will kill throughput; transactions are for the exceptional cases
- ❌ **Transactions without session handling:** If session.commitTransaction() is never called (app crash), MongoDB auto-aborts after 60 seconds — design for transaction timeout recovery

### Concept Reference

---

## Q4: Embedding documents vs referencing — trade-offs?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can apply the embedding vs referencing decision matrix based on cardinality, update frequency, and query patterns.

### Answer in 60 seconds
- **Embed for:** Data always read together (user + address), bounded cardinality (<100 children), child data rarely updated independently, snapshot semantics acceptable (embed historical order price, not live product price)
- **Reference for:** Unbounded cardinality (user → orders), data accessed and updated independently (product catalog referenced by many orders), shared data (multiple orders referencing same product)
- **Read cost:** Embedded = 1 query; Referenced = 1 + N queries for N relationships (N+1 problem) mitigated by `$lookup` (aggregation join) or application-level batch loading
- **Write cost:** Embedded = full document rewrite on any field change; Referenced = update only the specific document

### Diagram

```mermaid
graph TD
  A[Decision Matrix]
  A --> B{Cardinality?}
  B -->|One-to-few < 100| C{Always read together?}
  B -->|One-to-many > 100| D[Reference - store parent_id in child]
  C -->|Yes| E[Embed]
  C -->|No, queried independently| F[Reference]

  G[Example: blog post]
  G --> H[Embed: post.tags = array of strings - few, always shown with post]
  G --> I[Embed: post.author_preview = name, avatar - snapshot at publish time]
  G --> J[Reference: post.comment_ids - could be thousands]
  G --> K[Reference: post.author_id - author data updates independently]
```

### Pitfalls
- ❌ **Embedding for shared data:** If product price is embedded in every order document, updating the price requires updating millions of order documents — reference the product and store the historical price at time of order as a separate field
- ❌ **Referencing everything for "normalization":** MongoDB's strength is embedding; over-normalization creates application-level joins that are slower than embedded reads

### Concept Reference

---

## Q5: How does MongoDB's aggregation pipeline work?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P2 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand MongoDB's stage-based aggregation model and can design a pipeline for common analytics queries.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Collection | orders (50M documents) |
| Query | Top 10 customers by total spend, last 30 days |

### Pipeline Architecture

```mermaid
graph TD
  A[Input: 50M orders collection]
  A --> B[Stage 1: $match - filter last 30 days]
  B --> C[Stage 2: $group - group by customer_id, sum total]
  C --> D[Stage 3: $sort - descending by total_spend]
  D --> E[Stage 4: $limit - top 10]
  E --> F[Stage 5: $lookup - join with customers collection for name]
  F --> G[Output: 10 documents with name + total]

  H[Stage 1: $match reduces 50M to 5M docs]
  H --> I[Efficiency: run $match first to reduce input to later stages]
  I --> J[Index on created_at used for $match - fast]
```

### Key Pipeline Stages

| Stage | Purpose | Performance Note |
|-------|---------|-----------------|
| `$match` | Filter documents | Put first; uses indexes |
| `$group` | Aggregate with accumulators | Requires memory; watch allowDiskUse |
| `$sort` | Sort results | Index-backed if matching index |
| `$lookup` | Left outer join to another collection | Expensive; use sparingly |
| `$project` | Select/reshape fields | Reduces document size for subsequent stages |
| `$unwind` | Flatten array field to one doc per element | Multiplies document count |

### Recommended Answer
Design pipelines with `$match` first to reduce document count before expensive stages like `$group` and `$lookup`. Ensure indexes exist on `$match` filter fields. For large group-bys, set `allowDiskUse: true` to spill to disk when memory limit (100MB) is exceeded. Use `$lookup` sparingly — it's an application-level join that can be slow for large collections.

### What a great answer includes
- [ ] Pipeline optimization order: $match (filter) → $project (trim fields) → $group (aggregate) → $sort
- [ ] allowDiskUse: required for $group on collections >100MB that don't fit in memory
- [ ] Index usage: $match uses indexes; $sort can use indexes if on the same indexed field; $group does not use indexes
- [ ] `explain("executionStats")` on aggregation to verify index usage

### Pitfalls
- ❌ **$lookup on large collections without an index:** `$lookup` joins from one collection to another — if the foreign collection doesn't have an index on the join field, it's a full collection scan per document
- ❌ **$unwind before $match:** Unwinding an array before filtering multiplies document count — always filter first to minimize unwind output

### Concept Reference

---

## Q6: How do you handle schema evolution in a document database?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P2 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand the lack of schema enforcement in MongoDB and have strategies for managing multiple document versions in production.

### Answer in 60 seconds
- **MongoDB's flexibility:** No schema enforcement by default — old documents and new documents can coexist in the same collection with different shapes
- **Version field pattern:** Add a `schema_version` field to every document; application code handles each version: `if doc.schema_version == 1: transform; if doc.schema_version == 2: use directly`
- **Lazy migration:** Old documents are transformed on read (no backfill needed); on write, always write the latest schema version — collection gradually migrates over time
- **Eager migration:** Background job reads all documents and rewrites in new schema; faster but requires more I/O and risk of partial migration

### Diagram

```mermaid
graph TD
  A[Legacy documents: v1 schema - address as string]
  B[New documents: v2 schema - address as object]
  A --> C[Collection: both v1 and v2 documents coexist]
  C --> D[Application read path]
  D --> E{schema_version?}
  E -->|v1| F[Transform: split address string to object]
  E -->|v2| G[Use directly]
  F --> H[Return normalized v2 structure]
  G --> H
```

### Pitfalls
- ❌ **No schema version tracking:** Without version fields, code can't distinguish old from new documents — a field that was a string in v1 and an object in v2 causes type errors
- ❌ **Relying on schema enforcement for data integrity:** MongoDB schema validation (`$jsonSchema`) can enforce structure, but app-level validation is still needed — don't assume the DB catches all invalid data

### Concept Reference

---

## Q7: How does MongoDB Atlas handle global multi-region reads?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P2 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand MongoDB Atlas's global cluster architecture and the read preference and zone configuration that enables low-latency global reads.

### Answer in 60 seconds
- **Atlas Global Clusters:** Data sharded across regions; each zone (e.g., US-East, EU-West, AP-Southeast) holds a subset of shards; writes go to the zone's primary, reads serve from local zone
- **Zone sharding:** Documents are assigned to zones based on a shard key range — e.g., users with `region=us` land on US zone shards, `region=eu` on EU zone shards; reads are always local
- **Read preference:** `nearest` reads from the closest replica set member (same datacenter) — typically <5ms local read vs 100ms+ cross-region
- **Writes:** Still routed to the primary shard; if user is in EU but their shard's primary is in US, writes are 100ms+ — design zone sharding to minimize cross-zone writes

### Diagram

```mermaid
graph TD
  A[Atlas Global Cluster]
  A --> B[US-East Zone: shards 0-33]
  A --> C[EU-West Zone: shards 34-66]
  A --> D[AP-Southeast Zone: shards 67-99]

  E[US User: region=us]
  E --> F[Write → US Primary: 5ms local]
  E --> G[Read nearest → US Replica: 3ms]

  H[EU User: region=eu]
  H --> I[Write → EU Primary: 5ms local]
  H --> J[Read nearest → EU Replica: 3ms]
```

### Pitfalls
- ❌ **Global cluster without zone-aware shard key:** If shard key doesn't include region, US and EU users' data mixes across all zones — cross-region reads for EU users hitting US shards (100ms latency)
- ❌ **Expecting sub-millisecond cross-region writes:** Speed of light constraints mean US-EU writes are 70ms minimum RTT — design shard keys so each user's writes stay in their home region

### Concept Reference

---

## Q8: How would you shard a MongoDB collection for multi-tenant SaaS?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P2 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you can design a MongoDB sharding strategy that provides tenant isolation, even data distribution, and efficient per-tenant queries.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Tenants | 10,000 companies |
| Documents per tenant | 10K–10M (variable) |
| Query pattern | 95% filtered by tenant_id |
| Write rate | 100K writes/sec peak |

### Shard Key Options

```mermaid
graph TD
  A[Shard key options for multi-tenant]

  A --> B[Option 1: tenant_id only]
  B --> C[Pro: all tenant data co-located - fast queries]
  B --> D[Con: large tenants become hotspot shards]

  A --> E[Option 2: tenant_id + document_id compound]
  E --> F[Pro: even distribution within tenant]
  E --> G[Pro: tenant queries hit 1 shard chunk]
  E --> H[Con: range queries within tenant span multiple chunks]

  A --> I[Option 3: hashed tenant_id]
  I --> J[Pro: even distribution across shards]
  I --> K[Con: all queries scatter to all shards - no co-location]
```

### Recommended Architecture

```mermaid
graph TD
  A[Shard key: tenant_id + _id compound]
  A --> B[MongoDB zones: large tenants get dedicated shard ranges]
  B --> C[Small tenants: shared shards with other small tenants]
  B --> D[Large tenants: dedicated shards via zone configuration]

  E[Zone configuration]
  E --> F[Zone large-tenants: min=enterprise1, max=enterprise1z - dedicated]
  E --> G[Zone shared: all other tenant_ids share 8 shards]
```

| Shard Key | Distribution | Query Efficiency | Hotspot Risk |
|-----------|-------------|-----------------|-------------|
| tenant_id only | Uneven (large tenants) | Excellent (1 shard) | High for large tenants |
| tenant_id + _id | Good | Good (bounded range per tenant) | Low |
| Hashed tenant_id | Perfect | Poor (scatter-gather) | None |

### Recommended Answer
Use `tenant_id + _id` compound shard key — tenant_id provides routing for per-tenant queries (most queries), and _id ensures even distribution of documents within each tenant's chunk range. Use MongoDB zone sharding to give large tenants their own dedicated shard ranges, preventing them from causing hotspots shared with small tenants.

### What a great answer includes
- [ ] Zone sharding for large tenant isolation: assign enterprise customer IDs to a dedicated zone
- [ ] Chunk splitting: MongoDB automatically splits large chunks; monitor chunk distribution with `sh.status()`
- [ ] Query pattern validation: verify 95% of queries include tenant_id in filter before committing to shard key
- [ ] Migrations: adding tenant_id to a shard key on existing collection requires resharding (MongoDB 5.0+ supports online resharding)

### Pitfalls
- ❌ **Hashed shard key for multi-tenant:** `hashed(tenant_id)` distributes perfectly but means every tenant query becomes a scatter-gather across all shards — 10x latency increase
- ❌ **Compound shard key without tenant_id first:** `_id + tenant_id` distributes randomly — tenant_id must be first in compound key for query routing to work

### Concept Reference

---

## Q9: How does Cosmos DB partitioning differ from MongoDB?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P3 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand Cosmos DB's partition key model and how it maps differently to MongoDB's shard key approach.

### Answer in 60 seconds
- **Cosmos DB:** Partition key is mandatory on every container; each logical partition maps to a physical partition (max 20GB); every query without the partition key does a cross-partition scan at higher cost and latency
- **MongoDB:** Shard key is optional (sharding is opt-in); non-sharded collections work normally on a single mongod; sharding is an explicit scale-out decision
- **Cosmos throughput model:** RU/s (Request Units) provisioned per container or per partition key; hot partitions exceed their RU allocation and get throttled with 429 errors
- **Key practical difference:** Cosmos DB requires upfront partition key design for scale (can't be changed); MongoDB shard key can be chosen later and changed with online resharding (MongoDB 5+)

### Diagram

```mermaid
graph LR
  A[Cosmos DB] --> B[Partition key mandatory from day 1]
  A --> C[20GB max per logical partition]
  A --> D[RU throttling per partition if hot]
  A --> E[99.999% SLA, multi-region writes native]

  F[MongoDB] --> G[Sharding optional, add when needed]
  F --> H[No per-shard size limit enforced by default]
  F --> I[No RU model - raw throughput]
  F --> J[Multi-region writes via Atlas Global Clusters]
```

### Pitfalls
- ❌ **Wrong Cosmos DB partition key:** Using timestamp as partition key means all recent writes go to one partition — hot partition, 429 throttling, application errors
- ❌ **Cosmos DB partition key with low cardinality:** Using `country_code` (195 values) as partition key for a 10TB container means ~50GB per country partition — exceeds 20GB limit for large countries

### Concept Reference

---

## Q10: Store user profiles with highly variable nested attributes — design the schema

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Scenario
**Real Company:** Modeled on LinkedIn profile storage, Salesforce custom fields

### The Brief
> "You're designing the storage for user profiles on a professional network. Each user type (developer, designer, sales rep, executive) has completely different profile fields. Developers have programming languages, GitHub links, and open source projects. Designers have portfolio links and tool expertise. Sales reps have quota attainment and industry verticals. Design a MongoDB schema that handles this variability."

### Clarifying Questions to Ask First
1. What queries are most common — lookup by user_id or search by specific field values?
2. Are field names known in advance or truly dynamic (user-defined custom fields)?
3. Do users ever switch between types?
4. What is the read:write ratio for profiles?

### Back-of-Envelope Estimation
| Metric | Value |
|--------|-------|
| Users | 50M |
| Avg profile size | 5KB |
| Total storage | 50M × 5KB = 250GB |
| Profile reads/sec | 500K (high, everyone views profiles) |
| Profile writes/sec | 5K (low, users update infrequently) |

### High-Level Architecture

```mermaid
graph TD
  A[User Profile Document Structure]
  A --> B[Core fields: always present]
  B --> C[user_id, name, email, user_type, created_at]

  A --> D[Type-specific extension field]
  D --> E["developer_profile: languages, github_url, projects - array"]
  D --> F["designer_profile: portfolio_url, tools, style_tags"]
  D --> G["sales_profile: quota_attainment_pct, industries, territories"]

  A --> H[Custom fields: user-defined key-value]
  H --> I["custom_attributes: array of key:value pairs"]

  J[Indexes for search]
  J --> K["Index: user_type + developer_profile.languages"]
  J --> L["Index: user_type + sales_profile.industries"]
  J --> M["Text index: name, bio for full-text search"]
```

### Trade-off Decisions
| Decision | Option A | Option B | Chosen | Why |
|----------|----------|----------|--------|-----|
| Schema approach | Single collection, type-specific fields | Separate collections per user type | Single collection | Easier profile lookup; type-specific indexes handle query routing |
| Extension storage | Embedded sub-document | Reference to separate collection | Embedded | Profile always read together; <10KB total |
| Custom fields | Free-form object | Typed key-value array | Typed array | Array allows indexing by field name; free-form object limits queryability |
| Search | MongoDB text search | Elasticsearch | Elasticsearch | Full-text and faceted search at scale; MongoDB text index doesn't handle complex queries |

### Failure Modes
| Failure | Impact | Mitigation |
|---------|--------|------------|
| Very large profile (user embeds 1000 projects) | 16MB document limit | Limit array length in application code; move to reference model at >100 items |
| Missing type-specific field on read | Null pointer in application | Default empty sub-document in all profiles; application handles null fields |
| Slow search without index | Full collection scan | Ensure compound indexes on user_type + type-specific fields; test with `explain()` |

