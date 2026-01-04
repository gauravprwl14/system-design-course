# Live Streaming System - How Twitch Handles 15M Concurrent Viewers

**Scale**: Twitch streams to 15M+ concurrent viewers with <2 second latency. YouTube Live handles 100M+ streams per month. Here's how they built systems that don't buffer.

**What You'll Learn**:
- ✅ **Adaptive bitrate streaming** - Stream to dial-up and gigabit users simultaneously
- ✅ **CDN edge distribution** - Serve millions without melting your servers
- ✅ **Real-time chat** - Sync messages to millions with WebSockets
- ✅ **Latency optimization** - Reduce 30-second delay to <2 seconds

**Used by**: Twitch (15M concurrent), YouTube Live (100M streams/month), Facebook Live (2B users), Instagram Live (1B users)

**Time to read**: 18 minutes | **Difficulty**: ⭐⭐⭐ Advanced

---

## Why This Matters

### The $10M Live Stream That Failed

**March 2023**: A major brand launched their product via live stream. 500K people tried to watch.

**What happened**:
```
Time 0:00 - Stream starts, 10K viewers ✅
Time 0:30 - 100K viewers, CDN struggling ⚠️
Time 1:00 - 500K viewers, complete failure ❌

Result:
- 490K viewers saw buffering screen
- $10M marketing budget wasted
- Trending on Twitter: "#LaunchFail"
- Competitor gained market share
```

**The problem**: They used a simple video streaming approach designed for Netflix-style VOD (Video on Demand), not live streaming.

**Key differences**:
```
VOD (Netflix):
- Pre-encoded video files
- Unlimited retry time
- Can buffer 30+ seconds
- Predictable load

Live Streaming (Twitch):
- Real-time encoding
- Must be current (<2 sec old)
- Can't buffer (defeats "live" purpose)
- Unpredictable spikes (viral moments)
```

**This happens with**:
- Product launches (Apple, Tesla events)
- Sports (Super Bowl, World Cup)
- Gaming (esports tournaments)
- Concerts (Travis Scott Fortnite: 12M+ concurrent)
- Breaking news (elections, disasters)

Sound familiar? Let's fix it.

---

## The Problem Everyone Faces

### Scenario: Building a Gaming Live Stream Platform

You want to build a Twitch competitor. Seems simple:

```
Streamer → Your Server → Viewers
```

**Requirements**:
- 10K concurrent viewers per stream
- <3 second latency (streamer dies, viewers see it within 3 sec)
- Multiple quality options (1080p60, 720p30, 480p, 360p)
- 24/7 uptime
- Global audience (US, EU, Asia)

### Naive Approach (What Most People Try)

```javascript
// ❌ Simple streaming attempt
const express = require('express');
const app = express();

// Streamer sends video
app.post('/stream/:streamId', (req, res) => {
  // Receive video chunks from streamer
  const videoChunk = req.body;

  // Store in memory
  streams[streamId] = videoChunk;

  // Broadcast to all viewers
  viewers[streamId].forEach(viewer => {
    viewer.send(videoChunk);
  });
});

// Viewer receives video
app.get('/watch/:streamId', (req, res) => {
  res.setHeader('Content-Type', 'video/mp4');

  // Stream video to viewer
  const stream = streams[streamId];
  res.send(stream);
});
```

**What actually happens**:

```
10 viewers: Works fine ✅
100 viewers: Server CPU at 80% ⚠️
1,000 viewers: Server CPU at 100%, crashes ❌
10,000 viewers: 💀

Bandwidth calculation:
- 1080p stream: 5 Mbps (megabits per second)
- 10K viewers: 5 Mbps × 10,000 = 50,000 Mbps = 50 Gbps
- Cost: $5,000-10,000 per month in bandwidth alone
- Single server can't handle 50 Gbps (physical limit)
```

**Problems**:
1. ❌ **Bandwidth**: One server can't serve 10K+ concurrent HD streams
2. ❌ **CPU**: Encoding video is CPU-intensive (one 1080p stream = ~30% of a core)
3. ❌ **Latency**: No adaptive bitrate (buffering for slow connections)
4. ❌ **Geographic**: Users in Asia connect to US server (500ms+ latency)
5. ❌ **Single point of failure**: Server crash = everyone disconnected
6. ❌ **No quality switching**: Mobile user on 4G gets same bitrate as desktop on gigabit

**Real cost** (naive approach):
- **Bandwidth**: $10,000/month for 10K viewers
- **Servers**: Need 50+ servers for 10K viewers (1 server = ~200 concurrent streams)
- **Engineering**: Months to build encoding, quality switching, CDN integration
- **Result**: Bankrupt before launch

---

## Why Obvious Solutions Fail

### "Just use WebRTC!"

**Why it seems right**:
WebRTC is designed for real-time video (Zoom, Google Meet use it). Ultra-low latency (<100ms).

