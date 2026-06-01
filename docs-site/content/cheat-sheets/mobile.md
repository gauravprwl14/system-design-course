---
title: "Mobile Architecture Cheat Sheet"
description: "Quick reference for mobile system design — offline-first sync, 60fps rendering, pagination, and secure storage"
---

> **Spaced Repetition Schedule**
> - **Day 0** (now): Read through once, note 3 things you didn't know
> - **Day 3**: Redo without looking — what offline sync strategies and performance numbers stick out?
> - **Day 10**: Quiz yourself on offline-first design and 60fps rendering targets
> - **Day 30**: Explain delta sync, conflict resolution strategies, and secure storage out loud
>
> *If you can teach it, you've learned it. Each pass takes < 10 minutes.*

# Mobile Architecture Cheat Sheet

> Scan this before a mobile system design interview. Key numbers, decisions, and traps only.

---

## 1. iOS vs Android Architecture

| Concern | iOS | Android |
|---------|-----|---------|
| UI Framework | UIKit (imperative) / SwiftUI (declarative) | Views (imperative) / Jetpack Compose (declarative) |
| Local Database | CoreData / SQLite / Realm | Room (SQLite wrapper) / Realm |
| Networking | URLSession / Alamofire | OkHttp / Retrofit |
| Async | Grand Central Dispatch (GCD) / async-await | Coroutines / RxJava |
| Background Tasks | BGTaskScheduler | WorkManager |
| Push Notifications | APNs (Apple Push Notification Service) | FCM (Firebase Cloud Messaging) |
| DI Framework | Swinject / manual | Hilt / Koin / Dagger |
| State Management | Combine / TCA | ViewModel + StateFlow / MVI |
| Package Manager | CocoaPods / Swift Package Manager | Gradle / Maven |
| Testing | XCTest / XCUITest | JUnit / Espresso / Robolectric |
| App Store Review | Apple App Store (1-7 day review) | Google Play (hours to 3 days) |
| Minimum OS target (2024) | iOS 16+ (95%+ device coverage) | Android 8+ (API 26, ~97% coverage) |

Key decisions:
- **SwiftUI vs UIKit**: SwiftUI for new screens in iOS 16+; UIKit for complex custom layouts or legacy codebases
- **Jetpack Compose vs Views**: Compose for new screens; Views when migrating incrementally or using complex custom drawables
- **Coroutines vs RxJava**: Coroutines are idiomatic Kotlin; RxJava only if existing codebase demands it or complex operator chaining is required

Trap: Targeting too-old OS versions locks you out of security APIs (Secure Enclave, StrongBox), background task APIs, and modern UI frameworks.

---

## 2. Offline-First Architecture

**Offline-first sync** — designing apps that work without connectivity and sync when online

### Conflict Resolution Strategies

| Conflict strategy | Data loss | Complexity | Use when |
|------------------|----------|-----------|---------|
| **Last-Write-Wins (LWW)** | Yes (losing device) | Low | Ephemeral data (location updates, analytics) |
| **Server-Wins** | Yes (client changes lost) | Very low | Config/settings pushed from server |
| **Client-Wins** | Yes (server changes lost) | Very low | Offline forms that should never be overwritten |
| **Three-Way Merge** | No (unless same field) | Medium | Structured data with independent fields (contacts) |
| **CRDTs** | No | High (library required) | Collaborative editing, shared documents |
| **User-Prompt** | No | High (UX burden) | High-value content (legal, medical, financial) |

### Sync Patterns

| Pattern | How it works | Best for |
|---------|-------------|---------|
| **Full sync** | Download entire dataset each sync | Small datasets (<1000 rows), infrequent changes |
| **Delta sync** | Only records changed since `last_sync_ts` | Large datasets, frequent small changes |
| **Event sourcing** | Sync event log, replay on client | Audit trails, complex conflict resolution |
| **Operational transforms** | Transform concurrent ops for consistency | Real-time collaborative features |

