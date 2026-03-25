#!/usr/bin/env python3
"""
Archive Worker - Moves old data from hot to archive storage

Usage:
    python archive_worker.py [--days 90] [--batch-size 10000] [--dry-run]

Example:
    python archive_worker.py --days 90 --batch-size 5000
"""

import asyncio
import asyncpg
import argparse
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configurations
HOT_DB_URL = "postgresql://postgres:postgres@localhost:5432/archival_poc"
ARCHIVE_DB_URL = "postgresql://postgres:postgres@localhost:5433/archival_archive"


@dataclass
class ArchivalStats:
    """Statistics from archival job."""
    records_archived: int = 0
    bytes_archived: int = 0
    batches_processed: int = 0
    duration_seconds: float = 0.0
    errors: list = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


class ArchiveWorker:
    """
    Moves old data from hot storage to archive storage.

    Architecture:
        Hot DB (PostgreSQL) -> Archive DB (PostgreSQL/TimescaleDB)

    Features:
        - Batch processing to avoid locks
        - Transaction safety
        - Progress tracking
        - Dry run mode for testing
    """

    def __init__(self, hot_db_url: str, archive_db_url: str):
        self.hot_db_url = hot_db_url
        self.archive_db_url = archive_db_url
        self.hot_pool = None
        self.archive_pool = None

    async def connect(self):
        """Initialize database connections."""
        logger.info("Connecting to databases...")
        self.hot_pool = await asyncpg.create_pool(self.hot_db_url, min_size=2, max_size=5)
        self.archive_pool = await asyncpg.create_pool(self.archive_db_url, min_size=2, max_size=5)
        logger.info("Connected to hot and archive databases")

    async def close(self):
        """Close database connections."""
        if self.hot_pool:
            await self.hot_pool.close()
        if self.archive_pool:
            await self.archive_pool.close()
        logger.info("Database connections closed")

    async def run_archival(
        self,
        table_name: str = "orders",
        retention_days: int = 90,
        batch_size: int = 10000,
        dry_run: bool = False
    ) -> ArchivalStats:
        """
        Run archival job for a table.

        Args:
            table_name: Table to archive from
            retention_days: Archive records older than this
            batch_size: Records per batch
            dry_run: If True, don't actually move data

        Returns:
            ArchivalStats with job metrics
        """
        stats = ArchivalStats()
        start_time = datetime.utcnow()
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        archive_table = f"{table_name}_archive"

        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Starting archival for {table_name}")
        logger.info(f"Cutoff date: {cutoff_date}")
        logger.info(f"Batch size: {batch_size}")

        # Record job start
        job_id = await self._start_job(table_name) if not dry_run else 0

        try:
            while True:
                batch_stats = await self._archive_batch(
                    table_name,
                    archive_table,
                    cutoff_date,
                    batch_size,
                    dry_run
                )

                if batch_stats['count'] == 0:
                    break

                stats.records_archived += batch_stats['count']
                stats.bytes_archived += batch_stats['bytes']
                stats.batches_processed += 1

                logger.info(
                    f"Batch {stats.batches_processed}: "
                    f"archived {batch_stats['count']} records "
                    f"(total: {stats.records_archived})"
                )

                # Small delay to reduce database load
                await asyncio.sleep(0.1)

            # Record job completion
            if not dry_run:
                await self._complete_job(job_id, stats)

        except Exception as e:
            logger.error(f"Archival failed: {e}")
            stats.errors.append(str(e))
            if not dry_run and job_id:
                await self._fail_job(job_id, str(e))
            raise

        stats.duration_seconds = (datetime.utcnow() - start_time).total_seconds()

        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Archival complete!")
        logger.info(f"Records archived: {stats.records_archived}")
        logger.info(f"Batches processed: {stats.batches_processed}")
        logger.info(f"Duration: {stats.duration_seconds:.2f}s")

        return stats

    async def _archive_batch(
        self,
        table_name: str,
        archive_table: str,
        cutoff_date: datetime,
        batch_size: int,
        dry_run: bool
    ) -> dict:
        """Archive a single batch of records."""

        # Get records to archive from hot DB
        async with self.hot_pool.acquire() as hot_conn:
            records = await hot_conn.fetch(f"""
                SELECT * FROM {table_name}
                WHERE created_at < $1
                  AND status NOT IN ('pending', 'processing')
                ORDER BY created_at ASC
                LIMIT $2
                {"" if dry_run else "FOR UPDATE SKIP LOCKED"}
            """, cutoff_date, batch_size)

            if not records:
                return {'count': 0, 'bytes': 0}

            record_ids = [r['id'] for r in records]

            if dry_run:
                return {'count': len(records), 'bytes': len(records) * 100}

            # Insert into archive DB
            async with self.archive_pool.acquire() as archive_conn:
                # Prepare insert
                columns = [key for key in records[0].keys()]
                column_list = ', '.join(columns)

                for record in records:
                    values = [record[col] for col in columns]
                    placeholders = ', '.join(f'${i+1}' for i in range(len(values)))

                    await archive_conn.execute(f"""
                        INSERT INTO {archive_table} ({column_list})
                        VALUES ({placeholders})
                        ON CONFLICT (id) DO NOTHING
                    """, *values)

            # Delete from hot DB and track
            async with hot_conn.transaction():
                # Track archived records
                await hot_conn.executemany("""
                    INSERT INTO archive_tracking (table_name, record_id, storage_tier, archived_at)
                    VALUES ($1, $2, 'archive', NOW())
                    ON CONFLICT (table_name, record_id)
                    DO UPDATE SET storage_tier = 'archive', archived_at = NOW()
                """, [(table_name, rid) for rid in record_ids])

                # Delete from hot
                await hot_conn.execute(f"""
                    DELETE FROM {table_name} WHERE id = ANY($1)
                """, record_ids)

            return {'count': len(records), 'bytes': len(records) * 100}

    async def _start_job(self, table_name: str) -> int:
        """Record job start in hot DB."""
        async with self.hot_pool.acquire() as conn:
            return await conn.fetchval("""
                INSERT INTO archive_jobs (table_name, started_at, status)
                VALUES ($1, NOW(), 'running')
                RETURNING id
            """, table_name)

    async def _complete_job(self, job_id: int, stats: ArchivalStats):
        """Record job completion."""
        async with self.hot_pool.acquire() as conn:
            await conn.execute("""
                UPDATE archive_jobs
                SET records_archived = $2,
                    bytes_archived = $3,
                    completed_at = NOW(),
                    status = 'completed'
                WHERE id = $1
            """, job_id, stats.records_archived, stats.bytes_archived)

    async def _fail_job(self, job_id: int, error: str):
        """Record job failure."""
        async with self.hot_pool.acquire() as conn:
            await conn.execute("""
                UPDATE archive_jobs
                SET completed_at = NOW(),
                    status = 'failed',
                    error_message = $2
                WHERE id = $1
            """, job_id, error)


