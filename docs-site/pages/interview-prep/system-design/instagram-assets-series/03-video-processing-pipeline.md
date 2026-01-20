# Video Processing & Transcoding Pipeline - Handle Millions of Videos Daily

> **Reading Time:** 20 minutes
> **Difficulty:** 🔴 Advanced
> **Prerequisites:** [Video Transcoding Basics](/interview-prep/system-design/instagram-assets-series/prereq-video-transcoding), [Part 1: Image Upload Pipeline](/interview-prep/system-design/instagram-assets-series/01-image-upload-pipeline)
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The 1GB Video That Crashes Your System

**A user uploads a 4K video recorded on their iPhone.**

```
Original video specs:
- Resolution: 3840 × 2160 (4K)
- Duration: 60 seconds
- Codec: HEVC (H.265)
- Frame rate: 60 fps
- Bitrate: 50 Mbps
- File size: 375 MB

Processing required:
1. Decode HEVC → raw frames
2. Resize to 5 resolutions (1080p, 720p, 480p, 360p, 240p)
3. Encode each to H.264 (compatibility) + VP9 (efficiency)
4. Generate HLS segments (6-second chunks)
5. Create thumbnail sprites
6. Extract audio track
7. Run content moderation ML

Processing time (single server):
- Decode: 45 seconds
- Resize + encode (10 variants): 8 minutes
- Segmentation: 30 seconds
- Thumbnails: 15 seconds
- Total: ~10 minutes per video

At 500 million video uploads/day:
- 347,222 videos/minute
- Single-server capacity: 0.1 videos/minute
- Servers needed: 3.5 million servers

This doesn't scale.
```

Instagram Reels processes **500+ million video uploads daily**. Without a distributed, parallel processing pipeline, this would be impossible.

This article shows you how to build a video transcoding pipeline that scales to millions of videos per day.

---

## The $10 Million Infrastructure Problem

**Case Study: Video Platform Scaling Crisis (2021)**

```
Before optimization:
- Architecture: Synchronous, single-server transcoding
- Processing time: 15 minutes per video
- Server fleet: 500 transcoding servers
- Daily capacity: 48,000 videos
- Actual demand: 200,000 videos/day

What happened:
- 4x demand vs capacity
- 12-hour transcoding backlog
- Users waiting hours to see their video live
- Competitor launched, users churned

Emergency response:
- Spun up 2,000 more servers (cloud burst)
- Cost: $800K/month additional
- Still couldn't keep up with growth

After pipeline redesign:
- Architecture: Distributed, chunked parallel processing
- Processing time: 45 seconds per video (20x faster)
- Server fleet: 200 servers (60% fewer)
- Daily capacity: 1,000,000+ videos
- Cost: $200K/month (75% savings)

The insight: Split video into chunks, process in parallel
```

---

## Parallel Video Processing Architecture

### The Chunk-Based Approach