Delta sync implementation:
```
Client sends:  GET /sync?since=2024-01-15T10:00:00Z
Server returns: { records: [...changed], deletions: [...ids], next_cursor: "..." }
Client applies: upsert changed records, tombstone deletions
Client stores: last_sync_ts = server_time from response
```

- **Key number**: Offline-first reads from local DB → response time **<10ms** vs network-first **100–5000ms** — users perceive **10–50x faster**
- **Key number**: Delta sync transfers **5–20x less data** than full sync for datasets with <10% change rate per day
- **Decision**: LWW when newer value always wins (current location); Three-Way Merge when different fields change independently; User-Prompt when silent data loss is unacceptable
- **Trap**: Not tracking a common ancestor for conflict detection — without the ancestor version, you cannot do three-way merge; you can only do LWW. Store the server version at sync time as the ancestor.
- **Trap**: Using wall-clock timestamps for LWW without NTP — clocks drift, system clocks can be set backwards. Use server-assigned monotonic sequence numbers or vector clocks instead.
- **Trap**: Forgetting soft deletes — if you hard-delete on server, delta sync cannot tell clients to remove records. Use `deleted_at` tombstones, sync them, then hard-delete after all clients have synced.

---

## 3. Push Notification Architecture

### APNs (iOS) Flow

```
App Server → APNs servers → Apple CDN → Device
              (HTTP/2, TLS)             (persistent connection)
```

1. App registers with APNs → receives device token (64-byte hex)
2. App sends token to your server
3. Your server sends notification payload to APNs with device token
4. APNs delivers to device (best-effort, no delivery guarantee)

APNs payload limits: **4KB** max per notification (was 256 bytes before iOS 8)

### FCM (Android/Cross-platform) Flow

```
App Server → FCM servers → Google Play Services → App
              (HTTP v1 API)                        (on device)
```

FCM handles: token management, delivery receipts, topic subscriptions, multi-device targeting

### Delivery Guarantees

| Service | Guarantee | Retry behavior |
|---------|-----------|----------------|
| APNs | Best-effort (no receipt) | Stores 1 notification per app, overwrites on new one; discards if device offline >30 days |
| FCM | Best-effort default; "reliable delivery" with `priority: high` | Stores up to 100 messages per app; collapsed by `collapse_key` |

### Token Management

- **Token refresh**: device tokens change when app reinstalls, OS update, backup/restore — your server must handle 410 Gone (APNs) or `registration.removed` (FCM) by removing stale tokens
- **Token registration**: upsert on each app launch, not just first install
- **Multi-device**: one user → multiple tokens (phone + tablet + reinstall). Use user_id → [token] mapping, not token → user_id.

### Deduplication

Problem: user receives duplicate notifications (server sends twice, FCM retries after timeout).

Solution:
1. Include `notification_id` (UUID) in payload
2. Client checks if `notification_id` already processed (store last 100 in local DB)
3. If duplicate, discard silently

- **Key number**: FCM p50 delivery latency ~250ms, p99 ~2s for `priority: high`; `priority: normal` may be batched for hours under Doze mode
- **Trap**: Not handling token invalidation = growing table of dead tokens, wasted API calls, and wrong delivery metrics
- **Trap**: Sending user PII in push payload — payloads are logged, cached by FCM/APNs. Send a `notification_id` only; fetch content from server on receipt.

---

## 4. Performance Numbers to Know

### Cold Start Targets

| Platform | First frame | Interactive | Measurement |
|----------|------------|-------------|-------------|
| iOS | <400ms (Apple guideline) | <2s (industry target) | Time from process launch to first viewDidAppear |
| Android | <500ms first frame | <3s interactive | Time to Full Display (TTFD) |
| React Native | <1s first frame | <4s interactive | Hermes + inline requires |
| Flutter | <400ms first frame | <2s interactive | AOT compiled release build |

### Frame Budget

| Refresh rate | Frame budget | Typical devices |
|-------------|-------------|----------------|
| 60fps | 16.67ms | Most Android mid-range, older iPhones |
| 90fps | 11.11ms | Pixel 6+, some mid-range Android |
| 120fps | 8.33ms | iPhone 13 Pro+ (ProMotion), flagship Android |

