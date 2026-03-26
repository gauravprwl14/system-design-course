---
title: "Multi-Tenancy Database Patterns"
layer: interview-q
section: interview-prep/question-bank/databases
difficulty: advanced
tags: [databases, multi-tenancy, row-level-security, saas, isolation, gdpr]
---

# Multi-Tenancy Database Patterns

6 questions covering the 3 isolation patterns, Row-Level Security, noisy neighbor handling, zero-downtime migration, GDPR deletion, and Salesforce's 150K-tenant architecture.

---

## Q1: What are the 3 multi-tenancy patterns (shared DB + schema, shared DB + tables, isolated DB)?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can explain each pattern with its cost, isolation level, and the business scenario that drives each choice — not just name them.

### Answer in 60 seconds
- **Shared DB, shared tables (Silo model):** All tenants in the same tables, rows tagged with `tenant_id`; cheapest, highest density (10,000+ tenants per DB); lowest isolation — one bug leaks all tenants' data; used by Shopify, Slack
- **Shared DB, separate schemas:** Each tenant gets their own PostgreSQL schema within one DB; medium isolation — separate object namespaces; 100–1,000 tenants per DB; used by Heroku Postgres add-ons
- **Isolated DB per tenant:** Each tenant has a completely separate DB instance; strongest isolation; most expensive (1 RDS instance per tenant = $50–500/month each); used by enterprise SaaS with compliance requirements (SOC 2, HIPAA per-tenant)

### Diagram

```mermaid
graph TD
  A[Multi-Tenancy Patterns]

  B[Pattern 1: Shared Tables]
  B --> C[One DB, one schema, all tenants share tables]
  C --> D[tenant_id column on every row]
  D --> E[Density: 10K plus tenants per DB instance]
  E --> F[Risk: missing WHERE tenant_id filter leaks all data]

  G[Pattern 2: Shared DB, Separate Schemas]
  G --> H[One DB, N schemas: tenant_a.users, tenant_b.users]
  H --> I[Schema switching: SET search_path = tenant_id]
  I --> J[Density: 100-1000 tenants per DB]
  J --> K[Risk: schema proliferation slows DDL migrations]

  L[Pattern 3: Isolated DB per Tenant]
  L --> M[One DB instance per tenant]
  M --> N[Full isolation: network, storage, credentials]
  N --> O[Density: 1 tenant per DB - $50-500/month per tenant]
  O --> P[Risk: operational cost scales linearly with tenants]
```

### Decision Matrix

```mermaid
graph TD
  A[Choosing Multi-Tenancy Pattern]
  A --> B{How many tenants?}
  B -->|1K to 100K tenants - SMB SaaS| C[Shared Tables - Pattern 1]
  B -->|100-2000 tenants - mid-market| D[Shared DB Separate Schemas - Pattern 2]
  B -->|10-200 enterprise tenants| E[Isolated DB per Tenant - Pattern 3]

  C --> F{Compliance requirement per tenant?}
  F -->|SOC 2 Type II per tenant| E
  F -->|Shared compliance OK| C
```

| Dimension | Shared Tables | Shared DB, Separate Schemas | Isolated DB |
|-----------|--------------|----------------------------|------------|
| Tenant density | 10,000+/DB | 100–1,000/DB | 1/DB |
| Isolation | Low (app-enforced) | Medium (schema namespace) | High (full DB boundary) |
| Monthly cost per tenant | ~$0.001 | ~$0.10 | $50–$500 |
| DDL migration speed | Single migration | N migrations (one per tenant) | N migrations + orchestration |
| Cross-tenant query support | Easy (admin analytics) | Hard (cross-schema joins) | Very hard (cross-DB) |
| Data leak risk | High (missing tenant_id filter) | Medium (schema escape bug) | Low (network isolation) |

### Pitfalls
- ❌ **Starting with isolated DB per tenant to feel safe:** If you acquire 10,000 tenants, you need 10,000 DB instances — $5M/month at $500/instance; most SaaS businesses cannot sustain this cost
- ❌ **Choosing separate schemas thinking it's as cheap as shared tables:** Every new tenant requires a schema creation + full DDL migration — adding 100 tenants per day means 100 schema migrations per day; operational overhead grows fast

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q2: How do you prevent data leakage between tenants using Row-Level Security (RLS)?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you know PostgreSQL Row-Level Security as a database-enforced guarantee — not just an application-layer convention — and understand why it's safer than `WHERE tenant_id = ?`.

