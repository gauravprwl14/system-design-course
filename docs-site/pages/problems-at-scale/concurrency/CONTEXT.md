# problems-at-scale/concurrency/ — Layer 2 Router

Routes across concurrency and race condition failure scenarios.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| counter-race | problem | Multiple processes incrementing the same counter — lost updates |
| double-booking | problem | Two users booking the same resource simultaneously |
| double-charge-payment | problem | Payment processed twice due to retry without idempotency |
| duplicate-orders | problem | Duplicate order creation from network retries |
| race-condition-inventory | problem | Overselling inventory when concurrent requests read the same stock |
| stock-order-matching-race | problem | Order matching engine race conditions in trading systems |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Users are getting double-charged | double-charge-payment | double-charge-payment |
| Two users booked the same seat | double-booking | double-booking |
| We're overselling inventory | race-condition-inventory | race-condition-inventory |
| Counter values are incorrect | counter-race | counter-race |
| Duplicate orders are appearing | duplicate-orders | duplicate-orders |
| Solutions: atomic operations | practice-pocs/ | redis-atomic-inventory, redis-distributed-lock |
| Solutions: idempotency | practice-pocs/ | idempotency-keys |
| Solutions: distributed locks | practice-pocs/ | redis-distributed-lock, redis-watch-optimistic-locking |
