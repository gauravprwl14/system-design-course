# Video Transcoding Basics - Making Video Work Everywhere

> **Reading Time:** 15 minutes
> **Difficulty:** 🟡 Intermediate
> **Prerequisites:** Basic understanding of media formats
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The 1-Minute Video That Takes 1 Hour to Upload

**A user records a 60-second 4K video on their iPhone.**

```
Original video specs:
Resolution: 3840 × 2160 (4K)
Frame rate: 60 fps
Codec: HEVC (H.265)
Bitrate: 50 Mbps
File size: 375 MB

User's upload speed: 5 Mbps
Upload time: 10 minutes

Then the viewer on 3G tries to watch it:
Download speed: 1 Mbps
Required: 50 Mbps
Result: Infinite buffering. Video unwatchable.
```

Instagram processes **500+ million video uploads daily** (Stories, Reels, posts). Without transcoding, most videos would be unwatchable for most users.

**The solution?** Transcode every video into multiple quality levels that adapt to each viewer's network conditions.

```
After transcoding (adaptive bitrate):
Qualities: 1080p, 720p, 480p, 360p, 240p
Bitrates: 4Mbps → 400Kbps
File sizes: 30MB → 3MB (per quality)

3G user gets 360p @ 600 Kbps
WiFi user gets 1080p @ 4 Mbps
Both: Instant playback, no buffering
```

This article explains codecs, containers, transcoding, and adaptive streaming—the foundations of video delivery at scale.

---

## Video Fundamentals

### The Two Parts of a Video File

```
┌─────────────────────────────────────────────────────────────┐
│                       VIDEO FILE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐    │
│  │    CONTAINER     │    │          CONTENT            │    │
│  │   (the wrapper)  │    │    (video + audio data)     │    │
│  │                  │    │                             │    │
│  │  Examples:       │    │  ┌─────────────────────┐    │    │
│  │  - MP4           │    │  │    VIDEO CODEC      │    │    │
│  │  - WebM          │    │  │    (H.264, H.265,   │    │    │
│  │  - MOV           │    │  │     VP9, AV1)       │    │    │
│  │  - MKV           │    │  └─────────────────────┘    │    │
│  │                  │    │                             │    │
│  │  Contains:       │    │  ┌─────────────────────┐    │    │
│  │  - Metadata      │    │  │    AUDIO CODEC      │    │    │
│  │  - Timestamps    │    │  │    (AAC, Opus,      │    │    │
│  │  - Chapters      │    │  │     MP3)            │    │    │
│  │  - Subtitles     │    │  └─────────────────────┘    │    │
│  └──────────────────┘    └─────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Analogy:
- Container = Shipping box (format/structure)
- Codec = Contents inside (compressed video/audio)

You can put H.264 video in MP4, MOV, or MKV containers.
The container doesn't change the video quality—the codec does.
```

### Video Codecs Explained

```javascript
const videoCodecs = {
  'H.264 (AVC)': {
    released: 2003,
    support: '100% (universal)',
    efficiency: 'Baseline',
    use: 'Maximum compatibility',
    browsers: 'All',
    hardware: 'All devices have decoders',
    streaming: 'HLS, DASH'
  },

  'H.265 (HEVC)': {
    released: 2013,
    support: '~80% (Safari, Edge, some Chrome)',
    efficiency: '50% better than H.264',
    use: 'Apple ecosystem, premium devices',
    browsers: 'Safari, Edge (with license)',
    hardware: 'Newer devices (2015+)',
    streaming: 'HLS (Apple)'
  },

  'VP9': {
    released: 2013,
    support: '~95% (Chrome, Firefox, Edge)',
    efficiency: '40% better than H.264',
    use: 'YouTube, Google ecosystem',
    browsers: 'Chrome, Firefox, Edge, Android',
    hardware: 'Most 2016+ devices',
    streaming: 'DASH, WebM'
  },

  'AV1': {
    released: 2018,
    support: '~75% (growing fast)',
    efficiency: '30% better than VP9, 50% better than H.264',
    use: 'Next-gen streaming, Netflix, YouTube',
    browsers: 'Chrome, Firefox, Edge (2020+)',
    hardware: 'Limited, growing',
    streaming: 'DASH, CMAF'
  }
};

// Efficiency comparison (same visual quality):
// H.264: 4 Mbps (baseline)
// HEVC:  2 Mbps (50% smaller)
// VP9:   2.4 Mbps (40% smaller)
// AV1:   1.6 Mbps (60% smaller)
```

