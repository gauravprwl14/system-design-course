---
title: "Database Backup & Recovery"
layer: interview-q
section: interview-prep/question-bank/databases
difficulty: intermediate
tags: [databases, backup, recovery, rpo, rto, pitr, wal, disaster-recovery]
---

# Database Backup & Recovery

6 questions covering RPO vs RTO, backup types, PITR with WAL archiving, backup testing, geo-redundancy and the 3-2-1 rule, and AWS RDS automated backup internals.

---

## Q1: What is RPO vs RTO — how do they drive backup strategy decisions?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you can define RPO and RTO precisely, explain who sets them (business, not engineering), and map specific values to specific backup technologies.

### Answer in 60 seconds
- **RPO (Recovery Point Objective):** Maximum acceptable data loss — how far back in time can you afford to restore from? RPO=0 means zero data loss (synchronous replication required); RPO=1hr means up to 1 hour of transactions can be lost
- **RTO (Recovery Time Objective):** Maximum acceptable downtime — how long can the service be down before restoring? RTO=5min means the system must be serving traffic again within 5 minutes of a failure
- **Who sets them:** Business stakeholders set RPO/RTO based on revenue impact — an e-commerce site losing $10,000/minute of downtime has RTO=1min; a nightly analytics pipeline can tolerate RTO=4hr
- **Technology mapping:** RPO=0 → synchronous multi-region replication; RPO=5min → WAL shipping + PITR; RPO=24hr → daily full backup; RTO=1min → standby with automatic failover; RTO=4hr → restore from backup to new instance

### Diagram

```mermaid
graph TD
  A[Disaster occurs at T=12:00]

  B[RPO: how far back do we restore?]
  B --> C[Last backup at T=11:00 = RPO of 1 hour = 1 hour of lost data]
  B --> D[Continuous WAL shipping: RPO = 5 minutes = 5 min of lost data]
  B --> E[Synchronous replica: RPO = 0 = zero lost transactions]

  F[RTO: how long to restore service?]
  F --> G[Restore from S3 backup: RTO = 4 hours to download and restore]
  F --> H[Warm standby failover: RTO = 30 seconds to promote replica]
  F --> I[Hot standby with load balancer: RTO = 10 seconds automatic failover]
```

### RPO/RTO Technology Matrix

```mermaid
graph TD
  A[RPO and RTO Requirements Drive Architecture]

  B[RPO=0 AND RTO=0 - impossible in practice]
  B --> C[Synchronous multi-AZ replication - RPO near 0]
  C --> D[Automatic failover with health checks - RTO 10-30s]

  E[RPO=5min AND RTO=5min - typical production]
  E --> F[WAL archiving to S3 every 5 minutes]
  F --> G[Warm standby replica promotes in 30s]

  H[RPO=24hr AND RTO=4hr - dev or low-value system]
  H --> I[Daily full backup to S3]
  I --> J[Manual restore process]
```

| RPO Requirement | Backup Technology | Monthly Cost (RDS) |
|-----------------|------------------|-------------------|
| 0 seconds | Synchronous multi-AZ replica | +100% (2x instance) |
| 5 minutes | WAL archiving + warm standby | +50% (standby + S3) |
| 1 hour | Hourly snapshots + S3 | +10% (S3 storage) |
| 24 hours | Daily full backup | +5% (S3 storage only) |

| RTO Requirement | Technology | Time to Recovery |
|-----------------|------------|-----------------|
| <30 seconds | Automatic failover to hot standby | 10–30 seconds |
| <5 minutes | Promote warm standby | 1–5 minutes |
| <1 hour | Restore latest snapshot to new instance | 15–60 minutes |
| <4 hours | Full restore from offsite backup | 1–4 hours |

