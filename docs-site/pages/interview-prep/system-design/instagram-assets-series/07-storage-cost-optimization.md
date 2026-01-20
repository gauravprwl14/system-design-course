# Storage Cost Optimization - Managing Petabytes Economically

> **Reading Time:** 18 minutes
> **Difficulty:** 🔴 Advanced
> **Prerequisites:** [Object Storage](/interview-prep/system-design/instagram-assets-series/prereq-object-storage), All Previous Parts
> **Series:** [Instagram Asset Management](/interview-prep/system-design/instagram-assets-series)

## The Cost Crisis at Scale

**Storage costs can make or break a media platform.**

```
Instagram's storage reality (estimated):

Daily uploads:
┌─────────────────────────────────────────────────────────────────┐
│ Photos: 100 million/day × 3 variants × 500KB avg = 150 TB/day  │
│ Videos: 50 million/day × 5 variants × 50MB avg = 12.5 PB/day   │
│ Stories: 500 million/day × 2 variants × 5MB avg = 5 PB/day     │
│ Reels: 50 million/day × 5 variants × 100MB avg = 25 PB/day     │
├─────────────────────────────────────────────────────────────────┤
│ Daily new storage: ~43 PB                                       │
│ Annual new storage: ~15 EB (exabytes)                           │
└─────────────────────────────────────────────────────────────────┘

Storage costs (AWS S3 pricing):
┌────────────────────────────────────────────────────────────────┐
│ Storage Tier      │ Cost/GB/month │ For 1 PB/month            │
├───────────────────┼───────────────┼───────────────────────────┤
│ S3 Standard       │ $0.023        │ $23,000/month             │
│ S3 Infrequent     │ $0.0125       │ $12,500/month             │
│ S3 Glacier        │ $0.004        │ $4,000/month              │
│ S3 Deep Archive   │ $0.00099      │ $990/month                │
└───────────────────┴───────────────┴───────────────────────────┘

At 100 PB total:
- All in Standard: $2.3M/month
- Optimized tiers: $500K/month
- Savings: $1.8M/month = $21.6M/year
```

Optimizing storage costs while maintaining performance is critical for media platforms at scale.

---

## Storage Tiering Strategies

### Access-Based Tiering

```
Tiering based on content age and access patterns:

┌─────────────────────────────────────────────────────────────────┐
│                 STORAGE TIER HIERARCHY                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  HOT TIER (0-7 days)                                            │
│  ├─ Storage: Premium SSD + Object Storage Standard              │
│  ├─ Access: < 10ms latency                                      │
│  ├─ Use case: New content, trending, high engagement            │
│  └─ Cost: $$$$ (but small volume)                               │
│           │                                                      │
│           ▼ Auto-tier after 7 days                              │
│                                                                  │
│  WARM TIER (7-30 days)                                          │
│  ├─ Storage: Object Storage Standard                            │
│  ├─ Access: < 50ms latency                                      │
│  ├─ Use case: Recent content, moderate access                   │
│  └─ Cost: $$$ (medium volume)                                   │
│           │                                                      │
│           ▼ Auto-tier after 30 days                             │
│                                                                  │
│  COOL TIER (30-90 days)                                         │
│  ├─ Storage: Infrequent Access storage                          │
│  ├─ Access: < 100ms latency                                     │
│  ├─ Use case: Older content, occasional access                  │
│  └─ Cost: $$ (large volume)                                     │
│           │                                                      │
│           ▼ Auto-tier after 90 days                             │
│                                                                  │
│  COLD TIER (90+ days)                                           │
│  ├─ Storage: Archive/Glacier storage                            │
│  ├─ Access: Minutes to hours retrieval                          │
│  ├─ Use case: Historical content, rarely accessed               │
│  └─ Cost: $ (majority of volume)                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
// Intelligent tiering service
class StorageTieringService {
  constructor() {
    this.tierConfigs = {
      HOT: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        storageClass: 'STANDARD',
        minAccessRate: 0.1 // 10% of items accessed daily
      },
      WARM: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        storageClass: 'STANDARD',
        minAccessRate: 0.01 // 1% accessed daily
      },
      COOL: {
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
        storageClass: 'STANDARD_IA',
        minAccessRate: 0.001 // 0.1% accessed daily
      },
      COLD: {
        maxAge: Infinity,
        storageClass: 'GLACIER',
        minAccessRate: 0
      }
    };
  }

  async evaluateAndTier(mediaId) {
    const media = await this.getMediaMetadata(mediaId);
    const accessStats = await this.getAccessStats(mediaId);

    const recommendedTier = this.calculateOptimalTier(media, accessStats);

    if (recommendedTier !== media.currentTier) {
      await this.transitionTier(mediaId, recommendedTier);
    }

    return recommendedTier;
  }

  calculateOptimalTier(media, accessStats) {
    const age = Date.now() - media.createdAt;
    const dailyAccessRate = accessStats.last7Days / 7;

    // Special case: Viral content stays hot regardless of age
    if (accessStats.last24Hours > 10000) {
      return 'HOT';
    }

    // Normal tiering based on age and access
    for (const [tier, config] of Object.entries(this.tierConfigs)) {
      if (age <= config.maxAge && dailyAccessRate >= config.minAccessRate) {
        return tier;
      }
    }

    return 'COLD';
  }

  async transitionTier(mediaId, targetTier) {
    const media = await this.getMediaMetadata(mediaId);
    const config = this.tierConfigs[targetTier];

    // Transition all variants
    for (const variant of media.variants) {
      await this.objectStorage.changeStorageClass(
        variant.key,
        config.storageClass
      );
    }

    // Update metadata
    await this.updateMediaTier(mediaId, targetTier);

    // Log for analytics
    await this.logTierTransition(mediaId, media.currentTier, targetTier);
  }
}
```