### Containers Explained

```javascript
const containers = {
  'MP4 (.mp4)': {
    codecs: ['H.264', 'H.265', 'AV1'],
    audio: ['AAC', 'MP3'],
    support: '100%',
    use: 'Web delivery, downloads',
    streaming: 'HLS, DASH (fragmented MP4)'
  },

  'WebM (.webm)': {
    codecs: ['VP8', 'VP9', 'AV1'],
    audio: ['Vorbis', 'Opus'],
    support: '~95%',
    use: 'Open-source alternative to MP4',
    streaming: 'DASH'
  },

  'MOV (.mov)': {
    codecs: ['H.264', 'H.265', 'ProRes'],
    audio: ['AAC', 'PCM'],
    support: '~90%',
    use: 'Apple ecosystem, editing',
    streaming: 'Not recommended'
  },

  'TS (.ts)': {
    codecs: ['H.264', 'H.265'],
    audio: ['AAC', 'AC3'],
    support: '100% (via HLS)',
    use: 'HLS streaming segments',
    streaming: 'HLS (legacy)'
  }
};
```

---

## Transcoding: Converting Video for Delivery

### What Transcoding Does

```
Input (user upload):
┌─────────────────────────────────────┐
│ 4K HEVC @ 50 Mbps                   │
│ iPhone 15 Pro recording             │
│ File: 375 MB (1 minute)             │
└─────────────────────────────────────┘
                ↓
         TRANSCODING
                ↓
Output (multiple renditions):
┌─────────────────────────────────────┐
│ 1080p H.264 @ 4 Mbps   (30 MB)      │
│ 720p H.264 @ 2 Mbps    (15 MB)      │
│ 480p H.264 @ 1 Mbps    (7.5 MB)     │
│ 360p H.264 @ 600 Kbps  (4.5 MB)     │
│ 240p H.264 @ 400 Kbps  (3 MB)       │
├─────────────────────────────────────┤
│ Total: 60 MB (84% reduction)        │
│ Now playable on ANY device/network  │
└─────────────────────────────────────┘
```

### The Transcoding Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                   VIDEO TRANSCODING PIPELINE                     │
└─────────────────────────────────────────────────────────────────┘

     ┌─────────────┐
     │   UPLOAD    │  Raw video from user device
     │             │
     └──────┬──────┘
            ↓
     ┌─────────────┐
     │   DECODE    │  Decompress to raw frames
     │  (Demux)    │  Separate video/audio tracks
     └──────┬──────┘
            ↓
     ┌─────────────┐
     │  ANALYZE    │  Check resolution, framerate
     │             │  Detect content type (motion level)
     │             │  Content moderation (optional)
     └──────┬──────┘
            ↓
     ┌─────────────┐
     │   SCALE     │  Resize to target resolutions
     │             │  1080p, 720p, 480p, 360p, 240p
     └──────┬──────┘
            ↓
     ┌─────────────┐
     │   ENCODE    │  Compress with target codec
     │             │  H.264/VP9/AV1 @ target bitrate
     └──────┬──────┘
            ↓
     ┌─────────────┐
     │  PACKAGE    │  Create HLS/DASH segments
     │             │  Generate manifests
     └──────┬──────┘
            ↓
     ┌─────────────┐
     │   STORE     │  Upload to CDN origin
     │             │  Replicate across regions
     └─────────────┘
```

### Code: FFmpeg Transcoding

```bash
# Single-pass transcoding (basic)
ffmpeg -i input.mov \
  -c:v libx264 \           # Video codec
  -preset medium \         # Encoding speed (slower = better compression)
  -crf 23 \                # Quality (lower = better, 18-28 typical)
  -c:a aac \               # Audio codec
  -b:a 128k \              # Audio bitrate
  -movflags +faststart \   # Enable progressive download
  output.mp4

# Two-pass encoding (better quality at same bitrate)
# Pass 1: Analyze
ffmpeg -i input.mov \
  -c:v libx264 \
  -preset slow \
  -b:v 4M \
  -pass 1 \
  -f null /dev/null

# Pass 2: Encode
ffmpeg -i input.mov \
  -c:v libx264 \
  -preset slow \
  -b:v 4M \
  -pass 2 \
  -c:a aac -b:a 128k \
  output.mp4
```

### Code: Multi-Rendition Transcoding

```javascript
const { spawn } = require('child_process');

