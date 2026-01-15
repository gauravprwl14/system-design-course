# 🗄️ Data Integrity

## Overview

Problems where **data becomes corrupted, inconsistent, or violates business rules** due to application bugs, migration errors, or database constraint failures. Unlike consistency issues, these problems result in permanently broken data.

**Why this matters**: Stripe once had a data migration bug that corrupted payment records. Recovery took weeks and cost millions. Data integrity issues are often irreversible without backups.

---

## Common Scenarios

### Referential Integrity
- **Orphaned records**: Child records exist after parent deleted
- **Foreign key violations**: References point to non-existent records
- **Cascade delete failures**: Partial deletions leave inconsistent state

### Uniqueness Violations
- **Duplicate entries**: Same email registered multiple times
- **Primary key conflicts**: Race conditions create duplicate IDs
- **Natural key collisions**: Business logic assumes uniqueness incorrectly

### Data Corruption
- **Character encoding issues**: UTF-8 data stored as Latin-1
- **Truncation errors**: Data cut off at column limits
- **Type mismatches**: Numbers stored as strings
- **Timezone confusion**: Dates stored in wrong timezone

### Migration Failures
- **Schema changes break app**: New column added, old code crashes
- **Data transformation errors**: Migration logic has bugs
- **Rollback impossible**: Can't undo migration safely

---

## Key Patterns

### 1. Orphaned Records
```sql
-- Parent table
DELETE FROM users WHERE id = 12345;

-- Child records remain (no CASCADE)
SELECT * FROM orders WHERE user_id = 12345;
-- Returns 50 orphaned orders

Result: Orders exist but user doesn't
App crashes trying to load user for order
```

**Solution**: CASCADE DELETE, soft deletes, cleanup jobs

### 2. Duplicate Entries
```javascript
// No unique constraint on email
async function registerUser(email) {
  const exists = await db.query("SELECT * FROM users WHERE email = ?", email);

  if (!exists) {
    // Race condition: two requests pass this check
    await db.query("INSERT INTO users (email) VALUES (?)", email);
  }
}

Result: Same email inserted twice
Login fails with "multiple users found"
```

**Solution**: Unique index, UPSERT operations

### 3. Schema Migration Failure
```sql
-- Migration adds NOT NULL column
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(50) NOT NULL;

-- Old code still running (doesn't set tracking_number)
INSERT INTO orders (user_id, total) VALUES (123, 50.00);
-- ERROR: null value in column "tracking_number" violates not-null constraint

Result: All order creation fails
Revenue stops
```

**Solution**: Multi-phase migrations, backward compatibility

---

## Problems in This Category

| Problem | Domain | Impact | Difficulty | Status |
|---------|--------|--------|------------|--------|
| [Orphaned Records](/problems-at-scale/data-integrity/orphaned-records) | Relational DBs | Data inconsistency | 🟡 Intermediate | 🚧 Problem documented |
| [Duplicate Entries](/problems-at-scale/data-integrity/duplicate-entries) | User Systems | Login issues | 🟢 Beginner | 🚧 Problem documented |
| [Foreign Key Violations](/problems-at-scale/data-integrity/foreign-key-violations) | E-commerce | App errors | 🟡 Intermediate | 🚧 Problem documented |
| [Data Corruption](/problems-at-scale/data-integrity/data-corruption) | Migrations | Data loss | 🔴 Advanced | 🚧 Problem documented |
| [Schema Migration Failure](/problems-at-scale/data-integrity/schema-migration-failure) | Deployments | Downtime | 🔴 Advanced | 🚧 Problem documented |

---

## Common Solutions

### 1. Database Constraints
**Enforce rules at database level**
- Pros: Guaranteed enforcement, prevents bad data
- Cons: Performance impact, harder to change
- When: Critical invariants, multi-app access

### 2. Soft Deletes
**Mark records as deleted instead of removing**
- Pros: Reversible, audit trail, no orphans
- Cons: Query complexity, storage overhead
- When: Important data, audit requirements

### 3. Multi-Phase Migrations
**Deploy schema changes in backward-compatible steps**
- Pros: Zero downtime, safe rollback
- Cons: Slower deployment, temporary complexity
- When: Production databases, high availability

### 4. Data Validation
**Check data integrity regularly**
- Pros: Detect corruption early, prevent propagation
- Cons: Overhead, doesn't prevent issues
- When: Critical data, compliance requirements

---

## Real-World Impact

| Company | Problem | Scale | Impact |
|---------|---------|-------|--------|
| **GitLab** | Migration deleted production data | 5K projects | 6-hour restore from backup |
| **Stripe** | Payment encoding corruption | 1M transactions | Manual data recovery |
| **AWS** | Orphaned resources | Millions | Billing inconsistencies |
| **GitHub** | Schema migration failure | 100M users | 2-hour downtime |

---

## Detection & Prevention

### Monitoring
```sql
-- Detect orphaned records
SELECT COUNT(*) FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.id IS NULL;

-- Detect duplicates
SELECT email, COUNT(*) as duplicates
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- Verify referential integrity
SELECT COUNT(*) FROM orders
WHERE product_id NOT IN (SELECT id FROM products);
```

### Prevention
- Add database constraints (FOREIGN KEY, UNIQUE, NOT NULL)
- Use transactions for multi-table operations
- Test migrations on production-like data
- Implement validation checks in CI/CD
- Regular integrity checks (nightly jobs)

---

## Related Categories

- [Consistency](/problems-at-scale/consistency) - Consistency issues can cause integrity problems
- [Concurrency](/problems-at-scale/concurrency) - Race conditions create duplicates
- [Availability](/problems-at-scale/availability) - Integrity failures can cause outages

---

## Learn More

- [System Design: Database Constraints](/system-design/databases/constraints)
- [System Design: Schema Migrations](/system-design/databases/migrations)
- [POC: Zero-Downtime Migrations](/interview-prep/practice-pocs/schema-migration)

---

**Start exploring**: [Orphaned Records](/problems-at-scale/data-integrity/orphaned-records) | [All Problems](/problems-at-scale)
