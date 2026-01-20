# Stories & Reels Architecture - Ephemeral Content at Scale

> **Reading Time:** 20 minutes
> **Difficulty:** 🔴 Advanced
> **Prerequisites:** [Video Streaming](/interview-prep/system-design/instagram-assets-series/04-video-streaming-delivery), [Feed Loading](/interview-prep/system-design/instagram-assets-series/05-feed-loading-optimization)
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The Ephemeral Content Revolution

**Stories and Reels dominate social media engagement.**

```
Platform statistics (2024):
┌────────────────────────────────────────────────────────────────┐
│ Instagram Stories:                                              │
│ - 500 million daily active users                               │
│ - Average user posts 3 stories/day                             │
│ - Stories disappear after 24 hours                             │
│ - 1.5 billion stories created daily                            │
│                                                                 │
│ Instagram Reels:                                                │
│ - 2 billion plays per day                                      │
│ - Average watch time: 53 minutes/day                           │
│ - 45% of accounts interact with Reels weekly                   │
│ - Reels get 22% more engagement than regular videos            │
└────────────────────────────────────────────────────────────────┘

Technical challenges:
┌────────────────────────────────────────────────────────────────┐
│ Stories:                                                        │
│ ├─ 24-hour TTL with automatic deletion                         │
│ ├─ Instant playback (< 100ms transition)                       │
│ ├─ Interactive elements (polls, stickers)                      │
│ ├─ Viewer tracking per story                                   │
│ └─ Sequential viewing with tap navigation                      │
│                                                                 │
│ Reels:                                                          │
│ ├─ Vertical video (9:16 aspect ratio)                          │
│ ├─ 60-90 second duration                                       │
│ ├─ Audio synchronization (music, voiceover)                    │
│ ├─ Infinite vertical scroll                                    │
│ └─ Algorithm-driven discovery feed                             │
└────────────────────────────────────────────────────────────────┘
```

Building Stories and Reels requires specialized architecture for ephemeral content, instant playback, and massive scale.

---

## Stories Architecture

### Data Model

```javascript
// Story entity structure
const storySchema = {
  story_id: "UUID",           // Unique identifier
  user_id: "UUID",            // Creator
  media_type: "IMAGE|VIDEO",  // Content type
  media_url: "string",        // CDN URL
  thumbnail_url: "string",    // Preview image

  // Temporal properties
  created_at: "timestamp",
  expires_at: "timestamp",    // created_at + 24 hours

  // Interactive elements
  interactions: [{
    type: "POLL|QUESTION|QUIZ|SLIDER|COUNTDOWN|LINK",
    data: "JSON",             // Type-specific data
    position: { x: 0.5, y: 0.3 }, // Relative position
    responses: []             // User responses
  }],

  // Engagement
  view_count: "number",
  viewers: ["user_ids"],      // Who viewed (visible to creator)

  // Metadata
  duration_ms: "number",      // Video duration (if video)
  music_track_id: "UUID",     // Optional music
  mentions: ["@usernames"],
  hashtags: ["#tags"],
  location_id: "UUID"
};

// Story tray (horizontal list of story bubbles)
const storyTraySchema = {
  user_id: "UUID",
  username: "string",
  profile_pic_url: "string",
  has_unseen_stories: "boolean",
  latest_story_at: "timestamp",
  stories: ["story_ids"],
  ring_color: "GRADIENT|LIVE|CLOSE_FRIENDS"
};
```

### TTL-Based Storage

```
Stories storage architecture:

┌─────────────────────────────────────────────────────────────────┐
│                    STORY LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Upload                   Active Period              Cleanup     │
│    │                      (24 hours)                   │        │
│    ▼                                                   ▼        │
│  ┌─────┐              ┌──────────────────────────┐  ┌─────┐    │
│  │Write│──────────────│     Hot Storage          │──│Delete│   │
│  └─────┘              │   (Fast SSD + Redis)     │  └─────┘    │
│                       └──────────────────────────┘              │
│                                                                  │
│  Storage strategy:                                               │
│  ├─ Redis: Story metadata with TTL                              │
│  ├─ Object Storage: Media files with lifecycle rules            │
│  └─ PostgreSQL: Viewer tracking, interactions                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
// Redis-based story storage with TTL
class StoryStore {
  constructor(redis, objectStorage) {
    this.redis = redis;
    this.objectStorage = objectStorage;
    this.TTL_SECONDS = 24 * 60 * 60; // 24 hours
  }

  async createStory(userId, storyData, mediaBuffer) {
    const storyId = generateUUID();
    const expiresAt = Date.now() + (this.TTL_SECONDS * 1000);

    // 1. Upload media to object storage with lifecycle rule
    const mediaKey = `stories/${userId}/${storyId}`;
    await this.objectStorage.upload(mediaKey, mediaBuffer, {
      lifecycle: {
        expiration: { days: 1 },
        transitionToIA: null // Don't tier, just delete
      },
      metadata: {
        'story-id': storyId,
        'expires-at': expiresAt.toString()
      }
    });

    // 2. Generate CDN URL with signed expiration
    const mediaUrl = await this.generateSignedUrl(mediaKey, this.TTL_SECONDS);

    // 3. Store metadata in Redis with TTL
    const story = {
      story_id: storyId,
      user_id: userId,
      media_url: mediaUrl,
      created_at: Date.now(),
      expires_at: expiresAt,
      ...storyData
    };

    await this.redis.setex(
      `story:${storyId}`,
      this.TTL_SECONDS,
      JSON.stringify(story)
    );

    // 4. Add to user's story list (sorted set by creation time)
    await this.redis.zadd(
      `user:${userId}:stories`,
      Date.now(),
      storyId
    );
    await this.redis.expire(`user:${userId}:stories`, this.TTL_SECONDS);

    // 5. Notify followers (async)
    await this.notifyFollowers(userId, storyId);

    return story;
  }

  async getUserStories(userId) {
    // Get story IDs for user
    const storyIds = await this.redis.zrangebyscore(
      `user:${userId}:stories`,
      Date.now(), // Only non-expired
      '+inf'
    );

    if (storyIds.length === 0) return [];

    // Batch fetch story metadata
    const pipeline = this.redis.pipeline();
    storyIds.forEach(id => pipeline.get(`story:${id}`));
    const results = await pipeline.exec();

    return results
      .map(([err, data]) => data ? JSON.parse(data) : null)
      .filter(Boolean);
  }
}
```

