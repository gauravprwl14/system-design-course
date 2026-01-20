# Image Upload & Processing Pipeline - Handle 100M+ Uploads Daily

> **Reading Time:** 20 minutes
> **Difficulty:** 🟡 Intermediate
> **Prerequisites:** [CDN Fundamentals](/interview-prep/system-design/instagram-assets-series/prereq-cdn-fundamentals), [Image Optimization](/interview-prep/system-design/instagram-assets-series/prereq-image-optimization), [Object Storage](/interview-prep/system-design/instagram-assets-series/prereq-object-storage)
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The 10-Second Upload That Takes 10 Minutes

**A user uploads a photo. Simple, right?**

```
User taps "Share"
  ↓
Photo: 12 MB (iPhone 15 Pro, HEIC format)
Upload speed: 5 Mbps
Upload time: 19 seconds... just for transfer

But then:
  ↓
Convert HEIC → JPEG (server doesn't support HEIC)
  ↓
Resize to 5 variants (150, 320, 640, 1080, 2048 pixels)
  ↓
Encode each as JPEG, WebP, AVIF (15 files!)
  ↓
Upload to S3 (15 PUT requests)
  ↓
Replicate to 3 regions
  ↓
Update database (photo metadata, user feed, followers' feeds)
  ↓
Push to CDN edge locations

Total time: 10+ minutes for 1 photo

At 100 million photos/day:
- 1,157 uploads/second peak
- Each taking 10 minutes of processing
- Queue builds infinitely
- System collapses
```

**This doesn't scale.**

Instagram solved this by building an async, distributed processing pipeline that handles 100M+ uploads daily with sub-second apparent latency.

This article shows you exactly how they do it.

---

## The $50K/Hour Problem

**Real Incident: Photo Sharing Startup (2019)**

```
Black Friday morning:
- Normal traffic: 10K uploads/hour
- Black Friday: 200K uploads/hour (20x spike)

What happened:
09:00 - Traffic spikes, upload queue growing
09:15 - Queue: 50,000 photos waiting
09:30 - Processing workers maxed out
09:45 - Queue: 200,000 photos, 45-minute delay
10:00 - Users see "Upload failed" (timeout)
10:15 - Users retry → queue doubles
10:30 - Complete outage, queue: 500,000+
12:00 - Emergency scaling (too late)
14:00 - Queue cleared, but damage done

Cost:
- 4 hours of degraded service during peak shopping
- 40% of users experienced failures
- $50K/hour in GMV lost = $200K+ total
- Negative press, user churn

Root cause: Synchronous image processing on upload path
```

**The fix:** Decouple upload from processing. Accept the photo immediately, process in the background.

---

## Why Synchronous Processing Fails

### The Naive Approach

```javascript
// ❌ Synchronous upload handler (DON'T DO THIS)

app.post('/api/upload', async (req, res) => {
  try {
    // Step 1: Receive file (blocking, 5-20 seconds for large files)
    const file = await receiveFile(req);

    // Step 2: Validate (100ms)
    await validateImage(file);

    // Step 3: Process all variants (10-30 seconds!)
    const variants = await processAllVariants(file);
    //   ├── Decode HEIC → bitmap
    //   ├── Resize to 5 sizes
    //   ├── Encode JPEG, WebP, AVIF (15 files)
    //   └── Each encode: 500ms-2s

    // Step 4: Upload to S3 (15 requests × 100ms = 1.5s)
    await uploadToS3(variants);

    // Step 5: Update database
    await updateDatabase(req.user.id, variants);

    // Step 6: Invalidate CDN cache
    await invalidateCDN(variants);

    // Total time: 30-60 seconds
    // User staring at spinner the whole time
    res.json({ success: true, photoId: variants.id });

  } catch (error) {
    // If ANYTHING fails, user sees error
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Problems:
// 1. User waits 30-60 seconds (terrible UX)
// 2. One slow step blocks everything
// 3. Server threads tied up (limits concurrency)
// 4. Timeout = retry = double processing
// 5. No retry for partial failures
```

### The Scale Problem

```
Synchronous processing at scale:

Uploads/sec: 1,000
Processing time: 30 seconds
Concurrent requests needed: 30,000

But your server pool:
- 100 servers
- 200 threads per server
- Max concurrent: 20,000

Result: Queue builds, timeouts, cascading failure
```

---