```
Traditional (Sequential):
┌─────────────────────────────────────────────────────────────────┐
│  INPUT VIDEO (60 seconds)                                       │
│  ════════════════════════════════════════════════════════════   │
│                              ↓                                  │
│                    [Single Transcode Job]                       │
│                         10 minutes                              │
│                              ↓                                  │
│  OUTPUT (all variants)                                          │
└─────────────────────────────────────────────────────────────────┘
Time: 10 minutes (bottleneck: single server)

Parallel (Chunked):
┌─────────────────────────────────────────────────────────────────┐
│  INPUT VIDEO (60 seconds)                                       │
│  ════════════════════════════════════════════════════════════   │
│     ↓          ↓          ↓          ↓          ↓               │
│  [Chunk 1] [Chunk 2] [Chunk 3] ... [Chunk 10]  (6s each)        │
│     ↓          ↓          ↓          ↓          ↓               │
│  Worker 1  Worker 2  Worker 3  ... Worker 10   (parallel)       │
│     ↓          ↓          ↓          ↓          ↓               │
│  [Output 1][Output 2][Output 3]... [Output 10]                  │
│     ↓          ↓          ↓          ↓          ↓               │
│           [Concatenate / Package as HLS]                        │
│                              ↓                                  │
│  OUTPUT (all variants, already segmented)                       │
└─────────────────────────────────────────────────────────────────┘
Time: 1 minute (10x parallel = 10x faster)
```

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 VIDEO PROCESSING PIPELINE                        │
└─────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────────────────────────┐
     │                    UPLOAD SERVICE                        │
     │  - Accept video upload (resumable, chunked)             │
     │  - Store in temp S3                                     │
     │  - Enqueue processing job                               │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │                  ORCHESTRATOR SERVICE                    │
     │  - Analyze video (duration, codec, resolution)          │
     │  - Split into processing chunks                         │
     │  - Create chunk jobs for each resolution                │
     │  - Track overall job progress                           │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │              DISTRIBUTED JOB QUEUE (Kafka)               │
     │  Topics:                                                │
     │  - video.chunks.transcode                               │
     │  - video.chunks.complete                                │
     │  - video.assembly.ready                                 │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │            TRANSCODING WORKER FLEET (Auto-scaling)       │
     │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
     │  │Worker 1 │ │Worker 2 │ │Worker 3 │ │Worker N │        │
     │  │GPU/CPU  │ │GPU/CPU  │ │GPU/CPU  │ │GPU/CPU  │        │
     │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
     │  - Process individual chunks                            │
     │  - Output to chunk storage                              │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │                  ASSEMBLY SERVICE                        │
     │  - Collect all processed chunks                         │
     │  - Generate HLS/DASH manifests                          │
     │  - Create thumbnail sprites                             │
     │  - Upload to permanent storage                          │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │                  COMPLETION SERVICE                      │
     │  - Update database with video metadata                  │
     │  - Trigger CDN cache warming                            │
     │  - Notify user (push notification)                      │
     │  - Clean up temp files                                  │
     └─────────────────────────────────────────────────────────┘
```

---

## Implementation Deep Dive

### Step 1: Video Upload & Analysis

```javascript
// Upload service with resumable uploads

const express = require('express');
const { S3Client, CreateMultipartUploadCommand, UploadPartCommand } = require('@aws-sdk/client-s3');
const ffprobe = require('ffprobe');

const app = express();
const s3 = new S3Client({ region: 'us-west-2' });

// Initialize resumable upload
app.post('/api/video/upload/init', async (req, res) => {
  const { fileName, fileSize, contentType } = req.body;
  const userId = req.user.id;
  const videoId = generateSnowflakeId();

  // Validate
  if (fileSize > 4 * 1024 * 1024 * 1024) {  // 4GB limit
    return res.status(400).json({ error: 'File too large (max 4GB)' });
  }

  // Create multipart upload
  const s3Key = `uploads/videos/${videoId}/original`;
  const multipart = await s3.send(new CreateMultipartUploadCommand({
    Bucket: 'instagram-uploads-temp',
    Key: s3Key,
    ContentType: contentType
  }));

  // Store upload session
  await redis.setex(`video-upload:${videoId}`, 86400, JSON.stringify({
    videoId,
    userId,
    s3Key,
    uploadId: multipart.UploadId,
    fileSize,
    parts: [],
    status: 'uploading'
  }));

  res.json({
    videoId,
    uploadId: multipart.UploadId,
    chunkSize: 10 * 1024 * 1024  // 10MB chunks
  });
});

// Upload chunk (resumable)
app.put('/api/video/upload/:videoId/chunk/:partNumber', async (req, res) => {
  const { videoId, partNumber } = req.params;
  const session = JSON.parse(await redis.get(`video-upload:${videoId}`));

  if (!session) {
    return res.status(404).json({ error: 'Upload session not found' });
  }

  // Upload part to S3
  const result = await s3.send(new UploadPartCommand({
    Bucket: 'instagram-uploads-temp',
    Key: session.s3Key,
    PartNumber: parseInt(partNumber),
    UploadId: session.uploadId,
    Body: req.body
  }));

  // Track uploaded part
  session.parts.push({
    PartNumber: parseInt(partNumber),
    ETag: result.ETag
  });
  await redis.setex(`video-upload:${videoId}`, 86400, JSON.stringify(session));

  res.json({ success: true, partNumber, etag: result.ETag });
});