### Story Tray Generation

```javascript
// Generate the horizontal story tray for a user's feed
class StoryTrayService {
  async getStoryTray(viewerId) {
    // 1. Get users the viewer follows
    const following = await this.getFollowing(viewerId);

    // 2. Check which have active stories (batch operation)
    const pipeline = this.redis.pipeline();
    following.forEach(userId => {
      pipeline.exists(`user:${userId}:stories`);
    });
    const hasStoriesResults = await pipeline.exec();

    const usersWithStories = following.filter((_, idx) =>
      hasStoriesResults[idx][1] === 1
    );

    // 3. Get story tray data for each
    const trayItems = await Promise.all(
      usersWithStories.map(userId => this.getTrayItem(viewerId, userId))
    );

    // 4. Sort: unseen first, then by recency
    return trayItems.sort((a, b) => {
      // Unseen stories come first
      if (a.has_unseen !== b.has_unseen) {
        return a.has_unseen ? -1 : 1;
      }
      // Then sort by most recent story
      return b.latest_story_at - a.latest_story_at;
    });
  }

  async getTrayItem(viewerId, userId) {
    const [userInfo, storyIds, viewedStories] = await Promise.all([
      this.getUserInfo(userId),
      this.redis.zrange(`user:${userId}:stories`, 0, -1),
      this.redis.smembers(`viewer:${viewerId}:viewed:${userId}`)
    ]);

    const viewedSet = new Set(viewedStories);
    const hasUnseen = storyIds.some(id => !viewedSet.has(id));

    return {
      user_id: userId,
      username: userInfo.username,
      profile_pic_url: userInfo.profile_pic_url,
      has_unseen_stories: hasUnseen,
      latest_story_at: await this.redis.zscore(
        `user:${userId}:stories`,
        storyIds[storyIds.length - 1]
      ),
      story_count: storyIds.length,
      ring_color: this.getRingColor(userId, viewerId)
    };
  }

  getRingColor(storyOwnerId, viewerId) {
    // Determine the gradient ring color
    if (this.isLive(storyOwnerId)) return 'LIVE';
    if (this.isCloseFriend(storyOwnerId, viewerId)) return 'CLOSE_FRIENDS';
    return 'GRADIENT';
  }
}
```

### Instant Story Playback