### Answer in 60 seconds
- **Problem with app-level tenant filter:** Every query requires `WHERE tenant_id = :current_tenant` — one developer forgets it, one query bug, one ORM misconfiguration = cross-tenant data leak affecting all tenants
- **RLS solution:** PostgreSQL policy on the table enforces tenant isolation at the DB level — even if the app forgets `WHERE tenant_id`, the DB silently filters to the current tenant's rows
- **Setup:** `ALTER TABLE orders ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation ON orders USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`; app sets `SET app.current_tenant_id = 'tenant-123'` at connection start
- **Performance:** RLS adds a predicate to every query automatically — same performance as manually adding `WHERE tenant_id = ?`; no additional overhead if `tenant_id` is indexed

### Diagram

```mermaid
sequenceDiagram
  participant App
  participant DB as PostgreSQL with RLS

  App->>DB: SET app.current_tenant_id = 'tenant-123'
  App->>DB: SELECT * FROM orders (no WHERE clause - developer forgot)
  Note over DB: RLS policy fires automatically
  Note over DB: Adds: AND tenant_id = current_setting('app.current_tenant_id')
  DB-->>App: Returns only tenant-123 orders (safe!)

  Note over App,DB: Without RLS
  App->>DB: SELECT * FROM orders (no WHERE clause)
  DB-->>App: Returns ALL tenants orders - data breach!
```

### RLS Policy Setup

```mermaid
graph TD
  A[Implementing RLS in PostgreSQL]

  B[Step 1: Enable RLS on table]
  B --> C[ALTER TABLE orders ENABLE ROW LEVEL SECURITY]
  C --> D[ALTER TABLE orders FORCE ROW LEVEL SECURITY]
  D --> E[FORCE: applies policy even to table owner - important!]

  F[Step 2: Create isolation policy]
  F --> G[CREATE POLICY tenant_iso ON orders]
  G --> H[USING: tenant_id = current_setting app.current_tenant_id, true::uuid]
  H --> I[true parameter: returns NULL not error if setting missing]

  J[Step 3: App sets context per request]
  J --> K[On connection checkout: SET LOCAL app.current_tenant_id = ?]
  K --> L[SET LOCAL: scoped to current transaction - auto-resets]
  L --> M[Safer than SET: connection pool reuse cannot leak tenant context]

  N[Step 4: Admin bypass for analytics]
  N --> O[Admin role: SET row_security = off]
  O --> P[Or: use BYPASSRLS role attribute for admin user only]
```

### RLS Performance Impact

```mermaid
graph TD
  A[RLS Performance Characteristics]

  B[Policy adds implicit predicate]
  B --> C[Query: SELECT * FROM orders → becomes:]
  C --> D[SELECT * FROM orders WHERE tenant_id = current_setting...]
  D --> E[Same as manual WHERE clause - no overhead if indexed]

  F[Ensure tenant_id is indexed]
  F --> G[CREATE INDEX ON orders tenant_id]
  G --> H[B-tree index: O of log N to find tenant rows]

  I[Composite index for tenant queries]
  I --> J[CREATE INDEX ON orders tenant_id, created_at DESC]
  J --> K[Covers: WHERE tenant_id = X ORDER BY created_at]
  K --> L[Index Only Scan possible if INCLUDE other needed columns]
```

### Pitfalls
- ❌ **Not using `FORCE ROW LEVEL SECURITY`:** By default, table owners bypass RLS — the DB admin or migration user can accidentally see all tenant data; use `FORCE ROW LEVEL SECURITY` to apply the policy to everyone
- ❌ **Using `SET` instead of `SET LOCAL` in connection pools:** `SET app.current_tenant_id = 'X'` persists for the entire connection; if the connection is returned to the pool and reused by tenant Y, tenant Y's queries run with tenant X's context — always use `SET LOCAL` (transaction-scoped)

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q3: How do you handle a "noisy neighbor" tenant using 80% of DB resources?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you have concrete strategies to isolate and throttle one overactive tenant without impacting the rest of the tenants sharing the database.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Shared DB | 5,000 tenants on one PostgreSQL instance |
| Noisy tenant | Tenant X runs 500 concurrent queries, using 80% CPU |
| Other tenants | Experiencing 10x latency increase (from 20ms to 200ms) |
| Goal | Restore normal performance within 30 minutes |