// Complete upload & trigger processing
app.post('/api/video/upload/:videoId/complete', async (req, res) => {
  const { videoId } = req.params;
  const { caption } = req.body;
  const session = JSON.parse(await redis.get(`video-upload:${videoId}`));

  // Complete multipart upload
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: 'instagram-uploads-temp',
    Key: session.s3Key,
    UploadId: session.uploadId,
    MultipartUpload: { Parts: session.parts.sort((a, b) => a.PartNumber - b.PartNumber) }
  }));

  // Analyze video
  const analysis = await analyzeVideo(session.s3Key);

  // Enqueue for processing
  await kafka.send({
    topic: 'video-processing-orchestrator',
    messages: [{
      key: videoId,
      value: JSON.stringify({
        videoId,
        userId: session.userId,
        s3Key: session.s3Key,
        caption,
        analysis,
        priority: getUserPriority(session.userId)
      })
    }]
  });

  res.json({
    videoId,
    status: 'processing',
    estimatedTime: estimateProcessingTime(analysis)
  });
});

async function analyzeVideo(s3Key) {
  // Download first 10MB for analysis (header + first frames)
  const probe = await ffprobe(getS3Url(s3Key));

  return {
    duration: parseFloat(probe.format.duration),
    width: probe.streams[0].width,
    height: probe.streams[0].height,
    fps: eval(probe.streams[0].r_frame_rate),
    codec: probe.streams[0].codec_name,
    bitrate: parseInt(probe.format.bit_rate),
    hasAudio: probe.streams.some(s => s.codec_type === 'audio')
  };
}
```

### Step 2: Orchestrator Service

```javascript
// Orchestrator: Splits video into chunks and creates jobs

const CHUNK_DURATION = 6;  // 6-second chunks (HLS standard)

const QUALITY_LADDER = [
  { name: '1080p', width: 1920, height: 1080, bitrate: '4M', crf: 23 },
  { name: '720p', width: 1280, height: 720, bitrate: '2M', crf: 24 },
  { name: '480p', width: 854, height: 480, bitrate: '1M', crf: 25 },
  { name: '360p', width: 640, height: 360, bitrate: '600k', crf: 26 },
  { name: '240p', width: 426, height: 240, bitrate: '400k', crf: 27 }
];

class VideoOrchestrator {
  async processVideo(job) {
    const { videoId, s3Key, analysis } = job;

    console.log(`Orchestrating video ${videoId}: ${analysis.duration}s, ${analysis.width}x${analysis.height}`);

    // Calculate chunks
    const numChunks = Math.ceil(analysis.duration / CHUNK_DURATION);
    const chunks = [];

    for (let i = 0; i < numChunks; i++) {
      const startTime = i * CHUNK_DURATION;
      const endTime = Math.min((i + 1) * CHUNK_DURATION, analysis.duration);

      chunks.push({
        chunkId: `${videoId}_chunk_${i}`,
        chunkIndex: i,
        startTime,
        endTime,
        duration: endTime - startTime
      });
    }

    // Determine output qualities (skip higher than source)
    const outputQualities = QUALITY_LADDER.filter(q =>
      q.height <= analysis.height
    );

    // Create job record
    const processingJob = {
      videoId,
      s3Key,
      analysis,
      chunks,
      qualities: outputQualities,
      totalTasks: chunks.length * outputQualities.length,
      completedTasks: 0,
      status: 'processing',
      createdAt: Date.now()
    };

    await redis.setex(`video-job:${videoId}`, 86400, JSON.stringify(processingJob));

    // Enqueue all chunk transcoding tasks
    const tasks = [];
    for (const chunk of chunks) {
      for (const quality of outputQualities) {
        tasks.push({
          topic: 'video-transcode-chunks',
          messages: [{
            key: `${videoId}_${chunk.chunkIndex}_${quality.name}`,
            value: JSON.stringify({
              videoId,
              chunkId: chunk.chunkId,
              chunkIndex: chunk.chunkIndex,
              startTime: chunk.startTime,
              duration: chunk.duration,
              sourceS3Key: s3Key,
              quality,
              outputS3Key: `processing/${videoId}/chunks/${quality.name}/${chunk.chunkIndex}.ts`
            })
          }]
        });
      }
    }

    // Batch send to Kafka
    await kafka.sendBatch(tasks);

    console.log(`Created ${tasks.length} transcoding tasks for video ${videoId}`);

    return processingJob;
  }
}
```

### Step 3: Transcoding Workers

```javascript
// Transcoding worker with GPU acceleration

const { spawn } = require('child_process');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

class TranscodeWorker {
  constructor() {
    this.s3 = new S3Client({ region: 'us-west-2' });
    this.useGPU = this.detectGPU();
  }

  detectGPU() {
    try {
      // Check for NVIDIA GPU
      const result = require('child_process').execSync('nvidia-smi');
      return true;
    } catch {
      return false;
    }
  }