Frame breakdown budget (16.67ms total):
- Layout (measure + layout pass): <5ms
- Draw (canvas operations): <5ms
- Main thread code: <6ms
- Total: 16.67ms — any overflow = dropped frame = jank

### Memory Limits (approximate, varies by device RAM)

| Platform | Foreground limit | Background limit | OOM kill threshold |
|----------|----------------|-----------------|-------------------|
| iOS (2GB device) | ~200MB | ~5MB | Jetsam kills at >200MB |
| iOS (4GB device) | ~400MB | ~10MB | Jetsam kills at >400MB |
| Android | No hard limit (varies by `ActivityManager.getMemoryClass()`) | ~50MB before background kill | Low Memory Killer (LMK) |

- `ActivityManager.getMemoryClass()` returns 128, 192, 256, or 512 MB — your app's expected max heap
- `ActivityManager.getLargeMemoryClass()` — for memory-intensive apps with `largeHeap=true` manifest flag

### Network Performance

| Connection type | RTT | Throughput |
|----------------|-----|-----------|
| 5G (ideal) | <10ms | >100Mbps |
| LTE (good signal) | 20-60ms | 10-50Mbps |
| LTE (weak signal) | 100-400ms | 1-5Mbps |
| 3G | 200-800ms | 0.5-2Mbps |
| WiFi (home) | 5-20ms | 50-500Mbps |

Design for 3G: target <3s for critical content on 3G. If you can't, show skeleton screens.

---

## 5. Battery and Background Optimization

### Android Battery Restrictions

| Restriction | Android version | What it does |
|------------|----------------|-------------|
| Doze mode | Android 6.0 (API 23) | Batches network, sync, GPS when screen off >1h |
| App Standby | Android 6.0 | Defers background work for apps not used recently |
| Background Service Limits | Android 8.0 (API 26) | Can't start background services; use WorkManager |
| Battery Saver | User-triggered | Kills background activity, reduces performance |
| Adaptive Battery | Android 9.0 (API 28) | ML-based prediction; restricts apps not used in >48h |

WorkManager constraint options:
```kotlin
val constraints = Constraints.Builder()
    .setRequiredNetworkType(NetworkType.CONNECTED)
    .setRequiresBatteryNotLow(true)
    .setRequiresCharging(false)
    .setRequiresDeviceIdle(false)
    .build()
```

### iOS Background Execution

| Mode | Time limit | Use case |
|------|-----------|---------|
| Background fetch | 30s (system discretion) | Prefetch content |
| Background processing task | Minutes (BGProcessingTaskRequest) | Heavy computation when charging |
| Silent push | 30s | Server-triggered background refresh |
| Location updates | Unlimited | Navigation apps |
| Audio / VoIP | Unlimited | Music, calling apps |

- **Key rule**: Every 1% battery roughly corresponds to 720 network requests at typical mobile usage patterns
- **Key rule**: GPS polling at 1Hz consumes ~3-5% battery per hour — batch location requests whenever possible
- **Trap**: Registering for background modes without using them triggers App Store rejection; Apple audits background mode usage in code review

### Battery Optimization Rules

1. Batch network requests — 10 small requests costs ~10x more battery than 1 large request (radio state machine)
2. Use exponential backoff for retries — constant retry on failure drains battery fast
3. Prefer push over polling — polling wakes radio every N seconds; push only wakes on event
4. Use compressed formats — JSON is verbose; use Protobuf (5-10x smaller) for high-frequency data
5. Cache aggressively — avoid redundant network requests

---

## 6. Security

### Secure Credential Storage

| What to store | iOS | Android |
|--------------|-----|---------|
| Tokens, passwords | Keychain (SecItemAdd) | Keystore + EncryptedSharedPreferences |
| Sensitive files | Data Protection API (NSFileProtection) | EncryptedFile (Jetpack Security) |
| Biometric-protected secrets | Keychain with `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` | KeyStore with `setUserAuthenticationRequired(true)` |
| Never store | NSUserDefaults / UserDefaults | SharedPreferences (plaintext XML) |