```
Story viewing architecture:

┌─────────────────────────────────────────────────────────────────┐
│                  STORY VIEWING FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User taps story bubble                                         │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐    Already        ┌───────────────────┐   │
│  │ Check preload   │───loaded?────────▶│ Show immediately  │   │
│  │ cache           │       YES         │ (< 16ms)          │   │
│  └────────┬────────┘                   └───────────────────┘   │
│           │ NO                                                   │
│           ▼                                                      │
│  ┌─────────────────┐                   ┌───────────────────┐   │
│  │ Fetch first     │──────────────────▶│ Show loading      │   │
│  │ story           │                   │ skeleton          │   │
│  └────────┬────────┘                   └───────────────────┘   │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Parallel load   │                                            │
│  │ next 3 stories  │◀─────── Background prefetch               │
│  └─────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Preloading strategy:
┌─────────────────────────────────────────────────────────────────┐
│ Priority 1: Adjacent stories in current user's set             │
│ Priority 2: First story of next 2 users in tray               │
│ Priority 3: Remaining stories of current user                  │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
class StoryPlayer {
  constructor() {
    this.preloadCache = new Map();
    this.maxCacheSize = 10; // Keep 10 stories preloaded
  }

  async openStoryViewer(userId, stories) {
    // Show first story immediately
    this.displayStory(stories[0]);

    // Start preloading in background
    this.preloadStories(stories);

    // Track view
    await this.recordView(stories[0]);
  }

  displayStory(story) {
    // Check cache first
    const cached = this.preloadCache.get(story.story_id);

    if (cached && cached.loaded) {
      // Instant display
      this.renderMedia(cached.element);
      return;
    }

    // Show skeleton while loading
    this.showLoadingSkeleton();

    // Load and display
    this.loadStory(story).then(element => {
      this.renderMedia(element);
    });
  }

  async preloadStories(stories) {
    // Preload next stories with priority
    const preloadQueue = [
      ...stories.slice(1, 4),  // Next 3 stories (high priority)
      ...stories.slice(4, 7)   // Following 3 (low priority)
    ];

    for (const story of preloadQueue) {
      if (this.preloadCache.size >= this.maxCacheSize) {
        // Evict oldest entry
        const oldestKey = this.preloadCache.keys().next().value;
        this.preloadCache.delete(oldestKey);
      }

      // Preload in background
      this.preloadStory(story);
    }
  }

  async preloadStory(story) {
    const cacheEntry = { loaded: false, element: null };
    this.preloadCache.set(story.story_id, cacheEntry);

    try {
      if (story.media_type === 'VIDEO') {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true; // Preload muted for autoplay
        video.src = story.media_url;

        await new Promise((resolve, reject) => {
          video.oncanplaythrough = resolve;
          video.onerror = reject;
        });

        cacheEntry.element = video;
      } else {
        const img = new Image();
        img.src = story.media_url;
        await img.decode();
        cacheEntry.element = img;
      }

      cacheEntry.loaded = true;
    } catch (error) {
      this.preloadCache.delete(story.story_id);
    }
  }

  // Swipe/tap navigation
  handleNavigation(direction) {
    if (direction === 'next') {
      this.currentIndex++;
      if (this.currentIndex >= this.currentStories.length) {
        // Move to next user's stories
        this.switchToNextUser();
      } else {
        this.displayStory(this.currentStories[this.currentIndex]);
      }
    } else {
      this.currentIndex = Math.max(0, this.currentIndex - 1);
      this.displayStory(this.currentStories[this.currentIndex]);
    }
  }
}
```

### Interactive Elements

```javascript
// Interactive story elements (polls, questions, etc.)
class StoryInteractions {
  // Poll handling
  async submitPollResponse(storyId, pollId, optionIndex, userId) {
    const key = `story:${storyId}:poll:${pollId}`;

    // Atomic increment for poll option
    await this.redis.multi()
      .hincrby(key, `option:${optionIndex}`, 1)
      .sadd(`${key}:voters`, userId)
      .exec();

    // Get updated results
    return this.getPollResults(storyId, pollId);
  }

  async getPollResults(storyId, pollId) {
    const key = `story:${storyId}:poll:${pollId}`;
    const results = await this.redis.hgetall(key);

    // Calculate percentages
    const total = Object.values(results)
      .filter(k => !k.startsWith('option:'))
      .reduce((sum, val) => sum + parseInt(val), 0);

    return {
      options: Object.entries(results)
        .filter(([k]) => k.startsWith('option:'))
        .map(([key, count]) => ({
          index: parseInt(key.split(':')[1]),
          count: parseInt(count),
          percentage: total > 0 ? (parseInt(count) / total * 100).toFixed(1) : 0
        })),
      total_votes: total
    };
  }

  // Question sticker
  async submitQuestionResponse(storyId, questionId, response, userId) {
    const responseId = generateUUID();

    await this.redis.rpush(
      `story:${storyId}:question:${questionId}:responses`,
      JSON.stringify({
        response_id: responseId,
        user_id: userId,
        text: response,
        created_at: Date.now()
      })
    );

    // Notify story owner
    await this.notifyOwner(storyId, 'QUESTION_RESPONSE', { responseId });
  }

  // Slider reaction
  async submitSliderReaction(storyId, sliderId, value, userId) {
    // value is 0-1 (emoji position)
    const key = `story:${storyId}:slider:${sliderId}`;

    await this.redis.multi()
      .zadd(key, value, userId)
      .exec();

    // Calculate average
    const values = await this.redis.zrange(key, 0, -1, 'WITHSCORES');
    const sum = values.reduce((acc, _, i) =>
      i % 2 === 1 ? acc + parseFloat(values[i]) : acc, 0);
    const count = values.length / 2;

    return { average: sum / count, total_responses: count };
  }
}
```

---

## Reels Architecture

### Vertical Video Optimization

