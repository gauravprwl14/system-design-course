---
title: "Mobile Architecture Cheat Sheet"
description: "Quick reference for mobile system design — offline-first sync, 60fps rendering, pagination, and secure storage"
---

> **📅 Spaced Repetition Schedule**
> - **Day 0** (now): Read through once, note 3 things you didn't know
> - **Day 3**: Redo without looking — what offline sync strategies and performance numbers stick out?
> - **Day 10**: Quiz yourself on offline-first design and 60fps rendering targets
> - **Day 30**: Explain delta sync, conflict resolution strategies, and secure storage out loud
>
> *If you can teach it, you've learned it. Each pass takes < 10 minutes.*

# Mobile Architecture Cheat Sheet

> Scan this before a mobile system design interview. Key numbers, decisions, and traps only.

---

## 1. Question-Bank: Mobile Architecture Deep Dives

### Offline-First Sync
**Offline-first sync** — designing apps that work without connectivity and sync when online

| Conflict strategy | Data loss | Complexity | Use when |
|------------------|----------|-----------|---------|
| **Last-Write-Wins (LWW)** | Yes (losing device) | Low | Ephemeral data (location updates, analytics) |
| **Three-Way Merge** | No (unless same field) | Medium | Structured data with independent fields (contacts) |
| **User-Prompt** | No | High (UX burden) | High-value content (legal, medical, financial) |

- **Key number**: Offline-first reads from local DB → response time **<10ms** vs network-first **100–5000ms** depending on signal — users perceive **10–50× faster**
- **Decision**: LWW when newer value always wins (current location); Three-Way Merge when different fields may change independently; User-Prompt when silent data loss is unacceptable
- **Trap**: Not tracking a common ancestor for conflict detection — without the ancestor version, you cannot do three-way merge; you can only do LWW; store the server version at sync time as the ancestor
- → [Full article](../12-interview-prep/question-bank/mobile-architecture/offline-first-sync)

---

### Mobile App Architecture
**Mobile app architecture** — 60fps rendering, cursor pagination, and secure credential storage

**60fps rendering budget:**

| Component | Time budget | Bottleneck |
|-----------|------------|-----------|
| Layout (measure + layout pass) | <5ms | Nested views, constraint complexity |
| Draw (canvas operations) | <5ms | Overdraw (pixels drawn multiple times) |
| Main thread code | <6ms | Sync I/O, JSON parsing on UI thread |
| **Total frame budget** | **16.67ms** (60fps) | Any overflow = dropped frame = jank |

- **Key number**: 60fps = **16.67ms per frame**; 120fps (ProMotion displays) = **8.3ms per frame**; overdraw: a pixel drawn 5× costs 5× GPU fill rate
- **Decision**: Cursor pagination (O(log N) with index) over OFFSET pagination (O(offset) — scans and discards N rows) for infinite scroll feeds; OFFSET also causes duplicates on new inserts
- **Trap**: Storing OAuth tokens in SharedPreferences/UserDefaults — plain XML/plist files, extractable via `cat /data/data/com.app/shared_prefs/*.xml` on rooted Android; always use iOS Keychain / Android Keystore for tokens and keys
- → [Full article](../12-interview-prep/question-bank/mobile-architecture/mobile-app-architecture)
