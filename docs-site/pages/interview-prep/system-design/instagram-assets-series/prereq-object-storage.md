# Object Storage at Scale - Storing Petabytes of Media

> **Reading Time:** 12 minutes
> **Difficulty:** 🟢 Beginner
> **Prerequisites:** Basic cloud knowledge
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The $2 Million/Month Storage Problem

**Instagram stores 100 million photos per day.**

```
Daily uploads: 100 million photos
Average size (all variants): 800 KB
Daily storage: 80 TB

Monthly: 2.4 PB
Yearly: 29 PB

At $0.023/GB (S3 Standard):
Monthly cost: $55,000,000+

That's $55 MILLION per month just for storage.
```

Without smart storage strategies, media-heavy applications become **financially unsustainable**.

**The solution?** Tiered storage, intelligent data lifecycle, and cost-aware architecture.

```
After optimization:
- Hot tier (S3 Standard): 10% of data → $5.5M
- Warm tier (S3 IA): 30% of data → $6.6M
- Cold tier (Glacier): 60% of data → $800K

New monthly cost: $12.9M (77% savings!)
```

This article explains object storage fundamentals, tiered storage, and the strategies used by Instagram, Netflix, and other media companies.

---

## What is Object Storage?

### Object Storage vs File Storage vs Block Storage

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE COMPARISON                            │
├────────────────┬────────────────┬────────────────────────────────┤
│ Block Storage  │ File Storage   │ Object Storage                 │
├────────────────┼────────────────┼────────────────────────────────┤
│ Fixed-size     │ Hierarchical   │ Flat namespace                 │
│ blocks         │ directories    │ (key-value)                    │
│                │                │                                │
│ /dev/sda1      │ /photos/       │ bucket/abc123.jpg              │
│                │   2024/        │ bucket/def456.jpg              │
│                │     jan/       │ bucket/ghi789.jpg              │
│                │       1.jpg    │                                │
├────────────────┼────────────────┼────────────────────────────────┤
│ EBS, SAN       │ NFS, EFS       │ S3, GCS, Azure Blob            │
├────────────────┼────────────────┼────────────────────────────────┤
│ Best for:      │ Best for:      │ Best for:                      │
│ - Databases    │ - Shared files │ - Static assets (images, video)│
│ - OS volumes   │ - Home dirs    │ - Backups                      │
│ - Low latency  │ - Legacy apps  │ - Unlimited scale              │
└────────────────┴────────────────┴────────────────────────────────┘
```

### Why Object Storage for Media?

```javascript
const whyObjectStorage = {
  unlimitedScale: {
    description: 'No capacity planning needed',
    example: 'S3 stores exabytes, auto-scales infinitely'
  },

  httpNative: {
    description: 'Direct URL access to files',
    example: 'https://bucket.s3.amazonaws.com/photo.jpg'
  },

  durability: {
    description: '11 nines (99.999999999%)',
    example: 'Expect to lose 1 object per 10 million years'
  },

  costEffective: {
    description: 'Pay only for what you store',
    example: '$0.023/GB/month (S3 Standard)'
  },

  cdnIntegration: {
    description: 'Native CDN origin support',
    example: 'CloudFront pulls directly from S3'
  }
};
```

---

## Object Storage Architecture

### S3-Compatible Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBJECT STORAGE ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────┘

     ┌───────────────────────────────────────────────────────┐
     │                    APPLICATION                         │
     │           (Upload/Download requests)                   │
     └───────────────────────────────────────────────────────┘
                              ↓
     ┌───────────────────────────────────────────────────────┐
     │                   S3 API GATEWAY                       │
     │  PUT /bucket/key    GET /bucket/key    DELETE /key    │
     └───────────────────────────────────────────────────────┘
                              ↓
     ┌───────────────────────────────────────────────────────┐
     │                  METADATA SERVICE                      │
     │   Stores: key → {size, etag, storage_class, location} │
     │   Backend: Distributed database (DynamoDB-like)       │
     └───────────────────────────────────────────────────────┘
                              ↓
     ┌───────────────────────────────────────────────────────┐
     │                  DATA PLACEMENT                        │
     │   Objects split into chunks, distributed across AZs   │
     │   Erasure coding for durability (e.g., 6+3 scheme)    │
     └───────────────────────────────────────────────────────┘
                              ↓
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │    AZ-A    │  │    AZ-B    │  │    AZ-C    │
     │  Storage   │  │  Storage   │  │  Storage   │
     │   Nodes    │  │   Nodes    │  │   Nodes    │
     └────────────┘  └────────────┘  └────────────┘
```

