#!/usr/bin/env python3
"""
Query Router - Routes queries to appropriate storage tier

Usage:
    python query_router.py --user-id 123 --days 30
    python query_router.py --start-date 2023-01-01 --end-date 2023-06-30
    python query_router.py --demo

Example:
    python query_router.py --demo  # Run demo queries
"""

import asyncio
import asyncpg
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import logging
import json

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

HOT_DB_URL = "postgresql://postgres:postgres@localhost:5432/archival_poc"
ARCHIVE_DB_URL = "postgresql://postgres:postgres@localhost:5433/archival_archive"


class StorageTier(Enum):
    HOT = "hot"
    ARCHIVE = "archive"
    BOTH = "both"


class QueryRouter:
    """
    Smart Query Router - Routes queries based on date range.

    Routing Rules:
        - Date range entirely within 90 days -> HOT only
        - Date range entirely before 90 days -> ARCHIVE only
        - Date range spans both periods -> Query BOTH and merge
    """

    def __init__(self, hot_db_url: str, archive_db_url: str, cutoff_days: int = 90):
        self.hot_db_url = hot_db_url
        self.archive_db_url = archive_db_url
        self.cutoff_days = cutoff_days
        self.hot_pool = None
        self.archive_pool = None

    async def connect(self):
        """Initialize connection pools."""
        self.hot_pool = await asyncpg.create_pool(self.hot_db_url, min_size=2, max_size=5)
        self.archive_pool = await asyncpg.create_pool(self.archive_db_url, min_size=2, max_size=5)
        logger.info("Connected to hot and archive databases")

    async def close(self):
        """Close connections."""
        if self.hot_pool:
            await self.hot_pool.close()
        if self.archive_pool:
            await self.archive_pool.close()

    def determine_tier(
        self,
        start_date: Optional[datetime],
        end_date: Optional[datetime]
    ) -> StorageTier:
        """
        Determine which storage tier(s) to query based on date range.
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(days=self.cutoff_days)

        # Default: query hot only for unbounded queries
        if not start_date and not end_date:
            return StorageTier.HOT

        # Set defaults
        if not end_date:
            end_date = now
        if not start_date:
            start_date = datetime.min

        # Determine tier
        if start_date >= cutoff:
            return StorageTier.HOT
        elif end_date < cutoff:
            return StorageTier.ARCHIVE
        else:
            return StorageTier.BOTH

    async def query_orders(
        self,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> Dict:
        """
        Query orders with automatic tier routing.

        Returns dict with:
            - orders: List of order records
            - count: Total records returned
            - tiers_queried: Which tiers were queried
            - query_plan: Routing decision explanation
        """
        query_start = datetime.utcnow()
        tier = self.determine_tier(start_date, end_date)

        logger.info(f"Query routing decision: {tier.value}")

        results = []
        tiers_queried = []
        tier_latencies = {}

        # Query tiers in parallel if needed
        tasks = []

        if tier in (StorageTier.HOT, StorageTier.BOTH):
            tasks.append(('hot', self._query_hot(user_id, start_date, end_date, status, limit)))
            tiers_queried.append('hot')

        if tier in (StorageTier.ARCHIVE, StorageTier.BOTH):
            tasks.append(('archive', self._query_archive(user_id, start_date, end_date, status, limit)))
            tiers_queried.append('archive')

        # Execute queries
        for tier_name, task in tasks:
            tier_start = datetime.utcnow()
            tier_results = await task
            tier_latencies[tier_name] = (datetime.utcnow() - tier_start).total_seconds() * 1000

            for record in tier_results:
                record['_storage_tier'] = tier_name
            results.extend(tier_results)

        # Sort combined results by date descending
        results.sort(key=lambda x: x['created_at'], reverse=True)

        # Apply limit after merge
        results = results[:limit]

        total_latency = (datetime.utcnow() - query_start).total_seconds() * 1000

        return {
            'orders': results,
            'count': len(results),
            'tiers_queried': tiers_queried,
            'query_plan': {
                'routing_decision': tier.value,
                'start_date': start_date.isoformat() if start_date else None,
                'end_date': end_date.isoformat() if end_date else None,
                'cutoff_date': (datetime.utcnow() - timedelta(days=self.cutoff_days)).isoformat()
            },
            'latency_ms': {
                'total': round(total_latency, 2),
                'by_tier': {k: round(v, 2) for k, v in tier_latencies.items()}
            }
        }

    async def _query_hot(
        self,
        user_id: Optional[int],
        start_date: Optional[datetime],
        end_date: Optional[datetime],
        status: Optional[str],
        limit: int
    ) -> List[Dict]:
        """Query hot storage (primary database)."""
        query = """
            SELECT id, user_id, product_id, quantity, total_amount,
                   status, created_at, updated_at
            FROM orders
            WHERE 1=1
        """
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

        if status:
            query += f" AND status = ${param_idx}"
            params.append(status)
            param_idx += 1

        query += f" ORDER BY created_at DESC LIMIT ${param_idx}"
        params.append(limit)

        async with self.hot_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]

    async def _query_archive(
        self,
        user_id: Optional[int],
        start_date: Optional[datetime],
        end_date: Optional[datetime],
        status: Optional[str],
        limit: int
    ) -> List[Dict]:
        """Query archive storage (warm database)."""
        query = """
            SELECT id, user_id, product_id, quantity, total_amount,
                   status, created_at, updated_at
            FROM orders_archive
            WHERE 1=1
        """
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

        if status:
            query += f" AND status = ${param_idx}"
            params.append(status)
            param_idx += 1

        query += f" ORDER BY created_at DESC LIMIT ${param_idx}"
        params.append(limit)

        async with self.archive_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]


def print_result(title: str, result: Dict):
    """Pretty print query result."""
    print(f"\n{'='*60}")
    print(f" {title}")
    print('='*60)
    print(f"Tiers queried: {result['tiers_queried']}")
    print(f"Routing decision: {result['query_plan']['routing_decision']}")
    print(f"Results: {result['count']} orders")
    print(f"Latency: {result['latency_ms']['total']}ms (by tier: {result['latency_ms']['by_tier']})")

    if result['orders']:
        print(f"\nSample results:")
        for order in result['orders'][:3]:
            print(f"  - Order #{order['id']}: ${order['total_amount']} "
                  f"({order['created_at'].strftime('%Y-%m-%d')}) "
                  f"[{order['_storage_tier']}]")


async def run_demo(router: QueryRouter):
    """Run demo queries to show routing behavior."""
    print("\n" + "="*60)
    print(" QUERY ROUTER DEMO")
    print("="*60)

    # Test 1: Recent data (hot only)
    result = await router.query_orders(
        start_date=datetime.utcnow() - timedelta(days=30),
        limit=5
    )
    print_result("Test 1: Last 30 days (should query HOT only)", result)

    # Test 2: Old data (archive only)
    result = await router.query_orders(
        start_date=datetime.utcnow() - timedelta(days=365),
        end_date=datetime.utcnow() - timedelta(days=180),
        limit=5
    )
    print_result("Test 2: 6-12 months ago (should query ARCHIVE only)", result)

    # Test 3: Spanning both (queries both tiers)
    result = await router.query_orders(
        start_date=datetime.utcnow() - timedelta(days=180),
        limit=10
    )
    print_result("Test 3: Last 6 months (should query BOTH)", result)

    # Test 4: User-specific query
    result = await router.query_orders(
        user_id=100,
        limit=10
    )
    print_result("Test 4: Specific user (user_id=100)", result)

    # Test 5: Status filter with date range
    result = await router.query_orders(
        status='delivered',
        start_date=datetime.utcnow() - timedelta(days=60),
        limit=5
    )
    print_result("Test 5: Delivered orders in last 60 days", result)


async def main():
    parser = argparse.ArgumentParser(description='Query router with automatic tier routing')
    parser.add_argument('--user-id', type=int, help='Filter by user ID')
    parser.add_argument('--days', type=int, help='Query last N days')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    parser.add_argument('--status', type=str, help='Filter by status')
    parser.add_argument('--limit', type=int, default=10, help='Max results')
    parser.add_argument('--demo', action='store_true', help='Run demo queries')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()

    router = QueryRouter(HOT_DB_URL, ARCHIVE_DB_URL)

    try:
        await router.connect()

        if args.demo:
            await run_demo(router)
            return

        # Parse dates
        start_date = None
        end_date = None

        if args.days:
            start_date = datetime.utcnow() - timedelta(days=args.days)
        if args.start_date:
            start_date = datetime.fromisoformat(args.start_date)
        if args.end_date:
            end_date = datetime.fromisoformat(args.end_date)

        # Run query
        result = await router.query_orders(
            user_id=args.user_id,
            start_date=start_date,
            end_date=end_date,
            status=args.status,
            limit=args.limit
        )

        if args.json:
            # Convert datetime for JSON
            output = {
                **result,
                'orders': [
                    {**o, 'created_at': o['created_at'].isoformat(), 'updated_at': o['updated_at'].isoformat()}
                    for o in result['orders']
                ]
            }
            print(json.dumps(output, indent=2))
        else:
            print_result("Query Results", result)

    finally:
        await router.close()


if __name__ == '__main__':
    asyncio.run(main())
