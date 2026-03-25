# 04-messaging/hands-on/ — Layer 2 Router

Runnable Kafka POCs and event sourcing implementations covering the full lifecycle from basics to performance tuning.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Guide to the hands-on messaging POCs |
| kafka-basics-producer-consumer | Kafka producer and consumer in code: sending and receiving messages |
| kafka-consumer-groups-load-balancing | Consumer groups for parallel processing and load-balanced consumption |
| kafka-exactly-once-semantics | Implementing exactly-once delivery with idempotent producers and transactions |
| kafka-performance-tuning-monitoring | Tuning Kafka throughput: batching, compression, acks, and monitoring |
| kafka-streams-real-time-processing | Stream processing with Kafka Streams: filters, aggregations, joins |
| backpressure-queues | Handling backpressure when consumers are slower than producers |
| event-sourcing-basics | Basic event sourcing: storing and replaying events to rebuild state |
| event-store-implementation | Building an event store with append-only writes and snapshot support |
| outbox-pattern | Implementing the transactional outbox pattern with a relay process |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Start with Kafka from scratch | kafka-basics-producer-consumer |
| Scale consumers across multiple instances | kafka-consumer-groups-load-balancing |
| Guarantee no duplicates or data loss | kafka-exactly-once-semantics |
| Improve Kafka throughput | kafka-performance-tuning-monitoring |
| Build stream processing pipelines | kafka-streams-real-time-processing |
| Prevent consumer overload | backpressure-queues |
| Implement event sourcing | event-sourcing-basics, event-store-implementation |
| Publish events reliably with DB transactions | outbox-pattern |
