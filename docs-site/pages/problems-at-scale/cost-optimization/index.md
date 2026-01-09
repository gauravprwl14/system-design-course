# 💰 Cost & Resource Waste

## Overview

Problems where **inefficient resource usage leads to unnecessarily high cloud bills** or wasted infrastructure. These issues often go unnoticed until the monthly bill arrives with 10x increase.

**Why this matters**: Pinterest reduced their annual cloud bill by $20M through optimization. Dropbox saved $75M by moving off AWS. At scale, small inefficiencies become millions in wasted spend.

---

## Common Scenarios

### Storage Waste
- **Storage bloat**: Soft deletes cause 10TB of unused data
- **Unused indexes**: 50 indexes but only 5 used by queries
- **Log retention**: Logs kept forever, never accessed
- **Duplicate data**: Same data stored in multiple places

### Compute Waste
- **Over-provisioning**: Server handles 10% of capacity
- **Idle resources**: Dev/staging running 24/7
- **Inefficient queries**: Full table scans cost $$$ per query
- **No auto-scaling**: Peak capacity runs during low traffic

### Network Waste
- **CDN cost spike**: Cache bypass causes origin hits
- **Data transfer**: Internal services in different regions
- **No compression**: Uncompressed responses waste bandwidth
- **Egress charges**: Moving data out of cloud

---

## Key Patterns

### 1. Storage Bloat (Soft Deletes)
```sql
-- User deletes account (soft delete)
UPDATE users SET deleted_at = NOW() WHERE id = 12345;

-- Data never actually removed
SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL;
-- Returns 10,000,000 soft-deleted users

Storage cost: 10M users × 10KB = 100GB
Annual cost: $2,400/year (for deleted data!)
```

**Solution**: Hard delete + archival, data lifecycle policies

### 2. Unused Indexes
```sql
-- DBA creates 50 indexes "just in case"
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
-- ... 48 more indexes

-- Only 5 actually used by queries
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
-- Returns 45 unused indexes

Cost: 45 indexes × 2GB each = 90GB wasted
Write performance: -50% (index maintenance)
```

**Solution**: Monitor index usage, remove unused

### 3. Over-Provisioning
```javascript
// "We might need it during Black Friday"
const servers = 100; // Provisioned for 100K req/s

// Actual traffic
const avgTraffic = 10000; // 10K req/s (10% utilization)

Cost: 100 servers × $500/month = $50K/month
Optimized: 15 servers + auto-scaling = $7.5K/month
Waste: $42.5K/month = $510K/year
```

**Solution**: Auto-scaling, right-sizing, spot instances

---

## Problems in This Category

| Problem | Domain | Impact | Difficulty | Status |
|---------|--------|--------|------------|--------|
| [Storage Bloat](/problems-at-scale/cost-optimization/storage-bloat) | SaaS Platforms | High AWS bills | 🟡 Intermediate | 🚧 Problem documented |
| [Unused Indexes](/problems-at-scale/cost-optimization/unused-indexes) | Databases | Wasted storage | 🟢 Beginner | 🚧 Problem documented |
| [Over-Provisioning](/problems-at-scale/cost-optimization/over-provisioning) | Cloud Infrastructure | 10x cost waste | 🟡 Intermediate | 🚧 Problem documented |
| [Inefficient Queries](/problems-at-scale/cost-optimization/inefficient-queries) | Analytics | High compute costs | 🟡 Intermediate | 🚧 Problem documented |
| [CDN Cost Spike](/problems-at-scale/cost-optimization/cdn-cost-spike) | Media Delivery | Unexpected bills | 🟡 Intermediate | 🚧 Problem documented |

---

## Common Solutions

### 1. Data Lifecycle Policies
**Automatically archive/delete old data**
- Pros: Ongoing cost reduction, automated
- Cons: Need to design retention rules
- When: Growing datasets, compliance requirements

### 2. Auto-Scaling
**Scale resources based on actual demand**
- Pros: Pay only for what you use, handle spikes
- Cons: Cold start latency, complexity
- When: Variable traffic, predictable patterns

### 3. Reserved Instances
**Commit to usage for discounts (50-75% off)**
- Pros: Significant cost savings, predictable billing
- Cons: Commitment required, less flexible
- When: Baseline steady-state load

### 4. Query Optimization
**Fix inefficient database queries**
- Pros: Lower compute costs, better performance
- Cons: Requires expertise, ongoing monitoring
- When: High query volume, analytical workloads

---

## Real-World Impact

| Company | Problem | Scale | Savings |
|---------|---------|-------|---------|
| **Pinterest** | Storage & compute optimization | 1B users | $20M/year |
| **Dropbox** | Over-reliance on AWS | 500M users | $75M over 2 years |
| **Airbnb** | Unused database indexes | 150M users | $2M/year |
| **Spotify** | Over-provisioned infrastructure | 500M users | $10M/year |

---

## Detection & Prevention

### Monitoring
```sql
-- Find unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%_pkey';

-- Find expensive queries
SELECT query, total_exec_time, calls,
       total_exec_time / calls as avg_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Detect storage bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

### Prevention
- Set up cost alerts (AWS Budgets, GCP Billing alerts)
- Monthly cost review meetings
- Tag resources by team/project for attribution
- Implement auto-scaling for variable workloads
- Regular capacity planning reviews

---

## Related Categories

- [Performance](/problems-at-scale/performance) - Inefficient code costs money
- [Scalability](/problems-at-scale/scalability) - Over-provisioning for scale
- [Data Integrity](/problems-at-scale/data-integrity) - Soft deletes cause bloat

---

## Learn More

- [AWS Cost Optimization](https://aws.amazon.com/aws-cost-management/)
- [System Design: Cost-Aware Architecture](/system-design/cost-optimization)
- [POC: Cloud Cost Monitoring](/interview-prep/practice-pocs/cost-monitoring)

---

**Start exploring**: [Storage Bloat](/problems-at-scale/cost-optimization/storage-bloat) | [All Problems](/problems-at-scale)