```
Reels video specifications:

┌─────────────────────────────────────────────────────────────────┐
│                   REELS FORMAT                                   │
├─────────────────────────────────────────────────────────────────┤
│ Aspect Ratio: 9:16 (vertical)                                   │
│ Resolution: 1080x1920 (Full HD vertical)                        │
│ Duration: 15s, 30s, 60s, 90s                                    │
│ Frame Rate: 30fps (native), 60fps (supported)                   │
│ Codec: H.264 (compatibility), HEVC (efficiency)                 │
│ Container: MP4 (HLS for streaming)                              │
│ Audio: AAC, 44.1kHz, stereo                                     │
└─────────────────────────────────────────────────────────────────┘

Transcoding profiles for Reels:

┌──────────────────────────────────────────────────────────────────┐
│ Profile       │ Resolution  │ Bitrate  │ Use Case               │
├───────────────┼─────────────┼──────────┼────────────────────────┤
│ 240p          │ 432x768     │ 300kbps  │ Very slow connections  │
│ 360p          │ 640x1136    │ 600kbps  │ 3G/slow 4G             │
│ 480p          │ 720x1280    │ 1Mbps    │ Standard mobile        │
│ 720p          │ 720x1280    │ 2Mbps    │ Good 4G/WiFi           │
│ 1080p         │ 1080x1920   │ 4Mbps    │ Strong WiFi/5G         │
└───────────────┴─────────────┴──────────┴────────────────────────┘
```

```javascript
// Reels transcoding pipeline
class ReelsTranscoder {
  async processReel(reelId, inputPath) {
    const outputBase = `reels/${reelId}`;

    // Generate all quality variants
    const variants = [
      { name: '240p', width: 432, height: 768, bitrate: '300k' },
      { name: '360p', width: 640, height: 1136, bitrate: '600k' },
      { name: '480p', width: 720, height: 1280, bitrate: '1000k' },
      { name: '720p', width: 720, height: 1280, bitrate: '2000k' },
      { name: '1080p', width: 1080, height: 1920, bitrate: '4000k' }
    ];

    const transcodingJobs = variants.map(variant =>
      this.transcodeVariant(inputPath, outputBase, variant)
    );

    // Parallel transcoding
    const results = await Promise.all(transcodingJobs);

    // Generate HLS manifest
    const hlsManifest = this.generateHLSManifest(results);

    // Upload manifest
    await this.storage.upload(
      `${outputBase}/playlist.m3u8`,
      hlsManifest
    );

    return {
      reelId,
      manifestUrl: `${CDN_URL}/${outputBase}/playlist.m3u8`,
      variants: results
    };
  }

  async transcodeVariant(input, outputBase, variant) {
    const outputPath = `${outputBase}/${variant.name}`;

    // FFmpeg command for vertical video
    const command = `
      ffmpeg -i ${input}
        -vf "scale=${variant.width}:${variant.height}:force_original_aspect_ratio=decrease,
             pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2"
        -c:v libx264 -preset fast -crf 23
        -b:v ${variant.bitrate} -maxrate ${variant.bitrate} -bufsize ${variant.bitrate}
        -c:a aac -b:a 128k
        -hls_time 2 -hls_list_size 0
        -hls_segment_filename "${outputPath}/segment_%03d.ts"
        ${outputPath}/playlist.m3u8
    `;

    await exec(command);

    return {
      quality: variant.name,
      bandwidth: parseInt(variant.bitrate) * 1000,
      path: outputPath
    };
  }
}
```

### Infinite Scroll Feed