### Pitfalls
- ❌ **Setting RPO=0 without understanding cost:** Synchronous replication means every write waits for at least one remote acknowledgment — adds 50–100ms write latency for cross-AZ; this is often unacceptable for write-heavy workloads; agree on RPO=5min and save 40ms per write
- ❌ **Conflating RTO with failover time:** RTO includes detection time + failover time + DNS propagation time + application reconnect time; a replica that promotes in 30 seconds may have an effective RTO of 5 minutes after accounting for health check interval (60s) + DNS TTL (300s)

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q2: What is the difference between full, incremental, and WAL-based (continuous) backups?

**Role:** Mid | **Difficulty:** 🟡 Mid | **Priority:** P0 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand backup types, their storage and restore cost trade-offs, and when each is appropriate.

### Answer in 60 seconds
- **Full backup:** Copy of the entire database at a point in time; restore is simple (just restore this one file); storage cost = full DB size; typically taken weekly or daily; PostgreSQL: `pg_basebackup`; MySQL: `mysqldump` or Percona XtraBackup
- **Incremental backup:** Only the data changed since the last backup (full or incremental); storage = only delta bytes; restore requires replay of full + all incrementals in sequence; if one incremental is corrupt, the chain breaks
- **WAL-based (continuous) backup:** Archive WAL (Write-Ahead Log) files as they are generated — every 16MB WAL segment is shipped to S3; restore = full backup + replay all WAL files from that point; enables Point-in-Time Recovery (PITR) to any second in history
- **Real numbers:** 500GB database: full backup = 500GB/day; incremental = ~2GB/day (0.4% change rate); WAL archive = ~10GB/day (typical write-heavy workload)

### Diagram

```mermaid
graph TD
  A[Backup Types Timeline]

  B[Full Backup - Sunday T=00:00]
  B --> C[500GB snapshot to S3]
  C --> D[Restore: download 500GB, restore = 2 hours]

  E[Incremental - Monday T=00:00]
  E --> F[Only changed pages since Sunday: 3GB]
  F --> G[Restore: Sunday full + Monday incremental = 2.5 hours]

  H[Incremental - Tuesday T=00:00]
  H --> I[Changed pages since Monday: 4GB]
  I --> J[Restore: Sunday + Monday + Tuesday = 3 hours]

  K[WAL Archive - continuous]
  K --> L[Every WAL segment 16MB shipped to S3 within 5 minutes]
  L --> M[Storage: 10GB per day]
  M --> N[Restore to any point: full backup + WAL replay = PITR]
```

### Restore Complexity Comparison

```mermaid
graph TD
  A[Restore Scenarios]

  B[Full backup restore]
  B --> C[Download single file: 2 hours at 70MB/s]
  C --> D[Restore to new instance: 30 minutes]
  D --> E[Total RTO: ~2.5 hours - simple, reliable]

  F[Incremental chain restore]
  F --> G[Download full: 2 hours]
  G --> H[Download and apply 7 incrementals: 1 hour]
  H --> I[Total RTO: ~3 hours - complex chain dependency]

  J[WAL-based PITR restore]
  J --> K[Download base backup: 2 hours]
  K --> L[Replay WAL files from archive: 30 min to 3 hours depending on WAL volume]
  L --> M[Stop replay at target timestamp: precise recovery]
  M --> N[Total RTO: 2.5 to 5 hours - highest RPO precision]
```

| Backup Type | Storage/Day | Restore Time | RPO | Use Case |
|-------------|-------------|--------------|-----|----------|
| Full (daily) | 500GB | 2–4 hours | 24 hours | Simple systems, low write rate |
| Full + incremental | 5–20GB | 2–6 hours | 24 hours | Large DBs, limited storage budget |
| WAL continuous | 10–50GB | 3–6 hours | 5 minutes | Production, PITR required |
| Full + WAL combined | 500GB + 10GB/day | 2–5 hours | 5 minutes | Production best practice |