### iOS Secure Enclave

- Hardware-backed key generation for Face ID / Touch ID protected operations
- Keys generated inside Secure Enclave, never leave it (private key is never accessible)
- Supports: EC P-256 keys only (no RSA, no AES)
- Use for: transaction signing, biometric-gated operations
- Availability: iPhone 5s and later, iPad Pro (all), Apple Silicon Macs

### Android Keystore + StrongBox

| Feature | Android Keystore | StrongBox (Titan M chip) |
|---------|-----------------|------------------------|
| Key isolation | Process-isolated, kernel-accessible | Hardware security module (separate chip) |
| Key not extractable | Yes | Yes (stronger guarantee) |
| Availability | Android 6.0+ | Android 9.0+ (Pixel 3+, select flagships) |
| Use case | General secure key storage | High-assurance apps (banking, payments) |

### Certificate Pinning

Purpose: prevent MITM attacks even with compromised CA certificates.

```swift
// iOS — URLSession with custom delegate
func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    guard let serverCert = challenge.protectionSpace.serverTrust,
          let pinnedCert = loadPinnedCertificate() else {
        completionHandler(.cancelAuthenticationChallenge, nil)
        return
    }
    // compare public key hash, not cert (allows cert renewal without app update)
    completionHandler(keysMatch(serverCert, pinnedCert) ? .useCredential : .cancelAuthenticationChallenge,
                      URLCredential(trust: serverCert))
}
```

- **Pin public key hash, not certificate** — certificates expire and rotate; public keys can stay stable across renewals
- **Include backup pin** — at least 2 pins in case primary key is compromised
- **Provide override mechanism** — enterprise apps need a way to bypass pinning for MDM traffic inspection

### Biometric Authentication

| API | iOS | Android |
|-----|-----|---------|
| Library | LocalAuthentication / BiometricKit | BiometricPrompt |
| Modes | Face ID, Touch ID | Fingerprint, Face, Iris |
| Fallback | Device passcode | Device PIN/pattern |
| Class 3 (strong) biometric required for | KeyStore user auth binding | `setUserAuthenticationRequired(true)` |

- **Key number**: Face ID recognition: <1s; False accept rate: 1 in 1,000,000 (Touch ID: 1 in 50,000)
- **Trap**: Biometric auth without a backend token is client-side only — a rooted device can bypass it. Always issue a short-lived server token after biometric success.

### Jailbreak / Root Detection

Common checks (defense-in-depth, not foolproof):
- iOS: `/Applications/Cydia.app` exists, `fork()` succeeds, can write to `/private/`
- Android: `su` binary on PATH, test-keys build tag, SafetyNet/Play Integrity API attestation

Play Integrity API (preferred over deprecated SafetyNet):
```kotlin
val integrityManager = IntegrityManagerFactory.create(applicationContext)
val integrityTokenResponse = integrityManager.requestIntegrityToken(
    IntegrityTokenRequest.builder().setNonce(nonce).setCloudProjectNumber(cloudProjectNumber).build()
)
// Send token to server, server calls Google to verify verdict
```

- **Trap**: Root detection on the client is bypassable — treat it as a signal, not a gate. Make the final trust decision server-side.

---

## 7. Image Loading at Scale

### Cache Hierarchy

```
Request → Memory Cache (LRU, ~50MB) → Disk Cache (100-200MB) → Network
                 |                           |
          hit: <1ms                   hit: 5-20ms         miss: 100ms-5s
```

### Image Loading Libraries

| Library | Platform | Key features |
|---------|---------|-------------|
| Kingfisher | iOS (Swift) | Async/await API, SwiftUI support, animated GIF |
| SDWebImage | iOS (ObjC/Swift) | Mature, high-performance, progressive JPEG |
| Glide | Android | BitmapPool reuse, animated GIF/WebP, lifecycle-aware |
| Coil | Android (Kotlin) | Coroutines-first, Compose support, smaller APK |
| Fresco | Android (Facebook) | Best for very large images, drawee views |