```
Reels feed architecture:

┌─────────────────────────────────────────────────────────────────┐
│                    REELS FEED FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │   Swipe Up  │─────────────────────────────────┐              │
│  └──────┬──────┘                                 │              │
│         │                                         ▼              │
│         │                               ┌─────────────────┐     │
│         │                               │ Prefetch next   │     │
│         │                               │ 3 reels         │     │
│         │                               └─────────────────┘     │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Currently Playing Reel                                  │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │                                                   │   │   │
│  │  │              9:16 Vertical Video                  │   │   │
│  │  │                                                   │   │   │
│  │  │  ┌─────────┐           ┌────────────────────┐    │   │   │
│  │  │  │ Profile │           │ Like/Comment/Share │    │   │   │
│  │  │  └─────────┘           └────────────────────┘    │   │   │
│  │  │                                                   │   │   │
│  │  │  🎵 Audio track info                             │   │   │
│  │  │  📝 Caption (expandable)                         │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐                                                │
│  │  Swipe Down │◄────────── Buffer: 1 previous reel            │
│  └─────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
class ReelsPlayer {
  constructor() {
    this.reelBuffer = [];
    this.currentIndex = 0;
    this.preloadAhead = 3;
    this.preloadBehind = 1;
  }

  async initializeFeed(initialReels) {
    this.reelBuffer = initialReels;

    // Start playing first reel
    await this.playReel(0);

    // Preload upcoming reels
    this.preloadReels();
  }

  async playReel(index) {
    const reel = this.reelBuffer[index];
    this.currentIndex = index;

    // Stop previous video
    if (this.currentPlayer) {
      this.currentPlayer.pause();
    }

    // Get or create player for this reel
    const player = await this.getOrCreatePlayer(reel);
    this.currentPlayer = player;

    // Start playback with sound
    player.muted = false;
    player.currentTime = 0;
    await player.play();

    // Track view after 3 seconds
    setTimeout(() => {
      if (this.currentIndex === index) {
        this.recordView(reel.reel_id);
      }
    }, 3000);

    // Request more reels if running low
    if (index >= this.reelBuffer.length - 5) {
      this.fetchMoreReels();
    }
  }

  async getOrCreatePlayer(reel) {
    // Check if already preloaded
    if (this.preloadedPlayers.has(reel.reel_id)) {
      return this.preloadedPlayers.get(reel.reel_id);
    }

    // Create new HLS player
    const video = document.createElement('video');
    video.playsInline = true;
    video.loop = true;
    video.preload = 'auto';

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: this.getOptimalQuality(),
        capLevelToPlayerSize: true
      });
      hls.loadSource(reel.manifest_url);
      hls.attachMedia(video);
    } else {
      video.src = reel.manifest_url;
    }

    // Wait for video to be ready
    await new Promise(resolve => {
      video.oncanplay = resolve;
    });

    return video;
  }

  preloadReels() {
    // Preload next N reels
    for (let i = 1; i <= this.preloadAhead; i++) {
      const index = this.currentIndex + i;
      if (index < this.reelBuffer.length) {
        this.preloadReel(this.reelBuffer[index]);
      }
    }
  }

  async preloadReel(reel) {
    if (this.preloadedPlayers.has(reel.reel_id)) return;

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.preload = 'metadata';

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: this.getOptimalQuality()
      });
      hls.loadSource(reel.manifest_url);
      hls.attachMedia(video);

      // Only preload first few segments
      hls.once(Hls.Events.FRAG_LOADED, () => {
        this.preloadedPlayers.set(reel.reel_id, video);
      });
    }
  }

  getOptimalQuality() {
    // Select quality based on network conditions
    const connection = navigator.connection;

    if (!connection) return 2; // Default to 480p

    const effectiveType = connection.effectiveType;
    const qualityMap = {
      'slow-2g': 0, // 240p
      '2g': 1,      // 360p
      '3g': 2,      // 480p
      '4g': 3       // 720p
    };

    return qualityMap[effectiveType] || 2;
  }

  handleSwipe(direction) {
    if (direction === 'up' && this.currentIndex < this.reelBuffer.length - 1) {
      this.playReel(this.currentIndex + 1);
      this.preloadReels();
    } else if (direction === 'down' && this.currentIndex > 0) {
      this.playReel(this.currentIndex - 1);
    }
  }
}
```

### Audio Synchronization

```javascript
// Music and audio handling for Reels
class ReelsAudio {
  constructor() {
    this.musicLibrary = new Map();
    this.audioContext = new AudioContext();
  }

  // Create reel with music
  async createReelWithMusic(videoBlob, musicTrackId, startOffset, volume) {
    // 1. Get music track
    const musicTrack = await this.getMusicTrack(musicTrackId);

    // 2. Mix audio
    const mixedAudio = await this.mixAudio({
      originalVideo: videoBlob,
      musicTrack: musicTrack,
      musicStartOffset: startOffset,
      musicVolume: volume,
      originalVolume: 0.3 // Lower original audio when music added
    });

    // 3. Create final video with mixed audio
    return this.muxVideoAudio(videoBlob, mixedAudio);
  }

  async mixAudio({ originalVideo, musicTrack, musicStartOffset, musicVolume, originalVolume }) {
    // Extract audio from video
    const videoAudio = await this.extractAudio(originalVideo);
    const videoDuration = videoAudio.duration;

    // Create offline audio context for mixing
    const offlineContext = new OfflineAudioContext(
      2, // stereo
      this.audioContext.sampleRate * videoDuration,
      this.audioContext.sampleRate
    );

    // Original video audio
    const videoSource = offlineContext.createBufferSource();
    videoSource.buffer = videoAudio;
    const videoGain = offlineContext.createGain();
    videoGain.gain.value = originalVolume;
    videoSource.connect(videoGain);
    videoGain.connect(offlineContext.destination);

    // Music track
    const musicBuffer = await offlineContext.decodeAudioData(
      await musicTrack.arrayBuffer()
    );
    const musicSource = offlineContext.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loopStart = musicStartOffset;
    musicSource.loopEnd = musicStartOffset + videoDuration;
    musicSource.loop = true;

    const musicGain = offlineContext.createGain();
    musicGain.gain.value = musicVolume;
    musicSource.connect(musicGain);
    musicGain.connect(offlineContext.destination);

    // Start both
    videoSource.start(0);
    musicSource.start(0, musicStartOffset);

    // Render mixed audio
    return offlineContext.startRendering();
  }

  // Lip sync and beat detection for effects
  async detectBeats(audioBuffer) {
    const peaks = [];
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Simple peak detection
    const threshold = 0.8;
    let lastPeak = 0;
    const minInterval = sampleRate * 0.1; // Min 100ms between beats

    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) > threshold &&
          i - lastPeak > minInterval) {
        peaks.push(i / sampleRate); // Time in seconds
        lastPeak = i;
      }
    }

    return peaks;
  }
}
```

### Algorithm-Driven Discovery

