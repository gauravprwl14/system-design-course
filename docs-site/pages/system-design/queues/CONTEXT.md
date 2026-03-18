# system-design/queues/ — Layer 2 Router

Routes across message queue concepts: fundamentals and technology comparison.

## Files in This Section

| File | Layer | Description |
|------|-------|-------------|
| message-queue-basics | concept | Queue fundamentals: producers, consumers, brokers, guarantees |
| kafka-vs-rabbitmq | concept | Choosing between Kafka (streaming) and RabbitMQ (task queues) |

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| What is a message queue and why use one? | message-queue-basics | message-queue-basics |
| Should I use Kafka or RabbitMQ? | kafka-vs-rabbitmq | kafka-vs-rabbitmq |
| Hands-on Kafka practice | practice-pocs/ | kafka-basics-producer-consumer, kafka-consumer-groups-load-balancing |
| Hands-on Redis queue practice | practice-pocs/ | redis-job-queue, backpressure-queues |
| Retry storms from queues | problems-at-scale/ | problems-at-scale/availability/retry-storm |
| Out-of-order messages | problems-at-scale/ | problems-at-scale/consistency/message-out-of-order |
| Interview question on queues | interview-prep/ | interview-prep/system-design/message-queues-kafka-rabbitmq |
| Async processing patterns | system-design/ | scalability/async-processing |