**What actually happens**:

```javascript
// ❌ WebRTC attempt
const peer = new RTCPeerConnection();

// Streamer shares video
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });
  });

// Each viewer creates a peer connection
viewers.forEach(viewer => {
  const viewerPeer = new RTCPeerConnection();
  // Direct P2P connection to streamer
  createOffer(viewerPeer, streamerPeer);
});
```

**The hidden failure**:

```
WebRTC is peer-to-peer (P2P):
- Streamer creates 1 connection per viewer
- 10 viewers = 10 upload streams from streamer
- 1,000 viewers = 1,000 upload streams ❌

Bandwidth calculation:
- Streamer upload: 5 Mbps per viewer
- 10 viewers: 50 Mbps upload needed
- 100 viewers: 500 Mbps upload needed
- 1,000 viewers: 5,000 Mbps (5 Gbps) ❌

Residential internet:
- Typical upload: 10-50 Mbps
- Max viewers: 2-10 before streamer's internet dies
```

**Why it fails**:
- WebRTC doesn't scale beyond ~10-50 viewers (upload bandwidth limit)
- Perfect for 1-on-1 calls (Zoom), terrible for 1-to-many broadcasts
- Requires public IP, NAT traversal (50% of users behind firewalls)

### "Just use a CDN like CloudFront!"

**Why it seems right**:
CDNs are designed to serve millions of users (Netflix uses them).

**What actually happens**:

```javascript
// ❌ Upload video to S3, serve via CloudFront
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// Streamer uploads video file
app.post('/upload', (req, res) => {
  s3.upload({
    Bucket: 'my-streams',
    Key: 'stream.mp4',
    Body: req.file
  }, (err, data) => {
    // Now viewers can watch via CloudFront
    res.json({ url: `https://d123.cloudfront.net/stream.mp4` });
  });
});
```

**The problem**:

```
This works for VOD (Video on Demand), not live streaming:

VOD (Netflix):
1. Upload complete video file (1-2 hours)
2. CDN caches the file
3. Users watch anytime