### Pitfalls
- ❌ **Storing only incremental backups without a recent full backup:** If the base full backup is corrupted, the entire incremental chain is unrecoverable; always keep at least 2 recent full backups; test the restore of the chain weekly
- ❌ **Assuming WAL archive alone is sufficient:** WAL files replayed from genesis would take weeks for a 500GB database — you need a base backup as the starting point, then WAL replay only covers the delta from that base

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q3: How do you achieve point-in-time recovery (PITR) with PostgreSQL WAL archiving?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand the complete PITR setup — base backup, WAL archiving to S3, and the recovery process to a specific timestamp after a destructive event.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| Scenario | Developer runs `DELETE FROM orders WHERE status='completed'` — drops 20M rows — mistake without WHERE refinement |
| Time of mistake | 14:32:00 UTC |
| RPO target | Recover to 14:31:00 UTC (1 minute before mistake) |
| Database size | 300GB |
| WAL archive lag | < 5 minutes (WAL shipped to S3 every 5 min) |

### PITR Setup

```mermaid
graph TD
  A[PostgreSQL PITR Setup]

  B[Step 1: Configure WAL archiving]
  B --> C[postgresql.conf: wal_level = replica]
  C --> D[archive_mode = on]
  D --> E[archive_command = aws s3 cp %p s3://db-wal-archive/%f]
  E --> F[Every 16MB WAL segment shipped to S3 within archive_timeout seconds]

  G[Step 2: Regular base backups]
  G --> H[pg_basebackup -D /backup/base -Ft -z -P daily at 02:00]
  H --> I[Full consistent backup: 300GB compressed to ~100GB]
  I --> J[Stored in S3 bucket: s3://db-base-backups/YYYY-MM-DD/]

  K[Step 3: Recovery configuration]
  K --> L[recovery.conf or postgresql.conf restore_command]
  L --> M[restore_command = aws s3 cp s3://db-wal-archive/%f %p]
  M --> N[recovery_target_time = 2024-01-15 14:31:00 UTC]
```

### PITR Recovery Process

```mermaid
sequenceDiagram
  participant DBA
  participant S3 as S3 WAL Archive
  participant NewDB as New PostgreSQL Instance

  DBA->>S3: Download latest base backup (before 14:32)
  S3-->>DBA: 100GB compressed base backup
  DBA->>NewDB: Restore base backup (expand 100GB = 300GB)
  Note over NewDB: DB restored to 02:00 state (base backup time)

  DBA->>NewDB: Set recovery_target_time = 14:31:00
  NewDB->>S3: restore_command: fetch next WAL file
  S3-->>NewDB: WAL file 000000010000000000000042
  NewDB->>NewDB: Replay WAL file (apply all transactions up to end)
  loop Until 14:31:00 reached
    NewDB->>S3: Fetch next WAL file
    S3-->>NewDB: Next WAL file
    NewDB->>NewDB: Replay transactions - stop at 14:31:00
  end

  Note over NewDB: DB now at state of 14:31:00 - before DELETE
  DBA->>NewDB: SELECT count FROM orders - verify 20M rows present
  DBA->>NewDB: pg_ctl promote - convert to primary
```

### Recovery Target Options

```mermaid
graph TD
  A[PostgreSQL Recovery Target Options]

  B[recovery_target_time]
  B --> C[Recover to a specific timestamp: 2024-01-15 14:31:00]
  C --> D[Most common - used after human error with known time]

  E[recovery_target_lsn]
  E --> F[Recover to a specific WAL Log Sequence Number]
  F --> G[More precise than time - use when you know the exact transaction boundary]

  H[recovery_target_name]
  H --> I[Recover to a named restore point created with SELECT pg_create_restore_point]
  I --> J[Useful for pre-migration snapshots: pg_create_restore_point - pre-migration-20240115]

  K[recovery_target_xid]
  K --> L[Recover to just before a specific transaction ID]
  L --> M[Useful when you know exactly which transaction to undo]
```

