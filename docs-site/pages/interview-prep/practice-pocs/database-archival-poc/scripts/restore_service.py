#!/usr/bin/env python3
"""
Restore Service - Restores archived data back to hot storage

Usage:
    python restore_service.py --record-id 12345
    python restore_service.py --user-id 100
    python restore_service.py --stats

Example:
    python restore_service.py --record-id 12345 --keep-archive
"""

import asyncio
import asyncpg
import argparse
from datetime import datetime
from typing import Dict, List, Optional
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

HOT_DB_URL = "postgresql://postgres:postgres@localhost:5432/archival_poc"
ARCHIVE_DB_URL = "postgresql://postgres:postgres@localhost:5433/archival_archive"


class RestoreService:
    """
    Restores archived records back to hot storage.

    Use Cases:
        - User requests historical data
        - GDPR data export
        - Compliance/audit requirements
        - Account reactivation
    """

    def __init__(self, hot_db_url: str, archive_db_url: str):
        self.hot_db_url = hot_db_url
        self.archive_db_url = archive_db_url
        self.hot_pool = None
        self.archive_pool = None

    async def connect(self):
        """Initialize database connections."""
        self.hot_pool = await asyncpg.create_pool(self.hot_db_url, min_size=2, max_size=5)
        self.archive_pool = await asyncpg.create_pool(self.archive_db_url, min_size=2, max_size=5)
        logger.info("Connected to hot and archive databases")

    async def close(self):
        """Close database connections."""
        if self.hot_pool:
            await self.hot_pool.close()
        if self.archive_pool:
            await self.archive_pool.close()

    async def restore_record(
        self,
        table_name: str,
        record_id: int,
        keep_in_archive: bool = True
    ) -> Dict:
        """
        Restore a single record from archive to hot storage.

        Args:
            table_name: Base table name (e.g., 'orders')
            record_id: ID of record to restore
            keep_in_archive: If True, keep copy in archive (default)

        Returns:
            Restored record
        """
        archive_table = f"{table_name}_archive"

        # Fetch from archive
        async with self.archive_pool.acquire() as conn:
            record = await conn.fetchrow(f"""
                SELECT * FROM {archive_table} WHERE id = $1
            """, record_id)

        if not record:
            raise ValueError(f"Record {record_id} not found in archive")

        record = dict(record)
        record.pop('archived_at', None)  # Remove archive-specific column

        logger.info(f"Found record {record_id} in archive, restoring to hot storage")

        # Insert into hot storage
        async with self.hot_pool.acquire() as conn:
            async with conn.transaction():
                columns = list(record.keys())
                column_list = ', '.join(columns)
                placeholders = ', '.join(f'${i+1}' for i in range(len(columns)))
                values = [record[col] for col in columns]

                # Upsert into hot table
                await conn.execute(f"""
                    INSERT INTO {table_name} ({column_list})
                    VALUES ({placeholders})
                    ON CONFLICT (id) DO UPDATE SET
                        updated_at = NOW()
                """, *values)

                # Update tracking
                await conn.execute("""
                    UPDATE archive_tracking
                    SET storage_tier = $1
                    WHERE table_name = $2 AND record_id = $3
                """, 'hot' if not keep_in_archive else 'both', table_name, record_id)

        # Optionally remove from archive
        if not keep_in_archive:
            async with self.archive_pool.acquire() as conn:
                await conn.execute(f"""
                    DELETE FROM {archive_table} WHERE id = $1
                """, record_id)
            logger.info(f"Removed record {record_id} from archive")

        logger.info(f"Successfully restored record {record_id}")
        return record

    async def restore_user_data(
        self,
        user_id: int,
        table_names: List[str] = None,
        keep_in_archive: bool = True
    ) -> Dict[str, int]:
        """
        Restore all archived data for a user.

        Args:
            user_id: User ID to restore data for
            table_names: Tables to restore from (default: ['orders'])
            keep_in_archive: Keep copies in archive

        Returns:
            Dict of table -> records restored count
        """
        if table_names is None:
            table_names = ['orders']

        restored_counts = {}

        for table in table_names:
            archive_table = f"{table}_archive"

            # Find all archived records for user
            async with self.archive_pool.acquire() as conn:
                records = await conn.fetch(f"""
                    SELECT id FROM {archive_table}
                    WHERE user_id = $1
                """, user_id)

            count = 0
            for record in records:
                try:
                    await self.restore_record(table, record['id'], keep_in_archive)
                    count += 1
                except Exception as e:
                    logger.error(f"Failed to restore {record['id']}: {e}")

            restored_counts[table] = count
            logger.info(f"Restored {count} records from {table} for user {user_id}")

        return restored_counts

    async def get_archive_stats(self) -> Dict:
        """Get statistics about archived data."""
        stats = {}

        async with self.hot_pool.acquire() as conn:
            # Tracking by tier
            tier_counts = await conn.fetch("""
                SELECT storage_tier, COUNT(*) as count
                FROM archive_tracking
                GROUP BY storage_tier
            """)
            stats['by_tier'] = {r['storage_tier']: r['count'] for r in tier_counts}

            # Recent archival jobs
            recent_jobs = await conn.fetch("""
                SELECT id, table_name, records_archived, status,
                       started_at, completed_at,
                       EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
                FROM archive_jobs
                ORDER BY started_at DESC
                LIMIT 10
            """)
            stats['recent_jobs'] = [dict(j) for j in recent_jobs]

            # Hot storage counts
            hot_count = await conn.fetchval("SELECT COUNT(*) FROM orders")
            stats['hot_records'] = hot_count

        async with self.archive_pool.acquire() as conn:
            # Archive storage counts
            archive_count = await conn.fetchval("SELECT COUNT(*) FROM orders_archive")
            archive_size = await conn.fetchval(
                "SELECT pg_size_pretty(pg_total_relation_size('orders_archive'))"
            )
            stats['archive_records'] = archive_count
            stats['archive_size'] = archive_size

        return stats

    async def find_archived_records(
        self,
        table_name: str,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Find archived records matching criteria."""
        archive_table = f"{table_name}_archive"

        query = f"SELECT * FROM {archive_table} WHERE 1=1"
        params = []
        param_idx = 1

        if user_id:
            query += f" AND user_id = ${param_idx}"
            params.append(user_id)
            param_idx += 1

        if start_date:
            query += f" AND created_at >= ${param_idx}"
            params.append(start_date)
            param_idx += 1

        if end_date:
            query += f" AND created_at <= ${param_idx}"
            params.append(end_date)
            param_idx += 1

        query += f" ORDER BY created_at DESC LIMIT ${param_idx}"
        params.append(limit)

        async with self.archive_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]


def print_stats(stats: Dict):
    """Pretty print statistics."""
    print("\n" + "="*60)
    print(" ARCHIVAL SYSTEM STATISTICS")
    print("="*60)

    print(f"\n Hot Storage Records: {stats.get('hot_records', 0):,}")
    print(f" Archive Records: {stats.get('archive_records', 0):,}")
    print(f" Archive Size: {stats.get('archive_size', 'N/A')}")

    print(f"\n Records by Tier:")
    for tier, count in stats.get('by_tier', {}).items():
        print(f"   - {tier}: {count:,}")

    print(f"\n Recent Archival Jobs:")
    for job in stats.get('recent_jobs', [])[:5]:
        duration = job.get('duration_seconds', 0) or 0
        print(f"   - Job #{job['id']}: {job['records_archived']:,} records, "
              f"{job['status']}, {duration:.1f}s")


async def main():
    parser = argparse.ArgumentParser(description='Restore archived data to hot storage')
    parser.add_argument('--record-id', type=int, help='Restore specific record by ID')
    parser.add_argument('--user-id', type=int, help='Restore all records for user')
    parser.add_argument('--keep-archive', action='store_true', default=True,
                        help='Keep copy in archive (default: True)')
    parser.add_argument('--remove-archive', action='store_true',
                        help='Remove from archive after restore')
    parser.add_argument('--stats', action='store_true', help='Show archive statistics')
    parser.add_argument('--find', action='store_true',
                        help='Find archived records (use with --user-id)')
    args = parser.parse_args()

    service = RestoreService(HOT_DB_URL, ARCHIVE_DB_URL)

    try:
        await service.connect()

        if args.stats:
            stats = await service.get_archive_stats()
            print_stats(stats)
            return

        if args.find:
            if not args.user_id:
                print("--find requires --user-id")
                return

            records = await service.find_archived_records('orders', user_id=args.user_id)
            print(f"\nFound {len(records)} archived records for user {args.user_id}:")
            for r in records[:10]:
                print(f"  - Order #{r['id']}: ${r['total_amount']} ({r['created_at']})")
            return

        keep_in_archive = not args.remove_archive

        if args.record_id:
            print(f"\nRestoring record {args.record_id}...")
            record = await service.restore_record(
                'orders',
                args.record_id,
                keep_in_archive=keep_in_archive
            )
            print(f"Restored: Order #{record['id']}, ${record['total_amount']}, "
                  f"Status: {record['status']}")
            print(f"Archive copy: {'kept' if keep_in_archive else 'removed'}")

        elif args.user_id:
            print(f"\nRestoring all records for user {args.user_id}...")
            counts = await service.restore_user_data(
                args.user_id,
                keep_in_archive=keep_in_archive
            )
            for table, count in counts.items():
                print(f"  - {table}: {count} records restored")
            print(f"Archive copies: {'kept' if keep_in_archive else 'removed'}")

        else:
            # Show stats by default
            stats = await service.get_archive_stats()
            print_stats(stats)
            print("\nUsage:")
            print("  python restore_service.py --record-id 12345")
            print("  python restore_service.py --user-id 100")
            print("  python restore_service.py --find --user-id 100")

    finally:
        await service.close()


if __name__ == '__main__':
    asyncio.run(main())