### Key Concepts

```javascript
const s3Concepts = {
  bucket: {
    description: 'Container for objects',
    naming: 'Globally unique name (DNS-compatible)',
    example: 'instagram-photos-prod-us-west-2'
  },

  key: {
    description: 'Unique identifier within bucket',
    pattern: 'Can include "/" for logical organization',
    example: 'users/123/photos/abc456.jpg'
  },

  object: {
    description: 'The actual data + metadata',
    maxSize: '5 TB per object',
    metadata: 'Custom headers (content-type, cache-control, etc.)'
  },

  versionId: {
    description: 'Unique version if versioning enabled',
    use: 'Accidental delete protection, audit trail'
  },

  etag: {
    description: 'MD5 hash of object (or multipart upload ID)',
    use: 'Cache validation, integrity verification'
  }
};
```

---

## Storage Classes: The Cost Optimization Key

### AWS S3 Storage Classes

```javascript
const s3StorageClasses = {
  'S3 Standard': {
    cost: '$0.023/GB',
    retrieval: 'Instant',
    availability: '99.99%',
    durability: '99.999999999%',
    use: 'Frequently accessed data',
    example: 'Recent photos (< 30 days)'
  },

  'S3 Intelligent-Tiering': {
    cost: '$0.0025/1000 objects + storage cost',
    retrieval: 'Instant',
    availability: '99.9%',
    use: 'Unknown access patterns',
    example: 'User-uploaded content (varies)'
  },

  'S3 Standard-IA': {
    cost: '$0.0125/GB + $0.01/GB retrieval',
    retrieval: 'Instant',
    availability: '99.9%',
    use: 'Infrequent access (30+ days)',
    example: 'Photos from last month'
  },

  'S3 One Zone-IA': {
    cost: '$0.01/GB + $0.01/GB retrieval',
    retrieval: 'Instant',
    availability: '99.5%',
    use: 'Infrequent, recreatable data',
    example: 'Thumbnail variants'
  },

  'S3 Glacier Instant': {
    cost: '$0.004/GB + $0.03/GB retrieval',
    retrieval: 'Milliseconds',
    use: 'Archive with instant access',
    example: 'Photos from last year'
  },

  'S3 Glacier Flexible': {
    cost: '$0.0036/GB',
    retrieval: '1-12 hours',
    use: 'Archive, rarely accessed',
    example: 'Photos from 2+ years ago'
  },

  'S3 Glacier Deep Archive': {
    cost: '$0.00099/GB',
    retrieval: '12-48 hours',
    use: 'Long-term archive',
    example: 'Legal holds, compliance'
  }
};

// Cost comparison for 100 TB:
// Standard:     $2,300/month
// Standard-IA:  $1,250/month (46% savings)
// Glacier:      $360/month (84% savings)
// Deep Archive: $99/month (96% savings)
```

### Tiered Storage Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHOTO LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────┘

Day 0-30: HOT (S3 Standard)
┌─────────────────────────────────────────┐
│  Newly uploaded photo                    │
│  High access frequency                   │
│  Cost: $0.023/GB                         │
│  10% of total storage                    │
└─────────────────────────────────────────┘
                    ↓ (After 30 days)
Day 31-90: WARM (S3 Standard-IA)
┌─────────────────────────────────────────┐
│  Still accessed occasionally             │
│  Medium access frequency                 │
│  Cost: $0.0125/GB (46% less)            │
│  20% of total storage                    │
└─────────────────────────────────────────┘
                    ↓ (After 90 days)
