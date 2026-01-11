# AWS S3 TPS Limits & Optimization

## Question
**"What are S3 TPS limits? How do you handle high-throughput scenarios with S3? Explain partitioning strategies."**

Common in: AWS, Cloud Architecture, Backend interviews

---

## 📊 Quick Answer

**S3 TPS (Transactions Per Second) Limits**:
- **3,500 PUT/COPY/POST/DELETE** requests per second per prefix
- **5,500 GET/HEAD** requests per second per prefix
- **No limit** on number of prefixes

**Key Concept**: "Prefix" = The path before the filename

```
s3://bucket/user-123/photo.jpg
         └─────┬────┘
            Prefix
```

**Optimization Strategy**:
- ✅ Use multiple prefixes (distribute load)
- ✅ Use random prefixes for high TPS
- ✅ CloudFront CDN for read-heavy workloads
- ✅ S3 Transfer Acceleration for uploads

---

## 🎯 Understanding S3 Limits

### What is a Prefix?

```
Bucket: my-app-uploads

Files:
s3://my-app-uploads/images/2024/01/photo1.jpg  ← Prefix: images/2024/01/
s3://my-app-uploads/images/2024/01/photo2.jpg  ← Same prefix
s3://my-app-uploads/images/2024/02/photo3.jpg  ← Prefix: images/2024/02/
s3://my-app-uploads/videos/video1.mp4          ← Prefix: videos/
s3://my-app-uploads/documents/doc1.pdf         ← Prefix: documents/

Each prefix can handle:
- 3,500 writes/sec
- 5,500 reads/sec
```

### Calculating Your Needs

```javascript
// Example: Photo upload app
// 10,000 uploads per second needed

// Single prefix (images/)
// Limit: 3,500 uploads/sec
// Result: Will throttle! ❌

// Multiple prefixes (distribute by user ID)
// Prefix 1: images/user-0-999/
// Prefix 2: images/user-1000-1999/
// Prefix 3: images/user-2000-2999/
// Total: 3,500 × 3 = 10,500 uploads/sec ✅

// Number of prefixes needed = Desired TPS / 3,500
// 10,000 / 3,500 = 2.86 → 3 prefixes minimum
```

---

## 💻 Implementation Strategies

### 1. Hash-Based Prefix Distribution

```javascript
// s3-upload-distributed.js
const AWS = require('aws-sdk');
const crypto = require('crypto');

const s3 = new AWS.S3();

class S3Uploader {
  constructor(bucketName, numPrefixes = 10) {
    this.bucket = bucketName;
    this.numPrefixes = numPrefixes;
  }

  // Generate hash-based prefix to distribute load
  getPrefix(userId) {
    const hash = crypto.createHash('md5')
      .update(userId.toString())
      .digest('hex');

    // Use first 2 characters of hash
    const prefixIndex = parseInt(hash.substring(0, 2), 16) % this.numPrefixes;

    return `uploads/shard-${prefixIndex}/`;
  }

  async uploadFile(userId, fileName, fileContent) {
    const prefix = this.getPrefix(userId);
    const key = `${prefix}${userId}/${fileName}`;

    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: fileContent,
      ContentType: 'image/jpeg',

      // Metadata
      Metadata: {
        uploadedBy: userId.toString(),
        uploadedAt: new Date().toISOString()
      }
    };

    try {
      const result = await s3.upload(params).promise();

      console.log('Upload successful:', {
        key,
        location: result.Location,
        etag: result.ETag
      });

      return result;
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
    }
  }

  async getFile(userId, fileName) {
    const prefix = this.getPrefix(userId);
    const key = `${prefix}${userId}/${fileName}`;

    const params = {
      Bucket: this.bucket,
      Key: key
    };

    return await s3.getObject(params).promise();
  }
}

// Usage
const uploader = new S3Uploader('my-app-uploads', 10);

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const userId = req.user.id;
  const file = req.file;

  const result = await uploader.uploadFile(
    userId,
    file.originalname,
    file.buffer
  );

  res.json({
    url: result.Location,
    key: result.Key
  });
});

// With 10 prefixes:
// Capacity: 10 × 3,500 = 35,000 uploads/sec
```

---

