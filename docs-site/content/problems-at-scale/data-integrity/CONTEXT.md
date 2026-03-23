# problems-at-scale/data-integrity/ — Layer 2 Router

Routes across data integrity failure scenarios.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| duplicate-event-processing | problem | Same event processed more than once causing duplicate side-effects |
| orphaned-records | problem | Child records left without parents after failed cascade deletes |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Events are being processed multiple times | duplicate-event-processing | duplicate-event-processing |
| Database has records with no parent | orphaned-records | orphaned-records |
| Solutions: idempotent consumers | practice-pocs/ | idempotency-keys, redis-deduplication |
| Solutions: outbox pattern | practice-pocs/ | outbox-pattern |
| Solutions: DB foreign key constraints | practice-pocs/ | database-foreign-keys, database-check-constraints |
