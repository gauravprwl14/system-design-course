# 04-messaging/ — Layer 1 Module

Message queues, event streaming, and asynchronous system design — covering Kafka, RabbitMQ, event sourcing, and the outbox pattern.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Theory articles on queue fundamentals, Kafka internals, event sourcing, ordering guarantees, and stream processing |
| hands-on/ | poc | Runnable Kafka POCs and event sourcing implementations |
| failures/ | problem | Messaging failure modes: out-of-order messages and duplicate event processing |

## Article Count
- concepts/: 9 articles
- hands-on/: 9 articles
- failures/: 2 articles
- Total: 20 articles (plus index)

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Understand what message queues do | concepts/ | message-queue-basics.md |
| Choose between Kafka and RabbitMQ | concepts/ | kafka-vs-rabbitmq.md |
| Understand Kafka partitioning | concepts/ | kafka-partitioning-design.md |
| Understand exactly-once semantics | concepts/ | kafka-exactly-once-semantics.md |
| Implement event sourcing | concepts/ | event-sourcing-design.md |
| Implement the outbox pattern | concepts/ | outbox-pattern.md |
| Design a dead letter queue | concepts/ | dead-letter-queue-design.md |
| Understand message ordering | concepts/ | message-ordering-guarantees.md |
| Process streams in real time | concepts/ | stream-processing-patterns.md |
| Run a Kafka producer/consumer in code | hands-on/ | kafka-basics-producer-consumer.md |
| Scale Kafka consumers | hands-on/ | kafka-consumer-groups-load-balancing.md |
| Tune Kafka for performance | hands-on/ | kafka-performance-tuning-monitoring.md |
| Implement event sourcing in code | hands-on/ | event-sourcing-basics.md, event-store-implementation.md |
| Handle backpressure with queues | hands-on/ | backpressure-queues.md |
| Implement outbox pattern in code | hands-on/ | outbox-pattern.md |
| Understand duplicate event issues | failures/ | duplicate-event-processing.md |
| Understand out-of-order message issues | failures/ | message-out-of-order.md |

## Prerequisites
- 01-databases/ — outbox pattern requires understanding of database transactions
- 05-distributed-systems/ — consistency concepts help with exactly-once semantics

## Connects To
- 03-redis/ — Redis Streams as a lightweight alternative to Kafka
- 05-distributed-systems/ — distributed consensus in messaging systems
- 06-scalability/ — async processing as a scalability technique