### 2. Date-Based Prefix (Time-Series Data)

```javascript
// date-based-prefix.js
class S3Logger {
  constructor(bucketName) {
    this.bucket = bucketName;
  }

  getDatePrefix() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');

    // Prefix by date and hour
    return `logs/${year}/${month}/${day}/${hour}/`;
  }

  async uploadLog(logId, logData) {
    const prefix = this.getDatePrefix();
    const key = `${prefix}${logId}.json`;

    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(logData),
      ContentType: 'application/json'
    };

    return await s3.upload(params).promise();
  }
}

// Logs are naturally distributed across time
// Each hour gets a new prefix: logs/2024/12/31/00/, logs/2024/12/31/01/, etc.

const logger = new S3Logger('app-logs');

app.post('/api/logs', async (req, res) => {
  const logId = `log-${Date.now()}-${Math.random()}`;

  await logger.uploadLog(logId, {
    timestamp: new Date().toISOString(),
    level: req.body.level,
    message: req.body.message
  });

  res.json({ success: true });
});
```

---

### 3. Random Prefix for Maximum Distribution

```javascript
// random-prefix.js
class S3RandomPrefix {
  constructor(bucketName) {
    this.bucket = bucketName;
  }

  // Generate random prefix (00-99)
  getRandomPrefix() {
    const random = Math.floor(Math.random() * 100);
    const prefixId = String(random).padStart(2, '0');
    return `uploads/${prefixId}/`;
  }

  async upload(fileName, content) {
    const prefix = this.getRandomPrefix();
    const timestamp = Date.now();
    const key = `${prefix}${timestamp}-${fileName}`;

    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: content
    };

    return await s3.upload(params).promise();
  }
}

// With 100 random prefixes:
// Capacity: 100 × 3,500 = 350,000 uploads/sec!

const uploader = new S3RandomPrefix('high-throughput-uploads');

app.post('/api/upload', async (req, res) => {
  const result = await uploader.upload(req.file.originalname, req.file.buffer);
  res.json({ url: result.Location });
});
```

---

### 4. Multipart Upload for Large Files

```javascript
// multipart-upload.js
const fs = require('fs');
const stream = require('stream');

class S3MultipartUploader {
  constructor(bucketName) {
    this.bucket = bucketName;
    this.s3 = new AWS.S3();
  }

  async uploadLargeFile(key, filePath) {
    const fileSize = fs.statSync(filePath).size;
    const partSize = 10 * 1024 * 1024; // 10MB parts

    console.log(`Uploading ${fileSize} bytes in ${Math.ceil(fileSize / partSize)} parts`);

    // Method 1: Using managed upload (recommended)
    const managedUpload = this.s3.upload({
      Bucket: this.bucket,
      Key: key,
      Body: fs.createReadStream(filePath),

      // Multipart config
      partSize: partSize,
      queueSize: 4 // Upload 4 parts concurrently
    });

    // Track progress
    managedUpload.on('httpUploadProgress', (progress) => {
      const percent = (progress.loaded / progress.total * 100).toFixed(2);
      console.log(`Upload progress: ${percent}%`);
    });

    return await managedUpload.promise();
  }

  // Method 2: Manual multipart upload (more control)
  async uploadLargeFileManual(key, filePath) {
    const fileSize = fs.statSync(filePath).size;
    const partSize = 10 * 1024 * 1024; // 10MB

    // Step 1: Initiate multipart upload
    const multipart = await this.s3.createMultipartUpload({
      Bucket: this.bucket,
      Key: key
    }).promise();

    const uploadId = multipart.UploadId;
    console.log('Multipart upload initiated:', uploadId);

    try {
      // Step 2: Upload parts
      const parts = [];
      const numParts = Math.ceil(fileSize / partSize);

      for (let partNum = 1; partNum <= numParts; partNum++) {
        const start = (partNum - 1) * partSize;
        const end = Math.min(start + partSize, fileSize);

        const partStream = fs.createReadStream(filePath, { start, end: end - 1 });

        const uploadPart = await this.s3.uploadPart({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNum,
          Body: partStream
        }).promise();

        parts.push({
          PartNumber: partNum,
          ETag: uploadPart.ETag
        });

        console.log(`Part ${partNum}/${numParts} uploaded`);
      }

      // Step 3: Complete multipart upload
      const result = await this.s3.completeMultipartUpload({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      }).promise();

      console.log('Upload completed:', result.Location);
      return result;

    } catch (err) {
      // Abort on failure
      await this.s3.abortMultipartUpload({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId
      }).promise();

      throw err;
    }
  }
}

// Usage
const uploader = new S3MultipartUploader('large-files-bucket');

app.post('/api/upload-large', async (req, res) => {
  const tempPath = `/tmp/${req.file.filename}`;

  // Save to temp file
  fs.writeFileSync(tempPath, req.file.buffer);

  // Upload with multipart
  const result = await uploader.uploadLargeFile(
    `uploads/${Date.now()}-${req.file.originalname}`,
    tempPath
  );

  // Clean up
  fs.unlinkSync(tempPath);

  res.json({ url: result.Location });
});

// Benefits:
// - Resume failed uploads
// - Upload parts in parallel (faster!)
// - Required for files > 5GB
```

