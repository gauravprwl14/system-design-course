# 05-distributed-systems/failures/ — Layer 2 Router

Real-world distributed system concurrency failures: race conditions, double processing, stale reads, and orphaned data.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Overview of distributed system failure patterns and how to reason about them |
| counter-race | Race condition on a shared counter when multiple nodes increment simultaneously |
| double-booking | Two users booking the same resource simultaneously due to check-then-act race |
| double-charge-payment | Payment charged twice due to retry logic without idempotency keys |
| duplicate-orders | Order submitted multiple times from client retries or network failures |
| race-condition-inventory | Inventory over-sold due to concurrent reads before decrement |
| stock-order-matching-race | Race condition in a stock order book when two orders match simultaneously |
| stale-read-after-write | A write succeeds but a subsequent read returns the old value (replica lag) |
| orphaned-records | Child records left without a parent after a partial failure in a multi-step write |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Understand the classic double-booking bug | double-booking |
| Prevent duplicate payments | double-charge-payment |
| Prevent inventory overselling | race-condition-inventory |
| Handle stale data after a write | stale-read-after-write |
| Prevent orphaned records from partial failures | orphaned-records |
| Understand counter concurrency issues | counter-race |
| Understand high-frequency trading race conditions | stock-order-matching-race |