### Memory Math (Critical)

| Image format | 1MP decoded | 4K (3840x2160) decoded | 12MP photo decoded |
|-------------|------------|----------------------|------------------|
| RGBA_8888 | 4MB | 31.6MB | 48MB |
| RGB_565 | 2MB | 15.8MB | 24MB |
| RGBA_F16 (HDR) | 8MB | 63.2MB | 96MB |

Formula: `width × height × bytes_per_pixel`
- RGBA_8888: 4 bytes/px (default Android)
- RGB_565: 2 bytes/px (no alpha, lower quality)

**Key insight**: A list of 10 full-resolution photos can consume >480MB decoded — always downscale to display size before decoding.

### Image Optimization Rules

1. **Serve WebP** — 25-35% smaller than JPEG at same quality, 26% smaller than PNG (lossless WebP)
2. **Use srcset / density qualifiers** — send 1x for ldpi, 2x for xhdpi, 3x for xxxhdpi; don't download 3x on 1x screen
3. **Lazy load** — only decode images within or near the visible viewport
4. **Use thumbnails** — show 64x64 placeholder while full image loads; improves perceived performance
5. **Progressively decode** — progressive JPEG shows low-res first, sharpens as data arrives
6. **BitmapPool (Android)** — reuse decoded bitmap memory instead of allocating new — reduces GC pressure by up to 50% in image-heavy lists

### Key Numbers

- **Disk cache max**: 100-250MB (check available storage before caching)
- **Memory cache max**: 25% of available app heap (rule of thumb)
- **Thumbnail generation**: resize on server to exact display dimensions, not on device
- **Cache hit rate target**: >90% for feed images (profile pictures, thumbnails hit repeatedly)

---

## 8. Mobile-Specific System Design Patterns

### Pagination

| Strategy | Implementation | Best for |
|---------|---------------|---------|
| **Offset pagination** | `GET /feed?offset=100&limit=20` | Simple datasets, no real-time updates |
| **Cursor pagination** | `GET /feed?cursor=<opaque>&limit=20` | Feeds with real-time inserts (avoids duplicates) |
| **Keyset pagination** | `GET /feed?after_id=12345&limit=20` | Time-ordered feeds with known sort key |
| **Page number** | `GET /search?page=3&per_page=20` | Search results (random access by page) |

- **Key rule**: Use cursor pagination for infinite scroll feeds — offset pagination duplicates items when new content is inserted at the top between requests
- **Trap**: Cursor pagination with unstable sort keys (e.g., `updated_at` with ties) → inconsistent pages. Add tiebreaker: `ORDER BY updated_at DESC, id DESC`

### Request Batching and Deduplication

Problem: N items in a list each trigger 1 API call → N concurrent requests.

Solutions:
1. **DataLoader pattern** — collect all IDs within a 10ms window, send 1 batch request: `GET /users?ids=1,2,3,4,5`
2. **In-flight deduplication** — if request for `/user/42` is already in flight, queue the second caller rather than sending another request
3. **Prefetch** — when item i is visible, prefetch items i+2 and i+3 in background

### Progressive Loading

```
1. Render skeleton/placeholder immediately (0ms)
2. Load and show low-quality thumbnail (50-200ms)
3. Fetch critical above-fold data (200-500ms)
4. Load remaining content in background (background)
```

- Skeleton screens feel faster than spinners — users perceive ~20% shorter wait
- Critical rendering path: only block on data needed for first visible screen

### Delta Sync Design

```
Client → Server: GET /sync?user_id=X&since=<last_sync_cursor>
Server response:
{
  "updates": [...records changed since cursor],
  "deletions": [...ids of deleted records],
  "next_cursor": "2024-01-15T10:30:00Z_seq_4521",
  "has_more": false
}
Client: apply upserts, apply tombstones, store next_cursor
```

- **Cursor = timestamp + sequence**: handles ties in the same millisecond
- **Batch size**: 100-500 records per response; paginate if has_more=true
- **Conflict window**: if client was offline for >30 days, do full sync instead of delta