### Short-Term Mitigation

```mermaid
graph TD
  A[Immediate Actions - within 30 minutes]

  B[Step 1: Identify the tenant]
  B --> C[SELECT tenant_id, count, avg_time FROM pg_stat_activity GROUP BY tenant_id]
  C --> D[Find tenant with 500 active queries and high wait_event]

  E[Step 2: Kill long-running queries]
  E --> F[SELECT pg_terminate_backend pid FROM pg_stat_activity WHERE tenant_id = X AND duration > 30s]
  F --> G[Immediate relief: drop from 80% CPU to 40%]

  H[Step 3: Rate limit at connection pool]
  H --> I[PgBouncer: limit max_client_conn per tenant to 20]
  I --> J[Tenant X blocked at pool: queues instead of hammering DB]

  K[Step 4: Communicate to tenant]
  K --> L[Alert customer success: tenant X has a runaway job - needs investigation]
```

### Long-Term Architecture Fix

```mermaid
graph TD
  A[Permanent Noisy Neighbor Solutions]

  B[Option 1: Move noisy tenant to dedicated shard]
  B --> C[Create new DB instance for tenant X]
  C --> D[Migrate tenant X's data with dual-write]
  D --> E[Route tenant X's connections to dedicated instance]
  E --> F[Other 4999 tenants: immediately restored to 20ms latency]

  G[Option 2: Database resource groups - PostgreSQL 17 plus]
  G --> H[pg_query_settings: per-role resource limits]
  H --> I[ALTER ROLE tenant_x_user SET statement_timeout = 5000]
  I --> J[ALTER ROLE tenant_x_user SET idle_in_transaction_session_timeout = 10000]

  K[Option 3: Application-layer throttling]
  K --> L[API gateway: rate limit by tenant_id - 100 req/sec per tenant]
  L --> M[Token bucket algorithm: burst of 200, refill 100/sec]
  M --> N[Tenant X's excess requests queued or rejected with 429]
```

### Monitoring Setup to Prevent Recurrence

```mermaid
graph TD
  A[Proactive Noisy Neighbor Detection]

  B[Per-tenant metrics collection]
  B --> C[pg_stat_activity: active query count per tenant_id]
  C --> D[Alert if any tenant exceeds 50 concurrent queries]

  E[Resource accounting]
  E --> F[pg_stat_statements: group by tenant_id from query comment]
  F --> G[Track: total_exec_time, rows, shared_blks_read per tenant]
  G --> H[Alert if any tenant uses more than 20% of total DB time]

  I[Tenant tier enforcement]
  I --> J[Free tier: max 5 concurrent connections, 1s statement_timeout]
  J --> K[Pro tier: max 20 concurrent, 10s timeout]
  K --> L[Enterprise tier: dedicated shard or dedicated DB]
```

| Strategy | Time to Fix | Cost | Isolation Quality |
|----------|-------------|------|------------------|
| Kill long queries | 1 minute | Zero | Temporary |
| PgBouncer connection limit | 10 minutes | Zero | Good |
| Statement timeout per role | 10 minutes | Zero | Good |
| API rate limiting | 1 hour | Low | Good |
| Move to dedicated shard | 1–4 hours | Medium ($50–500/month) | Excellent |

### Pitfalls
- ❌ **Setting global `statement_timeout` to fix one tenant:** A global 5-second timeout kills legitimate long-running queries (reports, analytics) from other tenants — set per-role timeouts only for the problematic tenant
- ❌ **Not having per-tenant resource attribution:** If you can't identify which tenant is causing CPU spikes, you can't throttle them — add tenant_id as a query comment (`/* tenant_id=X */`) from day one so pg_stat_statements groups by tenant

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q4: How do you migrate a single-tenant schema to multi-tenant without downtime?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you have a concrete zero-downtime migration plan involving dual-write, backfill, and cutover — not just "add a tenant_id column."

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Current state | Single-tenant PostgreSQL, 50M rows in `orders` table |
| Goal | Add `tenant_id` to every table; enable multi-tenant |
| Downtime budget | Zero (24/7 service) |
| Migration window | Complete within 2 weeks |

