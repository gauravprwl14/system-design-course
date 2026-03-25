# 04-messaging/concepts/ — Layer 2 Router

Theory articles on message queues, Kafka internals, event sourcing, ordering guarantees, and stream processing patterns.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to async messaging and when to use it |
| message-queue-basics | Queue fundamentals: producers, consumers, delivery guarantees, at-least-once vs exactly-once |
| kafka-vs-rabbitmq | Decision guide: Kafka (log-based, high throughput) vs RabbitMQ (traditional queue, routing) |
| kafka-partitioning-design | How Kafka partitions work, partition key selection, and consumer group assignment |
| kafka-exactly-once-semantics | Idempotent producers, transactional APIs, and the guarantees they provide |
| event-sourcing-design | Event sourcing architecture: storing state as a sequence of events |
| outbox-pattern | Transactional outbox pattern for reliable event publishing alongside database writes |
| dead-letter-queue-design | DLQ design: routing poison messages, retry strategies, and alerting |
| message-ordering-guarantees | When ordering is guaranteed, when it is not, and how to handle out-of-order messages |
| stream-processing-patterns | Real-time stream processing: windowing, aggregation, joins, stateful processing |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Understand messaging concepts from scratch | message-queue-basics |
| Choose a messaging system | kafka-vs-rabbitmq |
| Design Kafka topics and partitions | kafka-partitioning-design |
| Guarantee no message is processed twice | kafka-exactly-once-semantics |
| Build an event-driven architecture | event-sourcing-design |
| Publish events atomically with DB writes | outbox-pattern |
| Handle messages that always fail | dead-letter-queue-design |
| Understand ordering trade-offs | message-ordering-guarantees |
| Build real-time stream processing | stream-processing-patterns |
