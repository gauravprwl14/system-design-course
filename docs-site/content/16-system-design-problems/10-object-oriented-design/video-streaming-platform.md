---
title: "Design a Video Streaming Platform (OOD)"
layer: case-study
section: "16-system-design-problems/10-object-oriented-design"
difficulty: advanced
tags: [oop, strategy, observer, decorator, facade, streaming, netflix, solid]
category: architecture
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "Head First Design Patterns — O'Reilly"
    url: "https://www.oreilly.com/library/view/head-first-design/0596007124/"
    type: article
  - title: "Netflix Tech Blog"
    url: "https://netflixtechblog.com/"
    type: article
  - title: "NeetCode OOD Playlist"
    url: "https://www.youtube.com/@NeetCode"
    type: article
  - title: "Design Patterns: Elements of Reusable Object-Oriented Software (GoF)"
    url: "https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612"
    type: article
---

# Design a Video Streaming Platform (OOD)

**Difficulty**: 🔴 Advanced
**Codemania**: #143
**Interview Frequency**: High

---

## Problem Statement

Model the OOD layer of a Netflix-like streaming platform: content catalog (movies, series, episodes), subscription gate, DRM license acquisition, adaptive bitrate selection, watch history, and recommendations. The OOD challenge: `getStreamUrl()` involves 3 subsystems (subscription check, DRM, CDN URL generation) that should be hidden behind a Facade. Bitrate selection is a swappable Strategy. Content wrapped with subtitles and DRM is a Decorator chain.

---

## Functional Requirements

- Users browse catalog: movies, series with seasons and episodes
- Subscription check before streaming; redirect to paywall if expired
- Adaptive bitrate: auto-select quality based on bandwidth; user can override
- DRM: fetch time-limited license before playback starts
- Watch history: record position so resume is seamless
- Recommendations: suggest next episode or similar content after completion

---

## Core Entities

| Class | Responsibility |
|-------|---------------|
| `User` | Account, subscription tier, watch history, preferences |
| `Content` | Abstract: movie or series; title, genre, ratings |
| `Movie` | Single-file content; one video asset |
| `Series` | Container: seasons → episodes |
| `Episode` | Single episode: runtime, video asset, subtitles |
| `Subscription` | Tier (Basic/Standard/Premium), expiry date |
| `WatchHistory` | Per-user progress records; resume position |
| `VideoPlayer` | Client-side player: bitrate selector, progress reporter |
| `QualityProfile` | Available resolutions and bitrates for a content asset |
| `DRMLicense` | Time-limited decryption key returned by license server |

---

## Class Diagram

```mermaid
classDiagram
    class Content {
        <<abstract>>
        +id: String
        +title: String
        +genre: Genre
        +maturityRating: String
        +availableQualities: QualityProfile
    }
    class Series {
        +seasons: List~Season~
        +getEpisode(season, ep): Episode
        +getNextEpisode(current): Episode
    }
    class Subscription {
        +tier: SubscriptionTier
        +expiresAt: DateTime
        +maxStreams: int
        +allowsDownload: boolean
        +isActive(): boolean
        +allowsContent(content): boolean
    }
    class WatchHistory {
        +userId: String
        +records: Map~String, WatchRecord~
        +recordProgress(contentId, position): void
        +getResumePosition(contentId): Duration
        +markComplete(contentId): void
    }
    class BitrateStrategy {
        <<interface>>
        +selectQuality(profile, bandwidth): VideoQuality
    }
    class StreamingFacade {
        +getStreamUrl(user, content, quality): StreamSession
    }
    class ContentDecorator {
        +wrapped: Content
        +getStreamUrl(): String
    }
    Content <|-- Movie
    Content <|-- Series
    Series --> Episode
    Subscription --> SubscriptionTier
    BitrateStrategy <|.. AdaptiveBitrateStrategy
    BitrateStrategy <|.. ManualBitrateStrategy
    ContentDecorator --> Content
    ContentDecorator <|-- SubtitleDecorator
    ContentDecorator <|-- DRMDecorator
```

---

## Design Patterns Used

### 1. Facade — getStreamUrl()

**Why it fits**: Starting a stream requires: check subscription → check concurrent stream limit → request DRM license → pick CDN region → generate signed URL. The client shouldn't orchestrate all this. `StreamingFacade.getStreamUrl()` hides all subsystems behind one call.

```
class StreamingFacade:
  subscriptionService: SubscriptionService
  drmService: DRMService
  cdnService: CDNService
  streamLimitService: StreamLimitService

  getStreamUrl(user: User, content: Content, quality: VideoQuality): StreamSession
    // 1. Subscription gate
    sub = subscriptionService.getActive(user)
    if sub == null or not sub.isActive():
      throw SubscriptionExpiredException(user)
    if not sub.allowsContent(content):
      throw ContentNotInTierException(content, sub.tier)

    // 2. Concurrent stream limit
    active = streamLimitService.getActiveCount(user)
    if active >= sub.maxStreams:
      throw MaxConcurrentStreamsException(sub.maxStreams)

    // 3. DRM license
    license = drmService.acquireLicense(user, content, expiresIn = 4.hours)

    // 4. CDN URL with signed token
    cdnUrl = cdnService.getSignedUrl(content.id, quality, license.token, ttl = 4.hours)

    // 5. Register active stream
    session = streamLimitService.openSession(user, content)

    return StreamSession(cdnUrl, license, session.id)
```

### 2. Strategy — Adaptive Bitrate Selection

**Why it fits**: Auto mode selects bitrate based on measured bandwidth; manual mode uses user preference; a "save data" mode caps at 480p regardless of bandwidth. Each is a different algorithm operating on the same `QualityProfile` input.

