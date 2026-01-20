# Video Streaming & Adaptive Delivery - Zero Buffering on Any Network

> **Reading Time:** 18 minutes
> **Difficulty:** 🟡 Intermediate
> **Prerequisites:** [Video Transcoding Basics](/interview-prep/system-design/instagram-assets-series/prereq-video-transcoding), [Part 3: Video Processing Pipeline](/interview-prep/system-design/instagram-assets-series/03-video-processing-pipeline)
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The Buffering Spiral That Kills Engagement

**A user opens a Reel on their commute.**

```
Network conditions during subway ride:
- Station: 20 Mbps (WiFi)
- Moving: 2 Mbps (LTE)
- Tunnel: 0 Mbps (no signal)
- Next station: 15 Mbps (4G)

Without adaptive streaming:
Video: Fixed 4 Mbps (1080p)

Timeline:
00:00 - Station WiFi: Playing ✅
00:15 - Train moves: ⏳ Buffering...
00:30 - Still buffering... user swipes away
Result: 50% completion rate, algorithm deprioritizes video

With adaptive streaming:
00:00 - Station WiFi: 1080p @ 4 Mbps ✅
00:15 - Moving: Switches to 480p @ 1 Mbps ✅
00:25 - Tunnel: Plays from buffer ✅
00:35 - Next station: Switches to 720p @ 2 Mbps ✅
Result: 95% completion rate, engagement maintained
```

Instagram Reels serves **billions of video views daily** with a target of **zero buffering** regardless of network conditions.

This article shows you how adaptive bitrate streaming works and how to implement it for seamless video delivery.

---

## How Adaptive Bitrate Streaming Works

### The Core Concept

```
Traditional Streaming (Progressive Download):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Server: Here's your video (one quality)                       │
│    ════════════════════════════════════ → Client               │
│                                                                 │
│  Problem: If bandwidth < bitrate → buffering                   │
│  Problem: If bandwidth > bitrate → wasting bandwidth           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Adaptive Streaming (HLS/DASH):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Server: Here are your options (multiple qualities)            │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  1080p   │ │   720p   │ │   480p   │ │   360p   │           │
│  │  4 Mbps  │ │  2 Mbps  │ │  1 Mbps  │ │  600kbps │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│  Client measures bandwidth → picks appropriate quality         │
│  Bandwidth changes? → Switch quality on next segment           │
│                                                                 │
│  Result: Always playing, never buffering                       │
└─────────────────────────────────────────────────────────────────┘
```

### Segment-Based Architecture

```
Video divided into 6-second segments:

1080p: [seg0][seg1][seg2][seg3][seg4][seg5][seg6][seg7][seg8][seg9]
720p:  [seg0][seg1][seg2][seg3][seg4][seg5][seg6][seg7][seg8][seg9]
480p:  [seg0][seg1][seg2][seg3][seg4][seg5][seg6][seg7][seg8][seg9]
360p:  [seg0][seg1][seg2][seg3][seg4][seg5][seg6][seg7][seg8][seg9]

Timeline of quality switching:
────────────────────────────────────────────────────────────────────
Time:   0s    6s    12s   18s   24s   30s   36s   42s   48s   54s
BW:     5Mbps 5Mbps 2Mbps 1Mbps 0.5M  2Mbps 4Mbps 4Mbps 4Mbps 4Mbps
Quality:1080p 1080p 720p  480p  360p  480p  720p  1080p 1080p 1080p
────────────────────────────────────────────────────────────────────

Key insight: Quality can change at any segment boundary
Result: Smooth playback despite network fluctuations
```

---

## HLS Implementation

### Complete HLS Package Structure

```
video/
├── master.m3u8                 # Master playlist (entry point)
├── 1080p/
│   ├── playlist.m3u8          # Quality-specific playlist
│   ├── init.mp4               # Initialization segment (fMP4)
│   ├── segment_0.m4s          # Video segment 0
│   ├── segment_1.m4s          # Video segment 1
│   └── ...
├── 720p/
│   ├── playlist.m3u8
│   ├── init.mp4
│   └── segment_*.m4s
├── 480p/
│   └── ...
├── 360p/
│   └── ...
└── audio/
    ├── playlist.m3u8          # Audio-only track
    ├── init.mp4
    └── segment_*.m4s
```