async def show_stats(worker: ArchiveWorker):
    """Show current storage statistics."""
    async with worker.hot_pool.acquire() as conn:
        # Hot storage stats
        hot_count = await conn.fetchval("SELECT COUNT(*) FROM orders")
        hot_oldest = await conn.fetchval("SELECT MIN(created_at) FROM orders")
        hot_newest = await conn.fetchval("SELECT MAX(created_at) FROM orders")

        print("\n" + "="*60)
        print("HOT STORAGE (Primary DB)")
        print("="*60)
        print(f"Records: {hot_count:,}")
        print(f"Date range: {hot_oldest} to {hot_newest}")

        # Archive tracking
        archive_count = await conn.fetchval(
            "SELECT COUNT(*) FROM archive_tracking WHERE storage_tier = 'archive'"
        )

    async with worker.archive_pool.acquire() as conn:
        # Archive storage stats
        arch_count = await conn.fetchval("SELECT COUNT(*) FROM orders_archive")
        arch_oldest = await conn.fetchval("SELECT MIN(created_at) FROM orders_archive")
        arch_newest = await conn.fetchval("SELECT MAX(created_at) FROM orders_archive")

        print("\n" + "="*60)
        print("ARCHIVE STORAGE (Warm DB)")
        print("="*60)
        print(f"Records: {arch_count:,}")
        print(f"Date range: {arch_oldest} to {arch_newest}")

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total records: {hot_count + arch_count:,}")
    print(f"Hot: {hot_count:,} ({hot_count/(hot_count+arch_count)*100:.1f}%)" if hot_count+arch_count > 0 else "Hot: 0")
    print(f"Archive: {arch_count:,} ({arch_count/(hot_count+arch_count)*100:.1f}%)" if hot_count+arch_count > 0 else "Archive: 0")


async def main():
    parser = argparse.ArgumentParser(description='Archive old data from hot to archive storage')
    parser.add_argument('--days', type=int, default=90, help='Archive records older than N days')
    parser.add_argument('--batch-size', type=int, default=10000, help='Records per batch')
    parser.add_argument('--dry-run', action='store_true', help='Simulate without moving data')
    parser.add_argument('--stats', action='store_true', help='Show storage stats and exit')
    args = parser.parse_args()

    worker = ArchiveWorker(HOT_DB_URL, ARCHIVE_DB_URL)

    try:
        await worker.connect()

        if args.stats:
            await show_stats(worker)
            return

        print("\n" + "="*60)
        print("DATA ARCHIVAL WORKER")
        print("="*60)

        await show_stats(worker)

        print("\n" + "-"*60)
        print(f"{'[DRY RUN] ' if args.dry_run else ''}Running archival...")
        print("-"*60)

        stats = await worker.run_archival(
            table_name="orders",
            retention_days=args.days,
            batch_size=args.batch_size,
            dry_run=args.dry_run
        )

        print("\n" + "-"*60)
        print("After archival:")
        print("-"*60)

        await show_stats(worker)

    finally:
        await worker.close()


if __name__ == '__main__':
    asyncio.run(main())
