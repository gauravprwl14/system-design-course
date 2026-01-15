# POC #88: API Key Management

> **Difficulty:** 🟡 Intermediate
> **Time:** 25 minutes
> **Prerequisites:** Node.js, Cryptography basics

## What You'll Learn

API keys provide simple authentication for server-to-server communication. This POC covers secure generation, storage, rotation, and rate limiting.

```
API KEY LIFECYCLE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. GENERATION          2. STORAGE           3. VALIDATION      │
│  ──────────────          ───────────          ────────────      │
│                                                                 │
│  ┌─────────────┐       ┌─────────────┐      ┌─────────────┐    │
│  │ Random 256  │       │ Hash stored │      │ Hash input  │    │
│  │ bit secret  │ ───▶  │ (not plain) │ ───▶ │ and compare │    │
│  └─────────────┘       └─────────────┘      └─────────────┘    │
│                                                                 │
│  4. ROTATION            5. REVOCATION                           │
│  ────────────            ────────────                           │
│                                                                 │
│  ┌─────────────┐       ┌─────────────┐                         │
│  │ New key     │       │ Immediate   │                         │
│  │ overlap     │       │ invalidate  │                         │
│  └─────────────┘       └─────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// api-key-management.js
const crypto = require('crypto');

// ==========================================
// API KEY GENERATOR
// ==========================================

class APIKeyGenerator {
  constructor(options = {}) {
    this.prefix = options.prefix || 'sk';  // sk = secret key
    this.keyLength = options.keyLength || 32;
    this.hashAlgorithm = 'sha256';
  }

  // Generate a new API key
  generate() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(this.keyLength).toString('base64url');
    const key = `${this.prefix}_${timestamp}_${random}`;

    return {
      key,                              // Full key (shown once to user)
      keyId: this.extractKeyId(key),    // Key identifier (for lookups)
      hash: this.hash(key),             // Hash (stored in database)
      prefix: key.substring(0, 12)      // Prefix for display
    };
  }

  // Extract key ID (non-secret part)
  extractKeyId(key) {
    const parts = key.split('_');
    return `${parts[0]}_${parts[1]}`;
  }

  // Hash the key for storage
  hash(key) {
    return crypto
      .createHash(this.hashAlgorithm)
      .update(key)
      .digest('hex');
  }

  // Verify a key against its hash
  verify(key, hash) {
    const keyHash = this.hash(key);
    return crypto.timingSafeEqual(
      Buffer.from(keyHash),
      Buffer.from(hash)
    );
  }
}

// ==========================================
// API KEY STORE
// ==========================================

class APIKeyStore {
  constructor(generator) {
    this.generator = generator;
    this.keys = new Map();        // keyId -> key metadata
    this.hashIndex = new Map();   // hash -> keyId (for lookup)
  }

  // Create a new API key
  create(userId, name, scopes = [], options = {}) {
    const { key, keyId, hash, prefix } = this.generator.generate();

    const metadata = {
      keyId,
      hash,
      prefix,
      userId,
      name,
      scopes,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: options.expiresAt || null,
      rateLimit: options.rateLimit || { requests: 1000, window: 3600 },
      status: 'active'
    };

    this.keys.set(keyId, metadata);
    this.hashIndex.set(hash, keyId);

    console.log(`🔑 API key created: ${prefix}...`);

    // Return full key only once!
    return {
      key,           // IMPORTANT: Only returned at creation
      keyId,
      prefix,
      name,
      scopes,
      expiresAt: metadata.expiresAt
    };
  }

  // Validate an API key
  validate(key) {
    const hash = this.generator.hash(key);
    const keyId = this.hashIndex.get(hash);

    if (!keyId) {
      return { valid: false, error: 'Invalid API key' };
    }

    const metadata = this.keys.get(keyId);

    // Check status
    if (metadata.status !== 'active') {
      return { valid: false, error: 'API key revoked' };
    }

    // Check expiration
    if (metadata.expiresAt && new Date() > metadata.expiresAt) {
      return { valid: false, error: 'API key expired' };
    }

    // Update last used
    metadata.lastUsedAt = new Date();

    return {
      valid: true,
      keyId,
      userId: metadata.userId,
      scopes: metadata.scopes,
      rateLimit: metadata.rateLimit
    };
  }

  // List keys for a user (no secrets!)
  listKeys(userId) {
    const userKeys = [];
    for (const [keyId, metadata] of this.keys) {
      if (metadata.userId === userId) {
        userKeys.push({
          keyId,
          prefix: metadata.prefix,
          name: metadata.name,
          scopes: metadata.scopes,
          createdAt: metadata.createdAt,
          lastUsedAt: metadata.lastUsedAt,
          expiresAt: metadata.expiresAt,
          status: metadata.status
        });
      }
    }
    return userKeys;
  }

  // Revoke a key
  revoke(keyId, userId) {
    const metadata = this.keys.get(keyId);

    if (!metadata) {
      return { success: false, error: 'Key not found' };
    }

    if (metadata.userId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    metadata.status = 'revoked';
    this.hashIndex.delete(metadata.hash);

    console.log(`🔒 API key revoked: ${metadata.prefix}...`);
    return { success: true };
  }

  // Rotate a key (create new, deprecate old)
  rotate(keyId, userId) {
    const oldMetadata = this.keys.get(keyId);

    if (!oldMetadata || oldMetadata.userId !== userId) {
      return { success: false, error: 'Key not found or unauthorized' };
    }

    // Create new key with same settings
    const newKey = this.create(userId, oldMetadata.name, oldMetadata.scopes, {
      rateLimit: oldMetadata.rateLimit
    });

    // Mark old key as deprecated (still works for grace period)
    oldMetadata.status = 'deprecated';
    oldMetadata.deprecatedAt = new Date();

    console.log(`🔄 API key rotated: ${oldMetadata.prefix}... → ${newKey.prefix}...`);

    return {
      success: true,
      newKey,
      oldKeyId: keyId,
      gracePeriod: '24 hours'
    };
  }

  // Clean up deprecated keys after grace period
  cleanupDeprecated(gracePeriodMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [keyId, metadata] of this.keys) {
      if (metadata.status === 'deprecated') {
        const deprecatedTime = new Date(metadata.deprecatedAt).getTime();
        if (now - deprecatedTime > gracePeriodMs) {
          this.hashIndex.delete(metadata.hash);
          this.keys.delete(keyId);
          cleaned++;
        }
      }
    }

    console.log(`🧹 Cleaned up ${cleaned} deprecated keys`);
    return cleaned;
  }
}

// ==========================================
// RATE LIMITER (per API key)
// ==========================================

class APIKeyRateLimiter {
  constructor() {
    this.windows = new Map();  // keyId -> { count, resetAt }
  }

  check(keyId, rateLimit) {
    const now = Date.now();
    const windowKey = keyId;

    let window = this.windows.get(windowKey);

    // Reset window if expired
    if (!window || now > window.resetAt) {
      window = {
        count: 0,
        resetAt: now + rateLimit.window * 1000
      };
      this.windows.set(windowKey, window);
    }

    // Check limit
    if (window.count >= rateLimit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: window.resetAt,
        retryAfter: Math.ceil((window.resetAt - now) / 1000)
      };
    }

    // Increment counter
    window.count++;

    return {
      allowed: true,
      remaining: rateLimit.requests - window.count,
      resetAt: window.resetAt
    };
  }
}

// ==========================================
// EXPRESS MIDDLEWARE
// ==========================================

function apiKeyMiddleware(keyStore, rateLimiter) {
  return (req, res, next) => {
    // Extract API key from header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        error: 'Missing API key',
        message: 'Provide API key in X-API-Key header'
      });
    }

    // Validate key
    const validation = keyStore.validate(apiKey);

    if (!validation.valid) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: validation.error
      });
    }

    // Check rate limit
    const rateCheck = rateLimiter.check(validation.keyId, validation.rateLimit);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': validation.rateLimit.requests,
      'X-RateLimit-Remaining': rateCheck.remaining,
      'X-RateLimit-Reset': Math.floor(rateCheck.resetAt / 1000)
    });

    if (!rateCheck.allowed) {
      res.set('Retry-After', rateCheck.retryAfter);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateCheck.retryAfter
      });
    }

    // Attach key info to request
    req.apiKey = {
      keyId: validation.keyId,
      userId: validation.userId,
      scopes: validation.scopes
    };

    next();
  };
}

// Scope checking middleware
function requireScope(...requiredScopes) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasScope = requiredScopes.some(scope => req.apiKey.scopes.includes(scope));

    if (!hasScope) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredScopes,
        provided: req.apiKey.scopes
      });
    }

    next();
  };
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('API KEY MANAGEMENT');
  console.log('='.repeat(60));

  const generator = new APIKeyGenerator({ prefix: 'sk_live' });
  const keyStore = new APIKeyStore(generator);
  const rateLimiter = new APIKeyRateLimiter();

  // Create API keys
  console.log('\n--- Creating API Keys ---');
  const readOnlyKey = keyStore.create('user-123', 'Read Only Key', ['read'], {
    rateLimit: { requests: 100, window: 3600 }
  });
  console.log('Read-only key:', readOnlyKey.key);

  const fullAccessKey = keyStore.create('user-123', 'Full Access Key', ['read', 'write', 'admin'], {
    rateLimit: { requests: 1000, window: 3600 }
  });
  console.log('Full access key:', fullAccessKey.key);

  // List keys for user
  console.log('\n--- Listing User Keys ---');
  const userKeys = keyStore.listKeys('user-123');
  userKeys.forEach(k => {
    console.log(`  ${k.prefix}... - ${k.name} [${k.scopes.join(', ')}]`);
  });

  // Validate keys
  console.log('\n--- Validating Keys ---');
  const readValidation = keyStore.validate(readOnlyKey.key);
  console.log('Read-only key valid:', readValidation.valid);
  console.log('  Scopes:', readValidation.scopes);

  const invalidValidation = keyStore.validate('sk_invalid_key');
  console.log('Invalid key valid:', invalidValidation.valid);
  console.log('  Error:', invalidValidation.error);

  // Rate limiting
  console.log('\n--- Rate Limiting ---');
  for (let i = 0; i < 5; i++) {
    const check = rateLimiter.check(readOnlyKey.keyId, { requests: 3, window: 60 });
    console.log(`Request ${i + 1}: allowed=${check.allowed}, remaining=${check.remaining}`);
  }

  // Key rotation
  console.log('\n--- Key Rotation ---');
  const rotation = keyStore.rotate(readOnlyKey.keyId, 'user-123');
  console.log('Rotation result:', rotation.success ? 'Success' : 'Failed');
  console.log('New key prefix:', rotation.newKey?.prefix);
  console.log('Grace period:', rotation.gracePeriod);

  // Old key still works during grace period
  const oldKeyValidation = keyStore.validate(readOnlyKey.key);
  console.log('Old key still valid (deprecated):', oldKeyValidation.valid);

  // Key revocation
  console.log('\n--- Key Revocation ---');
  keyStore.revoke(fullAccessKey.keyId, 'user-123');
  const revokedValidation = keyStore.validate(fullAccessKey.key);
  console.log('Revoked key valid:', revokedValidation.valid);

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## API Key Best Practices

| Practice | Implementation |
|----------|----------------|
| **Never store plain text** | Hash keys before storing |
| **Show key once** | Only display full key at creation |
| **Include prefix** | `sk_live_`, `pk_test_` for identification |
| **Support rotation** | Grace period for old keys |
| **Scope permissions** | Fine-grained access control |
| **Rate limit per key** | Prevent abuse |

---

## Key Format Examples

```
STRIPE-STYLE:
sk_live_51H7...abc     (Secret key, live mode)
pk_test_51H7...xyz     (Publishable key, test mode)

GITHUB-STYLE:
ghp_xxxxxxxxxxxx       (Personal access token)
ghs_xxxxxxxxxxxx       (GitHub Actions token)

AWS-STYLE:
AKIA...                (Access Key ID)
+secret...             (Secret Access Key)
```

---

## Security Checklist

```
✅ GENERATION:
├── Use cryptographically secure random
├── Minimum 256 bits of entropy
├── Include version/type prefix
└── Generate unique key ID

✅ STORAGE:
├── Hash before storing (SHA-256+)
├── Store metadata separately
├── Encrypt at rest
└── Audit access logs

✅ TRANSMISSION:
├── HTTPS only
├── Never in URL parameters
├── Header or POST body only
└── Mask in logs

✅ LIFECYCLE:
├── Support expiration
├── Enable rotation
├── Immediate revocation
└── Cleanup deprecated keys
```

---

## Related POCs

- [JWT Authentication](/interview-prep/practice-pocs/jwt-authentication)
- [OAuth 2.0 Flows](/interview-prep/practice-pocs/oauth-flows)
- [RBAC Implementation](/interview-prep/practice-pocs/rbac-implementation)