### Master Playlist (m3u8)

```m3u8
#EXTM3U
#EXT-X-VERSION:7

# Audio track (separate for bandwidth efficiency)
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",DEFAULT=YES,URI="audio/playlist.m3u8"

# 1080p variant
#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2",AUDIO="audio"
1080p/playlist.m3u8

# 720p variant
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2",AUDIO="audio"
720p/playlist.m3u8

# 480p variant
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480,CODECS="avc1.64001e,mp4a.40.2",AUDIO="audio"
480p/playlist.m3u8

# 360p variant
#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=640x360,CODECS="avc1.640015,mp4a.40.2",AUDIO="audio"
360p/playlist.m3u8

# 240p variant (for very poor connections)
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=426x240,CODECS="avc1.640015,mp4a.40.2",AUDIO="audio"
240p/playlist.m3u8
```

### Media Playlist (Quality-Specific)

```m3u8
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="init.mp4"

#EXTINF:6.000,
segment_0.m4s
#EXTINF:6.000,
segment_1.m4s
#EXTINF:6.000,
segment_2.m4s
#EXTINF:6.000,
segment_3.m4s
#EXTINF:6.000,
segment_4.m4s
#EXTINF:5.234,
segment_5.m4s

#EXT-X-ENDLIST
```

---

## Player Implementation

### HLS.js Integration (Web)

```javascript
import Hls from 'hls.js';

class AdaptiveVideoPlayer {
  constructor(videoElement, manifestUrl) {
    this.video = videoElement;
    this.manifestUrl = manifestUrl;
    this.hls = null;
    this.metrics = {
      bufferStalls: 0,
      qualitySwitches: 0,
      averageBitrate: 0
    };
  }

  init() {
    if (Hls.isSupported()) {
      this.hls = new Hls({
        // Start with auto quality selection
        startLevel: -1,

        // Buffer configuration
        maxBufferLength: 30,           // Max buffer ahead (seconds)
        maxMaxBufferLength: 60,        // Absolute max buffer
        maxBufferSize: 60 * 1000000,   // 60 MB max buffer size
        maxBufferHole: 0.5,            // Max gap in buffer

        // ABR configuration
        abrEwmaDefaultEstimate: 500000, // Initial bandwidth estimate (500 Kbps)
        abrEwmaFastLive: 3,             // Fast adaptation for live
        abrEwmaSlowLive: 9,             // Slow adaptation factor
        abrBandWidthFactor: 0.95,       // Use 95% of measured bandwidth
        abrBandWidthUpFactor: 0.7,      // Conservative on upgrades
        abrMaxWithRealBitrate: true,    // Use actual bitrate for decisions

        // Low latency mode (for Reels-like experience)
        lowLatencyMode: true,
        backBufferLength: 10            // Keep 10s in back buffer
      });

      this.hls.loadSource(this.manifestUrl);
      this.hls.attachMedia(this.video);

      this.setupEventHandlers();

    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      this.video.src = this.manifestUrl;
      this.setupNativeHandlers();
    }
  }

  setupEventHandlers() {
    // Quality level loaded
    this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log('Available qualities:', data.levels.map(l => `${l.height}p`));
    });

    // Quality switch
    this.hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      const level = this.hls.levels[data.level];
      console.log(`Switched to ${level.height}p @ ${level.bitrate / 1000} Kbps`);
      this.metrics.qualitySwitches++;
      this.onQualityChange(level);
    });

    // Buffer stall detection
    this.hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
        this.metrics.bufferStalls++;
        this.onBufferStall();
      }

      if (data.fatal) {
        this.handleFatalError(data);
      }
    });

    // Bandwidth estimation updates
    this.hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
      const stats = data.frag.stats;
      const bandwidth = (stats.loaded * 8) / (stats.loading.end - stats.loading.start) * 1000;
      this.updateBandwidthEstimate(bandwidth);
    });
  }

  onQualityChange(level) {
    // Update UI indicator
    this.dispatchEvent('qualitychange', {
      height: level.height,
      bitrate: level.bitrate
    });

    // Analytics
    this.trackEvent('quality_switch', {
      to_quality: level.height,
      bitrate: level.bitrate
    });
  }

  onBufferStall() {
    // Show loading indicator
    this.dispatchEvent('buffering', { stalled: true });

    // Potentially force lower quality
    if (this.metrics.bufferStalls > 2) {
      this.forceQualityDown();
    }
  }

  forceQualityDown() {
    const currentLevel = this.hls.currentLevel;
    if (currentLevel > 0) {
      this.hls.currentLevel = currentLevel - 1;
      console.log('Forced quality down due to repeated stalls');
    }
  }

  handleFatalError(data) {
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        // Try to recover
        this.hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        this.hls.recoverMediaError();
        break;
      default:
        // Unrecoverable error
        this.hls.destroy();
        this.dispatchEvent('error', { fatal: true });
        break;
    }
  }

  // Manual quality override
  setQuality(levelIndex) {
    this.hls.currentLevel = levelIndex;
    this.hls.nextLevel = levelIndex;
  }

  // Get current playback stats
  getStats() {
    return {
      currentQuality: this.hls.levels[this.hls.currentLevel]?.height,
      bandwidth: this.hls.bandwidthEstimate,
      bufferLength: this.video.buffered.length > 0
        ? this.video.buffered.end(0) - this.video.currentTime
        : 0,
      ...this.metrics
    };
  }

  destroy() {
    if (this.hls) {
      this.hls.destroy();
    }
  }
}

// Usage
const video = document.getElementById('video-player');
const player = new AdaptiveVideoPlayer(
  video,
  'https://cdn.instagram.com/videos/abc123/master.m3u8'
);
player.init();
```

