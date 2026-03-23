> **Migrated to [/09-observability](/09-observability)**: Connection pool management cross-references (POCs, problems-at-scale, interview prep) have been added to `/09-observability/index.md`. Active concept at `/09-observability/concepts/connection-pool-management.md`. Hands-on POCs: `/01-databases/hands-on/database-connection-pooling`, `connection-pool-sizing`, `postgresql-connection-pooling-replication`, `connection-leak-detection`. Problems at scale: `/problems-at-scale/performance/connection-pool-starvation` and `thread-pool-exhaustion`. This file is retained for historical reference.

# system-design/performance/ — Layer 2 Router

Routes across performance concepts with focus on connection management.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| connection-pool-management | concept | Managing DB and HTTP connection pools to prevent starvation |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| How do I manage database connections at scale? | connection-pool-management | connection-pool-management |
| Hands-on connection pooling practice | practice-pocs/ | database-connection-pooling, connection-pool-sizing, postgresql-connection-pooling-replication |
| Connection leak detection | practice-pocs/ | connection-leak-detection |
| Connection pool starvation failure | problems-at-scale/ | problems-at-scale/performance/connection-pool-starvation |
| Thread pool exhaustion failure | problems-at-scale/ | problems-at-scale/performance/thread-pool-exhaustion |
| Interview question on DB connection pools | interview-prep/ | interview-prep/database-storage/connection-pooling |
