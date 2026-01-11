# Queues & Messaging

> Decouple services and handle asynchronous processing at scale

## 📋 Overview

Message queues enable asynchronous communication between services, allowing you to handle traffic spikes, improve reliability, and build scalable distributed systems.

## 📚 Articles

### Fundamentals (🟢 Beginner)
1. [Message Queue Basics](./01-message-queue-basics.md) - What, why, when to use queues
2. [Queue vs Topic vs Stream](./02-queue-topic-stream.md) - Understanding patterns
3. [Producer-Consumer Pattern](./03-producer-consumer.md) - Basic async processing
4. [Task Queues](./04-task-queues.md) - Background job processing
5. [Dead Letter Queues](./05-dead-letter-queue.md) - Handling failed messages

### Intermediate Topics (🟡 Intermediate)
6. [Pub/Sub Pattern](./06-pub-sub.md) - Event-driven architecture
7. [Message Ordering](./07-message-ordering.md) - FIFO guarantees
8. [Exactly-Once Delivery](./08-exactly-once.md) - Idempotency patterns
9. [Retry Strategies](./09-retry-strategies.md) - Exponential backoff
10. [Priority Queues](./10-priority-queues.md) - Process urgent tasks first

### Advanced Topics (🔴 Advanced)
11. [Event Sourcing](./11-event-sourcing.md) - Event-driven architecture
12. [Stream Processing with Kafka](./12-kafka-streams.md) - Real-time data pipelines
13. [Saga Pattern](./13-saga-pattern.md) - Distributed transactions
14. [CQRS Pattern](./14-cqrs.md) - Command Query Responsibility Segregation
15. [Message Batching](./15-message-batching.md) - Throughput optimization

## 🎯 Quick Reference

| Use Case | Solution | Article |
|----------|----------|---------|
| Background jobs | Task Queue | [#04](./04-task-queues.md) |
| Email sending | Producer-Consumer | [#03](./03-producer-consumer.md) |
| Event notifications | Pub/Sub | [#06](./06-pub-sub.md) |
| Order processing | FIFO Queue | [#07](./message-ordering.md) |
| Real-time analytics | Kafka Streams | [#12](./12-kafka-streams.md) |

## 🚀 Impact

**Without Queues** (Synchronous):
- Request timeout if processing takes > 30 seconds
- Lost requests during traffic spikes
- Tight coupling between services

**With Queues** (Asynchronous):
- Fast response (< 100ms)
- Handle 10× traffic with queue buffer
- Services can fail independently

Start with [Message Queue Basics](./01-message-queue-basics.md)!