### React Native Implementation

```javascript
import Video from 'react-native-video';
import { useState, useRef, useCallback } from 'react';

function AdaptiveVideoPlayer({ videoId, onComplete }) {
  const videoRef = useRef(null);
  const [currentQuality, setCurrentQuality] = useState(null);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(null);

  const handleLoad = useCallback((data) => {
    console.log('Video loaded:', {
      duration: data.duration,
      naturalSize: data.naturalSize,
      audioTracks: data.audioTracks,
      textTracks: data.textTracks
    });
  }, []);

  const handleBuffer = useCallback(({ isBuffering }) => {
    setBuffering(isBuffering);

    if (isBuffering) {
      // Track buffering event
      analytics.track('video_buffer', { videoId });
    }
  }, [videoId]);

  const handleBandwidthUpdate = useCallback((data) => {
    // HLS.js or native player reports bandwidth
    console.log('Bandwidth:', data.bitrate);
    setCurrentQuality(data.selectedBitrate);
  }, []);

  const handleError = useCallback((error) => {
    console.error('Video error:', error);
    setError(error);

    // Retry logic
    if (error.error?.code === 'NETWORK_ERROR') {
      setTimeout(() => {
        videoRef.current?.seek(videoRef.current.currentTime);
      }, 1000);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{
          uri: `https://cdn.instagram.com/videos/${videoId}/master.m3u8`,
          type: 'm3u8'
        }}
        style={styles.video}
        resizeMode="cover"
        repeat={true}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"

        // Buffer configuration
        bufferConfig={{
          minBufferMs: 5000,           // Min buffer before playback
          maxBufferMs: 30000,          // Max buffer to maintain
          bufferForPlaybackMs: 2500,   // Buffer needed to start
          bufferForPlaybackAfterRebufferMs: 5000
        }}

        // Quality selection
        selectedVideoTrack={{
          type: 'auto'  // Let player choose based on bandwidth
        }}

        // Event handlers
        onLoad={handleLoad}
        onBuffer={handleBuffer}
        onBandwidthUpdate={handleBandwidthUpdate}
        onError={handleError}
        onEnd={onComplete}
      />

      {buffering && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {currentQuality && (
        <Text style={styles.qualityBadge}>
          {Math.round(currentQuality / 1000)}K
        </Text>
      )}
    </View>
  );
}
```

---

## ABR Algorithm Deep Dive

### Bandwidth Estimation

```javascript
class BandwidthEstimator {
  constructor() {
    // Exponential Weighted Moving Average
    this.ewmaFast = 0;  // Recent measurements (more reactive)
    this.ewmaSlow = 0;  // Historical average (more stable)
    this.samples = [];
  }