### Smart Lifecycle Policies

```javascript
// Automated lifecycle management
class LifecyclePolicyManager {
  constructor(objectStorage) {
    this.objectStorage = objectStorage;
  }

  async configureMediaBucket() {
    const lifecyclePolicy = {
      Rules: [
        // Rule 1: Transition photos older than 30 days
        {
          ID: 'PhotoTiering',
          Filter: { Prefix: 'photos/' },
          Status: 'Enabled',
          Transitions: [
            {
              Days: 30,
              StorageClass: 'STANDARD_IA'
            },
            {
              Days: 90,
              StorageClass: 'GLACIER'
            }
          ]
        },

        // Rule 2: Transition video source files faster
        {
          ID: 'VideoSourceTiering',
          Filter: {
            Prefix: 'videos/source/',
            Tag: { Key: 'transcoded', Value: 'true' }
          },
          Status: 'Enabled',
          Transitions: [
            {
              Days: 7, // Source can tier quickly after transcoding
              StorageClass: 'GLACIER'
            }
          ]
        },

        // Rule 3: Keep video variants warm longer
        {
          ID: 'VideoVariantTiering',
          Filter: { Prefix: 'videos/variants/' },
          Status: 'Enabled',
          Transitions: [
            {
              Days: 60,
              StorageClass: 'STANDARD_IA'
            },
            {
              Days: 180,
              StorageClass: 'GLACIER'
            }
          ]
        },

        // Rule 4: Stories auto-delete (TTL)
        {
          ID: 'StoriesExpiration',
          Filter: { Prefix: 'stories/' },
          Status: 'Enabled',
          Expiration: {
            Days: 1
          }
        },

        // Rule 5: Delete incomplete multipart uploads
        {
          ID: 'CleanupIncompleteUploads',
          Filter: {},
          Status: 'Enabled',
          AbortIncompleteMultipartUpload: {
            DaysAfterInitiation: 1
          }
        }
      ]
    };

    await this.objectStorage.putBucketLifecycleConfiguration({
      Bucket: 'media-bucket',
      LifecycleConfiguration: lifecyclePolicy
    });
  }
}
```

---

## Deduplication Strategies

### Content-Addressable Storage