## The Instagram Approach: Async Pipeline

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   INSTAGRAM UPLOAD PIPELINE                      │
└─────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────────────────────────┐
     │                      MOBILE APP                          │
     │  1. Client-side preprocessing                           │
     │     - Resize to max 4096px                              │
     │     - Compress to <10MB                                 │
     │     - Calculate blurhash for placeholder                │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │                    UPLOAD SERVICE                        │
     │  2. Accept upload, return immediately                   │
     │     - Stream to temp S3 bucket                          │
     │     - Return upload_id in <1 second                     │
     │     - Enqueue processing job                            │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │                    MESSAGE QUEUE                         │
     │  3. Reliable job queue (Kafka/SQS)                      │
     │     - At-least-once delivery                            │
     │     - Dead letter queue for failures                    │
     │     - Priority queues (paid users, popular users)       │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │                  PROCESSING WORKERS                      │
     │  4. Auto-scaling worker fleet                           │
     │     - Validate image                                    │
     │     - Generate variants (resize, encode)                │
     │     - Content moderation (ML-based)                     │
     │     - Upload to permanent S3                            │
     └─────────────────────────────────────────────────────────┘
                               ↓
     ┌─────────────────────────────────────────────────────────┐
     │                   COMPLETION SERVICE                     │
     │  5. Finalize and notify                                 │
     │     - Update database with photo metadata               │
     │     - Trigger feed fanout                               │
     │     - Push notification to app (processing complete)    │
     │     - Warm CDN cache                                    │
     └─────────────────────────────────────────────────────────┘
```

### Timeline Comparison

```
Synchronous (bad):
├─ Upload file ──────────────────────────────────────────┤ 20s
├─ Process variants ──────────────────────────────────────────────────────┤ 30s
├─ Upload to S3 ─────────────────────────────────────────────────────────────────┤ 10s
├─ Update DB ─────────────────────────────────────────────────────────────────────┤ 1s
Total user wait: 61 seconds ❌

Asynchronous (Instagram approach):
├─ Upload file ─────────┤ 5s
├─ Response ┤ 0.1s
Total user wait: 5.1 seconds ✅

Background (user doesn't wait):
├─────────────────────── Process variants ────────────────────────┤
├───────────────────────────────── Upload to S3 ──────────────────┤
├─────────────────────────────────────────────────────────────────── Update DB ─┤
├─ Push notification: "Photo posted!" ─┤
```

---

## Implementation Deep Dive

### Step 1: Client-Side Preprocessing

```javascript
// Mobile client (React Native example)

async function prepareUpload(photoUri) {
  // 1. Read image
  const image = await ImageManipulator.manipulateAsync(
    photoUri,
    [
      // Resize if larger than 4096px (reduce upload size)
      { resize: { width: 4096, height: 4096 } }
    ],
    {
      compress: 0.9,  // 90% quality
      format: ImageManipulator.SaveFormat.JPEG
    }
  );

  // 2. Generate placeholder (blurhash) for instant display
  const blurhash = await generateBlurhash(image.uri, 4, 3);

  // 3. Get pre-signed upload URL from server
  const { uploadUrl, uploadId } = await fetch('/api/upload/init', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      contentType: 'image/jpeg',
      fileSize: image.size,
      blurhash: blurhash,
      width: image.width,
      height: image.height
    })
  }).then(r => r.json());

  return { image, uploadUrl, uploadId, blurhash };
}

async function uploadPhoto(photoUri, caption) {
  const { image, uploadUrl, uploadId, blurhash } = await prepareUpload(photoUri);

  // 4. Upload directly to S3 (bypasses your servers)
  await fetch(uploadUrl, {
    method: 'PUT',
    body: await fetch(image.uri).then(r => r.blob()),
    headers: { 'Content-Type': 'image/jpeg' }
  });

  // 5. Notify server upload is complete
  const { photoId, status } = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      uploadId: uploadId,
      caption: caption
    })
  }).then(r => r.json());

  // 6. Show photo immediately with blurhash placeholder
  // Photo appears in feed instantly (with blur)
  // As processing completes, full quality loads

  return { photoId, blurhash };
}
```

### Step 2: Upload Service

```javascript
// Upload Service (handles initial upload)

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const app = express();
const s3 = new S3Client({ region: 'us-west-2' });
const redis = require('./redis');
const kafka = require('./kafka');