### Migration Plan

```mermaid
graph TD
  A[Phase 1: Add column safely - no downtime]
  A --> B[ALTER TABLE orders ADD COLUMN tenant_id UUID]
  B --> C[Column is nullable initially - existing rows have NULL]
  C --> D[This DDL is instant in PostgreSQL 11+ - no table lock]

  E[Phase 2: Backfill existing rows]
  E --> F[UPDATE orders SET tenant_id = default_tenant WHERE tenant_id IS NULL]
  F --> G[Rate-limited batches: 10K rows per batch, 100ms pause between]
  G --> H[Avoids table lock and excessive WAL generation]
  H --> I[Monitor: pg_stat_progress_update shows progress]

  J[Phase 3: Dual-write mode]
  J --> K[Deploy new app code: writes tenant_id on all new inserts]
  K --> L[Old code path still works - tenant_id defaults to default_tenant]
  L --> M[New code path sets tenant_id explicitly]

  N[Phase 4: Make column NOT NULL]
  N --> O[Wait for backfill to complete - verify zero NULL rows]
  O --> P[ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL]
  P --> Q[Add CHECK CONSTRAINT: tenant_id IS NOT NULL - fast in Postgres 12+]

  R[Phase 5: Enable RLS and cutover]
  R --> S[Enable Row-Level Security on all tables]
  S --> T[Set search path or tenant context in connection middleware]
  T --> U[Enable multi-tenant routing in app - done]
```

### Backfill Safety Pattern

```mermaid
sequenceDiagram
  participant BackfillJob
  participant DB

  loop For each batch of 10K rows
    BackfillJob->>DB: BEGIN
    BackfillJob->>DB: SELECT id FROM orders WHERE tenant_id IS NULL LIMIT 10000 FOR UPDATE SKIP LOCKED
    BackfillJob->>DB: UPDATE orders SET tenant_id=DEFAULT_TENANT WHERE id IN (batch_ids)
    BackfillJob->>DB: COMMIT
    BackfillJob->>BackfillJob: Sleep 100ms (rate limit - avoid I/O saturation)
  end

  Note over BackfillJob,DB: SKIP LOCKED: concurrent jobs dont fight over same rows
  Note over BackfillJob,DB: FOR UPDATE: prevents long-running app transactions from stalling backfill
```

### Rollback Plan

```mermaid
graph TD
  A[Rollback strategy at each phase]

  B[Phase 1 rollback: nullable column]
  B --> C[DROP COLUMN tenant_id - instant, no data lost]

  D[Phase 2 rollback: during backfill]
  D --> E[Stop backfill job - column is still nullable]
  E --> F[Old code still works - tenant_id is NULL and app ignores it]

  G[Phase 3 rollback: dual-write]
  G --> H[Deploy old app version - writes stop setting tenant_id]
  H --> I[Column stays nullable - no impact]

  J[Phase 4 rollback: NOT NULL added]
  J --> K[ALTER TABLE orders ALTER COLUMN tenant_id DROP NOT NULL]
  K --> L[Reverts to nullable - old app code works again]
```

### Pitfalls
- ❌ **Running `ALTER TABLE ADD COLUMN NOT NULL DEFAULT value` on a large table:** In PostgreSQL before version 11, this rewrites the entire table and holds a lock for hours on 50M rows; in PostgreSQL 11+, column defaults are stored in catalog and the rewrite is avoided — always add nullable first, backfill, then add NOT NULL
- ❌ **Not using `SKIP LOCKED` in the backfill job:** Without SKIP LOCKED, multiple parallel backfill workers try to lock the same rows and serialize — `SKIP LOCKED` lets each worker grab a non-contended batch, enabling 4x parallel backfill speed

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q5: How do you implement tenant-specific data retention and GDPR deletion?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can design a deletion pipeline that satisfies "right to erasure" (GDPR Article 17) within the 30-day legal deadline and handles cascades across microservices.

### Answer in 60 seconds
- **GDPR Article 17 requirement:** Delete all personal data within 30 days of a deletion request; must cover all systems — DB, backups, analytics, search indexes, audit logs
- **Soft delete first:** Mark the tenant as `deleted_at=now()` immediately; this stops new data ingestion and hides the tenant from the UI while the hard delete is scheduled
- **Hard delete pipeline:** Asynchronous job processes each table in dependency order; deletes all rows with `tenant_id=X`; verifies deletion with row count check; marks tables complete in a deletion manifest
- **Backup handling:** Backups cannot be selectively deleted; document in privacy policy that backup data is retained for up to 90 days but inaccessible and overwritten within the backup rotation window