### Pitfalls
- ❌ **Setting `archive_timeout` too high:** Default `archive_timeout=0` means WAL is only archived when a segment fills (16MB, which could take hours on a low-write system); set `archive_timeout=300` (5 minutes) to ensure WAL is shipped even if not full — otherwise RPO can be hours, not minutes
- ❌ **Not testing PITR recovery before you need it:** A WAL archive that is incomplete or corrupted is only discovered during a crisis; run a monthly PITR test to a separate instance and verify row counts match expected state

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q4: How do you test a backup — what is the minimum test to verify recoverability?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you understand that an untested backup is not a backup — you need a concrete, repeatable restore test procedure with a pass/fail criterion.

### Answer in 60 seconds
- **The fundamental principle:** A backup is only verified when you have successfully restored it and confirmed data integrity — storing a backup file without testing it is false confidence
- **Minimum viable test:** (1) Restore backup to a separate test instance; (2) verify DB starts and is queryable; (3) run a checksum query (`SELECT count(*), max(updated_at) FROM critical_table`) and compare to production at backup time; (4) spot-check 5–10 critical rows by known ID
- **Schedule:** Weekly restore test for production DBs; monthly full PITR test simulating a disaster scenario with a timestamp target
- **Automated testing:** CI/CD pipeline triggers weekly restore test; alerts if restore fails or row counts deviate >0.1% from expected; test result is a mandatory metric on ops dashboard

### Diagram

```mermaid
graph TD
  A[Backup Verification Process - Weekly Automated]

  B[Step 1: Trigger restore to test environment]
  B --> C[Download latest backup from S3 to test-db-restore instance]
  C --> D[Restore using same process as production recovery]

  E[Step 2: Verify DB health]
  E --> F[pg_isready: DB is accepting connections]
  F --> G[SELECT 1: basic query executes]
  G --> H[Check pg_stat_database: no errors, DB consistent state]

  I[Step 3: Row count and freshness check]
  I --> J[SELECT count from orders WHERE created_at > now - 24hr]
  J --> K[Compare: expected count based on backup timestamp]
  K --> L{Row count within 0.1% of expected?}
  L -->|Yes| M[PASS: backup is recoverable]
  L -->|No| N[FAIL: alert on-call - investigate backup corruption]

  O[Step 4: Spot check critical data]
  O --> P[SELECT known order IDs and verify expected field values]
  P --> Q[Verify foreign key integrity: no orphaned records]
  Q --> R[Run application smoke tests against restored DB]
```

### Backup Test Automation Architecture

```mermaid
graph TD
  A[Weekly Backup Test Pipeline]

  B[Monday 03:00 UTC - off-peak]
  B --> C[Trigger: restore latest backup to test-db-restore.internal]
  C --> D[Restore time: monitor and alert if > 4 hours RTO threshold]

  E[Validation suite runs against restored DB]
  E --> F[Health checks: connectivity, query execution]
  E --> G[Data integrity: row counts, max timestamps, FK checks]
  E --> H[Application smoke tests: 50 critical read queries]

  I[Results]
  I --> J[All pass: log success to ops dashboard, retain for 90 days]
  I --> K[Any fail: PagerDuty alert, backup owner notified, P1 incident]

  L[PITR test - monthly]
  L --> M[Simulate: restore to timestamp 7 days ago]
  M --> N[Verify: data matches archived production snapshot from that time]
  N --> O[Confirm: WAL chain is intact and all segments present in S3]
```

### Test Failure Causes and Fixes

| Failure Type | Symptom | Root Cause | Fix |
|-------------|---------|------------|-----|
| Backup file corrupt | MD5 checksum mismatch | S3 bit rot, upload error | Enable S3 object integrity checking, verify on upload |
| WAL gap in PITR chain | Recovery stops at T=X, cannot reach T=Y | WAL segment missing from archive | Check `archive_status` on source DB, re-archive missing segment |
| Row count mismatch >1% | Fewer rows than expected | Backup captured mid-transaction | Use consistent backup (`pg_basebackup --checkpoint=fast`) |
| DB starts but app fails | Connection string errors | DB name or user different in backup | Document restore runbook with all connection parameters |