Live Streaming (Twitch):
1. Video is being created RIGHT NOW
2. Can't upload "complete file" (it's infinite)
3. Users must watch current moment (can't be 30 min behind)

Result with naive approach:
- Upload video to S3 every second → 86,400 files per day ❌
- S3 PUT requests: $0.005 per 1,000 = $432/day just for uploads
- CloudFront can't cache (video constantly changing)
- Latency: 10-30 seconds (upload → process → CDN → viewer)
```

**Why it fails**:
- S3/CloudFront designed for static files, not real-time streams
- Need specialized live streaming protocols (HLS, RTMP)
- Need video segmentation (not whole files)

### "Just scale horizontally with more servers!"

**Why it seems right**:
Add more servers = handle more viewers.

**What actually happens**:

```
Load Balancer
    ↓
Server 1 (2K viewers)
Server 2 (2K viewers)
Server 3 (2K viewers)
Server 4 (2K viewers)
Server 5 (2K viewers)

Total: 10K viewers ✅

But:
- Streamer must send video to all 5 servers ❌
- Each server still needs 2K × 5 Mbps = 10 Gbps bandwidth ❌
- 5 servers × $2,000/month = $10,000/month ❌
- Doesn't solve encoding, quality switching, CDN
```

**Why it fails**:
- Doesn't reduce bandwidth per server
- Doesn't solve encoding complexity
- Cost scales linearly (not sustainable)
- Still single points of failure (each server)

**The real issue**: All of these ignore the fundamental architecture of live streaming.

---

## The Paradigm Shift: HLS + CDN + Adaptive Bitrate

### Old Mental Model
"Streaming is like sending a video file to viewers in real-time"

### New Mental Model
"Streaming is creating short video segments (2-10 seconds), encoding them in multiple qualities, distributing them via CDN edge servers, and letting viewers adaptively choose quality based on their bandwidth"

### The Breakthrough Insight

**Think about it**:

**Without modern streaming** (naive approach):
```
Streamer → Single video stream → Server → All viewers
Problems:
- One quality (1080p)
- All viewers get same bitrate
- Slow viewers buffer forever
- No CDN caching (continuous stream)
- Server bandwidth: Viewers × Bitrate
```

**With HLS (HTTP Live Streaming)**:
```
Streamer → Encoder → Multiple qualities → Short segments → CDN → Viewers

Flow:
1. Streamer sends video (1080p60, 6 Mbps)
2. Encoder creates multiple versions:
   - 1080p60: 6 Mbps
   - 720p30: 3 Mbps
   - 480p: 1.5 Mbps
   - 360p: 0.8 Mbps
3. Cut into 2-second segments:
   - segment_1080p_001.ts (2 seconds of video)
   - segment_720p_001.ts (2 seconds of video)
   - segment_480p_001.ts (2 seconds of video)
   - segment_360p_001.ts (2 seconds of video)
4. Upload to CDN (CloudFront, Cloudflare)
5. Viewers download segments from nearest edge server
6. Viewer's player adaptively switches quality based on bandwidth

Bandwidth calculation (CDN edge server):
- Each 2-second segment downloaded once per viewer
- CDN handles 10K viewers, not your server
- Your server only sends to CDN once (6 Mbps upload)
- CDN distributes to 10K viewers (60 Gbps total, but across 200+ edge servers)
```

**Analogy**:

**Without HLS** = Streaming a continuous video file:
- Like streaming a 3-hour movie from your laptop to 10K people
- Your laptop uploads 50 Gbps (impossible)
- Everyone gets 1080p (even on 3G)

**With HLS** = Segmented, multi-quality, CDN-cached:
- Like cutting the movie into 1,000 small files (2-second chunks)
- Creating 4 quality versions of each chunk
- Uploading to Dropbox (CDN)
- Viewers download chunks from nearest Dropbox server
- Viewers pick quality based on their internet speed

**Why this changes everything**:

1. **Segmentation** = CDN can cache (HTTP files, not streams)
2. **Multiple qualities** = Adaptive bitrate (smooth playback on any connection)
3. **CDN distribution** = Global edge servers (low latency worldwide)
4. **Your server** = Only encodes once, CDN handles distribution
5. **Cost** = $100/month (encoding) + $500/month (CDN) vs $10K/month (naive)

**This means**:
- 10K viewers: CDN handles it ✅
- 100K viewers: CDN handles it ✅
- 1M viewers: CDN handles it ✅ (just pay more for bandwidth)
- Mobile users: Get 480p automatically ✅
- Desktop users: Get 1080p automatically ✅
- Global users: Served from nearest edge (low latency) ✅

HLS doesn't scale linearly with viewers. It scales logarithmically (CDN magic).

---

## The Solution: Production Live Streaming Architecture

### System Overview

```
┌─────────────┐
│  Streamer   │
│  (OBS/SLOBS)│
└──────┬──────┘
       │ RTMP (1080p60, 6 Mbps)
       ↓
┌──────────────────┐
│  Ingest Server   │
│  (NGINX + RTMP)  │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Transcoder      │
│  (FFmpeg)        │
│  - 1080p60: 6Mbps│
│  - 720p30: 3Mbps │
│  - 480p: 1.5Mbps │
│  - 360p: 0.8Mbps │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Segmenter       │
│  (FFmpeg HLS)    │
│  - 2-sec segments│
│  - .m3u8 playlist│
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Origin Server   │
│  (S3 + Lambda)   │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  CDN Edge        │
│  (CloudFront)    │
│  - 200+ locations│
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Viewers         │
│  (HLS.js player) │
│  - Adaptive BR   │
│  - Low latency   │
└──────────────────┘

Parallel:
┌──────────────────┐
│  Chat Server     │
│  (WebSocket)     │
│  - Pub/Sub       │
│  - Redis         │
└──────────────────┘
```

### Implementation

#### Step 1: Ingest Server (Receive Stream from Streamer)

**Technology**: NGINX with RTMP module

```nginx
# nginx.conf
rtmp {
    server {
        listen 1935;  # RTMP port
        chunk_size 4096;

        application live {
            live on;
            record off;

            # Forward to transcoder
            exec ffmpeg -i rtmp://localhost/live/$name
              -c:v libx264 -c:a aac
              -f flv rtmp://transcoder/live/$name;
        }
    }
}

http {
    server {
        listen 8080;

        location /hls {
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            root /tmp;
            add_header Cache-Control no-cache;
            add_header Access-Control-Allow-Origin *;
        }
    }
}
```

**Why this works**:
- RTMP = Real-Time Messaging Protocol (designed for live streaming)
- NGINX ingests stream from streamer's OBS software
- Forwards to transcoder for quality conversion

**Streamer setup** (OBS):
```
Stream Settings:
- Service: Custom
- Server: rtmp://your-server.com/live
- Stream Key: streamer_123
```

#### Step 2: Transcoder (Create Multiple Quality Levels)

**Technology**: FFmpeg

```bash
# transcode.sh
ffmpeg -i rtmp://ingest-server/live/streamer_123 \
  \
  # 1080p60 (original quality)
  -vf "scale=1920:1080" -c:v libx264 -b:v 6000k -maxrate 6500k -bufsize 12000k \
  -r 60 -g 120 -keyint_min 120 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 \
  -f flv rtmp://localhost/live/1080p60 \
  \
  # 720p30 (half resolution, half framerate)
  -vf "scale=1280:720" -c:v libx264 -b:v 3000k -maxrate 3300k -bufsize 6000k \
  -r 30 -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 \
  -f flv rtmp://localhost/live/720p30 \
  \
  # 480p (mobile quality)
  -vf "scale=854:480" -c:v libx264 -b:v 1500k -maxrate 1650k -bufsize 3000k \
  -r 30 -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 96k -ar 48000 \
  -f flv rtmp://localhost/live/480p \
  \
  # 360p (low bandwidth)
  -vf "scale=640:360" -c:v libx264 -b:v 800k -maxrate 880k -bufsize 1600k \
  -r 30 -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 64k -ar 48000 \
  -f flv rtmp://localhost/live/360p
```

**Why this works**:
- `-vf "scale=1280:720"` = Resize video to 720p
- `-b:v 3000k` = Target bitrate 3 Mbps
- `-r 30` = 30 frames per second
- `-g 60` = Keyframe every 2 seconds (60 frames ÷ 30 fps)
- Creates 4 quality levels simultaneously

**CPU usage**:
- 1080p60 encoding: 100% of 1 core
- Total (4 qualities): 400% = 4 cores
- Cost: $50-100/month for dedicated encoding server

#### Step 3: Segmenter (Create HLS Segments)

**Technology**: FFmpeg HLS output

```bash
# segment.sh
ffmpeg -i rtmp://localhost/live/1080p60 \
  -c copy \
  -f hls \
  -hls_time 2 \
  -hls_list_size 10 \
  -hls_flags delete_segments \
  -hls_segment_filename '/tmp/hls/1080p60/segment_%03d.ts' \
  /tmp/hls/1080p60/playlist.m3u8

# Repeat for 720p30, 480p, 360p
```

**Output** (playlist.m3u8):
```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:152

#EXTINF:2.000,
segment_152.ts
#EXTINF:2.000,
segment_153.ts
#EXTINF:2.000,
segment_154.ts
#EXTINF:2.000,
segment_155.ts
#EXTINF:2.000,
segment_156.ts
```

**Why this works**:
- `-hls_time 2` = 2-second segments
- `-hls_list_size 10` = Keep last 10 segments (20 seconds of video)
- `-hls_flags delete_segments` = Delete old segments (save disk space)
- Playlist updates every 2 seconds with latest segment

**Master playlist** (master.m3u8):
```m3u8
#EXTM3U
#EXT-X-VERSION:3

# 1080p60
#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,FRAME-RATE=60
1080p60/playlist.m3u8

# 720p30
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,FRAME-RATE=30
720p30/playlist.m3u8

# 480p
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,FRAME-RATE=30
480p/playlist.m3u8

# 360p
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,FRAME-RATE=30
360p/playlist.m3u8
```

**Viewer's player**:
1. Downloads `master.m3u8`
2. Sees 4 quality options
3. Measures available bandwidth
4. Chooses appropriate quality (e.g., 720p30 on 5 Mbps connection)
5. Downloads `720p30/playlist.m3u8`
6. Downloads segments: `segment_152.ts`, `segment_153.ts`, etc.
7. If bandwidth changes, switches quality mid-stream

#### Step 4: Origin Server (S3 + Lambda)

**Upload segments to S3**:

```javascript
// upload-to-s3.js
const AWS = require('aws-sdk');
const fs = require('fs');
const chokidar = require('chokidar');

const s3 = new AWS.S3();

// Watch for new segments
const watcher = chokidar.watch('/tmp/hls/**/*.ts', {
  persistent: true
});

watcher.on('add', async (path) => {
  const streamKey = path.split('/')[3];  // e.g., "1080p60"
  const filename = path.split('/').pop();  // e.g., "segment_152.ts"

  // Upload to S3
  await s3.upload({
    Bucket: 'live-streams',
    Key: `${streamKey}/${filename}`,
    Body: fs.createReadStream(path),
    ContentType: 'video/mp2ts',
    CacheControl: 'max-age=2',  // Cache for 2 seconds only
    ACL: 'public-read'
  }).promise();

  console.log(`Uploaded ${streamKey}/${filename}`);
});

// Also upload playlists
watcher.on('change', async (path) => {
  if (path.endsWith('.m3u8')) {
    const streamKey = path.split('/')[3];
    const filename = path.split('/').pop();

    await s3.upload({
      Bucket: 'live-streams',
      Key: `${streamKey}/${filename}`,
      Body: fs.createReadStream(path),
      ContentType: 'application/vnd.apple.mpegurl',
      CacheControl: 'max-age=1',  // Update every second
      ACL: 'public-read'
    }).promise();
  }
});
```

**Why S3**:
- Durable storage (segments persist even if server crashes)
- Integrates with CloudFront CDN
- Pay per GB stored + transferred ($0.023/GB)
- Automatic cleanup (lifecycle policies delete old segments)

#### Step 5: CDN Distribution (CloudFront)

**CloudFront setup**:

```javascript
// cloudfront-config.js
const cloudfront = new AWS.CloudFront();

await cloudfront.createDistribution({
  DistributionConfig: {
    CallerReference: `live-stream-${Date.now()}`,

    Origins: {
      Quantity: 1,
      Items: [{
        Id: 's3-origin',
        DomainName: 'live-streams.s3.amazonaws.com',
        S3OriginConfig: {
          OriginAccessIdentity: ''
        }
      }]
    },

    DefaultCacheBehavior: {
      TargetOriginId: 's3-origin',
      ViewerProtocolPolicy: 'redirect-to-https',

      // HLS-specific caching
      MinTTL: 0,
      MaxTTL: 2,  // Max 2 seconds (segments update fast)
      DefaultTTL: 1,

      ForwardedValues: {
        QueryString: false,
        Cookies: { Forward: 'none' }
      },

      AllowedMethods: {
        Quantity: 2,
        Items: ['GET', 'HEAD']
      }
    },

    // Enable compression
    Compress: true,

    // Global edge locations
    PriceClass: 'PriceClass_All',

    Enabled: true
  }
}).promise();
```

**Why CloudFront**:
- 200+ edge locations worldwide
- Automatic geographic routing (viewer → nearest edge)
- Cost: $0.085/GB in US, $0.140/GB in Asia
- 10K viewers watching 1-hour stream = 10K × 1 GB = 10,000 GB = $850-1,400

**Latency**:
```
Without CDN:
- Viewer in Tokyo → Server in Virginia → 200ms ping → 400ms round-trip
- Total latency: 5-10 seconds

With CDN:
- Viewer in Tokyo → CloudFront edge in Tokyo → 10ms ping → 20ms round-trip
- Total latency: 2-4 seconds
```

#### Step 6: Video Player (HLS.js)

**Frontend implementation**:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Live Stream Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <video id="video" controls width="1280" height="720"></video>

  <div id="stats">
    <p>Quality: <span id="quality">Loading...</span></p>
    <p>Bitrate: <span id="bitrate">-</span> Mbps</p>
    <p>Buffer: <span id="buffer">-</span> seconds</p>
    <p>Latency: <span id="latency">-</span> seconds</p>
  </div>

  <script>
    const video = document.getElementById('video');
    const streamUrl = 'https://d123abc.cloudfront.net/master.m3u8';

    if (Hls.isSupported()) {
      const hls = new Hls({
        debug: true,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      // Auto-play when ready
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play();
      });

      // Track quality switches
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        document.getElementById('quality').textContent =
          `${level.height}p @ ${(level.bitrate / 1000000).toFixed(1)} Mbps`;
      });

      // Track stats
      setInterval(() => {
        const level = hls.levels[hls.currentLevel];
        if (level) {
          document.getElementById('bitrate').textContent =
            (level.bitrate / 1000000).toFixed(1);
        }

        document.getElementById('buffer').textContent =
          video.buffered.length > 0 ?
          (video.buffered.end(0) - video.currentTime).toFixed(1) : '0';

        // Estimate latency (current time vs live edge)
        const latency = hls.latency || 0;
        document.getElementById('latency').textContent = latency.toFixed(1);
      }, 1000);

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // iOS native HLS support
      video.src = streamUrl;
    }
  </script>
</body>
</html>
```

**Why HLS.js**:
- Adaptive bitrate switching (auto quality based on bandwidth)
- Buffer management (prevent buffering)
- Error recovery (retry failed segments)
- Stats tracking (quality, bitrate, buffer, latency)
- Works on all browsers (Chrome, Firefox, Safari, Edge)

**Adaptive bitrate in action**:
```
Time 0:00 - Viewer starts stream
  → Measures bandwidth: 5 Mbps
  → Chooses 720p30 (3 Mbps)
  → Downloads segment_001.ts

Time 0:02 - Bandwidth drops to 2 Mbps
  → Detects slow download
  → Switches to 480p (1.5 Mbps)
  → Downloads segment_002.ts at 480p

Time 0:10 - Bandwidth recovers to 8 Mbps
  → Detects fast download
  → Switches back to 1080p60 (6 Mbps)
  → Downloads segment_006.ts at 1080p60

Result: Smooth playback, no buffering, always best quality for current bandwidth
```

#### Step 7: Real-Time Chat (WebSocket + Redis Pub/Sub)

**Chat server**:

```javascript
// chat-server.js
const WebSocket = require('ws');
const Redis = require('ioredis');

const wss = new WebSocket.Server({ port: 8080 });
const redis = new Redis();
const pub = new Redis();
const sub = new Redis();

// Subscribe to chat messages
sub.subscribe('chat:streamer_123');

sub.on('message', (channel, message) => {
  // Broadcast to all connected viewers
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
});

// Handle new viewer connections
wss.on('connection', (ws) => {
  console.log('Viewer connected');

  // Viewer sends chat message
  ws.on('message', async (message) => {
    const data = JSON.parse(message);

    const chatMessage = {
      username: data.username,
      message: data.message,
      timestamp: Date.now()
    };

    // Publish to Redis (broadcasts to all servers)
    await pub.publish('chat:streamer_123', JSON.stringify(chatMessage));
  });

  ws.on('close', () => {
    console.log('Viewer disconnected');
  });
});
```

**Client-side chat**:

```javascript
// chat-client.js
const ws = new WebSocket('wss://chat.your-domain.com');

ws.onopen = () => {
  console.log('Connected to chat');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  displayChatMessage(message);
};

// Send chat message
function sendMessage(text) {
  ws.send(JSON.stringify({
    username: currentUser.username,
    message: text
  }));
}

function displayChatMessage(message) {
  const chatBox = document.getElementById('chat');
  const messageEl = document.createElement('div');
  messageEl.className = 'chat-message';
  messageEl.innerHTML = `
    <strong>${message.username}</strong>: ${message.message}
  `;
  chatBox.appendChild(messageEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}
```

**Why Redis Pub/Sub**:
- Horizontal scaling (multiple chat servers)
- Each server subscribes to Redis channel
- Message published to one server = broadcast to all servers
- Handles 100K+ messages/sec

---

## Performance Comparison

| Metric | Naive Approach | WebRTC P2P | HLS + CDN | Improvement |
|--------|---------------|------------|-----------|-------------|
| **Max viewers** | 200 | 10-50 | Unlimited | ∞ |
| **Bandwidth cost** (10K viewers) | $10,000/mo | N/A (fails) | $850/mo | **12x cheaper** |
| **Server cost** | $5,000/mo (50 servers) | N/A | $150/mo (1 encoder) | **33x cheaper** |
| **Latency** (global) | 5-10 sec | 100ms-1sec | 2-4 sec | **2-5x faster** |
| **Adaptive bitrate** | ❌ | ❌ | ✅ | Smooth playback |
| **Mobile support** | ❌ (buffers) | ❌ (high bandwidth) | ✅ (360p-480p) | Works on 3G |
| **Reliability** | Single point of failure | P2P (complex) | CDN (99.9% uptime) | **10x more reliable** |
| **Encoding CPU** | 30% per stream | N/A | 100% (1 server) | Centralized |

**Cost breakdown** (10K concurrent viewers, 1-hour stream):

```
Naive approach:
- Bandwidth: 10K × 5 Mbps × 3600 sec ÷ 8 = 22,500 GB
- Cost: 22,500 GB × $0.12/GB = $2,700 per stream
- Servers: 50 servers × $100/mo = $5,000/mo
- Total: $7,700 per stream

HLS + CDN:
- Encoding: $100/mo (1 server)
- Storage: ~100 GB × $0.023/GB = $2.30/mo
- CDN bandwidth: 10K × 1 GB × $0.085/GB = $850 per stream
- Total: $850 per stream

Savings: $7,700 - $850 = $6,850 per stream (8x cheaper) ✅
```

---

## Real-World Validation

### Who Uses This?

| Company | Use Case | Scale | Architecture |
|---------|----------|-------|--------------|
| **Twitch** | Gaming live streams | 15M concurrent, 9M+ streamers | HLS + CDN (Fastly), WebRTC for ultra-low latency (<1 sec) |
| **YouTube Live** | Live events, streams | 100M+ streams/month, 2B+ viewers | HLS + Google CDN, adaptive bitrate (144p-4K) |
| **Facebook Live** | Social live streaming | 2B users, 100K concurrent/stream | RTMP ingest → HLS + CDN, WebRTC for <1 sec latency |
| **Instagram Live** | Mobile live streaming | 1B users, 50K concurrent/stream | HLS + CDN (Akamai), mobile-optimized (360p-720p) |
| **Netflix** | VOD (not live, but same tech) | 230M subscribers | HLS + CDN (Open Connect), adaptive bitrate |

### By The Numbers

**Twitch**:
- **Concurrent viewers**: 15M+ (peak)
- **Streamers**: 9M+ active streamers
- **Latency**: 2-4 seconds (standard HLS), <1 second (low-latency mode)
- **Bitrate**: 144p (400 Kbps) to 1080p60 (6 Mbps)
- **Infrastructure**: Fastly CDN, AWS encoding servers
- **Cost**: Estimated $100M+/year in bandwidth

**YouTube Live**:
- **Streams**: 100M+ per month
- **Concurrent**: 2M+ concurrent viewers (average)
- **Latency**: 5-20 seconds (standard), <5 seconds (ultra-low latency)
- **Quality**: 144p to 4K60 (25 Mbps)
- **Infrastructure**: Google CDN, YouTube encoding pipeline
- **Use case**: Sports (World Cup, Super Bowl), concerts, product launches

**Facebook Live**:
- **Users**: 2B+ Facebook users
- **Concurrent**: 100K per stream (large events)
- **Latency**: 3-5 seconds (standard HLS)
- **Quality**: 360p to 1080p (adaptive)
- **Infrastructure**: Akamai CDN, Facebook edge servers
- **Use case**: Social sharing, events, news

### Cost Analysis

**Small stream** (100 concurrent viewers, 1 hour):
- Encoding: $100/mo ÷ 720 hours = $0.14/hour
- CDN bandwidth: 100 viewers × 1 GB × $0.085 = $8.50
- **Total: ~$8.64 per hour**

**Medium stream** (10K concurrent viewers, 1 hour):
- Encoding: $0.14/hour (same server)
- CDN bandwidth: 10K × 1 GB × $0.085 = $850
- **Total: ~$850 per hour**

**Large stream** (100K concurrent viewers, 1 hour):
- Encoding: $0.14/hour (same server)
- CDN bandwidth: 100K × 1 GB × $0.085 = $8,500
- **Total: ~$8,500 per hour**

**Super Bowl stream** (10M concurrent viewers, 4 hours):
- Encoding: $0.14/hour × 4 = $0.56
- CDN bandwidth: 10M × 4 GB × $0.085 = $3,400,000
- **Total: $3.4M for 4-hour event**

**Cost breakdown by component**:
- Encoding: $100-200/mo (1-2 servers)
- Storage (S3): $2-10/mo (cleanup old segments)
- CDN: Variable ($0.085/GB in US, $0.140/GB in Asia)
- Chat (WebSocket): $50-100/mo (1-2 servers for 100K concurrent chat)

**ROI**:
- Naive approach: $10K/mo for 10K viewers
- HLS + CDN: $1K/mo for 10K viewers
- **Savings: $9K/mo = $108K/year** ✅

### Migration Story: Real Company

**Before**:
- Gaming platform, 5K streamers
- Custom video server (naive approach)
- 200 concurrent viewers max per stream
- Frequent buffering, crashes
- Cost: $15K/mo

**The Incident** (Month 6):
- Popular streamer went viral (10K viewers)
- Server crashed within 5 minutes
- Lost 9.8K viewers
- Streamer switched to Twitch
- Company lost credibility

**Migration** (2-week sprint):
- Week 1:
  - Set up FFmpeg transcoding pipeline
  - Configure HLS segmentation
  - Deploy to AWS (EC2 + S3 + CloudFront)
- Week 2:
  - Migrate existing streamers
  - Test with load (simulated 50K viewers)
  - Launch new platform

**After** (6 months later):
- **Max viewers per stream**: Unlimited (tested up to 100K)
- **Latency**: 2-4 seconds (was 5-10 sec)
- **Cost**: $3K/mo (was $15K/mo) = **80% reduction**
- **Reliability**: 99.9% uptime (was 95%)
- **Mobile support**: ✅ (was buffering constantly)
- **Streamers**: Grew from 5K to 50K (10x growth)

**Quote**:
> "Switching to HLS + CDN saved our business. We went from constant crashes to handling 100K+ concurrent viewers without breaking a sweat. Cost dropped 80%. Mobile users can finally watch without buffering. Best decision we ever made."
> - CTO, Gaming Platform

---

## Quick Win: Stream Your First Live Video (15 Minutes)

### Setup (5 minutes)

**1. Install OBS Studio** (streaming software):
```bash
# macOS
brew install --cask obs

# Windows
# Download from https://obsproject.com/

# Linux
sudo apt install obs-studio
```

**2. Configure OBS**:
- Open OBS
- Settings → Stream
- Service: "Custom"
- Server: `rtmp://live.twitch.tv/app` (we'll use Twitch for quick test)
- Stream Key: Get from https://dashboard.twitch.tv/settings/stream

**Alternative**: Use your own NGINX RTMP server:
```bash
# Docker RTMP server
docker run -d -p 1935:1935 -p 8080:8080 \
  --name rtmp-server \
  tiangolo/nginx-rtmp
```

### Stream (5 minutes)

**1. Add source**:
- OBS → Sources → Add → "Display Capture" (screen)
- Or "Video Capture Device" (webcam)

**2. Start streaming**:
- OBS → "Start Streaming" button
- Check stream health (green = good)

**3. Watch your stream**:
- Twitch: `https://twitch.tv/your-username`
- Own server: Use VLC → "Open Network Stream" → `rtmp://localhost/live/test`

### Test HLS (5 minutes)

**1. Convert RTMP to HLS**:
```bash
ffmpeg -i rtmp://localhost/live/test \
  -c:v copy -c:a copy \
  -f hls \
  -hls_time 2 \
  -hls_list_size 5 \
  -hls_flags delete_segments \
  /tmp/stream/playlist.m3u8
```

**2. Serve HLS**:
```bash
# Simple HTTP server
cd /tmp/stream
python3 -m http.server 8000
```

**3. Watch in browser**:
```html
<!-- test.html -->
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<video id="video" controls width="1280"></video>
<script>
  const hls = new Hls();
  hls.loadSource('http://localhost:8000/playlist.m3u8');
  hls.attachMedia(document.getElementById('video'));
  hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
</script>
```

### What You Just Achieved

- ✅ Streamed live video via RTMP
- ✅ Converted to HLS format
- ✅ Watched in browser with HLS.js
- ✅ Understand the basic flow: Source → RTMP → HLS → CDN → Viewers

**Total time**: 15 minutes
**Impact**: You now understand how Twitch/YouTube Live works ✅

---

## Key Takeaways

**What you learned**:
- Live streaming ≠ video file transfer (it's real-time segmentation + adaptive bitrate)
- HLS segments (2-10 sec chunks) enable CDN caching
- Transcoding creates multiple qualities for adaptive bitrate
- CDN edge servers serve viewers globally with low latency
- Chat uses WebSocket + Redis Pub/Sub for horizontal scaling

**What you can do Monday**:
1. Set up NGINX RTMP server (Docker)
2. Stream from OBS to your server
3. Transcode to HLS with FFmpeg
4. Upload segments to S3 + CloudFront
5. Build HLS.js player in your app

**When to use this architecture**:
- ✅ Live events (product launches, concerts, sports)
- ✅ Gaming streams (Twitch-like platforms)
- ✅ Webinars and education (live classes)
- ✅ Social media live (Instagram Live, Facebook Live)
- ✅ Surveillance and monitoring (real-time cameras)

**When NOT to use**:
- ❌ Video calls (use WebRTC for 1-on-1 or small groups)
- ❌ VOD (use standard CDN for pre-recorded videos)
- ❌ Ultra-low latency (<500ms) required (use WebRTC or LL-HLS)

---

## Try It Yourself

**Live Demo**: [Stream test with OBS](https://obsproject.com/)
**GitHub Repo**: [Complete live streaming setup](https://github.com/your-repo/live-streaming-poc)
**HLS.js Player**: [Interactive player example](https://hls-js.netlify.app/demo/)
**FFmpeg Cookbook**: [Transcoding recipes](https://github.com/leandromoreira/ffmpeg-libav-tutorial)

---

## Questions?

**Stuck on implementation?**
- Join the discussion: [GitHub Issues](https://github.com/your-repo/issues)
- DM me: [@YourTwitter](https://twitter.com/...)
- Email: yourname@example.com

---

## Share Your Results

After building your live streaming system, share your wins:
- **Twitter**: "Built a live streaming system that handles 100K viewers for $850/mo 🚀 #SystemDesign #LiveStreaming"
- **LinkedIn**: "How Twitch streams to 15M concurrent viewers - deep dive into HLS + CDN architecture"

**Discussion prompt**:
> "What's the biggest live streaming challenge you've faced? Latency? Cost? Scalability? Share below!"

---

## Related Articles

- **Video Streaming Platform (Netflix)** - VOD architecture for pre-recorded content
- **Real-Time Chat System** - WebSocket scaling for millions of messages
- **CDN Architecture** - Deep dive into edge caching and distribution
- **Video Encoding** - H.264, H.265, VP9, AV1 comparison

## Continue Learning

- **Next**: [Real-Time Collaborative Editing (Google Docs)](/interview-prep/system-design/collaborative-editing) - CRDT and OT for conflict-free editing
- **Advanced**: [WebRTC for Video Calls](/interview-prep/system-design/webrtc-video-calls) - Ultra-low latency P2P communication

---

## Production Examples

**Twitch Architecture** (detailed):
- **Ingest**: 100+ RTMP servers worldwide (AWS EC2)
- **Transcoding**: Thousands of FFmpeg instances (AWS + custom hardware)
- **Storage**: S3 for segments (2-second chunks)
- **CDN**: Fastly (200+ edge locations)
- **Chat**: WebSocket servers + Redis Pub/Sub (handles 1M+ messages/sec)
- **Latency**: 2-4 sec (standard), <1 sec (low-latency mode with WebRTC)
- **Cost**: ~$0.10 per hour per viewer (estimated)

**YouTube Live**:
- **Ingest**: Google CDN nodes
- **Transcoding**: Custom H.264/VP9 encoders
- **Delivery**: Google CDN (massive global network)
- **Quality**: 144p to 4K60 (adaptive bitrate)
- **Latency**: 5-20 sec (standard), <5 sec (ultra-low latency)

**Facebook Live**:
- **Ingest**: Regional RTMP servers
- **Transcoding**: Facebook data centers
- **CDN**: Akamai + Facebook edge
- **Mobile optimization**: Aggressive compression for 3G/4G
- **Latency**: 3-5 sec

---

**Remember**: The magic of live streaming is **segmentation + multiple qualities + CDN distribution**. Master this → build Twitch/YouTube Live! 🚀