### Diagram

```mermaid
graph TD
  A[GDPR Deletion Request received]

  B[Step 1: Soft delete - immediate]
  B --> C[UPDATE tenants SET deleted_at=now, deletion_requested_at=now WHERE id=X]
  C --> D[Tenant immediately invisible to all queries]
  D --> E[New data ingestion stopped]

  F[Step 2: Deletion job triggered - async]
  F --> G[Deletion manifest created: list of all tables with tenant data]
  G --> H[Tables ordered by FK dependency: children before parents]

  I[Step 3: Delete in dependency order]
  I --> J[DELETE FROM order_items WHERE tenant_id=X - 10K batch with 50ms pause]
  I --> K[DELETE FROM orders WHERE tenant_id=X - after order_items done]
  I --> L[DELETE FROM users WHERE tenant_id=X - after orders done]

  M[Step 4: Cross-system deletion]
  M --> N[Publish tenant_deleted event to Kafka]
  N --> O[Search service: delete Elasticsearch tenant index]
  N --> P[Analytics service: delete BigQuery partition for tenant]
  N --> Q[Audit log service: anonymize or delete logs per retention policy]

  R[Step 5: Verify and certify]
  R --> S[Run verification queries: SELECT count WHERE tenant_id=X on all tables]
  S --> T[All counts = 0: issue deletion certificate with timestamp]
  T --> U[Store certificate in immutable audit log for compliance evidence]
```

### Retention Policy Architecture

```mermaid
graph TD
  A[Tenant-Specific Retention Configuration]

  B[Retention config stored per tenant]
  B --> C[tenants table: data_retention_days=365, audit_retention_days=2555]
  C --> D[Different defaults by plan: free=90days, pro=365days, enterprise=2555days]

  E[Automated retention job]
  E --> F[Runs nightly: find rows older than tenant.data_retention_days]
  F --> G[Soft-delete eligible rows: UPDATE SET archived=true WHERE created_at < now - retention]
  G --> H[Hard delete after 30 day grace period]

  I[GDPR deletion vs retention conflict]
  I --> J[Audit log must be retained 7 years for tax purposes]
  J --> K[Solution: anonymize PII in audit logs - replace name with anonymous_user_12345]
  K --> L[Log integrity preserved - PII removed - both requirements met]
```

### Pitfalls
- ❌ **Deleting rows with `DELETE FROM table WHERE tenant_id=X` in one statement:** On a table with 50M rows for tenant X, this holds a huge transaction lock and generates massive WAL — always batch delete in 10,000-row chunks with pauses
- ❌ **Forgetting derived data in analytics and search:** GDPR covers all systems that store personal data — deleting from PostgreSQL while leaving the tenant's data in Elasticsearch, S3 data lake, and BI warehouse is a GDPR violation; the Kafka event approach ensures all consumers handle deletion

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q6: How does Salesforce serve 150K tenants with shared Oracle databases?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P2 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can describe a real production multi-tenant architecture that handles enterprise-scale isolation on shared infrastructure — with specific technical details.

### Answer in 60 seconds
- **Scale:** 150,000+ tenants (orgs), billions of records, Oracle RAC clusters shared across thousands of tenants per pod
- **Metadata-driven schema:** Salesforce does not create actual Oracle tables per tenant; instead, a generic `Data` table with columns `val0` through `val500` stores all tenant data; a `Fields` metadata table maps tenant-defined field names to column slots
- **Tenant isolation:** Every row in every table has an `OrgId` column; all queries are automatically filtered by `OrgId = :current_org_id` via query rewriting in the Salesforce application tier
- **Pods:** Tenants are grouped into "pods" — Oracle RAC clusters of ~3 nodes; each pod serves 5,000–10,000 tenants; a pod failure affects only its tenants (blast radius isolation)
- **Elasticity:** Adding a new tenant is a metadata operation — insert a row into tenant registry, assign to a pod; no DDL migration, no table creation

### Salesforce Architecture