### Pitfalls
- ❌ **Testing backup by checking file size only:** A 100GB backup file that is corrupt internally will fail to restore; file size check is not a validity check — only an actual restore confirms recoverability
- ❌ **Restoring to the same server as production for backup test:** Restoring over production to test the backup destroys production — always use a separate, isolated test environment; never test restores in place on a running system

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q5: What is geo-redundant backup and why does the 3-2-1 backup rule matter?

**Role:** Senior | **Difficulty:** 🔴 Senior | **Priority:** P1 | **Format:** Quick Answer

> **What the interviewer is testing:** Whether you know the 3-2-1 rule as a widely accepted minimum standard for backup redundancy and can explain what geo-redundancy protects against.

### Answer in 60 seconds
- **3-2-1 rule:** Keep **3** copies of data, on **2** different storage media types, with **1** copy offsite; this ensures a single failure (disk failure, datacenter fire, ransomware) cannot destroy all copies simultaneously
- **Geo-redundant backup:** Storing backup copies in geographically separate regions — e.g., primary DB in US-East-1, backups in US-East-1 and US-West-2; a US-East-1 region outage cannot destroy both copies
- **What it protects against:** Regional cloud outages (full AZ or region failure); ransomware that encrypts DB and backup in same region; accidental deletion of backup in one region
- **Real numbers:** AWS S3 standard has 99.999999999% (11 nines) durability in one region; adding cross-region replication raises protection against regional disaster to astronomically unlikely

### Diagram

```mermaid
graph TD
  A[3-2-1 Backup Rule Applied to PostgreSQL]

  B[Copy 1: Production DB]
  B --> C[PostgreSQL primary - US-East-1 - local disk NVMe]

  D[Copy 2: Same-region backup]
  D --> E[S3 bucket: us-east-1 - different storage type from disk]
  E --> F[Daily pg_basebackup + WAL archive]

  G[Copy 3: Cross-region backup]
  G --> H[S3 bucket: us-west-2 - different region - offsite]
  H --> I[S3 Cross-Region Replication: auto-copies from us-east-1 bucket]
  I --> J[CRR lag: typically 1-15 minutes]

  K[Failure scenarios covered]
  K --> L[Disk failure: restore from S3 us-east-1]
  K --> M[us-east-1 region outage: restore from S3 us-west-2]
  K --> N[Ransomware encrypts us-east-1: S3 Object Lock on us-west-2 protects]
```

### S3 Geo-Redundant Backup Architecture

```mermaid
graph TD
  A[AWS S3 Cross-Region Replication Setup]

  B[Source bucket: db-backups-primary - us-east-1]
  B --> C[S3 Versioning enabled: protects against accidental delete]
  C --> D[S3 Object Lock - COMPLIANCE mode: cannot delete for 90 days]
  D --> E[Replication rule: replicate all to us-west-2]

  F[Destination bucket: db-backups-replica - us-west-2]
  F --> G[Independent bucket: different AWS account recommended]
  G --> H[Ransomware or credential compromise: cannot reach cross-account bucket]

  I[Monitoring]
  I --> J[CloudWatch: ReplicationLatency alarm if lag > 15 minutes]
  I --> K[S3 Storage Lens: verify backup counts match expected]
  I --> L[Weekly alert: confirm latest backup in us-west-2 is < 25 hours old]
```

### Disaster Recovery Scenarios

```mermaid
graph TD
  A[Failure Scenario Coverage]

  B[Scenario 1: Single disk failure]
  B --> C[Copy 1 lost - local disk]
  C --> D[Restore from Copy 2: S3 us-east-1]
  D --> E[RTO: 30 min to restore from S3 in same region]

  F[Scenario 2: Full region failure - us-east-1 down]
  F --> G[Copy 1 and Copy 2 unavailable]
  G --> H[Restore from Copy 3: S3 us-west-2]
  H --> I[RTO: 2-4 hours - cross-region download latency]

  J[Scenario 3: Ransomware encrypts all us-east-1 data]
  J --> K[Copy 1 and Copy 2 encrypted by attacker]
  K --> L[Copy 3 in us-west-2 - S3 Object Lock prevents encryption]
  L --> M[Restore from Object Lock protected copy: RTO 2-4 hours]

  N[Scenario 4: Accidental deletion of backup bucket]
  N --> O[S3 Versioning on Copy 2: deleted files can be recovered]
  N --> P[S3 Object Lock on Copy 3: cannot be deleted even by admin]
```