### Network Retry Strategy

```
Retry 1: immediate (transient errors only)
Retry 2: 1s delay
Retry 3: 2s delay
Retry 4: 4s delay
Retry 5: 8s delay (max)
```

- **Exponential backoff with jitter**: `delay = min(cap, base * 2^attempt) + random(0, jitter)`
- **Only retry idempotent requests**: GET, PUT, DELETE — not POST (unless you have idempotency keys)
- **Idempotency keys for POST**: include `X-Idempotency-Key: <UUID>` header; server deduplicates

### App Size Reduction

| Technique | Typical saving | Notes |
|-----------|---------------|-------|
| Android App Bundles | 15-35% | Google Play splits by ABI, density, language |
| On-demand delivery | Varies | Dynamic feature modules downloaded at runtime |
| WebP images | 25-35% vs JPEG | Supported iOS 14+, Android 4.0+ |
| ProGuard/R8 | 20-30% code size | Minification + dead code removal |
| Asset catalogs (iOS) | 10-20% | App Slicing delivers only needed assets |
| Bitcode (iOS legacy) | N/A | Deprecated in Xcode 14 |

- **Target size**: Android <10MB initial download (Play Store guidelines); iOS <200MB cellular download limit (auto-granted up to 200MB since iOS 13)
- **Trap**: Including full-size assets for all densities — 1x assets on a 3x screen look blurry; 3x assets on all devices wastes 9x the memory

---

## 9. Common Interview Questions for Mobile Architects

**Q1: How do you design an offline-first note-taking app?**
- Local SQLite/Core Data as primary store, always read/write locally
- Sync queue: capture all local mutations (insert/update/delete) in a `sync_queue` table with `operation` and `payload`
- Background sync: WorkManager/BGProcessingTask drains queue when online
- Conflict strategy: Last-write-wins with server timestamp for simplicity; show "conflict" UI for user-resolved merges
- Tombstones: soft-delete with `deleted_at`, sync tombstones before purging

**Q2: How do you handle push notification deduplication?**
- Include `notification_id` (UUID generated by server) in every push payload
- On receipt, check local store (SQLite table of last 100 processed IDs)
- If already seen: discard silently
- If new: process and insert into dedup store
- Expire dedup store entries after 7 days to bound size

**Q3: How do you design image loading for a social feed of 100 images?**
- Visible images: load at display resolution, not full resolution
- Pre-fetch: load next 3 off-screen images while user scrolls
- Memory cache (LRU): ~50MB, evict on low memory warning
- Disk cache: 150MB, LRU eviction
- Placeholder: color swatch extracted from JPEG thumbnail (Palette API / dominant color)
- Cancel: cancel in-flight requests for images that scroll out of view

**Q4: How do you reduce app cold start time from 3s to under 1s?**
- Defer: move non-critical init (analytics, crash reporting) to background thread
- Async: load data asynchronously, show skeleton while loading
- Trim dependency injection: avoid synchronous DI graphs at startup; use lazy loading
- Reduce binary size: fewer ObjC runtime classes, remove unused frameworks
- Measure: use systrace (Android) / Instruments (iOS) to find actual bottlenecks
- Target: TTID (Time to Initial Display) < 500ms; TTFD (Time to Full Display) < 2s

**Q5: How do you design a feature flag system for mobile?**
- Client fetches flag config at app launch (or hourly), caches locally
- Config includes: `flag_name`, `enabled`, `rollout_percentage`, `user_segment`, `value` (for A/B)
- User assignment: `hash(user_id + flag_name) % 100 < rollout_percentage` — stable, no server call per flag check
- Fallback: if fetch fails, use last cached config; if no cache, use hardcoded defaults
- Kill switch: `force_update_required` flag forces app store update prompt