  async processChunk(task) {
    const { videoId, chunkIndex, startTime, duration, sourceS3Key, quality, outputS3Key } = task;

    console.log(`Processing chunk ${chunkIndex} of ${videoId} at ${quality.name}`);

    // Download source segment (only the needed portion)
    const inputPath = `/tmp/${videoId}_input_${chunkIndex}.mp4`;
    const outputPath = `/tmp/${videoId}_${quality.name}_${chunkIndex}.ts`;

    try {
      // Extract chunk from source using time-based seeking
      await this.extractChunk(sourceS3Key, inputPath, startTime, duration);

      // Transcode chunk
      await this.transcodeChunk(inputPath, outputPath, quality);

      // Upload result
      await this.uploadToS3(outputPath, outputS3Key);

      // Notify completion
      await kafka.send({
        topic: 'video-chunks-complete',
        messages: [{
          key: videoId,
          value: JSON.stringify({
            videoId,
            chunkIndex,
            quality: quality.name,
            outputS3Key,
            success: true
          })
        }]
      });

    } finally {
      // Cleanup temp files
      await fs.promises.unlink(inputPath).catch(() => {});
      await fs.promises.unlink(outputPath).catch(() => {});
    }
  }

  async extractChunk(s3Key, outputPath, startTime, duration) {
    return new Promise((resolve, reject) => {
      const s3Url = `s3://instagram-uploads-temp/${s3Key}`;

      const args = [
        '-ss', startTime.toString(),  // Seek before input (fast)
        '-i', s3Url,
        '-t', duration.toString(),
        '-c', 'copy',  // No re-encoding for extraction
        '-avoid_negative_ts', 'make_zero',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', args);
      ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}`)));
    });
  }

  async transcodeChunk(inputPath, outputPath, quality) {
    return new Promise((resolve, reject) => {
      const args = this.useGPU
        ? this.getGPUArgs(inputPath, outputPath, quality)
        : this.getCPUArgs(inputPath, outputPath, quality);

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';
      ffmpeg.stderr.on('data', data => stderr += data);

      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed: ${stderr}`));
        }
      });
    });
  }

  getCPUArgs(input, output, quality) {
    return [
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', quality.crf.toString(),
      '-maxrate', quality.bitrate,
      '-bufsize', `${parseInt(quality.bitrate) * 2}`,
      '-vf', `scale=${quality.width}:${quality.height}`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'mpegts',
      output
    ];
  }

  getGPUArgs(input, output, quality) {
    return [
      '-hwaccel', 'cuda',
      '-hwaccel_output_format', 'cuda',
      '-i', input,
      '-c:v', 'h264_nvenc',  // NVIDIA GPU encoder
      '-preset', 'p4',       // Quality preset
      '-rc:v', 'vbr',
      '-cq:v', quality.crf.toString(),
      '-maxrate', quality.bitrate,
      '-bufsize', `${parseInt(quality.bitrate) * 2}`,
      '-vf', `scale_cuda=${quality.width}:${quality.height}`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'mpegts',
      output
    ];
  }

  async uploadToS3(localPath, s3Key) {
    const fileContent = await fs.promises.readFile(localPath);
    await this.s3.send(new PutObjectCommand({
      Bucket: 'instagram-video-processing',
      Key: s3Key,
      Body: fileContent,
      ContentType: 'video/mp2t'
    }));
  }
}

// Worker loop
async function runWorker() {
  const worker = new TranscodeWorker();
  const consumer = kafka.consumer({ groupId: 'transcode-workers' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'video-transcode-chunks' });

  await consumer.run({
    partitionsConsumedConcurrently: 4,  // Process 4 chunks in parallel
    eachMessage: async ({ message }) => {
      const task = JSON.parse(message.value);
      await worker.processChunk(task);
    }
  });
}

runWorker().catch(console.error);
```

### Step 4: Assembly Service

```javascript
// Assembly service: Combines chunks into HLS package