---

### 5. S3 Transfer Acceleration

```javascript
// s3-transfer-acceleration.js
const s3Accelerated = new AWS.S3({
  // Enable Transfer Acceleration endpoint
  useAccelerateEndpoint: true
});

async function uploadWithAcceleration(bucket, key, body) {
  const params = {
    Bucket: bucket, // Must have Transfer Acceleration enabled
    Key: key,
    Body: body
  };

  const result = await s3Accelerated.upload(params).promise();

  console.log('Upload completed via Transfer Acceleration:', result.Location);
  return result;
}

// Enable Transfer Acceleration on bucket (AWS CLI)
// aws s3api put-bucket-accelerate-configuration \
//   --bucket my-bucket \
//   --accelerate-configuration Status=Enabled

// Benefits:
// - 50-500% faster uploads from distant regions
// - Uses AWS edge locations
// - Additional cost: $0.04 per GB transferred
```

---

### 6. CloudFront CDN for Read-Heavy Workloads

```javascript
// cloudfront-s3.js
const cloudfront = new AWS.CloudFront();

// Setup CloudFront distribution for S3 bucket
async function createCDN(bucketName) {
  const params = {
    DistributionConfig: {
      Origins: {
        Quantity: 1,
        Items: [{
          Id: 's3-origin',
          DomainName: `${bucketName}.s3.amazonaws.com`,
          S3OriginConfig: {
            OriginAccessIdentity: ''
          }
        }]
      },
      DefaultCacheBehavior: {
        TargetOriginId: 's3-origin',
        ViewerProtocolPolicy: 'redirect-to-https',

        // Cache for 1 day
        MinTTL: 0,
        MaxTTL: 86400,
        DefaultTTL: 86400,

        AllowedMethods: {
          Quantity: 2,
          Items: ['GET', 'HEAD']
        },

        Compress: true
      },
      Enabled: true,
      Comment: 'CDN for S3 bucket'
    }
  };

  return await cloudfront.createDistribution(params).promise();
}

// Use CloudFront URL instead of S3 URL
const cdnUrl = 'd111111abcdef8.cloudfront.net';

app.get('/api/images/:key', (req, res) => {
  // Instead of S3 URL:
  // https://my-bucket.s3.amazonaws.com/image.jpg

  // Use CloudFront URL (cached at edge locations):
  const imageUrl = `https://${cdnUrl}/${req.params.key}`;

  res.json({ url: imageUrl });
});

// Benefits:
// - 10-100x faster for global users
// - Reduces S3 GET requests (saves cost)
// - No S3 TPS limit concerns for reads!
```

---

## 📊 Performance Optimization

### Batch Operations

```javascript
// batch-operations.js
class S3BatchUploader {
  constructor(bucketName) {
    this.bucket = bucketName;
    this.s3 = new AWS.S3();
  }

  // Upload multiple files in parallel
  async uploadBatch(files) {
    const uploadPromises = files.map(file => {
      const params = {
        Bucket: this.bucket,
        Key: file.key,
        Body: file.body
      };

      return this.s3.upload(params).promise();
    });

    // Upload all files concurrently
    const results = await Promise.all(uploadPromises);

    console.log(`Uploaded ${results.length} files`);
    return results;
  }