### Pitfalls
- ❌ **Storing backup in same region as production without cross-region copy:** AWS us-east-1 has had multi-hour full-region outages (December 2021); S3 in us-east-1 was affected; backups in the same region as the failure are unavailable when you need them most
- ❌ **Not enabling S3 Object Lock (WORM) on backup buckets:** Ransomware attackers who compromise AWS credentials can delete S3 objects; Object Lock in COMPLIANCE mode prevents deletion for the retention period even by the root account — without it, a compromised credential can delete all backups

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)

---

## Q6: How does AWS RDS automated backup achieve RPO=5min with minimal performance impact?

**Role:** Staff | **Difficulty:** ⚫ Staff | **Priority:** P2 | **Format:** Deep Dive

> **What the interviewer is testing:** Whether you understand RDS automated backup internals — specifically how continuous WAL streaming achieves 5-minute RPO without impacting primary instance performance.

### Problem Constraints
| Dimension | Value |
|-----------|-------|
| RDS instance | db.r6g.8xlarge, 32 vCPU, 256GB RAM, 10TB gp3 storage |
| Write workload | 5,000 writes/sec, 200MB/s WAL generation rate |
| RPO target | 5 minutes |
| Performance budget | < 5% overhead on primary instance |

### RDS Backup Architecture

```mermaid
graph TD
  A[RDS Automated Backup Architecture]

  B[Daily snapshot]
  B --> C[RDS takes snapshot from storage layer - not from DB process]
  C --> D[EBS volume snapshot: copy-on-write - does not pause DB]
  D --> E[Snapshot duration: 5-30 minutes regardless of DB size]
  E --> F[Stored in S3 managed by AWS: customer cannot access directly]

  G[Continuous WAL streaming]
  G --> H[RDS streams PostgreSQL WAL to S3 in near-real-time]
  H --> I[WAL archived every 5 minutes or every 16MB segment - whichever first]
  I --> J[S3 WAL archive: retained for backup_retention_period days default 7]

  K[Combined: snapshot + WAL = PITR]
  K --> L[Restore to any second within retention window]
  L --> M[RDS restores nearest snapshot before target time]
  M --> N[Then replays WAL from snapshot time to target time]
```

### Performance Impact Minimization

```mermaid
graph TD
  A[How RDS minimizes backup overhead]

  B[EBS snapshot - storage layer copy]
  B --> C[Snapshots taken at EBS block storage level]
  C --> D[DB process does not participate in snapshot]
  D --> E[Checkpoint triggered: flushes dirty pages to disk first]
  E --> F[One-time checkpoint: 1-2 second I/O spike then normal]

  G[WAL archiving - asynchronous]
  G --> H[PostgreSQL writes WAL to local disk first - synchronous critical path]
  H --> I[WAL archiver process: separate process reads and ships to S3]
  I --> J[Ships completed WAL segments asynchronously]
  J --> K[No write latency impact: WAL ship is not in the commit path]

  L[Network isolation]
  L --> M[RDS uses dedicated backup network interface]
  M --> N[Backup I/O does not compete with application network traffic]
  N --> O[200MB/s WAL streamed to S3 on backup NIC - not application NIC]
```

### PITR Restore Process on RDS