  addSample(downloadBytes, downloadTimeMs) {
    const bandwidthBps = (downloadBytes * 8 * 1000) / downloadTimeMs;

    // EWMA update
    const alphaFast = 0.5;  // 50% weight to new sample
    const alphaSlow = 0.1;  // 10% weight to new sample

    if (this.ewmaFast === 0) {
      this.ewmaFast = bandwidthBps;
      this.ewmaSlow = bandwidthBps;
    } else {
      this.ewmaFast = alphaFast * bandwidthBps + (1 - alphaFast) * this.ewmaFast;
      this.ewmaSlow = alphaSlow * bandwidthBps + (1 - alphaSlow) * this.ewmaSlow;
    }

    // Keep recent samples for variance calculation
    this.samples.push({ bandwidth: bandwidthBps, timestamp: Date.now() });
    if (this.samples.length > 20) {
      this.samples.shift();
    }
  }

  getEstimate() {
    // Use the lower of fast and slow estimates (conservative)
    return Math.min(this.ewmaFast, this.ewmaSlow);
  }

  getVariance() {
    if (this.samples.length < 2) return 0;

    const mean = this.samples.reduce((a, s) => a + s.bandwidth, 0) / this.samples.length;
    const variance = this.samples.reduce((a, s) => a + Math.pow(s.bandwidth - mean, 2), 0) / this.samples.length;
    return Math.sqrt(variance);
  }

  isNetworkStable() {
    const cv = this.getVariance() / this.getEstimate();  // Coefficient of variation
    return cv < 0.3;  // Less than 30% variation = stable
  }
}
```

### Quality Selection Logic

```javascript
class ABRController {
  constructor(levels, estimator) {
    this.levels = levels;  // Available quality levels
    this.estimator = estimator;
    this.currentLevel = -1;
    this.lastSwitchTime = 0;
  }

  selectLevel(bufferLength) {
    const bandwidth = this.estimator.getEstimate();
    const isStable = this.estimator.isNetworkStable();

    // Safety factor: only use 80% of bandwidth
    const safeBandwidth = bandwidth * 0.8;

    // Find highest quality we can sustain
    let selectedLevel = 0;
    for (let i = this.levels.length - 1; i >= 0; i--) {
      if (this.levels[i].bitrate <= safeBandwidth) {
        selectedLevel = i;
        break;
      }
    }

    // Buffer-based adjustments
    if (bufferLength < 5) {
      // Low buffer: be more aggressive about downgrading
      selectedLevel = Math.max(0, selectedLevel - 1);
    } else if (bufferLength > 20 && isStable) {
      // High buffer + stable network: can try upgrading
      selectedLevel = Math.min(this.levels.length - 1, selectedLevel + 1);
    }

    // Rate-limit switches (no more than once per 10 seconds)
    const now = Date.now();
    if (now - this.lastSwitchTime < 10000 && this.currentLevel !== -1) {
      // Only allow downgrade if urgent
      if (selectedLevel >= this.currentLevel) {
        return this.currentLevel;
      }
    }

    if (selectedLevel !== this.currentLevel) {
      this.lastSwitchTime = now;
      this.currentLevel = selectedLevel;
    }

    return selectedLevel;
  }
}
```

---

## Buffer Management Strategy

### Optimal Buffer Configuration

```javascript
const bufferStrategy = {
  // Mobile (aggressive - minimize memory)
  mobile: {
    minBuffer: 5,       // Start playback with 5s buffer
    maxBuffer: 30,      // Don't buffer more than 30s
    targetBuffer: 15,   // Aim for 15s buffer
    backBuffer: 10      // Keep 10s behind playhead
  },

  // Desktop (relaxed - prioritize quality)
  desktop: {
    minBuffer: 10,
    maxBuffer: 60,
    targetBuffer: 30,
    backBuffer: 30
  },

  // Low-memory device
  lowMemory: {
    minBuffer: 3,
    maxBuffer: 15,
    targetBuffer: 8,
    backBuffer: 5
  }
};

function getBufferConfig(deviceType, availableMemory) {
  if (availableMemory < 1024) {  // < 1GB RAM
    return bufferStrategy.lowMemory;
  }
  return bufferStrategy[deviceType] || bufferStrategy.mobile;
}
```

### Pre-buffering for Feed Videos

```javascript
// Prebuffer next videos in feed for instant playback