```
Deduplication architecture:

┌─────────────────────────────────────────────────────────────────┐
│                 CONTENT DEDUPLICATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Upload Flow:                                                   │
│                                                                  │
│  ┌─────────────┐     ┌─────────────────┐    ┌───────────────┐  │
│  │ New Upload  │────▶│ Calculate Hash  │───▶│ Check Exists  │  │
│  └─────────────┘     │ (SHA-256)       │    │ in Index      │  │
│                      └─────────────────┘    └───────┬───────┘  │
│                                                      │          │
│                              ┌───────────────────────┴───────┐  │
│                              │                               │  │
│                              ▼                               ▼  │
│                      ┌─────────────┐               ┌───────────┐│
│                      │ Hash Exists │               │ New Hash  ││
│                      │ (Duplicate) │               │ (Unique)  ││
│                      └──────┬──────┘               └─────┬─────┘│
│                             │                            │      │
│                             ▼                            ▼      │
│                      ┌─────────────┐               ┌───────────┐│
│                      │ Reference   │               │ Store     ││
│                      │ Existing    │               │ New File  ││
│                      │ File        │               │ + Index   ││
│                      └─────────────┘               └───────────┘│
│                                                                  │
│  Savings potential:                                             │
│  ├─ Memes/viral content: 30-50% duplication rate               │
│  ├─ Screenshots: 10-20% duplication                            │
│  └─ Original photos: 1-5% duplication                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

```javascript
// Content-addressable storage with deduplication
class ContentAddressableStorage {
  constructor(objectStorage, hashIndex) {
    this.objectStorage = objectStorage;
    this.hashIndex = hashIndex; // Redis or dedicated DB
  }

  async store(buffer, metadata) {
    // 1. Calculate content hash
    const contentHash = await this.calculateHash(buffer);

    // 2. Check if content already exists
    const existing = await this.hashIndex.get(`hash:${contentHash}`);

    if (existing) {
      // Content exists - just create reference
      const reference = await this.createReference(contentHash, metadata);
      return {
        isNew: false,
        contentHash,
        reference,
        savedBytes: buffer.length
      };
    }

    // 3. Store new content
    const storageKey = `content/${contentHash}`;
    await this.objectStorage.upload(storageKey, buffer, {
      metadata: {
        'content-hash': contentHash,
        'original-size': buffer.length.toString()
      }
    });

    // 4. Index the hash
    await this.hashIndex.set(`hash:${contentHash}`, JSON.stringify({
      key: storageKey,
      size: buffer.length,
      createdAt: Date.now()
    }));

    // 5. Create reference for this upload
    const reference = await this.createReference(contentHash, metadata);

    return {
      isNew: true,
      contentHash,
      reference,
      savedBytes: 0
    };
  }

  async createReference(contentHash, metadata) {
    const referenceId = generateUUID();

    // Store reference (not the actual content)
    await this.db.collection('media_references').insertOne({
      referenceId,
      contentHash,
      userId: metadata.userId,
      uploadedAt: Date.now(),
      metadata: metadata
    });

    // Increment reference count
    await this.hashIndex.incr(`refcount:${contentHash}`);

    return referenceId;
  }

  async delete(referenceId) {
    const reference = await this.db.collection('media_references')
      .findOne({ referenceId });

    if (!reference) return;

    // Delete reference
    await this.db.collection('media_references')
      .deleteOne({ referenceId });

    // Decrement reference count
    const newCount = await this.hashIndex.decr(
      `refcount:${reference.contentHash}`
    );

    // If no more references, delete actual content
    if (newCount <= 0) {
      await this.deleteContent(reference.contentHash);
    }
  }

  async deleteContent(contentHash) {
    const content = JSON.parse(await this.hashIndex.get(`hash:${contentHash}`));

    await this.objectStorage.delete(content.key);
    await this.hashIndex.del(`hash:${contentHash}`);
    await this.hashIndex.del(`refcount:${contentHash}`);
  }

