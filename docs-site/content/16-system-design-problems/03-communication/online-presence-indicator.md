---
title: "Design an Online Presence Indicator System"
layer: case-study
section: "16-system-design-problems/03-communication"
difficulty: beginner
tags: [presence, heartbeat, redis-ttl, whatsapp, last-seen, privacy, websocket, pub-sub]
category: communication
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "WhatsApp — Last Seen Architecture"
    url: "https://highscalability.com"
    type: article
  - title: "Signal — Presence Protocol Design"
    url: "https://signal.org/blog/"
    type: article
  - title: "ByteByteGo — Design a Messaging App"
    url: "https://www.youtube.com/@ByteByteGo"
    type: article
---

# Design an Online Presence Indicator System

**Difficulty**: 🟢 Easy | **Codemania #79**
**Reading Time**: ~8 min
**Interview Frequency**: High

---

## The Core Problem

Showing "online/offline/last seen at 3:42 PM" status for 1 billion users in a messaging app, with less than 10 seconds of staleness — all without the presence system becoming a bottleneck for messaging. The challenges: 1B heartbeats every 5 seconds = 200M events/sec, respecting privacy settings, and efficient fan-out to all of a user's contacts.

---

## Functional Requirements

- Show whether a contact is currently online (active in last 30 seconds)
- Show "last seen" timestamp when the user was last active
- Privacy settings: hide presence from specific users, or show to "nobody"
- Push presence updates to contacts within 10 seconds of status change
- Support for mobile apps (background → foreground state changes)

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Users | 1B registered users; 200M daily active |
| Online users at peak | 100M concurrent online users |
| Heartbeat frequency | Every 5 seconds from active clients |
| Staleness | User shown as online until 30 seconds after last heartbeat |
| Update latency | Contacts notified within 10 seconds of status change |
| Privacy filtering | O(1) per-user privacy check before publishing |

---

## Back-of-Envelope Estimates

- **Heartbeat rate**: 100M online users × 1 heartbeat/5s = 20M heartbeats/sec
- **Redis writes**: 20M `SET key EX 30` operations/sec — Redis can handle ~1M writes/sec per instance; need ~20 Redis shards
- **Fan-out**: Each user has avg 200 contacts; 100M users × 200 contacts = 20B potential presence pushes/sec (too much — use pull-on-open instead)
- **Presence change events**: Online→Offline transitions = ~1M/hour (much fewer than heartbeats — only delta changes need to be broadcast)

---

## High-Level Architecture

```mermaid
graph TD
    Client[Mobile App\nActive in foreground] -->|Heartbeat every 5s| PresenceAPI[Presence API Gateway]
    PresenceAPI --> Redis[Redis Cluster\nuser:{uid}:presence → timestamp, TTL 30s]
    PresenceAPI --> Kafka[Kafka\nPresence change events]
    Kafka --> FanOut[Fan-Out Service\nBroadcast to contacts via WebSocket]
    FanOut --> ContactList[Contact Resolver\nGet friends list with privacy filter]
    ContactList --> WSServers[WebSocket Servers\nPush status to online contacts]
    WSServers --> ContactApp[Contact's App\nShow "Online" indicator]

    PresenceReader[Presence Query API] --> Redis
    PresenceReader --> PrivacyFilter[Privacy Filter\nHide presence per user settings]
```

---

## Key Design Decisions

### 1. Heartbeat Approach with Redis TTL

The simplest and most scalable approach:

```python
# Client sends heartbeat every 5 seconds
# Server:
def handle_heartbeat(user_id):
    redis.setex(
        key=f"presence:{user_id}",
        value=int(time.time()),  # last seen timestamp
        time=30  # TTL: 30 seconds
    )
```

- When key exists: user is **online** (active in last 30 seconds)
- When key expires (no heartbeat for 30s): user is **offline**
- Value = Unix timestamp of last heartbeat = "last seen" time

Redis TTL handles offline detection automatically — no background job needed.

### 2. Heartbeat Interval vs Staleness Trade-off

| Heartbeat Interval | Staleness | Server Load |
|--------------------|-----------|-------------|
| 1 second | 1 second | 100M requests/sec — too high |
| 5 seconds | 5 seconds | 20M requests/sec — manageable |
| 30 seconds | 30 seconds | 3.3M requests/sec — low |
| 60 seconds | 60 seconds | 1.7M requests/sec — very low |

WhatsApp uses ~30 seconds staleness tolerance; Signal uses ~10 seconds. Decision depends on UX requirements. **Decision**: 5-second heartbeat with 30-second TTL. Provides acceptable staleness for messaging apps while keeping load manageable with Redis sharding.

### 3. Push vs Pull for Presence Updates