class VideoAssembler {
  async assembleVideo(videoId) {
    const job = JSON.parse(await redis.get(`video-job:${videoId}`));

    console.log(`Assembling video ${videoId}`);

    // Download all chunks
    const chunksByQuality = await this.downloadChunks(videoId, job);

    // Generate HLS manifests
    const manifests = await this.generateHLSManifests(videoId, job, chunksByQuality);

    // Generate thumbnail sprite
    const thumbnails = await this.generateThumbnails(videoId, job.s3Key);

    // Upload final package to permanent storage
    await this.uploadFinalPackage(videoId, chunksByQuality, manifests, thumbnails);

    // Update job status
    job.status = 'complete';
    job.completedAt = Date.now();
    job.manifests = manifests;
    await redis.setex(`video-job:${videoId}`, 86400, JSON.stringify(job));

    // Trigger completion
    await kafka.send({
      topic: 'video-complete',
      messages: [{
        key: videoId,
        value: JSON.stringify({
          videoId,
          userId: job.userId,
          masterManifest: manifests.master,
          thumbnails
        })
      }]
    });

    return job;
  }

  async generateHLSManifests(videoId, job, chunksByQuality) {
    const manifests = {};

    // Generate quality-specific playlists
    for (const quality of job.qualities) {
      const playlist = this.generateMediaPlaylist(
        job.chunks,
        quality.name,
        job.analysis.duration
      );
      manifests[quality.name] = playlist;
    }

    // Generate master playlist
    manifests.master = this.generateMasterPlaylist(job.qualities);

    return manifests;
  }

  generateMediaPlaylist(chunks, quality, totalDuration) {
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';
    playlist += '#EXT-X-TARGETDURATION:6\n';
    playlist += '#EXT-X-MEDIA-SEQUENCE:0\n';
    playlist += '#EXT-X-PLAYLIST-TYPE:VOD\n';

    for (const chunk of chunks) {
      playlist += `#EXTINF:${chunk.duration.toFixed(3)},\n`;
      playlist += `${chunk.chunkIndex}.ts\n`;
    }

    playlist += '#EXT-X-ENDLIST\n';
    return playlist;
  }