class FeedPrebuffer {
  constructor(maxPrebufferedVideos = 3) {
    this.prebufferedVideos = new Map();
    this.maxPrebuffered = maxPrebufferedVideos;
  }

  async prebufferVideo(videoId, priority = 0) {
    if (this.prebufferedVideos.has(videoId)) {
      return;  // Already prebuffered
    }

    // Evict lowest priority if at capacity
    if (this.prebufferedVideos.size >= this.maxPrebuffered) {
      this.evictLowestPriority();
    }

    try {
      // Fetch first few segments (enough for 10-15 seconds)
      const manifest = await this.fetchManifest(videoId);
      const segments = await this.fetchInitialSegments(manifest, 3);

      this.prebufferedVideos.set(videoId, {
        manifest,
        segments,
        priority,
        timestamp: Date.now()
      });

      console.log(`Prebuffered video ${videoId}`);
    } catch (error) {
      console.error(`Failed to prebuffer ${videoId}:`, error);
    }
  }

  async fetchInitialSegments(manifest, count) {
    const lowestQuality = manifest.levels[0];  // Prebuffer at lowest quality
    const segments = [];

    for (let i = 0; i < count && i < lowestQuality.segments.length; i++) {
      const segment = await fetch(lowestQuality.segments[i].url);
      segments.push({
        index: i,
        data: await segment.arrayBuffer()
      });
    }

    return segments;
  }

  getPrebufferedData(videoId) {
    return this.prebufferedVideos.get(videoId);
  }

  evictLowestPriority() {
    let lowestPriority = Infinity;
    let lowestKey = null;

    for (const [key, value] of this.prebufferedVideos) {
      if (value.priority < lowestPriority) {
        lowestPriority = value.priority;
        lowestKey = key;
      }
    }

    if (lowestKey) {
      this.prebufferedVideos.delete(lowestKey);
    }
  }
}
```

---

## CDN Configuration for Video

### Cache Headers

```javascript
const videoCacheHeaders = {
  // HLS manifest (short cache - can change for live)
  'master.m3u8': {
    'Cache-Control': 'public, max-age=5',  // 5 seconds
    'CDN-Cache-Control': 'max-age=2'       // CDN caches for 2s
  },

  // Media playlist (VOD - long cache)
  'playlist.m3u8': {
    'Cache-Control': 'public, max-age=3600',
    'CDN-Cache-Control': 'max-age=86400'
  },

  // Video segments (immutable)
  '*.m4s': {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'CDN-Cache-Control': 'max-age=31536000'
  },

  // Init segment (immutable)
  'init.mp4': {
    'Cache-Control': 'public, max-age=31536000, immutable'
  }
};
```

### Byte-Range Requests

```javascript
// Handle byte-range requests for large segments

app.get('/videos/:id/:quality/:segment', async (req, res) => {
  const { id, quality, segment } = req.params;
  const range = req.headers.range;

  const s3Key = `videos/${id}/${quality}/${segment}`;
  const metadata = await getS3Metadata(s3Key);
  const fileSize = metadata.ContentLength;

  if (range) {
    // Parse range header
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    // Get partial content from S3
    const stream = await s3.getObject({
      Bucket: 'instagram-videos',
      Key: s3Key,
      Range: `bytes=${start}-${end}`
    }).createReadStream();

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4'
    });

    stream.pipe(res);
  } else {
    // Full file request
    const stream = await s3.getObject({
      Bucket: 'instagram-videos',
      Key: s3Key
    }).createReadStream();

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    });

    stream.pipe(res);
  }
});
```

---

## Performance Metrics

### Key Video Metrics

```javascript
const videoMetrics = {
  // Startup metrics
  timeToFirstFrame: {
    target: '<1s',
    p50: '600ms',
    p95: '1.2s',
    p99: '2.5s'
  },

  // Playback quality
  bufferRatio: {
    target: '<1%',  // Buffering time / total time
    description: 'Percentage of time spent buffering'
  },

  // Quality distribution
  qualityDistribution: {
    '1080p': '35%',
    '720p': '40%',
    '480p': '18%',
    '360p': '5%',
    '240p': '2%'
  },

  // Error rates
  playbackErrors: {
    target: '<0.1%',
    breakdown: {
      networkErrors: '0.05%',
      decodeErrors: '0.02%',
      droppedFrames: '0.03%'
    }
  }
};
```

### Monitoring Dashboard

```javascript
// Track and report video playback metrics