  // Delete multiple files in one request
  async deleteBatch(keys) {
    const params = {
      Bucket: this.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false
      }
    };

    // Single API call deletes up to 1000 objects
    const result = await this.s3.deleteObjects(params).promise();

    console.log(`Deleted ${result.Deleted.length} files`);
    return result;
  }
}

// Usage
const batcher = new S3BatchUploader('my-bucket');

// Upload 100 files in parallel
const files = Array.from({ length: 100 }, (_, i) => ({
  key: `batch/file-${i}.txt`,
  body: `Content of file ${i}`
}));

await batcher.uploadBatch(files);

// Delete 100 files in one request
const keysToDelete = files.map(f => f.key);
await batcher.deleteBatch(keysToDelete);
```

---

### Presigned URLs (Offload Upload to Client)

```javascript
// presigned-urls.js
function generatePresignedUploadUrl(bucket, key, expiresIn = 3600) {
  const params = {
    Bucket: bucket,
    Key: key,
    Expires: expiresIn, // URL expires in 1 hour
    ContentType: 'image/jpeg'
  };

  // Generate presigned PUT URL
  const uploadUrl = s3.getSignedUrl('putObject', params);

  return uploadUrl;
}

// API endpoint
app.post('/api/upload/presigned', async (req, res) => {
  const userId = req.user.id;
  const fileName = req.body.fileName;

  const key = `uploads/${userId}/${Date.now()}-${fileName}`;

  // Generate presigned URL
  const uploadUrl = generatePresignedUploadUrl('my-bucket', key);

  res.json({
    uploadUrl,
    key,
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg'
    }
  });
});

// Client uploads directly to S3
/*
Frontend (JavaScript):
const response = await fetch('/api/upload/presigned', {
  method: 'POST',
  body: JSON.stringify({ fileName: 'photo.jpg' })
});

const { uploadUrl } = await response.json();

// Upload file directly to S3 (bypasses your server!)
await fetch(uploadUrl, {
  method: 'PUT',
  body: fileBlob,
  headers: { 'Content-Type': 'image/jpeg' }
});
*/

// Benefits:
// - Offloads upload bandwidth from your servers
// - Faster for users (direct to S3)
// - Reduces server load
```

---

## 🎓 Interview Tips

### Common Questions

**Q: What happens when you exceed S3 TPS limits?**
A: "S3 returns 503 Slow Down errors. Solutions: 1) Distribute load across multiple prefixes, 2) Implement exponential backoff retry, 3) Use CloudFront for reads, 4) Cache frequently accessed objects."

**Q: How do you calculate the number of prefixes needed?**
A: "Divide desired TPS by the limit. For writes: prefixes = TPS / 3,500. For reads: prefixes = TPS / 5,500. Example: 10,000 writes/sec needs 10,000 / 3,500 = 3 prefixes minimum."

**Q: What's the difference between S3 Standard and S3 Intelligent-Tiering?**
A: "S3 Standard: Fixed cost, always hot. S3 Intelligent-Tiering: Automatically moves infrequently accessed objects to cheaper storage tiers. Good for unpredictable access patterns. Saves 40-70% on storage costs."

**Q: How do you optimize S3 costs?**
A: "1) Use lifecycle policies to move old data to Glacier, 2) Enable Intelligent-Tiering for unpredictable access, 3) Delete incomplete multipart uploads, 4) Use CloudFront to reduce GET requests, 5) Compress files before upload."

---

## 🔗 Related Questions

- [CDN Usage and Optimization](/interview-prep/caching-cdn/cdn-usage)
- [High-Concurrency API Design](/interview-prep/system-design/high-concurrency-api)
- [Lambda for Serverless Architecture](/interview-prep/aws-cloud/lambda-serverless)
- [CloudWatch Monitoring](/interview-prep/aws-cloud/cloudwatch-monitoring)

---

## 📚 Additional Resources

- [S3 Performance Guidelines](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html)
- [S3 Transfer Acceleration](https://aws.amazon.com/s3/transfer-acceleration/)
- [S3 Multipart Upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [CloudFront with S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/MigrateS3ToCloudFront.html)