// Initialize upload - return pre-signed URL
app.post('/api/upload/init', async (req, res) => {
  const { contentType, fileSize, blurhash, width, height } = req.body;
  const userId = req.user.id;

  // Validate
  if (fileSize > 20 * 1024 * 1024) {  // 20MB limit
    return res.status(400).json({ error: 'File too large' });
  }

  const uploadId = uuidv4();
  const s3Key = `uploads/pending/${uploadId}.jpg`;

  // Generate pre-signed URL (valid 10 minutes)
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: 'instagram-uploads-temp',
    Key: s3Key,
    ContentType: contentType
  }), { expiresIn: 600 });

  // Store upload metadata in Redis (TTL 1 hour)
  await redis.setex(`upload:${uploadId}`, 3600, JSON.stringify({
    userId,
    s3Key,
    blurhash,
    width,
    height,
    status: 'pending',
    createdAt: Date.now()
  }));

  res.json({ uploadUrl, uploadId });
});

// Complete upload - trigger processing
app.post('/api/upload/complete', async (req, res) => {
  const { uploadId, caption } = req.body;
  const userId = req.user.id;

  // Get upload metadata
  const uploadData = await redis.get(`upload:${uploadId}`);
  if (!uploadData) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  const upload = JSON.parse(uploadData);
  if (upload.userId !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Generate photo ID
  const photoId = generateSnowflakeId();

  // Enqueue processing job
  await kafka.send({
    topic: 'photo-processing',
    messages: [{
      key: photoId,
      value: JSON.stringify({
        photoId,
        uploadId,
        userId,
        s3Key: upload.s3Key,
        blurhash: upload.blurhash,
        caption,
        width: upload.width,
        height: upload.height,
        priority: getUserPriority(userId)  // Premium users get priority
      })
    }]
  });

  // Update status
  upload.status = 'processing';
  upload.photoId = photoId;
  await redis.setex(`upload:${uploadId}`, 3600, JSON.stringify(upload));

  // Return immediately - processing happens in background
  res.json({
    photoId,
    status: 'processing',
    blurhash: upload.blurhash,
    estimatedTime: 5  // seconds
  });
});
```

### Step 3: Processing Workers

```javascript
// Processing Worker (auto-scaling fleet)

const { Kafka } = require('kafkajs');
const sharp = require('sharp');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const kafka = new Kafka({ brokers: ['kafka:9092'] });
const consumer = kafka.consumer({ groupId: 'photo-processors' });
const s3 = new S3Client({ region: 'us-west-2' });

const VARIANTS = [
  { name: 't', size: 150 },   // thumbnail
  { name: 's', size: 320 },   // small
  { name: 'm', size: 640 },   // medium
  { name: 'l', size: 1080 },  // large
  { name: 'x', size: 2048 }   // extra large
];

const FORMATS = ['jpeg', 'webp', 'avif'];

async function processPhoto(message) {
  const job = JSON.parse(message.value);
  const { photoId, s3Key, userId } = job;

  console.log(`Processing photo ${photoId} for user ${userId}`);

  try {
    // 1. Download original from temp bucket
    const original = await downloadFromS3('instagram-uploads-temp', s3Key);

    // 2. Validate image
    const metadata = await sharp(original).metadata();
    if (!['jpeg', 'png', 'heic', 'webp'].includes(metadata.format)) {
      throw new Error('Invalid image format');
    }

    // 3. Generate all variants (parallel)
    const variantJobs = [];

    for (const variant of VARIANTS) {
      for (const format of FORMATS) {
        variantJobs.push(
          generateVariant(original, photoId, variant, format)
        );
      }
    }

    const results = await Promise.all(variantJobs);

    // 4. Upload all variants to permanent storage (parallel)
    await Promise.all(results.map(r =>
      uploadToS3('instagram-photos-prod', r.key, r.buffer, r.contentType)
    ));

    // 5. Run content moderation (ML)
    const moderationResult = await moderateContent(original);
    if (moderationResult.blocked) {
      await handleBlockedContent(photoId, moderationResult);
      return;
    }

    // 6. Update database
    await db.query(`
      INSERT INTO photos (id, user_id, variants, moderation_status, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [photoId, userId, JSON.stringify(results.map(r => r.key)), moderationResult.status]);

    // 7. Trigger feed fanout
    await kafka.send({
      topic: 'feed-fanout',
      messages: [{
        key: photoId,
        value: JSON.stringify({ photoId, userId })
      }]
    });

    // 8. Notify completion
    await notifyComplete(photoId, userId);

    // 9. Delete temp file
    await deleteFromS3('instagram-uploads-temp', s3Key);

    console.log(`Completed processing photo ${photoId}`);

  } catch (error) {
    console.error(`Error processing ${photoId}:`, error);
    // Message will be retried by Kafka
    throw error;
  }
}

async function generateVariant(buffer, photoId, variant, format) {
  let pipeline = sharp(buffer)
    .resize(variant.size, variant.size, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .rotate();  // Auto-orient based on EXIF

  const formatOptions = {
    jpeg: { quality: 85, progressive: true, mozjpeg: true },
    webp: { quality: 80, effort: 4 },
    avif: { quality: 75, effort: 4 }
  };

  pipeline = pipeline.toFormat(format, formatOptions[format]);
  const outputBuffer = await pipeline.toBuffer();

  const key = `photos/${photoId}/${variant.name}.${format}`;
  const contentType = `image/${format}`;

  return {
    key,
    buffer: outputBuffer,
    contentType,
    size: outputBuffer.length
  };
}

// Start worker
async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'photo-processing' });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      await processPhoto(message);
    }
  });
}

run().catch(console.error);
```

### Step 4: Auto-Scaling Configuration

```yaml
# Kubernetes HPA for processing workers
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: photo-processor-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: photo-processor
  minReplicas: 10
  maxReplicas: 500
  metrics:
    # Scale based on Kafka lag
    - type: External
      external:
        metric:
          name: kafka_consumergroup_lag
          selector:
            matchLabels:
              topic: photo-processing
        target:
          type: AverageValue
          averageValue: "1000"  # Scale up when lag > 1000 messages per pod

    # Also scale on CPU (for compute-intensive processing)
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Handling Edge Cases

### Retry Logic with Exponential Backoff

```javascript
// Kafka consumer with retry handling

async function processWithRetry(message, maxRetries = 3) {
  const job = JSON.parse(message.value);
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await processPhoto(message);
      return;  // Success
    } catch (error) {
      attempt++;

      if (attempt >= maxRetries) {
        // Send to dead letter queue
        await kafka.send({
          topic: 'photo-processing-dlq',
          messages: [{
            key: job.photoId,
            value: JSON.stringify({
              ...job,
              error: error.message,
              attempts: attempt
            })
          }]
        });

        // Notify user of failure
        await notifyUploadFailed(job.photoId, job.userId);
        return;
      }

      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
      await sleep(delay);
    }
  }
}
```

### Handling Duplicate Uploads

```javascript
// Idempotency with Redis

async function ensureIdempotent(uploadId) {
  // Try to acquire lock (returns false if already processing)
  const acquired = await redis.set(
    `processing:${uploadId}`,
    'locked',
    'NX',  // Only set if not exists
    'EX', 300  // Expire in 5 minutes
  );

  if (!acquired) {
    console.log(`Upload ${uploadId} already being processed, skipping`);
    return false;
  }

  return true;
}

async function processPhoto(message) {
  const job = JSON.parse(message.value);

  // Check idempotency
  if (!await ensureIdempotent(job.uploadId)) {
    return;  // Already processed or processing
  }

  try {
    // ... processing logic
  } finally {
    // Release lock (allow retries if needed)
    await redis.del(`processing:${job.uploadId}`);
  }
}
```

### Progress Tracking

```javascript
// Client-side polling for status

async function waitForProcessing(photoId) {
  const maxAttempts = 30;  // 30 seconds max
  let attempt = 0;

  while (attempt < maxAttempts) {
    const status = await fetch(`/api/photo/${photoId}/status`)
      .then(r => r.json());

    switch (status.state) {
      case 'complete':
        return status.urls;  // Return all variant URLs

      case 'failed':
        throw new Error(status.error);

      case 'processing':
        // Show progress to user
        updateProgressUI(status.progress);
        break;
    }

    await sleep(1000);
    attempt++;
  }

  throw new Error('Processing timeout');
}

// Or use WebSocket for real-time updates
socket.on('photo:complete', (data) => {
  if (data.photoId === currentPhotoId) {
    updatePhotoUI(data.urls);
  }
});
```

---

## Performance Metrics

### Pipeline Performance

| Metric | Target | Actual |
|--------|--------|--------|
| **Upload latency** (user wait) | < 5s | 2-3s |
| **Processing time** (P50) | < 10s | 6s |
| **Processing time** (P99) | < 30s | 18s |
| **Throughput** | 2,000/sec | 2,500/sec |
| **Error rate** | < 0.1% | 0.02% |
| **Storage per photo** (all variants) | < 2 MB | 800 KB |

### Cost Breakdown (100M photos/day)

```javascript
const costAnalysis = {
  compute: {
    workers: '500 pods average',
    instanceType: 'c6i.2xlarge',
    costPerHour: 500 * 0.34,
    dailyCost: 500 * 0.34 * 24,
    monthlyCost: '$122,400'
  },

  storage: {
    dailyIngress: '80 TB',
    monthlyStorage: '2.4 PB',
    tieredCost: '$55,000/month (after lifecycle policies)'
  },

  transfer: {
    s3ToProcessing: 'Free (same region)',
    s3ToCloudFront: '$0.085/GB',
    monthlyTransfer: '100 PB egress',
    monthlyCost: 'Negotiated enterprise rate'
  },

  kafka: {
    topics: 3,
    partitions: 100,
    monthlyCost: '$15,000 (MSK)'
  }
};
```

---

## Quick Win: Add Async Processing to Your App

### Minimal Implementation (15 minutes)

```javascript
// 1. Install dependencies
// npm install bull redis sharp

const Queue = require('bull');
const sharp = require('sharp');

// 2. Create processing queue
const photoQueue = new Queue('photo-processing', {
  redis: { host: 'localhost', port: 6379 }
});

// 3. Upload endpoint (returns immediately)
app.post('/api/upload', upload.single('photo'), async (req, res) => {
  const photoId = uuidv4();

  // Save temp file
  const tempPath = `/tmp/${photoId}-original`;
  await fs.promises.writeFile(tempPath, req.file.buffer);

  // Enqueue processing
  await photoQueue.add({
    photoId,
    tempPath,
    userId: req.user.id
  });

  // Return immediately
  res.json({
    photoId,
    status: 'processing',
    statusUrl: `/api/photo/${photoId}/status`
  });
});

// 4. Worker process
photoQueue.process(async (job) => {
  const { photoId, tempPath, userId } = job.data;

  // Generate variants
  const variants = await generateVariants(tempPath, photoId);

  // Upload to S3
  await uploadVariants(variants);

  // Update database
  await db.photos.create({ id: photoId, userId, variants });

  // Cleanup
  await fs.promises.unlink(tempPath);

  return { success: true };
});

// 5. Status endpoint
app.get('/api/photo/:id/status', async (req, res) => {
  const photo = await db.photos.findById(req.params.id);

  if (photo) {
    res.json({ state: 'complete', urls: photo.variants });
  } else {
    const job = await photoQueue.getJob(req.params.id);
    if (job) {
      res.json({ state: 'processing', progress: job.progress() });
    } else {
      res.json({ state: 'pending' });
    }
  }
});
```

---

## Key Takeaways

**What you learned:**
- Synchronous image processing doesn't scale (blocks threads, causes timeouts)
- Async pipeline: accept upload fast, process in background
- Pre-signed URLs let clients upload directly to S3 (bypass your servers)
- Auto-scaling workers with Kafka/SQS handle traffic spikes
- Blurhash placeholders provide instant perceived performance

**The pattern:**
```
User uploads → Quick acknowledgment → Background processing → Notification
     ↓
Response in <5 seconds
     ↓
Processing takes 10-30 seconds (user doesn't wait)
     ↓
Push notification or WebSocket when complete
```

**Implementation checklist:**
- [ ] Client-side resize before upload (reduce transfer time)
- [ ] Pre-signed URLs for direct S3 upload
- [ ] Message queue for reliable async processing
- [ ] Auto-scaling workers based on queue depth
- [ ] Idempotency handling (prevent duplicate processing)
- [ ] Dead letter queue for failed jobs
- [ ] Progress tracking for user feedback

---

## What's Next?

The photo is processed and stored. Now, how do you serve it to 2 billion users globally in under 100ms?

**Next Article:** [Part 2: Image Serving at Global Scale](/interview-prep/system-design/instagram-assets-series/02-image-serving-at-scale) — CDN architecture, format selection, and cache strategies for global delivery.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