```mermaid
graph TD
  A[Salesforce Multi-Tenant Architecture]

  B[Tenant requests go to Salesforce Application Tier]
  B --> C[App tier: injects OrgId into every query]
  C --> D[Query rewriter: SELECT * FROM data WHERE OrgId = current_org]

  E[Physical Database Layer]
  E --> F[Pod 1: Oracle RAC - serves 5000-10000 orgs]
  E --> G[Pod 2: Oracle RAC - serves 5000-10000 orgs]
  E --> H[Pod N: Oracle RAC - ...]

  I[Metadata-driven schema]
  I --> J[Data table: OrgId, ObjId, val0, val1, ... val500]
  I --> K[Fields table: OrgId, FieldName, ColumnSlot, DataType]
  I --> L[No DDL per tenant - field mapping is just rows in Fields table]

  M[Custom field example]
  M --> N[Tenant adds custom field My_Rating__c]
  N --> O[Fields table: OrgId=123, FieldName=My_Rating__c, ColumnSlot=val47]
  O --> P[Data table: row uses val47 for that field - no schema change]
```

### Universal Polymorphic Table Trade-offs

```mermaid
graph TD
  A[Trade-offs of Salesforce Metadata-Driven Approach]

  B[Advantages]
  B --> C[Zero DDL migrations per tenant - add custom fields instantly]
  B --> D[150K tenants on shared DB - extreme density]
  B --> E[New tenant provisioning: seconds not hours]

  F[Disadvantages]
  F --> G[val0 to val500 columns are VARCHAR - no native type enforcement at DB layer]
  F --> H[No DB-level foreign keys - integrity at app layer only]
  F --> I[Complex queries require joining Data and Fields tables - slower than native SQL]
  F --> J[Index design is challenging - index on val47 serves all tenants using that slot]

  K[Scaling limits they hit]
  K --> L[Force.com platform outages from hot OrgId rows - noisy neighbor]
  L --> M[Solution: per-tenant rate limiting at application tier]
  M --> N[Governor limits: max 100 SOQL queries per transaction per org]
```

### Pod Architecture

```mermaid
graph TD
  A[Salesforce Pod Assignment]

  B[New tenant signup]
  B --> C[Tenant registry: assign to least-loaded pod]
  C --> D[Pod selection: fewest tenants, lowest CPU, available capacity]

  E[Tenant-to-pod mapping]
  E --> F[DNS: na1.salesforce.com routes to Pod NA1]
  F --> G[Pod NA1: Oracle RAC nodes 1-3, 8,000 orgs]
  G --> H[Per-pod blast radius: 8,000 orgs affected by pod failure]

  I[Pod migration for large tenants]
  I --> J[Enterprise tenant uses 5% of pod resources]
  J --> K[Move to low-density pod or dedicated pod]
  K --> L[Transparent to tenant: DNS update routes to new pod]
```

### What a great answer includes
- [ ] The EAV (Entity-Attribute-Value) model: Salesforce's `val0–val500` is a form of EAV — a common but controversial pattern for dynamic schemas; the alternative is JSON columns (PostgreSQL JSONB), which Salesforce avoids for legacy Oracle compatibility
- [ ] Governor limits as architectural necessity: without the 100-SOQL-query governor limit, one tenant's Apex code could exhaust pod resources; governor limits are enforced at the application tier, not DB layer
- [ ] Why Oracle and not PostgreSQL: Salesforce was built in 2000 on Oracle; migrating 150K tenants' data from Oracle to any other DB is a multi-year project with enormous risk — legacy lock-in at architectural scale
- [ ] Hyperforce: Salesforce's newer infrastructure runs on public cloud (AWS, Azure, GCP) with a redesigned multi-tenant stack using modern PostgreSQL-based storage; legacy pods remain Oracle

### Pitfalls
- ❌ **Copying Salesforce's EAV model for a new SaaS product:** EAV was the right choice in 2000 without JSONB support; today, PostgreSQL JSONB with GIN indexes gives tenant-defined dynamic schemas with proper typing and indexing at far lower complexity
- ❌ **Ignoring governor limits as a product design requirement:** If you build shared infrastructure without per-tenant rate limits, one enterprise customer's scheduled batch job will degrade all other tenants — governor limits are not just a feature, they are a necessity for shared infrastructure

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)
