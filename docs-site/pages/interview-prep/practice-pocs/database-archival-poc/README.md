# Database Archival POC

A complete, runnable proof-of-concept for implementing data archival strategies.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application                               │
│                             │                                    │
│                      Query Router                                │
│                    /       │        \                            │
│                   ▼        ▼         ▼                           │
│    ┌──────────┐   ┌──────────────┐   ┌──────────────┐          │
│    │  Redis   │   │   Hot DB     │   │  Archive DB  │          │
│    │  Cache   │   │ (< 90 days)  │   │ (90d - 2yr)  │          │
│    └──────────┘   └──────────────┘   └──────────────┘          │
│       :6379           :5432              :5433                  │
│                             │                                    │
│                      Archive Worker                              │
│                      (Background Job)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start Infrastructure

```bash
# Navigate to POC directory
cd docs-site/pages/interview-prep/practice-pocs/database-archival-poc

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 2. Install Dependencies

**Python:**
```bash
pip install asyncpg
```

**Node.js:**
```bash
npm install pg
```

### 3. Run the Scripts

**Python - Check Stats:**
```bash
python scripts/archive_worker.py --stats
```

**Python - Run Archival:**
```bash
# Dry run (no changes)
python scripts/archive_worker.py --days 90 --dry-run

# Actually archive
python scripts/archive_worker.py --days 90
```

**Python - Query Router:**
```bash
# Run demo queries
python scripts/query_router.py --demo

# Query last 30 days
python scripts/query_router.py --days 30

# Query specific user
python scripts/query_router.py --user-id 100

# Query date range
python scripts/query_router.py --start-date 2023-06-01 --end-date 2023-12-31
```

**Python - Restore Service:**
```bash
# Show stats
python scripts/restore_service.py --stats

# Find archived records for user
python scripts/restore_service.py --find --user-id 100

# Restore specific record
python scripts/restore_service.py --record-id 12345
```

**Node.js:**
```bash
# Show stats
node scripts/archival_system.js stats

# Run archival
node scripts/archival_system.js archive --days=90

# Query data
node scripts/archival_system.js query --days=30

# Restore record
node scripts/archival_system.js restore --record-id=12345
```

## Data Flow

### Archival Flow

```
1. Archive Worker runs daily (cron)
2. Selects records older than 90 days from hot DB
3. Inserts into archive DB
4. Updates tracking table
5. Deletes from hot DB
```

### Query Flow

```
1. Request comes in with date range
2. Query Router analyzes date range:
   - Date > cutoff (90 days ago)? → Query HOT
   - Date < cutoff? → Query ARCHIVE
   - Spans both? → Query BOTH, merge results
3. Return combined results sorted by date
```

### Restore Flow

```
1. Request to restore record/user
2. Find record in archive DB
3. Copy to hot DB
4. Update tracking (tier = 'both' or 'hot')
5. Optionally delete from archive
```

## File Structure

```
database-archival-poc/
├── docker-compose.yml          # Infrastructure setup
├── init-scripts/               # Hot DB initialization
│   ├── 01-schema.sql          # Tables, indexes, functions
│   └── 02-seed-data.sql       # Test data (100K orders)
├── init-scripts-archive/       # Archive DB initialization
│   └── 01-schema.sql          # Archive table schema
├── scripts/
│   ├── archive_worker.py      # Python archival worker
│   ├── query_router.py        # Python query router
│   ├── restore_service.py     # Python restore service
│   └── archival_system.js     # Node.js complete implementation
└── README.md                   # This file
```

## Configuration

### Environment Variables

```bash
# Hot DB (Primary)
HOT_DB_URL=postgresql://postgres:postgres@localhost:5432/archival_poc

# Archive DB (Warm)
ARCHIVE_DB_URL=postgresql://postgres:postgres@localhost:5433/archival_archive
```

### Archival Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `retention_days` | 90 | Archive records older than this |
| `batch_size` | 10000 | Records per batch |
| `exclude_statuses` | pending, processing | Don't archive these |

## Expected Results

### Before Archival

```
HOT STORAGE (Primary DB)
  Records: 100,000
  Date range: 2022-01-24 to 2024-01-24

ARCHIVE STORAGE (Warm DB)
  Records: 0
```

### After Archival (90 days retention)

```
HOT STORAGE (Primary DB)
  Records: ~30,000 (30%)
  Date range: 2023-10-26 to 2024-01-24

ARCHIVE STORAGE (Warm DB)
  Records: ~70,000 (70%)
  Date range: 2022-01-24 to 2023-10-25
```

## Query Routing Examples

| Query | Tier(s) Queried | Why |
|-------|-----------------|-----|
| Last 30 days | HOT only | Entirely within retention |
| 6-12 months ago | ARCHIVE only | Entirely outside retention |
| Last 6 months | BOTH | Spans retention boundary |
| Unbounded | HOT | Default to recent data |

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (all data)
docker-compose down -v
```

## Key Learnings

1. **Batch Operations** - Use `FOR UPDATE SKIP LOCKED` to avoid blocking
2. **Track Everything** - Know where every record lives
3. **Route Smartly** - Only query tiers that have relevant data
4. **Support Restoration** - Archives aren't permanent tombs
5. **Monitor** - Track archival lag, storage sizes, query latencies

## Related Documentation

- [Data Archival Strategies](/system-design/databases/data-archival-strategies)
- [Storage Bloat Solutions](/problems-at-scale/cost-optimization/storage-bloat)
- [Table Partitioning POC](/interview-prep/practice-pocs/database-partitioning)