**Q6: How do you handle authentication token refresh on mobile?**
- Store access token (short-lived, 15min) and refresh token (long-lived, 30 days) in Keychain/Keystore
- On 401: pause all in-flight requests, refresh access token, replay queued requests
- Token refresh mutex: only one refresh attempt at a time (use semaphore/actor)
- On refresh failure (401 on refresh endpoint): clear tokens, redirect to login
- Biometric lock: require biometric to access refresh token for sensitive apps (banking)

**Q7: Design the architecture for a real-time collaborative drawing app (like Figma mobile)**
- Local operations: applied immediately (optimistic)
- Operation log: append-only list of drawing ops (type, coords, timestamp, op_id)
- Sync: stream ops via WebSocket; server rebroadcasts to all collaborators
- Conflict resolution: Operational Transforms (OT) or CRDTs for concurrent edits to same object
- Reconnect: on reconnect, send `last_server_op_id`; server replays missing ops

**Q8: How do you design location tracking with minimal battery drain?**
- Significant location changes (iOS CLLocationManager) / passive provider (Android) — uses cell tower/WiFi, minimal battery
- Geofences: define entry/exit regions, wake app only on crossing — uses ~0.1% battery vs GPS polling at ~3-5% per hour
- Batch uploads: buffer locations locally, upload in batch every 5-15 min on wifi/LTE
- Adaptive frequency: reduce polling when speed < 1 m/s (stationary), increase when moving fast

**Q9: How do you secure sensitive data in a banking app?**
- Credentials: Keychain (iOS) / Android Keystore; never in UserDefaults/SharedPreferences
- Data at rest: CoreData with NSFileProtectionComplete; EncryptedFile (Jetpack Security)
- Data in transit: TLS 1.3 minimum; certificate pinning with public key hash + backup pin
- Session: short-lived tokens (15min); require biometric re-auth after 5min background
- Jailbreak detection: Play Integrity API (Android); Secure Enclave key availability check (iOS)
- Screenshot prevention: `FLAG_SECURE` (Android) / `UIScreen.isCaptured` (iOS) + blur on app switch

**Q10: How do you design an app update and force-upgrade system?**
- Server returns `min_supported_version` in every API response header
- Client compares to current app version on each launch and after resuming from background
- Soft update: show dismissible banner if current version < recommended_version
- Hard update: show non-dismissible full-screen prompt + deep link to store if current version < min_supported_version
- Feature gates: use feature flags to disable specific features for old clients without forcing full update
- Graceful degradation: old clients should never crash on new API responses — use tolerant JSON parsing (ignore unknown fields)

---

## 10. Numbers Every Mobile Engineer Must Know

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start (iOS) | <400ms first frame, <2s interactive | Apple guideline / industry target |
| Cold start (Android) | <500ms first frame, <3s interactive | Google guideline (Time to Full Display) |
| Frame budget at 60fps | 16.67ms | Any overflow = dropped frame |
| Frame budget at 120fps | 8.33ms | ProMotion / high refresh displays |
| Network timeout | 10s connect, 30s read | Reasonable defaults; reduce for critical paths |
| API response (mobile) | <200ms p50, <1s p99 | Users notice >300ms |
| Crash-free rate target | >99.5% | Industry standard; >99.9% for top apps |

### Size and Memory

| Metric | Value | Notes |
|--------|-------|-------|
| APK size target | <10MB initial | Play Store best practice; larger = higher install drop-off |
| iOS app cellular limit | 200MB | Auto-granted since iOS 13 |
| Memory per 1MP image (RGBA_8888) | 4MB decoded | width × height × 4 bytes |
| Memory per 4K image (RGBA_8888) | 31.6MB decoded | 3840 × 2160 × 4 |
| Memory cache size (typical) | 50MB | ~25% of heap |
| Disk cache size (typical) | 100-250MB | Check available storage |
| iOS jetsam kill threshold | ~200MB (2GB device) | Varies by device RAM |
| Android heap (typical) | 128-512MB | Check with getMemoryClass() |

### Networking