```javascript
// Reels recommendation engine
class ReelsRecommendation {
  async getReelsForUser(userId, batchSize = 20) {
    // Multi-factor ranking
    const candidates = await this.getCandidates(userId, batchSize * 5);

    const rankedReels = candidates.map(reel => ({
      ...reel,
      score: this.calculateScore(reel, userId)
    }));

    // Sort by score and diversify
    rankedReels.sort((a, b) => b.score - a.score);

    return this.diversify(rankedReels, batchSize);
  }

  calculateScore(reel, userId) {
    let score = 0;

    // Engagement signals (40%)
    score += this.normalizeEngagement(reel) * 0.4;

    // User affinity (30%)
    score += this.calculateAffinity(reel, userId) * 0.3;

    // Freshness (15%)
    score += this.calculateFreshness(reel) * 0.15;

    // Creator authority (10%)
    score += this.creatorScore(reel.creator_id) * 0.1;

    // Audio popularity (5%)
    score += this.audioPopularity(reel.audio_track_id) * 0.05;

    return score;
  }

  normalizeEngagement(reel) {
    // Normalize engagement metrics
    const views = reel.view_count;
    const likes = reel.like_count;
    const comments = reel.comment_count;
    const shares = reel.share_count;
    const saves = reel.save_count;

    // Weighted engagement rate
    const engagementScore = (
      likes * 1 +
      comments * 2 +
      shares * 3 +
      saves * 4
    ) / Math.max(views, 1);

    // Watch time factor
    const avgWatchPercentage = reel.avg_watch_percentage;
    const completionBonus = avgWatchPercentage > 0.7 ? 1.5 : 1;

    return Math.min(engagementScore * completionBonus, 1);
  }

  calculateAffinity(reel, userId) {
    // User-content affinity
    const userInterests = this.getUserInterests(userId);
    const reelTopics = reel.topics;

    // Topic overlap
    const topicScore = this.calculateOverlap(userInterests.topics, reelTopics);

    // Creator affinity (have they engaged with this creator?)
    const creatorScore = this.getCreatorAffinity(userId, reel.creator_id);

    // Audio affinity (have they engaged with this audio?)
    const audioScore = this.getAudioAffinity(userId, reel.audio_track_id);

    return (topicScore * 0.5 + creatorScore * 0.3 + audioScore * 0.2);
  }

  diversify(rankedReels, batchSize) {
    // Ensure diversity in the feed
    const selected = [];
    const seenCreators = new Set();
    const seenAudios = new Set();
    const seenTopics = new Map();

    for (const reel of rankedReels) {
      if (selected.length >= batchSize) break;

      // Skip if too many from same creator
      if (seenCreators.has(reel.creator_id)) continue;

      // Skip if same audio recently
      if (seenAudios.has(reel.audio_track_id) &&
          selected.length < batchSize / 2) continue;

      // Topic diversity
      const topTopic = reel.topics[0];
      if ((seenTopics.get(topTopic) || 0) >= 3) continue;

      selected.push(reel);
      seenCreators.add(reel.creator_id);
      seenAudios.add(reel.audio_track_id);
      seenTopics.set(topTopic, (seenTopics.get(topTopic) || 0) + 1);
    }

    return selected;
  }
}
```

---

## Cross-Platform Considerations

### Stories vs Reels Comparison

```
Feature comparison:

┌────────────────────────────────────────────────────────────────┐
│                  STORIES vs REELS                               │
├────────────────────┬─────────────────────┬─────────────────────┤
│ Aspect             │ Stories             │ Reels               │
├────────────────────┼─────────────────────┼─────────────────────┤
│ Lifespan           │ 24 hours            │ Permanent           │
│ Discovery          │ Followers only      │ Global algorithm    │
│ Navigation         │ Tap (horizontal)    │ Swipe (vertical)    │
│ Duration           │ 15s per slide       │ 15-90s              │
│ Aspect ratio       │ 9:16 + stickers     │ 9:16 strict         │
│ Audio              │ Optional            │ Core feature        │
│ Interactions       │ Polls, Questions    │ Likes, Comments     │
│ Monetization       │ Ads between users   │ Ads in feed         │
│ Analytics          │ Viewer list         │ Public engagement   │
└────────────────────┴─────────────────────┴─────────────────────┘
```

### Unified Media Pipeline