class VideoAnalytics {
  constructor(videoId, sessionId) {
    this.videoId = videoId;
    this.sessionId = sessionId;
    this.startTime = Date.now();
    this.events = [];
    this.metrics = {
      timeToFirstFrame: null,
      bufferingEvents: [],
      qualitySwitches: [],
      droppedFrames: 0,
      playbackDuration: 0,
      watchedDuration: 0
    };
  }

  onFirstFrame() {
    this.metrics.timeToFirstFrame = Date.now() - this.startTime;
    this.track('first_frame', { ttff: this.metrics.timeToFirstFrame });
  }

  onBufferingStart() {
    this.currentBufferStart = Date.now();
  }

  onBufferingEnd() {
    if (this.currentBufferStart) {
      const duration = Date.now() - this.currentBufferStart;
      this.metrics.bufferingEvents.push({ duration, timestamp: Date.now() });
      this.track('buffer_end', { duration });
      this.currentBufferStart = null;
    }
  }

  onQualitySwitch(fromLevel, toLevel, reason) {
    this.metrics.qualitySwitches.push({
      from: fromLevel,
      to: toLevel,
      reason,
      timestamp: Date.now()
    });
    this.track('quality_switch', { from: fromLevel, to: toLevel, reason });
  }

  onVideoEnd() {
    const totalDuration = Date.now() - this.startTime;
    const bufferingTime = this.metrics.bufferingEvents.reduce((a, e) => a + e.duration, 0);
    const bufferRatio = bufferingTime / totalDuration;

    this.track('video_complete', {
      videoId: this.videoId,
      totalDuration,
      bufferingTime,
      bufferRatio,
      qualitySwitches: this.metrics.qualitySwitches.length,
      ttff: this.metrics.timeToFirstFrame
    });
  }

  track(event, properties) {
    this.events.push({ event, properties, timestamp: Date.now() });

    // Send to analytics backend
    analytics.track(event, {
      ...properties,
      videoId: this.videoId,
      sessionId: this.sessionId
    });
  }
}
```

---

## Quick Win: Add HLS Support (15 min)

### Using HLS.js CDN

```html
<!DOCTYPE html>
<html>
<head>
  <title>Adaptive Video Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    video { width: 100%; max-width: 800px; }
    .quality-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div style="position: relative; display: inline-block;">
    <video id="video" controls></video>
    <div id="quality" class="quality-badge">--</div>
  </div>

  <script>
    const video = document.getElementById('video');
    const qualityBadge = document.getElementById('quality');
    const manifestUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: -1,  // Auto
        maxBufferLength: 30
      });

      hls.loadSource(manifestUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        qualityBadge.textContent = `${level.height}p`;
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('Fatal error:', data);
          hls.destroy();
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = manifestUrl;
    }
  </script>
</body>
</html>
```

---

## Key Takeaways

**What you learned:**
- HLS/DASH segments video for quality switching at boundaries
- ABR algorithms balance bandwidth, buffer, and stability
- Pre-buffering enables instant playback in feeds
- CDN caching must handle manifests and segments differently

**Buffer formula:**
```
Safe to upgrade quality if:
  bufferLength > targetBuffer AND
  bandwidth * 0.8 > nextLevel.bitrate AND
  networkIsStable
```

**Implementation checklist:**
- [ ] HLS.js or native player integration
- [ ] ABR configuration (start level, buffer limits)
- [ ] Quality switch handling (UI, analytics)
- [ ] Error recovery (network, decode)
- [ ] Pre-buffering for feed videos
- [ ] CDN cache headers by content type
- [ ] Playback metrics tracking

---

## What's Next?

Videos play smoothly. But how do you load a feed with 50+ media items without freezing the UI?

**Next Article:** [Part 5: Feed Loading & Infinite Scroll](/interview-prep/system-design/instagram-assets-series/05-feed-loading-optimization) — Virtualization, prefetching, and rendering optimization for smooth scrolling.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