Day 91-365: COOL (S3 Glacier Instant)
┌─────────────────────────────────────────┐
│  Rarely accessed, but needs instant     │
│  Low access frequency                    │
│  Cost: $0.004/GB (83% less)             │
│  30% of total storage                    │
└─────────────────────────────────────────┘
                    ↓ (After 1 year)
Day 365+: ARCHIVE (S3 Glacier)
┌─────────────────────────────────────────┐
│  Almost never accessed                   │
│  Retrieval can wait hours               │
│  Cost: $0.0036/GB (84% less)            │
│  40% of total storage                    │
└─────────────────────────────────────────┘
```

---

## Lifecycle Policies

### Automating Tier Transitions

```javascript
// AWS S3 Lifecycle Configuration
const lifecycleRules = [
  {
    ID: 'TransitionPhotosToIA',
    Status: 'Enabled',
    Filter: {
      Prefix: 'photos/'
    },
    Transitions: [
      {
        Days: 30,
        StorageClass: 'STANDARD_IA'
      },
      {
        Days: 90,
        StorageClass: 'GLACIER_IR'  // Glacier Instant Retrieval
      },
      {
        Days: 365,
        StorageClass: 'GLACIER'
      }
    ]
  },
  {
    ID: 'DeleteTempUploads',
    Status: 'Enabled',
    Filter: {
      Prefix: 'temp/'
    },
    Expiration: {
      Days: 1  // Delete incomplete uploads after 1 day
    }
  },
  {
    ID: 'CleanupMultipartUploads',
    Status: 'Enabled',
    AbortIncompleteMultipartUpload: {
      DaysAfterInitiation: 7
    }
  }
];

// Apply via AWS CLI:
// aws s3api put-bucket-lifecycle-configuration \
//   --bucket my-bucket \
//   --lifecycle-configuration file://lifecycle.json
```

### Intelligent Tiering Configuration

```javascript
// Use S3 Intelligent-Tiering for unpredictable access patterns
const intelligentTieringConfig = {
  Id: 'PhotosIntelligentTiering',
  Status: 'Enabled',
  Filter: {
    Prefix: 'photos/'
  },
  Tierings: [
    {
      Days: 90,
      AccessTier: 'ARCHIVE_ACCESS'  // Move to archive after 90 days no access
    },
    {
      Days: 180,
      AccessTier: 'DEEP_ARCHIVE_ACCESS'  // Deep archive after 180 days
    }
  ]
};

// Benefits:
// - No retrieval fees (unlike manual Glacier)
// - Automatic promotion back to Frequent Access on access
// - Small monitoring fee ($0.0025 per 1000 objects)
```

---

## Multi-Region Replication

### Why Replicate?

```javascript
const replicationReasons = {
  latency: {
    problem: 'User in Tokyo accessing US bucket = 200ms+',
    solution: 'Replicate to Tokyo region = 20ms'
  },

  compliance: {
    problem: 'GDPR requires EU data in EU',
    solution: 'Replicate EU user data to EU region'
  },

  disaster_recovery: {
    problem: 'Entire region outage (rare but happens)',
    solution: 'Cross-region replication = automatic failover'
  },

  availability: {
    problem: 'S3 is 99.99%, want higher',
    solution: 'Multi-region = 99.9999% effective'
  }
};
```

### Replication Configuration

```javascript
const replicationConfig = {
  Role: 'arn:aws:iam::123456789:role/s3-replication-role',
  Rules: [
    {
      ID: 'ReplicatePhotosToEU',
      Status: 'Enabled',
      Priority: 1,
      Filter: {
        Prefix: 'photos/'
      },
      Destination: {
        Bucket: 'arn:aws:s3:::instagram-photos-eu-west-1',
        StorageClass: 'STANDARD_IA',  // Use cheaper class in replica
        ReplicationTime: {
          Status: 'Enabled',
          Time: { Minutes: 15 }  // Guaranteed replication SLA
        },
        Metrics: {
          Status: 'Enabled'  // Monitor replication lag
        }
      },
      DeleteMarkerReplication: {
        Status: 'Disabled'  // Don't replicate deletes immediately
      }
    }
  ]
};
```

### Multi-Region Access Points

```javascript
// S3 Multi-Region Access Points (MRAP)
// Single endpoint that routes to nearest region automatically