```javascript
// Shared processing for Stories and Reels
class UnifiedMediaProcessor {
  async processUpload(mediaBuffer, contentType) {
    // Common preprocessing
    const metadata = await this.extractMetadata(mediaBuffer);

    if (contentType === 'STORY') {
      return this.processStory(mediaBuffer, metadata);
    } else if (contentType === 'REEL') {
      return this.processReel(mediaBuffer, metadata);
    }
  }

  async processStory(mediaBuffer, metadata) {
    if (metadata.type === 'VIDEO') {
      // Stories: Simpler processing, fewer variants
      return {
        variants: [
          await this.transcodeVideo(mediaBuffer, '720p', { maxDuration: 15 }),
          await this.transcodeVideo(mediaBuffer, '480p', { maxDuration: 15 })
        ],
        thumbnail: await this.extractThumbnail(mediaBuffer, 0),
        ttl: 24 * 60 * 60 // 24 hours
      };
    } else {
      // Image story
      return {
        variants: [
          await this.resizeImage(mediaBuffer, 1080, 1920),
          await this.resizeImage(mediaBuffer, 720, 1280)
        ],
        ttl: 24 * 60 * 60
      };
    }
  }

  async processReel(mediaBuffer, metadata) {
    // Reels: Full quality processing
    return {
      variants: await this.transcodeAllQualities(mediaBuffer),
      thumbnail: await this.extractThumbnail(mediaBuffer, 0),
      audioTrack: await this.extractAudio(mediaBuffer),
      duration: metadata.duration,
      ttl: null // Permanent
    };
  }
}
```

---

## Storage and Cleanup

### Story Expiration Handler

```javascript
// Automated story cleanup
class StoryExpirationHandler {
  constructor(redis, objectStorage, db) {
    this.redis = redis;
    this.objectStorage = objectStorage;
    this.db = db;
  }

  // Run every minute via cron
  async processExpiredStories() {
    const now = Date.now();

    // Find stories that should expire
    const expiredStoryKeys = await this.redis.zrangebyscore(
      'stories:by_expiration',
      0,
      now
    );

    for (const storyKey of expiredStoryKeys) {
      await this.expireStory(storyKey);
    }
  }

  async expireStory(storyKey) {
    const storyData = await this.redis.get(storyKey);
    if (!storyData) return;

    const story = JSON.parse(storyData);

    // 1. Archive engagement data to cold storage
    await this.archiveStoryAnalytics(story);

    // 2. Delete from object storage
    await this.objectStorage.delete(story.media_key);

    // 3. Clean up Redis
    await this.redis.multi()
      .del(storyKey)
      .zrem(`user:${story.user_id}:stories`, story.story_id)
      .zrem('stories:by_expiration', storyKey)
      .del(`story:${story.story_id}:viewers`)
      .del(`story:${story.story_id}:interactions`)
      .exec();

    // 4. Update analytics
    await this.recordExpiration(story);
  }

  async archiveStoryAnalytics(story) {
    // Store final analytics in database for creator insights
    const analytics = {
      story_id: story.story_id,
      user_id: story.user_id,
      created_at: story.created_at,
      expired_at: Date.now(),
      view_count: await this.redis.scard(`story:${story.story_id}:viewers`),
      interactions: await this.getInteractionStats(story.story_id)
    };

    await this.db.collection('story_analytics').insertOne(analytics);
  }
}
```

### Highlights (Permanent Stories)

```javascript
// Story Highlights - permanent story collections
class StoryHighlights {
  async createHighlight(userId, highlightData) {
    const highlightId = generateUUID();

    // Highlights have no TTL
    const highlight = {
      highlight_id: highlightId,
      user_id: userId,
      title: highlightData.title,
      cover_image: highlightData.cover_image,
      stories: [],
      created_at: Date.now()
    };

    await this.db.collection('highlights').insertOne(highlight);

    return highlight;
  }

  async addStoryToHighlight(highlightId, storyId) {
    const story = await this.getStory(storyId);

    if (!story) {
      throw new Error('Story not found or expired');
    }

    // Copy story media to permanent storage
    const permanentMediaKey = `highlights/${highlightId}/${storyId}`;
    await this.objectStorage.copy(story.media_key, permanentMediaKey);

    // Remove lifecycle rule (make permanent)
    await this.objectStorage.updateLifecycle(permanentMediaKey, {
      expiration: null,
      transitionToIA: { days: 30 }
    });

    // Add to highlight
    await this.db.collection('highlights').updateOne(
      { highlight_id: highlightId },
      {
        $push: {
          stories: {
            story_id: storyId,
            media_key: permanentMediaKey,
            added_at: Date.now()
          }
        }
      }
    );
  }
}
```

---

## Performance Optimizations

### Network-Aware Loading