  async calculateHash(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
```

### Perceptual Hashing for Near-Duplicates

```javascript
// Detect visually similar images (memes, reposts, etc.)
class PerceptualHasher {
  constructor() {
    this.hammingThreshold = 10; // Max bit difference for "similar"
  }

  // Calculate perceptual hash (pHash)
  async calculatePHash(imageBuffer) {
    // 1. Resize to 32x32 grayscale
    const resized = await sharp(imageBuffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    // 2. Apply DCT (Discrete Cosine Transform)
    const dct = this.applyDCT(resized, 32);

    // 3. Take top-left 8x8 (low frequency components)
    const lowFreq = this.extractLowFrequency(dct, 8);

    // 4. Calculate median
    const median = this.calculateMedian(lowFreq);

    // 5. Generate hash (1 if above median, 0 if below)
    let hash = BigInt(0);
    for (let i = 0; i < 64; i++) {
      if (lowFreq[i] > median) {
        hash |= BigInt(1) << BigInt(i);
      }
    }

    return hash.toString(16).padStart(16, '0');
  }

  // Find similar images using pHash
  async findSimilar(pHash) {
    // Get all hashes from index (in practice, use locality-sensitive hashing)
    const candidates = await this.getHashCandidates(pHash);

    const similar = [];
    for (const candidate of candidates) {
      const distance = this.hammingDistance(pHash, candidate.hash);
      if (distance <= this.hammingThreshold) {
        similar.push({
          ...candidate,
          distance,
          similarity: 1 - (distance / 64)
        });
      }
    }

    return similar.sort((a, b) => a.distance - b.distance);
  }

  hammingDistance(hash1, hash2) {
    const h1 = BigInt(`0x${hash1}`);
    const h2 = BigInt(`0x${hash2}`);
    const xor = h1 ^ h2;

    // Count set bits
    let distance = 0;
    let n = xor;
    while (n > 0) {
      distance += Number(n & BigInt(1));
      n >>= BigInt(1);
    }

    return distance;
  }

  // Store and deduplicate
  async storeWithDedup(imageBuffer, metadata) {
    const pHash = await this.calculatePHash(imageBuffer);
    const exactHash = await this.calculateSHA256(imageBuffer);

    // Check exact duplicate first
    const exactMatch = await this.findExactMatch(exactHash);
    if (exactMatch) {
      return { type: 'exact_duplicate', reference: exactMatch };
    }

    // Check perceptual duplicates
    const similar = await this.findSimilar(pHash);
    if (similar.length > 0 && similar[0].similarity > 0.95) {
      // Very similar - might be repost
      return {
        type: 'near_duplicate',
        similarity: similar[0].similarity,
        original: similar[0],
        decision: 'store_anyway' // Policy decision
      };
    }

    // Store new unique content
    return this.storeNewContent(imageBuffer, exactHash, pHash, metadata);
  }
}
```

---

## Variant Optimization

### Smart Variant Generation

```javascript
// Generate only necessary quality variants
class SmartVariantGenerator {
  constructor() {
    this.defaultVariants = {
      image: ['thumbnail', 'preview', 'standard', 'full'],
      video: ['240p', '360p', '480p', '720p', '1080p']
    };
  }

  async determineVariants(sourceMedia, context) {
    const source = await this.analyzeSource(sourceMedia);

    // Don't upscale - only generate variants smaller than source
    const variants = [];

    if (source.type === 'image') {
      variants.push(...this.getImageVariants(source, context));
    } else {
      variants.push(...this.getVideoVariants(source, context));
    }

    return variants;
  }

  getImageVariants(source, context) {
    const maxWidth = source.width;
    const maxHeight = source.height;

    const allVariants = [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'preview', width: 320, height: 320 },
      { name: 'standard', width: 640, height: 640 },
      { name: 'large', width: 1080, height: 1080 },
      { name: 'full', width: 2048, height: 2048 }
    ];

    // Only include variants smaller than source
    const applicable = allVariants.filter(v =>
      v.width <= maxWidth || v.height <= maxHeight
    );

    // If source is small, include it directly
    if (maxWidth <= 1080 && maxHeight <= 1080) {
      applicable.push({ name: 'original', width: maxWidth, height: maxHeight });
    }

    // Context-based optimization
    if (context.isStory) {
      // Stories only need 2 variants
      return applicable.filter(v =>
        ['preview', 'standard'].includes(v.name)
      );
    }

    return applicable;
  }

  getVideoVariants(source, context) {
    const sourceHeight = source.height;
    const sourceBitrate = source.bitrate;

    const allVariants = [
      { name: '240p', height: 240, bitrate: 300000 },
      { name: '360p', height: 360, bitrate: 600000 },
      { name: '480p', height: 480, bitrate: 1000000 },
      { name: '720p', height: 720, bitrate: 2500000 },
      { name: '1080p', height: 1080, bitrate: 5000000 }
    ];

    // Only include variants that make sense for source
    const applicable = allVariants.filter(v =>
      v.height <= sourceHeight &&
      v.bitrate <= sourceBitrate * 1.5 // Allow slight upscaling of bitrate
    );

    // Always include lowest quality for slow connections
    if (!applicable.find(v => v.name === '240p')) {
      applicable.unshift(allVariants[0]);
    }

    // Context-based optimization
    if (context.isReel) {
      // Reels need all variants for smooth ABR
      return applicable;
    }

    if (context.isDirectMessage) {
      // DM videos only need 2-3 variants
      return applicable.slice(0, 3);
    }

    return applicable;
  }
}
```

### Lazy Variant Generation

```javascript
// Generate variants on-demand instead of upfront
class LazyVariantService {
  constructor() {
    this.variantCache = new Map();
  }

  async getVariant(mediaId, variantName) {
    const cacheKey = `${mediaId}:${variantName}`;

    // 1. Check if variant exists
    const existing = await this.checkVariantExists(mediaId, variantName);
    if (existing) {
      return existing.url;
    }

    // 2. Check if generation is in progress
    const pending = this.variantCache.get(cacheKey);
    if (pending) {
      return pending;
    }

    // 3. Generate variant on-demand
    const generationPromise = this.generateVariant(mediaId, variantName);
    this.variantCache.set(cacheKey, generationPromise);

    try {
      const result = await generationPromise;
      this.variantCache.delete(cacheKey);
      return result.url;
    } catch (error) {
      this.variantCache.delete(cacheKey);
      throw error;
    }
  }

  async generateVariant(mediaId, variantName) {
    const source = await this.getSourceMedia(mediaId);

    // Generate the specific variant
    const variantBuffer = await this.processVariant(
      source.buffer,
      variantName,
      source.type
    );

    // Store variant
    const variantKey = `variants/${mediaId}/${variantName}`;
    await this.objectStorage.upload(variantKey, variantBuffer);

    // Update media record
    await this.addVariantToMedia(mediaId, variantName, variantKey);

    return {
      url: this.getCDNUrl(variantKey),
      key: variantKey
    };
  }

  // Analyze access patterns to pre-generate popular variants
  async optimizeVariantGeneration() {
    const accessStats = await this.getVariantAccessStats();

    // Pre-generate variants that are frequently requested
    for (const stat of accessStats) {
      if (stat.onDemandGenerations > 10) {
        // If a variant is generated on-demand more than 10 times,
        // it should be generated upfront for future uploads
        await this.addToDefaultVariants(stat.variantName, stat.mediaType);
      }
    }
  }
}
```

---

## Cost Analytics and Monitoring

### Storage Cost Calculator

```javascript
// Track and project storage costs
class StorageCostAnalyzer {
  constructor() {
    this.pricingTiers = {
      STANDARD: 0.023,      // per GB/month
      STANDARD_IA: 0.0125,
      GLACIER: 0.004,
      DEEP_ARCHIVE: 0.00099
    };

    this.requestPricing = {
      GET: 0.0004,    // per 1000 requests
      PUT: 0.005,     // per 1000 requests
      GLACIER_RETRIEVE: 0.01 // per GB retrieved
    };
  }

  async calculateMonthlyCost() {
    const storageByTier = await this.getStorageByTier();
    const requestCounts = await this.getRequestCounts();

    let totalCost = 0;
    const breakdown = {};

    // Storage costs
    for (const [tier, gbStored] of Object.entries(storageByTier)) {
      const tierCost = gbStored * this.pricingTiers[tier];
      breakdown[`storage_${tier}`] = tierCost;
      totalCost += tierCost;
    }

    // Request costs
    breakdown.get_requests = (requestCounts.GET / 1000) * this.requestPricing.GET;
    breakdown.put_requests = (requestCounts.PUT / 1000) * this.requestPricing.PUT;
    totalCost += breakdown.get_requests + breakdown.put_requests;

    // Glacier retrieval costs
    if (requestCounts.GLACIER_RETRIEVE_GB) {
      breakdown.glacier_retrieval =
        requestCounts.GLACIER_RETRIEVE_GB * this.requestPricing.GLACIER_RETRIEVE;
      totalCost += breakdown.glacier_retrieval;
    }

    return {
      total: totalCost,
      breakdown,
      projectedAnnual: totalCost * 12
    };
  }

  async getCostPerUser() {
    const totalCost = await this.calculateMonthlyCost();
    const activeUsers = await this.getActiveUserCount();

    return {
      costPerUser: totalCost.total / activeUsers,
      storagePerUser: await this.getAverageStoragePerUser(),
      breakdown: {
        heavyUsers: await this.getHeavyUserCost(), // Top 10% by storage
        normalUsers: await this.getNormalUserCost(),
        lightUsers: await this.getLightUserCost()
      }
    };
  }

  async generateCostReport() {
    const current = await this.calculateMonthlyCost();
    const historical = await this.getHistoricalCosts(6); // Last 6 months

    // Project future costs
    const growthRate = this.calculateGrowthRate(historical);
    const projections = this.projectCosts(current.total, growthRate, 12);

    // Optimization recommendations
    const recommendations = await this.generateRecommendations();

    return {
      currentMonth: current,
      historical,
      projections,
      growthRate,
      recommendations,
      potentialSavings: recommendations.reduce((sum, r) => sum + r.savings, 0)
    };
  }

  async generateRecommendations() {
    const recommendations = [];

    // 1. Check for content that could be tiered down
    const tierableContent = await this.findTierableContent();
    if (tierableContent.savingsGB > 1000) {
      recommendations.push({
        type: 'TIER_TRANSITION',
        description: 'Move inactive content to cheaper tiers',
        affectedGB: tierableContent.savingsGB,
        savings: tierableContent.savingsGB *
          (this.pricingTiers.STANDARD - this.pricingTiers.GLACIER)
      });
    }

    // 2. Check for duplicate content
    const duplicates = await this.analyzeDuplicates();
    if (duplicates.duplicateGB > 100) {
      recommendations.push({
        type: 'DEDUPLICATION',
        description: 'Enable content deduplication',
        affectedGB: duplicates.duplicateGB,
        savings: duplicates.duplicateGB * this.pricingTiers.STANDARD
      });
    }

    // 3. Check for unnecessary variants
    const unusedVariants = await this.findUnusedVariants();
    if (unusedVariants.length > 0) {
      const wastedGB = unusedVariants.reduce((sum, v) => sum + v.sizeGB, 0);
      recommendations.push({
        type: 'VARIANT_CLEANUP',
        description: 'Remove rarely-accessed variants',
        affectedGB: wastedGB,
        savings: wastedGB * this.pricingTiers.STANDARD
      });
    }

    return recommendations;
  }
}
```

### Real-Time Cost Dashboard

```javascript
// Monitor storage costs in real-time
class CostDashboard {
  constructor() {
    this.metrics = new MetricsClient();
  }

  async getRealtimeMetrics() {
    return {
      currentStorage: await this.getCurrentStorage(),
      todaysCosts: await this.getTodaysCosts(),
      uploadRate: await this.getUploadRate(),
      deletionRate: await this.getDeletionRate(),
      netGrowth: await this.getNetGrowth(),
      alerts: await this.getActiveAlerts()
    };
  }

  async getCurrentStorage() {
    return {
      total: await this.metrics.gauge('storage.total.bytes'),
      byTier: {
        hot: await this.metrics.gauge('storage.hot.bytes'),
        warm: await this.metrics.gauge('storage.warm.bytes'),
        cool: await this.metrics.gauge('storage.cool.bytes'),
        cold: await this.metrics.gauge('storage.cold.bytes')
      },
      byType: {
        images: await this.metrics.gauge('storage.images.bytes'),
        videos: await this.metrics.gauge('storage.videos.bytes'),
        stories: await this.metrics.gauge('storage.stories.bytes'),
        reels: await this.metrics.gauge('storage.reels.bytes')
      }
    };
  }

  async configureAlerts() {
    // Alert if daily cost exceeds budget
    await this.alerts.create({
      name: 'DailyCostBudget',
      condition: 'storage.daily_cost > budget.daily',
      severity: 'WARNING',
      notification: 'slack'
    });

    // Alert if growth rate is anomalous
    await this.alerts.create({
      name: 'AnomalousGrowth',
      condition: 'storage.growth_rate > storage.growth_rate.avg * 2',
      severity: 'WARNING',
      notification: 'email'
    });

    // Alert if Glacier retrievals spike (expensive)
    await this.alerts.create({
      name: 'GlacierRetrievalSpike',
      condition: 'storage.glacier_retrievals > 1000',
      severity: 'CRITICAL',
      notification: ['slack', 'pagerduty']
    });
  }
}
```

---

## Cleanup and Retention Policies

### Orphaned Content Detection

```javascript
// Find and clean up orphaned media
class OrphanedContentCleaner {
  async findOrphanedMedia() {
    // Media in storage but not referenced in database
    const storageKeys = await this.listAllStorageKeys();
    const databaseRefs = await this.getAllDatabaseReferences();

    const orphaned = [];

    for (const key of storageKeys) {
      if (!databaseRefs.has(key)) {
        const metadata = await this.getObjectMetadata(key);
        orphaned.push({
          key,
          size: metadata.size,
          lastModified: metadata.lastModified,
          ageInDays: this.calculateAge(metadata.lastModified)
        });
      }
    }

    return orphaned;
  }

  async cleanupOrphaned(dryRun = true) {
    const orphaned = await this.findOrphanedMedia();

    // Only delete content orphaned for > 7 days (safety buffer)
    const safeToDelete = orphaned.filter(item => item.ageInDays > 7);

    const report = {
      totalOrphaned: orphaned.length,
      safeToDelete: safeToDelete.length,
      totalSize: safeToDelete.reduce((sum, item) => sum + item.size, 0),
      estimatedSavings: this.calculateSavings(safeToDelete)
    };

    if (!dryRun) {
      for (const item of safeToDelete) {
        await this.objectStorage.delete(item.key);
        await this.logDeletion(item);
      }
      report.deleted = safeToDelete.length;
    }

    return report;
  }
}
```

### User Content Cleanup

```javascript
// Handle content cleanup when users delete accounts
class UserContentCleanup {
  async processAccountDeletion(userId) {
    // 1. Get all user's media
    const userMedia = await this.getAllUserMedia(userId);

    // 2. Check for shared content (deduplicated)
    const sharedContent = [];
    const uniqueContent = [];

    for (const media of userMedia) {
      const refCount = await this.getRefCount(media.contentHash);
      if (refCount > 1) {
        sharedContent.push(media);
      } else {
        uniqueContent.push(media);
      }
    }

    // 3. Delete references (not shared content)
    for (const media of sharedContent) {
      await this.deleteReference(media.referenceId);
    }

    // 4. Delete unique content
    for (const media of uniqueContent) {
      await this.deleteContent(media.contentHash);
    }

    // 5. Generate deletion report
    return {
      userId,
      totalMedia: userMedia.length,
      sharedContent: sharedContent.length,
      uniqueDeleted: uniqueContent.length,
      storageFreed: uniqueContent.reduce((sum, m) => sum + m.size, 0),
      completedAt: Date.now()
    };
  }

  // GDPR-compliant scheduled deletion
  async scheduleAccountDeletion(userId, delayDays = 30) {
    await this.db.collection('deletion_queue').insertOne({
      userId,
      requestedAt: Date.now(),
      scheduledFor: Date.now() + (delayDays * 24 * 60 * 60 * 1000),
      status: 'PENDING'
    });

    // User can cancel within grace period
    return {
      scheduledFor: new Date(Date.now() + (delayDays * 24 * 60 * 60 * 1000)),
      canCancelUntil: new Date(Date.now() + (delayDays * 24 * 60 * 60 * 1000))
    };
  }
}
```

---

## Cost Comparison: Build vs Buy

### Multi-Cloud Storage Strategy

```
Cost comparison across providers:

┌─────────────────────────────────────────────────────────────────┐
│              STORAGE PROVIDER COMPARISON (per GB/month)          │
├────────────────────┬──────────┬──────────┬──────────┬───────────┤
│ Tier               │ AWS S3   │ GCP      │ Azure    │ Cloudflare│
├────────────────────┼──────────┼──────────┼──────────┼───────────┤
│ Standard           │ $0.023   │ $0.020   │ $0.018   │ $0.015    │
│ Infrequent Access  │ $0.0125  │ $0.010   │ $0.010   │ N/A       │
│ Archive            │ $0.004   │ $0.004   │ $0.002   │ N/A       │
│ Deep Archive       │ $0.00099 │ $0.0012  │ $0.00099 │ N/A       │
├────────────────────┼──────────┼──────────┼──────────┼───────────┤
│ Egress (per GB)    │ $0.09    │ $0.12    │ $0.08    │ $0.00     │
└────────────────────┴──────────┴──────────┴──────────┴───────────┘

Strategy for Instagram-scale:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Hot content (< 7 days):                                      │
│    → Cloudflare R2 (no egress fees, fast edge delivery)        │
│                                                                  │
│ 2. Warm content (7-90 days):                                    │
│    → AWS S3 Standard-IA or GCP Nearline                        │
│                                                                  │
│ 3. Cold content (> 90 days):                                    │
│    → AWS Glacier Deep Archive or Azure Cool Blob               │
│                                                                  │
│ 4. Edge caching:                                                │
│    → Cloudflare CDN (already paid for, unlimited bandwidth)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

### Storage Cost Optimization Summary

```
┌─────────────────────────────────────────────────────────────────┐
│            STORAGE COST OPTIMIZATION STRATEGIES                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. INTELLIGENT TIERING                                          │
│    ├─ Hot → Warm → Cool → Cold based on access patterns        │
│    ├─ Lifecycle policies for automatic transitions              │
│    └─ Potential savings: 50-70% of storage costs               │
│                                                                  │
│ 2. DEDUPLICATION                                                │
│    ├─ Content-addressable storage (exact matches)              │
│    ├─ Perceptual hashing (near-duplicates)                     │
│    └─ Potential savings: 10-30% depending on content type      │
│                                                                  │
│ 3. SMART VARIANTS                                               │
│    ├─ Generate only necessary quality levels                   │
│    ├─ Lazy generation for rarely-needed variants               │
│    └─ Potential savings: 20-40% of processing/storage          │
│                                                                  │
│ 4. CLEANUP AUTOMATION                                           │
│    ├─ Orphaned content detection                               │
│    ├─ Story TTL (automatic 24-hour deletion)                   │
│    └─ Account deletion processing                              │
│                                                                  │
│ 5. MULTI-CLOUD STRATEGY                                         │
│    ├─ Use providers optimally for each tier                    │
│    ├─ Cloudflare R2 for zero-egress hot content               │
│    └─ Deep archive for rarely-accessed historical data         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Cost per user target:
┌─────────────────────────────────────────────────────────────────┐
│ Without optimization: ~$0.50/user/month storage                 │
│ With optimization: ~$0.08/user/month storage                    │
│ Savings at 1B users: $420M/month = $5B/year                     │
└─────────────────────────────────────────────────────────────────┘
```

### Interview Discussion Points

1. **How would you handle storage costs at Instagram scale?**
   - Tiering based on access patterns
   - Content deduplication
   - Smart variant generation
   - Lifecycle automation

2. **What's the trade-off between storage cost and latency?**
   - Cold storage saves money but has retrieval delays
   - Need to balance cost savings with user experience
   - Use prediction to pre-warm popular content

3. **How do you handle content deletion at scale?**
   - Reference counting for deduplicated content
   - Batch processing for efficiency
   - GDPR compliance with grace periods

4. **What monitoring would you implement?**
   - Real-time cost dashboards
   - Growth rate alerts
   - Anomaly detection
   - Budget tracking

---

## Series Conclusion

Congratulations! You've completed the **Instagram Asset Management Series**. You now understand:

1. **Image Upload & Processing** - Efficient ingestion pipelines
2. **Image Serving at Scale** - CDN strategies and optimization
3. **Video Processing** - Transcoding and HLS packaging
4. **Video Streaming** - Adaptive bitrate delivery
5. **Feed Loading** - Infinite scroll performance
6. **Stories & Reels** - Ephemeral and short-form content
7. **Storage Optimization** - Cost management at scale

These patterns form the foundation of any media-heavy platform. Apply them to build your own Instagram, TikTok, or YouTube-scale systems!

---

**[← Back to Series Overview](/interview-prep/system-design/instagram-assets-series)**