  generateMasterPlaylist(qualities) {
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';

    for (const quality of qualities) {
      const bandwidth = parseInt(quality.bitrate) * 1000;
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height}\n`;
      playlist += `${quality.name}/playlist.m3u8\n`;
    }

    return playlist;
  }

  async generateThumbnails(videoId, sourceS3Key) {
    const thumbnails = [];
    const duration = await this.getVideoDuration(sourceS3Key);

    // Generate thumbnail every 10 seconds
    const interval = 10;
    const numThumbnails = Math.ceil(duration / interval);

    for (let i = 0; i < numThumbnails; i++) {
      const timestamp = i * interval;
      const thumbnailPath = `/tmp/${videoId}_thumb_${i}.jpg`;

      await this.extractFrame(sourceS3Key, thumbnailPath, timestamp);

      thumbnails.push({
        timestamp,
        path: thumbnailPath,
        s3Key: `videos/${videoId}/thumbnails/${i}.jpg`
      });
    }

    // Create sprite sheet (10 thumbnails per row)
    const spritePath = await this.createSpriteSheet(thumbnails, videoId);

    return {
      sprite: `videos/${videoId}/sprite.jpg`,
      vtt: `videos/${videoId}/thumbnails.vtt`,
      individual: thumbnails.map(t => t.s3Key)
    };
  }

  async uploadFinalPackage(videoId, chunks, manifests, thumbnails) {
    const uploads = [];

    // Upload all chunks to permanent storage
    for (const [quality, qualityChunks] of Object.entries(chunks)) {
      for (const chunk of qualityChunks) {
        uploads.push(this.copyToPermStorage(
          chunk.tempS3Key,
          `videos/${videoId}/${quality}/${chunk.index}.ts`
        ));
      }

      // Upload playlist
      uploads.push(this.uploadText(
        manifests[quality],
        `videos/${videoId}/${quality}/playlist.m3u8`,
        'application/vnd.apple.mpegurl'
      ));
    }

    // Upload master playlist
    uploads.push(this.uploadText(
      manifests.master,
      `videos/${videoId}/master.m3u8`,
      'application/vnd.apple.mpegurl'
    ));

    // Upload thumbnails
    for (const thumb of thumbnails.individual) {
      uploads.push(this.uploadFile(thumb.path, thumb.s3Key));
    }

    await Promise.all(uploads);
  }
}
```

---

## Auto-Scaling Configuration

### Kubernetes HPA for GPU Workers

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: video-transcode-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: video-transcode-worker
  minReplicas: 10
  maxReplicas: 1000
  metrics:
    # Scale based on Kafka consumer lag
    - type: External
      external:
        metric:
          name: kafka_consumer_lag
          selector:
            matchLabels:
              topic: video-transcode-chunks
        target:
          type: AverageValue
          averageValue: "100"  # 100 chunks per pod

    # Also consider GPU utilization
    - type: Resource
      resource:
        name: nvidia.com/gpu
        target:
          type: Utilization
          averageUtilization: 80

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-transcode-worker
spec:
  template:
    spec:
      containers:
        - name: worker
          image: instagram/video-transcoder:latest
          resources:
            limits:
              nvidia.com/gpu: 1
              memory: "16Gi"
              cpu: "4"
            requests:
              nvidia.com/gpu: 1
              memory: "8Gi"
              cpu: "2"
      tolerations:
        - key: "nvidia.com/gpu"
          operator: "Exists"
          effect: "NoSchedule"
      nodeSelector:
        cloud.google.com/gke-accelerator: nvidia-tesla-t4
```

### Spot/Preemptible Instance Strategy

```javascript
// Use spot instances for transcoding (75% cost savings)

const workerConfig = {
  // Primary: Spot instances (cheap, interruptible)
  spotFleet: {
    instanceTypes: ['g4dn.xlarge', 'g4dn.2xlarge', 'p3.2xlarge'],
    targetCapacity: 800,
    terminationPolicy: 'capacity-optimized',
    allocationStrategy: 'lowest-price',
    interruptionBehavior: 'terminate'
  },

  // Fallback: On-demand (guaranteed, expensive)
  onDemandFleet: {
    instanceTypes: ['g4dn.xlarge'],
    targetCapacity: 100,  // Minimum guaranteed capacity
    allocationStrategy: 'prioritized'
  },

  // Handle spot interruptions gracefully
  interruptionHandler: async (instanceId) => {
    // 2-minute warning before termination
    const runningJobs = await getJobsOnInstance(instanceId);

    for (const job of runningJobs) {
      // Re-queue the job for another worker
      await requeueChunk(job);
      console.log(`Re-queued chunk ${job.chunkId} due to spot interruption`);
    }
  }
};
```

---

## Performance Optimization

### GPU vs CPU Encoding Comparison

```javascript
const encodingBenchmark = {
  // 60-second 4K video to 1080p
  cpu: {
    encoder: 'libx264',
    preset: 'fast',
    time: '45 seconds',
    quality: 'Reference (best)',
    cost: '$0.10 per video'  // c5.4xlarge
  },

  gpuNvidia: {
    encoder: 'h264_nvenc',
    preset: 'p4',
    time: '8 seconds',  // 5.6x faster
    quality: '95% of CPU',
    cost: '$0.08 per video'  // g4dn.xlarge spot
  },

  gpuAMD: {
    encoder: 'h264_amf',
    preset: 'balanced',
    time: '10 seconds',
    quality: '92% of CPU',
    cost: '$0.07 per video'
  }
};

// At Instagram scale (500M videos/day):
// CPU only: $50M/day in compute
// GPU: $8M/day (84% savings)
```

### Parallel Chunk Processing Benefits

```javascript
const parallelBenchmark = {
  // 60-second video, 5 quality levels

  sequential: {
    chunks: 1,
    workers: 1,
    totalTime: '10 minutes',
    throughput: '0.1 videos/minute'
  },

  chunked_10: {
    chunks: 10,
    workers: 10,
    totalTime: '1 minute',  // 10x faster
    throughput: '1 video/minute'
  },

  chunked_with_quality_parallel: {
    chunks: 10,
    qualities: 5,
    workers: 50,
    totalTime: '12 seconds',  // 50x faster
    throughput: '5 videos/minute'
  }
};
```

---

## Error Handling & Reliability

### Retry Strategy

```javascript
class ChunkProcessor {
  async processWithRetry(task, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.processChunk(task);
      } catch (error) {
        attempt++;

        if (attempt >= maxRetries) {
          // Send to dead letter queue
          await this.sendToDLQ(task, error);
          throw error;
        }

        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
        await sleep(delay);

        // Log retry
        console.warn(`Retry ${attempt}/${maxRetries} for chunk ${task.chunkId}: ${error.message}`);
      }
    }
  }

