---
title: "Design Facebook Messenger — Real-Time Chat at Scale"
layer: case-study
section: "16-system-design-problems/03-communication"
difficulty: advanced
tags: [websocket, message-storage, delivery-receipt, presence, fanout, messenger, chat]
category: scalability
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "System Design Interview – Alex Xu"
    url: "https://www.amazon.com/System-Design-Interview-insiders-Second/dp/B08CMF2CQF"
    type: article
  - title: "Facebook Engineering — Building Mobile-First Infrastructure"
    url: "https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/"
    type: article
  - title: "How WhatsApp Scaled to 1B Users with 50 Engineers"
    url: "https://highscalability.com/how-whatsapp-grew-to-nearly-500-million-users-11-engineers-a/"
    type: article
---

# Design Facebook Messenger — Real-Time Chat at Scale

**Difficulty**: 🔴 Advanced
**Reading Time**: Coming Soon
**Interview Frequency**: Very High

---

> 🚧 **Full article coming soon.** This stub gives you the essentials to start thinking about this problem.

---

## The Core Problem

Delivering messages between 2 billion users with delivery guarantees (sent → delivered → read receipts) and real-time presence (online/offline/typing indicators) requires maintaining persistent connections at massive scale. A single connection server can handle 100,000 WebSocket connections — serving 2B users requires 20,000 such servers.

## Functional Requirements

- 1-on-1 and group messaging (up to 500 members)
- Delivery receipts: sent, delivered, read
- Online presence and typing indicators
- Message history accessible on new devices (multi-device sync)
- Support for media (images, videos, files)

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Availability | 99.99% (52 min/year) |
| Message delivery latency | p99 < 500ms |
| Message ordering | Consistent within conversation |
| Scale | 2B users, 100B messages/day |

## Back-of-Envelope Estimates

- **Messages per second**: 100B messages/day ÷ 86,400 = ~1.16M messages/sec
- **Connection servers**: 1B active users × 1 WebSocket = 1B connections ÷ 100K per server = 10,000 servers
- **Message storage**: 1.16M msg/sec × 200 bytes = 232MB/sec → ~20TB/day (Cassandra can handle this)

## Key Design Decisions

1. **Connection Layer Separation** — decouple connection management (stateful, WebSocket) from message processing (stateless); connection servers only route messages; message servers handle business logic; enables independent scaling.
2. **Message Storage in Cassandra** — use conversation_id as partition key, message_id (time-based UUID) as clustering key; gives efficient range scans for "last 100 messages in conversation"; Cassandra handles ~1M writes/sec per cluster.
3. **Delivery Receipts via Ack Pipeline** — message flows: sender → server (sent ✓) → recipient connection (delivered ✓✓) → recipient opens app (read ✓✓✓); each state change is a mini-event pushed back to sender.

## High-Level Architecture

```mermaid
graph TD
    SenderApp[Sender App] -->|WebSocket| ConnSvrA[Connection Server A]
    ConnSvrA --> MsgRouter[Message Router\nLookup recipient server]
    MsgRouter --> ConnSvrB[Connection Server B]
    ConnSvrB -->|WebSocket| RecipientApp[Recipient App]
    MsgRouter --> MsgStore[Message Store\nCassandra]
    MsgRouter --> PresenceSvc[Presence Service\nRedis TTL]
    ConnSvrB -->|Offline| PushSvc[Push Notification\nAPNS/FCM]
```

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| How do you route a message to the recipient's specific connection server? | Service discovery, consistent hashing |
| What happens when the recipient is offline when the message arrives? | Offline storage, push notifications |
| How do you maintain message ordering in group chats with concurrent senders? | Vector clocks, server-assigned sequence IDs |

## Related Concepts

- [WhatsApp Messenger architecture comparison](./whatsapp-messenger)
- [Live comment system for similar fan-out patterns](../01-data-processing/live-comment-system)

---

*📚 Full deep-dive with multiple approaches, trade-off tables, and pseudocode coming soon.*