const renditions = [
  { name: '1080p', width: 1920, height: 1080, bitrate: '4M' },
  { name: '720p', width: 1280, height: 720, bitrate: '2M' },
  { name: '480p', width: 854, height: 480, bitrate: '1M' },
  { name: '360p', width: 640, height: 360, bitrate: '600k' },
  { name: '240p', width: 426, height: 240, bitrate: '400k' }
];

async function transcodeVideo(inputPath, outputDir) {
  const jobs = renditions.map(rendition => {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', rendition.bitrate,
        '-maxrate', rendition.bitrate,
        '-bufsize', `${parseInt(rendition.bitrate) * 2}`,
        '-vf', `scale=${rendition.width}:${rendition.height}`,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        `${outputDir}/${rendition.name}.mp4`
      ];

      const ffmpeg = spawn('ffmpeg', args);
      ffmpeg.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}`));
      });
    });
  });

  // Run in parallel for faster processing
  await Promise.all(jobs);
}
```

---

## Adaptive Bitrate Streaming (ABR)

### The Problem ABR Solves

```
Without adaptive streaming:
┌────────────────────────────────────────────────────────────┐
│  Network: 3 Mbps available                                 │
│  Video: 4 Mbps required (1080p)                           │
│                                                            │
│  Result: ████████░░░░░░░░░ Buffer... Buffer... Buffer...  │
│                                                            │
│  User experience: Terrible. User leaves.                   │
└────────────────────────────────────────────────────────────┘

With adaptive streaming:
┌────────────────────────────────────────────────────────────┐
│  Network: 3 Mbps available                                 │
│  Video: Starts at 720p (2 Mbps)                           │
│                                                            │
│  ████████████████████████████████████████████ Smooth!      │
│                                                            │
│  Network improves to 5 Mbps?                               │
│  → Switches to 1080p automatically                         │
│                                                            │
│  Network drops to 1 Mbps?                                  │
│  → Switches to 480p (no buffering)                         │
└────────────────────────────────────────────────────────────┘
```

### HLS vs DASH

```javascript
const streamingProtocols = {
  'HLS (HTTP Live Streaming)': {
    creator: 'Apple (2009)',
    extension: '.m3u8 (playlist), .ts or .fmp4 (segments)',
    support: 'Universal (Safari native, others via hls.js)',
    segmentDuration: '2-10 seconds (6s typical)',
    encryption: 'AES-128, Sample-AES',
    pros: [
      'Universal support',
      'Battle-tested',
      'Works on all Apple devices natively'
    ],
    cons: [
      'Higher latency (15-30s typical)',
      '.ts segments are legacy format'
    ]
  },

  'DASH (Dynamic Adaptive Streaming over HTTP)': {
    creator: 'MPEG (2012)',
    extension: '.mpd (manifest), .m4s (segments)',
    support: 'Most browsers (via dash.js), not Safari native',
    segmentDuration: '2-10 seconds',
    encryption: 'Widevine, PlayReady',
    pros: [
      'Open standard',
      'More flexible',
      'Better for DRM'
    ],
    cons: [
      'No native Safari support',
      'More complex'
    ]
  }
};

// Industry trend: Use fMP4 segments for both HLS and DASH
// This is called "CMAF" - Common Media Application Format
```

### HLS Structure

```
video/
├── master.m3u8              # Master playlist (lists all qualities)
├── 1080p/
│   ├── playlist.m3u8        # Quality-specific playlist
│   ├── segment_0.ts         # 6-second video segment
│   ├── segment_1.ts
│   └── ...
├── 720p/
│   ├── playlist.m3u8
│   ├── segment_0.ts
│   └── ...
├── 480p/
│   └── ...
└── audio/
    ├── playlist.m3u8        # Audio-only track
    └── segment_0.aac
```

### Master Playlist Example

```m3u8
#EXTM3U
#EXT-X-VERSION:3

# 1080p variant
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p/playlist.m3u8

# 720p variant
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2"
720p/playlist.m3u8

# 480p variant
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480,CODECS="avc1.64001e,mp4a.40.2"
480p/playlist.m3u8

# 360p variant
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360,CODECS="avc1.640015,mp4a.40.2"
360p/playlist.m3u8
```

### Generate HLS with FFmpeg

```bash
# Generate HLS with multiple renditions
ffmpeg -i input.mp4 \
  -filter_complex \
  "[0:v]split=4[v1][v2][v3][v4]; \
   [v1]scale=1920:1080[v1out]; \
   [v2]scale=1280:720[v2out]; \
   [v3]scale=854:480[v3out]; \
   [v4]scale=640:360[v4out]" \
  -map "[v1out]" -c:v:0 libx264 -b:v:0 4M \
  -map "[v2out]" -c:v:1 libx264 -b:v:1 2M \
  -map "[v3out]" -c:v:2 libx264 -b:v:2 1M \
  -map "[v4out]" -c:v:3 libx264 -b:v:3 600k \
  -map a:0 -c:a aac -b:a 128k \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0 v:3,a:0" \
  stream_%v/playlist.m3u8
```

---

## Video Player Integration

### HLS.js for Web Playback

```javascript
import Hls from 'hls.js';

function initVideoPlayer(videoElement, manifestUrl) {
  if (Hls.isSupported()) {
    const hls = new Hls({
      // Start with lower quality for faster playback
      startLevel: -1,  // Auto-select based on bandwidth

      // Aggressive buffer management for mobile
      maxBufferLength: 30,
      maxMaxBufferLength: 60,

      // Enable ABR
      abrEwmaDefaultEstimate: 500000,  // 500 Kbps default
      abrBandWidthUpFactor: 0.7,        // Be conservative on upgrades
      abrBandWidthDownFactor: 0.9,      // Quick downgrades
    });

    hls.loadSource(manifestUrl);
    hls.attachMedia(videoElement);

    // Monitor quality switches
    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      console.log(`Quality switched to level ${data.level}`);
      console.log(`Resolution: ${hls.levels[data.level].width}x${hls.levels[data.level].height}`);
    });

    // Handle errors
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();  // Try to recover
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });

    return hls;
  } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS support
    videoElement.src = manifestUrl;
  }
}

// Usage
const video = document.getElementById('my-video');
initVideoPlayer(video, 'https://cdn.example.com/videos/abc123/master.m3u8');
```

---

## Encoding Quality Ladder

### Bitrate Recommendations

```javascript
// Netflix-style quality ladder
const qualityLadder = [
  // Resolution  | Bitrate     | Use Case
  { resolution: '2160p', bitrate: '15-25 Mbps', use: '4K TVs, high-end devices' },
  { resolution: '1080p', bitrate: '4-8 Mbps',   use: 'Desktop, tablets, Smart TVs' },
  { resolution: '720p',  bitrate: '2-4 Mbps',   use: 'Mobile on WiFi' },
  { resolution: '480p',  bitrate: '1-2 Mbps',   use: 'Mobile on 4G' },
  { resolution: '360p',  bitrate: '600k-1 Mbps',use: 'Mobile on 3G' },
  { resolution: '240p',  bitrate: '400-600 Kbps',use: 'Very slow connections' }
];

// Instagram-specific (mobile-optimized)
const instagramLadder = [
  { resolution: '1080p', bitrate: '4 Mbps',   use: 'Reels, full-screen' },
  { resolution: '720p',  bitrate: '2 Mbps',   use: 'Feed video' },
  { resolution: '480p',  bitrate: '1 Mbps',   use: 'Low bandwidth' },
  { resolution: '360p',  bitrate: '600 Kbps', use: 'Data saver mode' }
];
```

### Per-Title Encoding

```javascript
// Smart bitrate allocation based on content complexity

async function analyzeVideoComplexity(inputPath) {
  // Analyze motion, detail level, scene changes
  const analysis = await runFFProbe(inputPath);

  return {
    motionLevel: analysis.motionLevel,  // 0-1
    detailLevel: analysis.detailLevel,  // 0-1
    recommendedBitrate: calculateBitrate(analysis)
  };
}

function calculateBitrate(analysis) {
  const baseBitrate = 4000000;  // 4 Mbps base for 1080p

  // Adjust based on content
  // - High motion (sports, action) needs more bitrate
  // - Low motion (talking head) needs less
  const motionMultiplier = 0.7 + (analysis.motionLevel * 0.6);

  // - High detail (nature, textures) needs more bitrate
  // - Low detail (animation, graphics) needs less
  const detailMultiplier = 0.8 + (analysis.detailLevel * 0.4);

  return Math.round(baseBitrate * motionMultiplier * detailMultiplier);
}

// Result:
// Talking head video: 2.5 Mbps (adequate)
// Sports highlight: 5.5 Mbps (needs more to avoid blur)
// Animation: 2 Mbps (simple content)
```

---

## Performance Metrics

### Transcoding Speed Comparison

| Codec | Encoding Speed | Quality/Size | Hardware Acceleration |
|-------|----------------|--------------|----------------------|
| **H.264** | Fast (1x) | Baseline | NVENC, QSV, VideoToolbox |
| **H.265** | Slow (0.3x) | 50% smaller | NVENC, QSV, VideoToolbox |
| **VP9** | Slow (0.2x) | 40% smaller | Limited |
| **AV1** | Very Slow (0.05x) | 60% smaller | Growing (SVT-AV1 faster) |

### Hardware vs Software Encoding

```javascript
const encodingComparison = {
  software: {
    tool: 'libx264, libx265',
    speed: '~30 fps for 1080p',
    quality: 'Best',
    cost: 'High CPU usage',
    use: 'Offline processing, best quality'
  },

  nvidia: {
    tool: 'NVENC',
    speed: '~200 fps for 1080p',
    quality: '~95% of software',
    cost: 'GPU required',
    use: 'Real-time, high volume'
  },

  intel: {
    tool: 'QuickSync (QSV)',
    speed: '~150 fps for 1080p',
    quality: '~90% of software',
    cost: 'Intel CPU required',
    use: 'Cloud encoding (c5, m5 instances)'
  },

  apple: {
    tool: 'VideoToolbox',
    speed: '~180 fps for 1080p',
    quality: '~95% of software',
    cost: 'macOS/iOS only',
    use: 'On-device processing'
  }
};

// FFmpeg with hardware acceleration:
// NVIDIA: ffmpeg -i input.mp4 -c:v h264_nvenc -preset p4 output.mp4
// Intel:  ffmpeg -i input.mp4 -c:v h264_qsv -preset medium output.mp4
// Apple:  ffmpeg -i input.mp4 -c:v h264_videotoolbox output.mp4
```

---

## Quick Win: Transcode Your First Video in 5 Minutes

### Using FFmpeg

```bash
# 1. Install FFmpeg
# macOS: brew install ffmpeg
# Ubuntu: apt install ffmpeg
# Windows: choco install ffmpeg

# 2. Basic transcoding (single quality)
ffmpeg -i input.mov \
  -c:v libx264 \
  -preset fast \
  -crf 23 \
  -c:a aac \
  -b:a 128k \
  -movflags +faststart \
  output.mp4

# 3. Create HLS for streaming
ffmpeg -i input.mov \
  -c:v libx264 -crf 23 \
  -c:a aac -b:a 128k \
  -f hls \
  -hls_time 6 \
  -hls_list_size 0 \
  output.m3u8

# 4. Test playback
# Open output.m3u8 in VLC or use hls.js
```

### Using Node.js + Fluent-FFmpeg

```javascript
const ffmpeg = require('fluent-ffmpeg');

ffmpeg('input.mov')
  .videoCodec('libx264')
  .audioCodec('aac')
  .outputOptions([
    '-preset fast',
    '-crf 23',
    '-movflags +faststart'
  ])
  .on('progress', (progress) => {
    console.log(`Processing: ${progress.percent}%`);
  })
  .on('end', () => {
    console.log('Transcoding finished!');
  })
  .save('output.mp4');
```

---

## Key Takeaways

**What you learned:**
- Containers (MP4) hold codecs (H.264)—they're separate concerns
- H.264 is universal; AV1 is the future
- Adaptive bitrate streaming serves the right quality for each user's network
- HLS is the de-facto standard for video delivery

**Codec decision tree:**
```
Need universal support?
  └─ Yes → H.264 in MP4
  └─ No → Is AV1 hardware decoding available?
            └─ Yes → AV1 (best compression)
            └─ No → VP9 (good compression, wide support)
```

**Quick reference:**
```
Bitrate recommendations (1080p):
- High motion (sports): 6-8 Mbps
- Medium motion (vlogs): 4-5 Mbps
- Low motion (tutorials): 2-3 Mbps
- Screencasts: 1-2 Mbps
```

---

## What's Next?

Now you understand video codecs and transcoding. Next, learn about storing all this content efficiently:

**Next Article:** [Object Storage at Scale](/interview-prep/system-design/instagram-assets-series/prereq-object-storage) — S3, blob storage, tiered storage, and handling petabytes of media.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