| Metric | Value | Notes |
|--------|-------|-------|
| FCM p50 delivery latency | ~250ms | Priority: high |
| FCM p99 delivery latency | ~2s | Priority: high |
| APNs payload limit | 4KB | Since iOS 8 |
| FCM payload limit | 4KB data + 4KB notification | Total 8KB |
| Cellular radio wake time | ~1-2s | State machine: idle → active transition |
| Radio tail time | ~5-10s | Stays active after last request (costly) |
| HTTP/2 multiplexing benefit | 6x fewer connections | One connection for all requests to same host |

### Battery

| Action | Battery cost (approximate) | Notes |
|--------|--------------------------|-------|
| GPS polling at 1Hz | 3-5% per hour | Use geofences for lower frequency needs |
| LTE data transfer (1MB) | ~0.1% | Varies widely by signal strength |
| WiFi data transfer (1MB) | ~0.02% | 5x cheaper than LTE |
| Screen on (max brightness) | 15-25% per hour | Biggest single drain |
| Background sync (1 request) | ~0.001% | Low when radio already active |
| Waking radio from idle | ~0.01% overhead | Batch requests to minimize wake events |

### Security

| Parameter | Value | Notes |
|-----------|-------|-------|
| Face ID false accept rate | 1 in 1,000,000 | Apple spec |
| Touch ID false accept rate | 1 in 50,000 | Apple spec |
| Access token lifetime (typical) | 15 minutes | Balance security vs UX |
| Refresh token lifetime (typical) | 30 days | Revoke on suspicious activity |
| Keychain access class | WhenUnlocked | Default; use WhenPasscodeSet for high-security |
| Android Keystore key protection | Hardware-backed | Verified via KeyInfo.isInsideSecureHardware() |

### App Store / Distribution

| Metric | iOS | Android |
|--------|-----|---------|
| Review time | 1-7 days (avg ~24h) | Hours to 3 days |
| Phased rollout | Yes (7-day, 1/2/5/10/20/50/100%) | Yes (staged rollout %) |
| Rollback | No (must submit new version) | Yes (halt rollout) |
| OTA updates (JS) | Allowed for JS frameworks (RN) | Allowed |
| OTA updates (native code) | Not allowed (App Store rule 3.3.2) | Not allowed |
| Minimum OS deployment target (2024) | iOS 16+ (~95% device coverage) | Android 8.0 / API 26 (~97%) |

---

## Quick Decision Framework

**Choosing an architecture pattern:**
- Simple app (<10 screens): MVP or MVC — less boilerplate
- Medium app: MVVM + Repository — good testability, industry standard
- Complex app (collaborative, complex state): MVI / TCA — unidirectional data flow, debuggable

**Choosing a local DB:**
- Relational data with queries: Room (Android) / CoreData (iOS) / SQLite
- Object graph, no migrations: Realm — but beware thread ownership rules
- Key-value store: SharedPreferences / UserDefaults — only for small config, never secrets

**Choosing a sync strategy:**
- Read-only content (news, articles): cache with TTL, no conflict resolution needed
- User-owned data (notes, todos): offline-first with delta sync + LWW
- Collaborative data (docs, whiteboards): CRDTs or OT, requires more infrastructure
- Financial transactions: no offline writes — require online for consistency

**Trap summary (memorize these):**
1. Storing tokens in UserDefaults/SharedPreferences — use Keychain/Keystore
2. Offset pagination in infinite scroll — use cursor pagination
3. LWW without sequence numbers — clock skew corrupts data
4. Forgetting tombstones in delete flows — clients never learn about deletions
5. Decoding full-resolution images in lists — OOM crash; always downscale to display size
6. Not handling token refresh race conditions — concurrent refreshes issue duplicate tokens
7. Pinning the certificate instead of the public key — cert expiry breaks the app before key rotation
8. Polling for updates instead of using push — radio tail time drains battery
9. Hard-coding feature flags — can't kill a bad feature without an app update
10. Not testing on low-end devices / 3G — smooth on Pixel 9 does not mean smooth on a budget Android

---

*Last updated: 2026-06-01 | See also: [System Design Cheat Sheet](./system-design) | [Databases Cheat Sheet](./databases) | [Caching Cheat Sheet](./caching)*