const mrapConfig = {
  Name: 'photos-global',
  Regions: [
    { Bucket: 'instagram-photos-us-west-2' },
    { Bucket: 'instagram-photos-eu-west-1' },
    { Bucket: 'instagram-photos-ap-northeast-1' }
  ]
};

// Usage:
// Instead of: https://instagram-photos-us-west-2.s3.amazonaws.com/photo.jpg
// Use: https://photos-global.accesspoint.s3-global.amazonaws.com/photo.jpg
// S3 automatically routes to nearest region based on user location
```

---

## Upload Optimization

### Multipart Upload for Large Files

```javascript
const AWS = require('aws-sdk');
const fs = require('fs');

async function multipartUpload(bucket, key, filePath) {
  const s3 = new AWS.S3();
  const fileSize = fs.statSync(filePath).size;
  const partSize = 10 * 1024 * 1024;  // 10 MB parts
  const numParts = Math.ceil(fileSize / partSize);

  // 1. Initiate multipart upload
  const { UploadId } = await s3.createMultipartUpload({
    Bucket: bucket,
    Key: key,
    ContentType: 'image/jpeg'
  }).promise();

  // 2. Upload parts in parallel
  const uploadPromises = [];
  for (let i = 0; i < numParts; i++) {
    const start = i * partSize;
    const end = Math.min(start + partSize, fileSize);
    const partNumber = i + 1;

    const uploadPromise = s3.uploadPart({
      Bucket: bucket,
      Key: key,
      PartNumber: partNumber,
      UploadId: UploadId,
      Body: fs.createReadStream(filePath, { start, end: end - 1 })
    }).promise().then(data => ({
      ETag: data.ETag,
      PartNumber: partNumber
    }));

    uploadPromises.push(uploadPromise);
  }

  const parts = await Promise.all(uploadPromises);

  // 3. Complete multipart upload
  await s3.completeMultipartUpload({
    Bucket: bucket,
    Key: key,
    UploadId: UploadId,
    MultipartUpload: {
      Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
    }
  }).promise();
}

// Benefits:
// - Parallel uploads (faster)
// - Resume on failure (upload remaining parts)
// - Required for files > 5GB
// - Recommended for files > 100MB
```

### Pre-Signed URLs for Direct Upload

```javascript
// Generate pre-signed URL for client-side upload
// Avoids routing through your server

async function generateUploadUrl(bucket, key, contentType) {
  const s3 = new AWS.S3();

  const url = await s3.getSignedUrlPromise('putObject', {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Expires: 300  // URL valid for 5 minutes
  });

  return url;
}

// API endpoint
app.post('/api/upload-url', async (req, res) => {
  const { fileName, contentType } = req.body;
  const key = `uploads/${req.user.id}/${Date.now()}-${fileName}`;

  const uploadUrl = await generateUploadUrl(
    'instagram-uploads',
    key,
    contentType
  );

  res.json({ uploadUrl, key });
});

// Client-side upload (direct to S3)
async function uploadFile(file) {
  // 1. Get pre-signed URL from your API
  const { uploadUrl, key } = await fetch('/api/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type
    })
  }).then(r => r.json());

  // 2. Upload directly to S3
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  });

  return key;
}
```

---

## Performance Optimization

### Request Rate Optimization

```javascript
// S3 can handle 3,500 PUT/POST/DELETE and 5,500 GET per prefix per second
// Use random prefixes to distribute load

// ❌ Bad: Sequential prefixes (hot prefix)
const badKey = `photos/2024/01/15/${photoId}.jpg`;
// All today's photos go to same prefix → bottleneck

// ✅ Good: Random prefix distribution
const goodKey = `photos/${hashPrefix(photoId)}/${photoId}.jpg`;