  async sendToDLQ(task, error) {
    await kafka.send({
      topic: 'video-chunks-dlq',
      messages: [{
        key: task.videoId,
        value: JSON.stringify({
          ...task,
          error: error.message,
          failedAt: Date.now()
        })
      }]
    });
  }
}
```

### Idempotent Chunk Processing

```javascript
async function processChunkIdempotent(task) {
  const lockKey = `chunk-lock:${task.chunkId}:${task.quality}`;

  // Try to acquire lock
  const acquired = await redis.set(lockKey, 'processing', 'NX', 'EX', 600);

  if (!acquired) {
    // Already processing or completed
    const status = await redis.get(`chunk-status:${task.chunkId}:${task.quality}`);
    if (status === 'complete') {
      console.log(`Chunk ${task.chunkId} already processed, skipping`);
      return;
    }
    // Still processing, skip
    return;
  }

  try {
    await processChunk(task);

    // Mark as complete
    await redis.set(`chunk-status:${task.chunkId}:${task.quality}`, 'complete', 'EX', 86400);
  } finally {
    await redis.del(lockKey);
  }
}
```

---

## Cost Analysis

### Processing Cost per Video

```javascript
const costBreakdown = {
  // 60-second 1080p video

  compute: {
    gpuTime: 8,  // seconds
    gpuCostPerHour: 0.526,  // g4dn.xlarge spot
    costPerVideo: (8 / 3600) * 0.526 * 5,  // 5 qualities
    total: '$0.006'
  },

  storage: {
    tempStorage: '400MB × $0.023/GB × 1 hour',
    permanent: '50MB × $0.023/GB × 1 month',
    total: '$0.002'
  },

  transfer: {
    s3ToWorker: '400MB × $0 (same region)',
    workerToS3: '50MB × $0 (same region)',
    total: '$0.00'
  },

  kafka: {
    messages: 50,  // chunks × qualities
    costPer1M: 0.05,
    total: '$0.000003'
  },

  totalPerVideo: '$0.008',
  dailyCost500M: '$4,000,000',
  monthlyCost: '$120,000,000'  // Before optimizations

  // With optimizations (caching, spot instances, efficient encoding):
  optimizedMonthly: '$15,000,000'  // 87.5% savings
};
```

---

## Quick Win: Basic Video Pipeline (30 min)

```javascript
// Simplified video processing with Bull queue

const Queue = require('bull');
const ffmpeg = require('fluent-ffmpeg');

const videoQueue = new Queue('video-processing', {
  redis: { host: 'localhost', port: 6379 }
});

// Upload endpoint
app.post('/api/video/upload', upload.single('video'), async (req, res) => {
  const videoId = uuidv4();
  const inputPath = req.file.path;

  await videoQueue.add({
    videoId,
    inputPath,
    userId: req.user.id
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  });

  res.json({ videoId, status: 'processing' });
});

// Worker
videoQueue.process(async (job) => {
  const { videoId, inputPath } = job.data;
  const outputDir = `./output/${videoId}`;

  await fs.mkdir(outputDir, { recursive: true });

  // Generate HLS with multiple qualities
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-profile:v baseline',
        '-level 3.0',
        '-start_number 0',
        '-hls_time 6',
        '-hls_list_size 0',
        '-f hls'
      ])
      .output(`${outputDir}/playlist.m3u8`)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  // Upload to S3
  await uploadDirectory(outputDir, `videos/${videoId}`);

  return { success: true, videoId };
});
```

---

## Key Takeaways

**What you learned:**
- Chunk-based parallel processing enables 10-50x speedup
- GPU encoding is 5-6x faster than CPU at lower cost
- Spot instances reduce compute cost by 75%
- Orchestrator pattern coordinates distributed transcoding

**The architecture:**
```
Upload → Orchestrator → Chunk Queue → Workers → Assembly → CDN
          (split)        (Kafka)     (GPU)     (merge)
```

**Performance targets:**
```
Metric              | Target         | How to achieve
--------------------|----------------|---------------------------
Processing time     | < 1 min        | Parallel chunks + GPU
Throughput          | 500M/day       | 1000+ GPU workers
Cost per video      | < $0.01        | Spot instances + caching
Error rate          | < 0.1%         | Retries + DLQ
```

---

## What's Next?

Videos are processed. Now, how do you stream them adaptively based on network conditions?

**Next Article:** [Part 4: Video Streaming & Adaptive Delivery](/interview-prep/system-design/instagram-assets-series/04-video-streaming-delivery) — HLS/DASH implementation, player integration, and buffer management.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