**Pull (on contact list open)**:
- App opens chat → request presence for all 200 contacts → Redis multi-GET → display statuses
- Load spikes when users open chat (thundering herd)
- Contacts' statuses may become stale during extended chat session

**Push (server broadcasts changes)**:
- When user comes online/offline → send Kafka event → fan-out to all contacts via WebSocket
- Problem: 100M users × 200 contacts × online/offline transitions = massive fan-out
- But: online/offline transitions are rare (not every heartbeat creates a transition)

**Hybrid (Decision)**:
- **On open**: Pull presence for all contacts (fresh snapshot)
- **While open**: Subscribe to push updates for active contacts via WebSocket
- Only broadcast **transitions** (online → offline and vice versa), not every heartbeat

### 4. Detecting Online → Offline Transition

When heartbeats stop, the Redis TTL expires silently. How does the fan-out service know to broadcast "offline" to contacts?

**Option A: TTL expiry event** — Redis keyspace notifications (`notify-keyspace-events = Ex`). When key expires, Redis publishes an event to a channel. Fan-out service subscribes and broadcasts "offline" to contacts.

**Option B: WebSocket disconnect** — If user disconnects WebSocket, treat as offline immediately. Heartbeats maintain the "online" state while connected.

**Decision**: Option B (WebSocket disconnect) is faster and more reliable. WebSocket disconnect is deterministic; Redis TTL expiry notification may have a few seconds of delay.

### 5. Privacy Settings

```python
def get_presence(requester_id, target_user_id):
    # Check privacy settings
    privacy = get_privacy_setting(target_user_id)  # cached
    if privacy == "nobody":
        return {"status": "hidden"}
    if privacy == "contacts_only":
        if not are_contacts(requester_id, target_user_id):
            return {"status": "hidden"}
    if privacy == "blocked_users":
        if is_blocked(target_user_id, requester_id):  # target blocked requester
            return {"status": "hidden"}

    # Return actual presence
    ts = redis.get(f"presence:{target_user_id}")
    if ts:
        return {"status": "online"}
    return {"status": "offline", "last_seen": get_last_seen(target_user_id)}
```

Privacy filtering happens at query time, not fan-out time. This avoids complex fan-out filtering logic.

---

## Handling Mobile Background State

Mobile apps can't send heartbeats when in the background. Options:
1. **Silent push notifications**: Server sends silent push every 5 minutes; app wakes to send heartbeat. Battery-draining.
2. **Background fetch**: OS periodically wakes app (iOS Background Fetch, Android WorkManager). Less reliable.
3. **Accept offline status**: Show as "offline" while in background. Most messaging apps do this (WhatsApp goes offline when app is backgrounded on iOS).

**Decision**: Accept offline when backgrounded. Show "last seen" instead. This is the correct UX for messaging apps.

---

## Top Interview Questions for This Problem

| Question | Tests |
|----------|-------|
| How do you handle 100M heartbeats/sec to Redis without it becoming a bottleneck? | Redis sharding by user_id, pipeline heartbeats, cluster mode |
| How do you detect offline when the user just closes their app? | WebSocket close event, TCP FIN, heartbeat timeout |
| Why not use a database for presence? | Too slow for 20M writes/sec; Redis TTL is the right tool |
| How do you respect privacy — show online to some contacts but not others? | Privacy filter at query time (not fan-out), O(1) check per request |

---

## Common Mistakes

1. **Broadcasting every heartbeat to all contacts**: 20M heartbeats/sec × 200 contacts = 4B events/sec. Only broadcast transitions (online/offline changes), not heartbeats.
2. **Using long-polling for presence updates**: Polling every 30s from 100M concurrent users = 3.3M requests/sec just for presence. WebSocket push is far more efficient.
3. **No TTL on presence keys**: Without TTL, offline users remain "online" forever if their app crashes without proper logout.

---

## Related Concepts

- [Caching Fundamentals](../../02-caching/concepts/caching-fundamentals) — Redis TTL pattern for ephemeral state
- [Message Queue Basics](../../04-messaging/concepts/message-queue-basics) — Kafka for presence change event fan-out

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [ByteByteGo — Design WhatsApp](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Messaging architecture, presence, WebSocket at scale |
| [Hussein Nasser — WebSocket vs Polling](https://www.youtube.com/@hnasr) | 📺 YouTube | Long-polling, WebSocket, SSE — when to use each |
| [Signal Blog — Protocol Design](https://signal.org/blog/) | 📖 Blog | Privacy-preserving presence, minimal metadata collection |
| [High Scalability — WhatsApp Architecture](https://highscalability.com) | 📖 Blog | How WhatsApp handles 1B users efficiently |