```mermaid
sequenceDiagram
  participant DBA
  participant RDS_Console as RDS Console / API
  participant S3_Backup as S3 Managed Backup
  participant NewRDS as New RDS Instance

  DBA->>RDS_Console: Restore to point in time: 2024-01-15 14:31:00
  RDS_Console->>S3_Backup: Find nearest snapshot before 14:31:00
  S3_Backup-->>RDS_Console: Snapshot from 02:00 that day (12.5 hours before)

  RDS_Console->>NewRDS: Launch new RDS instance
  RDS_Console->>NewRDS: Restore EBS volume from snapshot (10TB: ~20 minutes)
  RDS_Console->>S3_Backup: Fetch WAL files from 02:00 to 14:31
  S3_Backup-->>NewRDS: WAL segments (12.5 hours × 200MB/s WAL = 9TB WAL)
  NewRDS->>NewRDS: Replay WAL to 14:31:00 (~2-3 hours of replay)
  NewRDS-->>DBA: New RDS endpoint ready - data at 14:31:00 state

  Note over DBA,NewRDS: Total RTO: 20min snapshot restore + 2-3hr WAL replay = ~3 hours
```

### RDS Backup Retention and Cost

```mermaid
graph TD
  A[RDS Backup Cost Model]

  B[Free backup storage]
  B --> C[AWS provides free backup storage equal to DB instance size]
  C --> D[10TB RDS instance: 10TB free S3 storage for backups]

  E[Paid backup storage]
  E --> F[Beyond 10TB: $0.095 per GB-month in us-east-1]
  F --> G[7 days retention: daily snapshots + WAL = ~15-20TB total]
  G --> H[Overage: 5-10TB at $0.095 = $475-$950/month]

  I[Retention period tradeoff]
  I --> J[7 days: covers most human errors - discovered within a week]
  I --> K[35 days max: higher cost but covers month-end reporting errors]
  I --> L[Beyond 35 days: export snapshots to your own S3 at $0.023/GB/month cheaper]
```

| RDS Backup Feature | Default | Configurable |
|--------------------|---------|-------------|
| Backup window | AWS chosen | Yes — set maintenance window |
| Retention period | 7 days | 0–35 days |
| RPO | 5 minutes | Cannot improve (WAL limit) |
| RTO (PITR) | 2–6 hours | No — depends on WAL volume |
| Cross-region backup | Disabled | Yes — extra cost |
| Encryption | Enabled with RDS KMS key | Yes — bring your own KMS key |

### What a great answer includes
- [ ] EBS snapshot vs `pg_basebackup`: RDS uses EBS storage-layer snapshots (milliseconds to initiate, copy-on-write) — not `pg_basebackup` (which reads all data pages and takes minutes to hours); this is why RDS snapshots don't block the DB
- [ ] WAL stream lag: RDS archives WAL every 5 minutes *minimum* — if the DB is very low-write, a WAL segment may not fill for 30 minutes; the 5-minute RPO assumes sufficient write volume to trigger the 5-minute archive; verify with `archive_timeout`-equivalent in RDS parameter group
- [ ] Multi-AZ interaction: RDS Multi-AZ keeps a synchronous standby; backups are taken from the standby in MySQL/MariaDB (zero overhead to primary); PostgreSQL Multi-AZ backups may still use the primary in some configurations — check AWS documentation for your engine version
- [ ] Export to S3 for longer retention: `aws rds export-snapshot-to-s3` exports a snapshot to Parquet files in your own S3 bucket — can query with Athena, and storage is $0.023/GB vs $0.095/GB for RDS managed storage

### Pitfalls
- ❌ **Setting backup_retention_period=0 to save cost:** Setting retention to 0 disables automated backups entirely — including PITR; if a developer deletes production data, you have zero recovery options; minimum production setting is 7 days
- ❌ **Relying only on RDS automated backups for compliance:** AWS manages automated backup storage and you cannot verify the restore procedure end-to-end through the console; for compliance (SOC 2, HIPAA), document and demonstrate a successful restore annually; use `aws rds restore-db-instance-to-point-in-time` in a test environment

### Concept Reference
→ [SQL vs NoSQL](../../../system-design/storage-and-databases/sql-vs-nosql)