```
interface BitrateStrategy:
  selectQuality(profile: QualityProfile, context: PlaybackContext): VideoQuality

AdaptiveBitrateStrategy:
  // Netflix BOLA algorithm (simplified)
  selectQuality(profile, context):
    bandwidth = context.measuredBandwidthKbps
    bufferLevel = context.bufferSeconds

    // Select highest quality whose bitrate fits in 80% of bandwidth
    candidates = profile.qualities.filter(q -> q.bitrateKbps <= bandwidth * 0.8)
    if candidates.isEmpty(): return profile.lowest

    // Buffer-based upgrade: if buffer > 15s, allow higher quality
    if bufferLevel > 15:
      return candidates.last()  // highest fitting
    return candidates[candidates.size() / 2]  // conservative middle

ManualBitrateStrategy(preferred: VideoQuality):
  selectQuality(profile, context):
    // Respect user choice; downgrade only if bandwidth too low
    if context.measuredBandwidthKbps < preferred.bitrateKbps * 1.2:
      return profile.nextLowerThan(preferred) ?? profile.lowest
    return preferred
```

### 3. Decorator — Content + Subtitles + DRM

**Why it fits**: A content asset can be served with subtitles (multiple language tracks), DRM-encrypted, or both. Inheritance for every combination (DRMMovie, SubtitleDRMEpisode…) explodes. Each decorator wraps the content and adds one concern without changing the interface.

```
abstract class ContentDecorator extends Content:
  wrapped: Content

  getTitle(): String
    return wrapped.getTitle()

class SubtitleDecorator extends ContentDecorator:
  subtitleTracks: List<SubtitleTrack>

  getManifestUrl(): String
    base = wrapped.getManifestUrl()
    return base + "&subtitles=" + subtitleTracks.map(t -> t.languageCode).join(",")

class DRMDecorator extends ContentDecorator:
  license: DRMLicense

  getManifestUrl(): String
    return wrapped.getManifestUrl() + "&drm_token=" + license.token

// Usage: apply DRM then subtitles
content = new DRMDecorator(
  new SubtitleDecorator(episode, [englishSub, spanishSub]),
  license
)
url = content.getManifestUrl()
```

### 4. Observer — Watch Completion → Recommendation

**Why it fits**: When a user finishes an episode, multiple systems react: auto-play next episode, update watch history, trigger recommendation refresh, and notify the analytics pipeline. Observer pattern lets the player emit `WatchCompletedEvent` and each system subscribe independently.

```
class VideoPlayer:
  observers: List<PlaybackObserver>

  reportProgress(contentId: String, position: Duration, duration: Duration): void
    watchHistory.recordProgress(contentId, position)
    progress = position.seconds / duration.seconds
    if progress >= 0.95:
      publish(WatchCompletedEvent(currentUser, contentId))

  publish(event): void
    for obs in observers: obs.onEvent(event)

class AutoPlayObserver implements PlaybackObserver:
  onEvent(WatchCompletedEvent e):
    if e.contentId is Episode:
      next = seriesService.getNextEpisode(e.contentId)
      if next != null:
        player.queueNext(next, autoPlayDelay = 5.seconds)

class RecommendationObserver implements PlaybackObserver:
  onEvent(WatchCompletedEvent e):
    recommendationService.refresh(e.user)
```

---

## Key Method: `getNextEpisode(series, current)`

```
SeriesService:
  getNextEpisode(series: Series, current: Episode): Episode
    season = series.getSeason(current.seasonNumber)

    // Try next episode in same season
    next = season.getEpisode(current.episodeNumber + 1)
    if next != null: return next

    // Try first episode of next season
    nextSeason = series.getSeason(current.seasonNumber + 1)
    if nextSeason != null:
      return nextSeason.getFirstEpisode()

    // Series complete
    return null
```

---

## Design Decisions & Trade-offs

| Decision | Option A | Option B | Choice |
|----------|----------|----------|--------|
| Bitrate selection | Client-side (player decides) | Server-side (server recommends) | Client-side — player has real-time bandwidth data; server can't |
| Watch history granularity | Record on every 10 seconds | Record on pause/close | Every 10 seconds — more resume accuracy; tolerable write load |
| DRM license scope | Per-content license | Per-session license | Per-session — can revoke mid-playback on subscription cancel |
| Recommendation trigger | After each watch | Nightly batch | After each watch — personalization is a real-time competitive advantage |

---

## Top Interview Questions

| Question | What It Tests |
|----------|--------------|
| How does the system know a user is watching on two devices simultaneously? | Session tracking, concurrent stream counter |
| How would you add offline download support (for premium subscribers)? | Subscription allowsDownload check, DRM offline license |
| A user cancels subscription mid-episode — when does playback stop? | DRM license revocation, session invalidation |

---

## Related Concepts

- [Social Media Platform OOD for Observer fan-out patterns](./social-media-platform)
- [Resource Management OOD for connection pool under concurrent streams](./resource-management)

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [NeetCode OOD Playlist](https://www.youtube.com/@NeetCode) | 📺 YouTube | Facade and Decorator pattern walkthroughs |
| [Netflix Tech Blog](https://netflixtechblog.com/) | 📖 Blog | Adaptive streaming, DRM, and CDN patterns at Netflix |
| [ByteByteGo System Design](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Netflix system design overview |
| [Head First Design Patterns](https://www.oreilly.com/library/view/head-first-design/0596007124/) | 📚 Book | Facade, Decorator, and Observer chapters |
| [GoF Design Patterns](https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612) | 📚 Book | Decorator and Strategy pattern reference |