function hashPrefix(id) {
  // Generate 4-character hex prefix from ID
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return hash.substring(0, 4);
}

// Result: photos/a3f2/abc123.jpg, photos/7b1c/def456.jpg
// Distributes across 65,536 prefixes (16^4)
// Effective rate: 65,536 × 5,500 = 360M GET/s
```

### Transfer Acceleration

```javascript
// S3 Transfer Acceleration uses CloudFront edge locations
// for faster uploads over long distances

const s3 = new AWS.S3({
  useAccelerateEndpoint: true
});

// Normal endpoint: instagram-photos.s3.us-west-2.amazonaws.com
// Accelerated:     instagram-photos.s3-accelerate.amazonaws.com

// User in Tokyo uploading to US-West-2:
// Normal: 200ms latency, ~5 Mbps throughput
// Accelerated: 50ms latency, ~20 Mbps throughput (4x faster)
```

---

## Cost Optimization Summary

### Instagram-Scale Cost Analysis

```javascript
const costAnalysis = {
  totalStorage: '30 PB',  // 30,000 TB

  beforeOptimization: {
    storageClass: 'All S3 Standard',
    costPerTB: '$23.50',
    monthlyCost: '$705,000'
  },

  afterOptimization: {
    distribution: {
      standard: { percent: 10, tb: 3000, cost: '$70,500' },
      standardIA: { percent: 20, tb: 6000, cost: '$75,000' },
      glacierInstant: { percent: 30, tb: 9000, cost: '$36,000' },
      glacier: { percent: 40, tb: 12000, cost: '$43,200' }
    },
    monthlyCost: '$224,700'
  },

  savings: {
    monthly: '$480,300',
    yearly: '$5,763,600',
    percent: '68%'
  }
};
```

---

## Quick Win: Set Up Lifecycle Rules in 10 Minutes

```bash
# Create lifecycle policy file
cat > lifecycle.json << 'EOF'
{
  "Rules": [
    {
      "ID": "TransitionOldObjects",
      "Status": "Enabled",
      "Filter": {},
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER_IR"
        }
      ]
    },
    {
      "ID": "CleanupIncompleteUploads",
      "Status": "Enabled",
      "Filter": {},
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    }
  ]
}
EOF

# Apply to bucket
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-photos-bucket \
  --lifecycle-configuration file://lifecycle.json

# Verify
aws s3api get-bucket-lifecycle-configuration \
  --bucket my-photos-bucket
```

---

## Key Takeaways

**What you learned:**
- Object storage (S3) is ideal for media: unlimited scale, HTTP-native, highly durable
- Storage classes range from $0.023/GB (Standard) to $0.001/GB (Deep Archive)
- Lifecycle policies automate tier transitions based on age or access patterns
- Pre-signed URLs enable direct-to-S3 uploads, bypassing your servers

**Cost optimization formula:**
```
Optimized Cost = (Hot × $0.023) + (Warm × $0.0125) + (Cold × $0.004) + (Archive × $0.001)

Typical distribution: 10% hot, 20% warm, 30% cold, 40% archive
Typical savings: 60-75% vs all-Standard
```

**Quick reference:**
```
Storage Class      | Cost/GB  | Retrieval | Use For
-------------------|----------|-----------|------------------
Standard           | $0.023   | Instant   | < 30 days old
Standard-IA        | $0.0125  | Instant   | 30-90 days
Glacier Instant    | $0.004   | Instant   | 90-365 days
Glacier            | $0.0036  | Hours     | > 1 year
Deep Archive       | $0.001   | 12-48 hrs | Compliance, legal
```

---

## You're Ready for the Main Series!

You now have all the prerequisite knowledge. Time to see how Instagram puts it all together:

**Next Article:** [Part 1: Image Upload & Processing Pipeline](/interview-prep/system-design/instagram-assets-series/01-image-upload-pipeline) — How Instagram handles 100M+ uploads per day.

---

*This article is part of the [Instagram Asset Management Series](/interview-prep/system-design/instagram-assets-series).*