```javascript
class AdaptiveLoader {
  constructor() {
    this.networkMonitor = new NetworkMonitor();
  }

  async loadContent(contentType, contentId) {
    const networkQuality = await this.networkMonitor.getQuality();

    const loadingStrategy = this.getStrategy(contentType, networkQuality);

    return this.executeStrategy(loadingStrategy, contentId);
  }

  getStrategy(contentType, networkQuality) {
    if (contentType === 'STORY') {
      return {
        imageQuality: networkQuality === 'fast' ? 'high' : 'medium',
        videoPreload: networkQuality === 'fast' ? 'auto' : 'metadata',
        preloadNext: networkQuality === 'fast' ? 3 : 1
      };
    } else if (contentType === 'REEL') {
      return {
        startQuality: this.getStartQuality(networkQuality),
        enableABR: true, // Adaptive bitrate
        bufferSize: networkQuality === 'fast' ? 10 : 5, // seconds
        preloadNext: networkQuality === 'fast' ? 2 : 1
      };
    }
  }

  getStartQuality(networkQuality) {
    const qualityMap = {
      'slow': 0,    // 240p
      'medium': 2,  // 480p
      'fast': 3     // 720p
    };
    return qualityMap[networkQuality] || 2;
  }
}

class NetworkMonitor {
  async getQuality() {
    const connection = navigator.connection;

    if (!connection) {
      // Fallback: measure actual speed
      return this.measureSpeed();
    }

    const downlink = connection.downlink; // Mbps

    if (downlink >= 5) return 'fast';
    if (downlink >= 1.5) return 'medium';
    return 'slow';
  }

  async measureSpeed() {
    const testUrl = '/speed-test.bin'; // Small test file
    const startTime = performance.now();

    const response = await fetch(testUrl);
    const blob = await response.blob();

    const duration = (performance.now() - startTime) / 1000;
    const sizeMb = blob.size / (1024 * 1024);
    const speedMbps = sizeMb / duration;

    if (speedMbps >= 5) return 'fast';
    if (speedMbps >= 1.5) return 'medium';
    return 'slow';
  }
}
```

### Memory Management

```javascript
class MediaMemoryManager {
  constructor(maxMemoryMB = 100) {
    this.maxMemory = maxMemoryMB * 1024 * 1024;
    this.cache = new Map();
    this.currentMemory = 0;
  }

  async cacheMedia(id, mediaBlob) {
    const size = mediaBlob.size;

    // Evict if necessary
    while (this.currentMemory + size > this.maxMemory && this.cache.size > 0) {
      this.evictOldest();
    }

    // Don't cache if single item exceeds limit
    if (size > this.maxMemory) {
      return null;
    }

    const url = URL.createObjectURL(mediaBlob);

    this.cache.set(id, {
      url,
      size,
      lastAccess: Date.now(),
      blob: mediaBlob
    });

    this.currentMemory += size;

    return url;
  }

  getMedia(id) {
    const entry = this.cache.get(id);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.url;
    }
    return null;
  }

  evictOldest() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldest = id;
      }
    }

    if (oldest) {
      const entry = this.cache.get(oldest);
      URL.revokeObjectURL(entry.url);
      this.currentMemory -= entry.size;
      this.cache.delete(oldest);
    }
  }

  // Called when leaving stories/reels view
  cleanup() {
    for (const [id, entry] of this.cache) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.currentMemory = 0;
  }
}
```

---

## Key Takeaways

### Stories Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                 STORIES ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. TTL-Based Storage                                            │
│    ├─ Redis with 24-hour TTL for metadata                       │
│    ├─ Object storage with lifecycle rules                       │
│    └─ Automatic cleanup on expiration                           │
│                                                                  │
│ 2. Instant Playback                                             │
│    ├─ Preload next 3-5 stories                                  │
│    ├─ Cache management (10 story limit)                         │
│    └─ < 100ms transition between stories                        │
│                                                                  │
│ 3. Interactive Elements                                         │
│    ├─ Real-time poll aggregation                                │
│    ├─ Question/response collection                              │
│    └─ Slider reactions with averaging                           │
│                                                                  │
│ 4. Story Tray                                                   │
│    ├─ Unseen stories prioritized                                │
│    ├─ Sorted by recency                                         │
│    └─ Ring color indicates type                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Reels Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                 REELS ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Vertical Video Pipeline                                      │
│    ├─ 9:16 aspect ratio optimization                            │
│    ├─ 5 quality variants (240p-1080p)                           │
│    └─ HLS adaptive streaming                                    │
│                                                                  │
│ 2. Infinite Scroll                                              │
│    ├─ Preload next 3 reels                                      │
│    ├─ Quality adaptation based on network                       │
│    └─ Seamless vertical swipe                                   │
│                                                                  │
│ 3. Audio Features                                               │
│    ├─ Music library integration                                 │
│    ├─ Audio mixing with original                                │
│    └─ Beat detection for effects                                │
│                                                                  │
│ 4. Discovery Algorithm                                          │
│    ├─ Multi-factor scoring                                      │
│    ├─ Engagement + affinity + freshness                         │
│    └─ Diversity enforcement                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Interview Discussion Points

1. **Why 24-hour TTL for Stories?**
   - Creates urgency and FOMO
   - Reduces storage costs
   - Encourages authentic content

2. **How to handle millions of story expirations?**
   - Batch processing with distributed cron
   - Object storage lifecycle rules
   - Async cleanup workers

3. **Why vertical video for Reels?**
   - Mobile-first consumption
   - Full-screen immersion
   - Competitive with TikTok

4. **How to ensure instant playback?**
   - Aggressive preloading
   - Adaptive bitrate streaming
   - Memory-efficient caching

---

## What's Next?

In **[Part 7: Storage Cost Optimization](/interview-prep/system-design/instagram-assets-series/07-storage-cost-optimization)**, we'll explore:
- Intelligent tiering strategies
- Deduplication at scale
- Cold storage economics
- Cost per user calculations
