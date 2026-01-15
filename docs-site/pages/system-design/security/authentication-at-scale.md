# Authentication at Scale - JWT, OAuth, and Session Management

> **TL;DR:** Sessions don't scale. JWTs scale but can't be revoked. The answer is almost always: short-lived JWTs + refresh tokens + token blacklist for emergencies.

## The Authentication Scaling Problem

**Uber's 2017 Challenge:**

```
Scale:
├── 75 million monthly active users
├── 15 million trips per day
├── 1000+ microservices
└── Each request needs authentication

Initial approach: Session cookies + Redis
├── Every request: Check Redis for session
├── Redis cluster: 50 nodes
├── Latency: +5ms per request
├── Problem: Redis became bottleneck at scale

After migration to JWT:
├── Token validation: Local (no network call)
├── Latency: +0.5ms per request
├── Redis freed for actual caching
└── Result: 10x auth throughput improvement
```

---

## Authentication Patterns Compared

```
SESSION-BASED:
┌────────┐     ┌────────┐     ┌─────────────┐
│ Client │────▶│ Server │────▶│ Session DB  │
│        │◀────│        │◀────│ (Redis/SQL) │
└────────┘     └────────┘     └─────────────┘

Every request: Server → Database lookup
Scaling: More users = More DB load

TOKEN-BASED (JWT):
┌────────┐     ┌────────┐
│ Client │────▶│ Server │  (No DB call!)
│        │◀────│        │
└────────┘     └────────┘

Every request: Server validates token locally
Scaling: Linear (just add servers)
```

---

## JWT Deep Dive

### Structure

```
JWT = Header.Payload.Signature

HEADER (Algorithm + Type):
{
  "alg": "RS256",
  "typ": "JWT"
}

PAYLOAD (Claims):
{
  "sub": "user-123",           // Subject (user ID)
  "iat": 1704067200,           // Issued at
  "exp": 1704070800,           // Expiration (1 hour)
  "iss": "auth.myapp.com",     // Issuer
  "aud": "api.myapp.com",      // Audience
  "roles": ["user", "admin"],  // Custom claims
  "org_id": "org-456"          // Custom claims
}

SIGNATURE:
RS256(
  base64(header) + "." + base64(payload),
  privateKey
)
```

### Implementation

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ==========================================
// TOKEN GENERATION (Auth Service)
// ==========================================

class AuthService {
  constructor() {
    // Use RS256 for production (asymmetric)
    // Auth service has private key (signs)
    // All services have public key (verify)
    this.privateKey = fs.readFileSync('./private.pem');
    this.publicKey = fs.readFileSync('./public.pem');
  }

  generateTokens(user) {
    // Short-lived access token (15 minutes)
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        org_id: user.orgId,
        type: 'access'
      },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '15m',
        issuer: 'auth.myapp.com',
        audience: 'api.myapp.com'
      }
    );

    // Long-lived refresh token (7 days)
    const refreshToken = jwt.sign(
      {
        sub: user.id,
        type: 'refresh',
        jti: crypto.randomUUID()  // Unique ID for revocation
      },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '7d',
        issuer: 'auth.myapp.com'
      }
    );

    // Store refresh token ID for revocation capability
    await redis.set(`refresh:${refreshToken.jti}`, user.id, 'EX', 7 * 24 * 3600);

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'auth.myapp.com'
      });

      // Check if refresh token is revoked
      const exists = await redis.exists(`refresh:${decoded.jti}`);
      if (!exists) {
        throw new Error('Refresh token revoked');
      }

      // Get fresh user data
      const user = await db.users.findById(decoded.sub);

      // Generate new access token
      return this.generateTokens(user).accessToken;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async revokeRefreshToken(refreshToken) {
    const decoded = jwt.decode(refreshToken);
    await redis.del(`refresh:${decoded.jti}`);
  }

  async revokeAllUserTokens(userId) {
    // For emergency: Add user to blacklist
    await redis.set(`blacklist:user:${userId}`, '1', 'EX', 24 * 3600);
  }
}

// ==========================================
// TOKEN VALIDATION (Any Service)
// ==========================================

function authMiddleware(publicKey) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'auth.myapp.com',
        audience: 'api.myapp.com'
      });

      // Optional: Check blacklist for emergency revocation
      const isBlacklisted = await redis.exists(`blacklist:user:${decoded.sub}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token revoked' });
      }

      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
```

---

## OAuth 2.0 Flows

### Authorization Code Flow (Recommended)

```
┌────────────────────────────────────────────────────────────────┐
│                  AUTHORIZATION CODE FLOW                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  User        Client App       Auth Server      Resource Server │
│   │              │                 │                  │        │
│   │──────────────┤                 │                  │        │
│   │  Click Login │                 │                  │        │
│   │              │                 │                  │        │
│   │              │────────────────▶│                  │        │
│   │              │  1. Redirect to │                  │        │
│   │              │  /authorize     │                  │        │
│   │              │                 │                  │        │
│   │◀─────────────┤─────────────────│                  │        │
│   │  2. Login page                 │                  │        │
│   │                                │                  │        │
│   │─────────────────────────────▶ │                  │        │
│   │  3. User logs in + consents    │                  │        │
│   │                                │                  │        │
│   │◀─────────────────────────────│                  │        │
│   │  4. Redirect to callback       │                  │        │
│   │     ?code=AUTH_CODE            │                  │        │
│   │              │                 │                  │        │
│   │              │────────────────▶│                  │        │
│   │              │  5. POST /token │                  │        │
│   │              │  code=AUTH_CODE │                  │        │
│   │              │  client_secret  │                  │        │
│   │              │                 │                  │        │
│   │              │◀────────────────│                  │        │
│   │              │  6. Access +    │                  │        │
│   │              │  Refresh tokens │                  │        │
│   │              │                 │                  │        │
│   │              │─────────────────┼─────────────────▶│        │
│   │              │  7. API call    │                  │        │
│   │              │  Authorization: │                  │        │
│   │              │  Bearer TOKEN   │                  │        │
│   │              │                 │                  │        │
│   │              │◀────────────────┼──────────────────│        │
│   │              │  8. Resource    │                  │        │
│   │              │                 │                  │        │
└────────────────────────────────────────────────────────────────┘
```

### Implementation

```javascript
// OAuth 2.0 Authorization Server
class OAuthServer {
  // Step 1: Authorization endpoint
  async authorize(req, res) {
    const { client_id, redirect_uri, scope, state, response_type } = req.query;

    // Validate client
    const client = await db.clients.findById(client_id);
    if (!client || !client.redirectUris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'invalid_client' });
    }

    // Show login/consent page
    res.render('login', { client, scope, state, redirect_uri });
  }

  // Step 3: After user consents
  async handleConsent(req, res) {
    const { user_id, client_id, redirect_uri, scope, state } = req.body;

    // Generate authorization code (short-lived)
    const code = crypto.randomBytes(32).toString('hex');

    // Store code with context (expires in 10 minutes)
    await redis.set(`auth_code:${code}`, JSON.stringify({
      userId: user_id,
      clientId: client_id,
      scope: scope,
      redirectUri: redirect_uri
    }), 'EX', 600);

    // Redirect back to client
    res.redirect(`${redirect_uri}?code=${code}&state=${state}`);
  }

  // Step 5: Token endpoint
  async token(req, res) {
    const { grant_type, code, client_id, client_secret, redirect_uri, refresh_token } = req.body;

    // Validate client credentials
    const client = await db.clients.findById(client_id);
    if (!client || client.secret !== client_secret) {
      return res.status(401).json({ error: 'invalid_client' });
    }

    if (grant_type === 'authorization_code') {
      // Exchange code for tokens
      const codeData = await redis.get(`auth_code:${code}`);
      if (!codeData) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      const { userId, scope, redirectUri } = JSON.parse(codeData);

      // Validate redirect URI matches
      if (redirectUri !== redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant' });
      }

      // Delete code (one-time use)
      await redis.del(`auth_code:${code}`);

      // Generate tokens
      const user = await db.users.findById(userId);
      const tokens = this.authService.generateTokens(user);

      return res.json({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: 900,  // 15 minutes
        scope: scope
      });
    }

    if (grant_type === 'refresh_token') {
      const accessToken = await this.authService.refreshAccessToken(refresh_token);
      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 900
      });
    }

    res.status(400).json({ error: 'unsupported_grant_type' });
  }
}
```

---

## Service-to-Service Authentication

### API Keys

```javascript
// Simple API key authentication
const apiKeys = new Map([
  ['sk_live_abc123', { service: 'payment-service', permissions: ['read', 'write'] }],
  ['sk_live_def456', { service: 'email-service', permissions: ['read'] }]
]);

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !apiKeys.has(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.service = apiKeys.get(apiKey);
  next();
}
```

### mTLS (Mutual TLS)

```
MUTUAL TLS:
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Service A                                        Service B    │
│  (Client)                                         (Server)     │
│     │                                                │         │
│     │──── ClientHello ─────────────────────────────▶│         │
│     │                                                │         │
│     │◀─── ServerHello + Server Certificate ─────────│         │
│     │                                                │         │
│     │──── Client Certificate ──────────────────────▶│         │
│     │     (Proves Service A's identity)             │         │
│     │                                                │         │
│     │◀─── Verify Client Certificate ────────────────│         │
│     │     (Service B verifies A's identity)         │         │
│     │                                                │         │
│     │◀───────── Encrypted Connection ──────────────▶│         │
│     │                                                │         │
└────────────────────────────────────────────────────────────────┘

Benefits:
- No passwords or tokens to manage
- Certificate rotation is automated
- Identity verified at TLS layer
- Common in service meshes (Istio, Linkerd)
```

---

## Token Revocation Strategies

### The Revocation Problem

```
JWT REVOCATION CHALLENGE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  JWTs are STATELESS - that's the benefit AND the problem       │
│                                                                 │
│  User compromised at 10:00 AM                                   │
│  Token expires at 11:00 AM                                      │
│  Attacker has 1 hour of access!                                 │
│                                                                 │
│  Solutions:                                                     │
│  ├── Short-lived tokens (15 min) + refresh tokens              │
│  ├── Token blacklist (check on each request)                   │
│  ├── Token versioning (increment version on logout)            │
│  └── Hybrid: Short tokens + blacklist for emergencies          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation: Token Blacklist

```javascript
class TokenRevocation {
  // Blacklist specific token
  async revokeToken(token) {
    const decoded = jwt.decode(token);
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      // Store until natural expiration
      await redis.set(`blacklist:token:${decoded.jti}`, '1', 'EX', ttl);
    }
  }

  // Blacklist all user tokens
  async revokeAllUserTokens(userId) {
    // Increment user's token version
    await redis.incr(`token_version:${userId}`);

    // Optionally: Add to blacklist for immediate effect
    await redis.set(`blacklist:user:${userId}`, '1', 'EX', 24 * 3600);
  }

  // Check if token is revoked
  async isRevoked(decoded) {
    // Check token blacklist
    if (await redis.exists(`blacklist:token:${decoded.jti}`)) {
      return true;
    }

    // Check user blacklist
    if (await redis.exists(`blacklist:user:${decoded.sub}`)) {
      return true;
    }

    // Check token version
    const currentVersion = await redis.get(`token_version:${decoded.sub}`);
    if (currentVersion && decoded.token_version < parseInt(currentVersion)) {
      return true;
    }

    return false;
  }
}
```

---

## Scaling Authentication

### Architecture at Scale

```
AUTHENTICATION AT SCALE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      ┌─────────────┐                            │
│                      │   API GW    │  ◀── Token validation      │
│                      │  (Verify)   │      Public key cached     │
│                      └──────┬──────┘                            │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐          │
│  │ Service A  │     │ Service B  │     │ Service C  │          │
│  │ (Trusts    │     │ (Trusts    │     │ (Trusts    │          │
│  │  Gateway)  │     │  Gateway)  │     │  Gateway)  │          │
│  └────────────┘     └────────────┘     └────────────┘          │
│                                                                 │
│  Option 1: Gateway validates, services trust gateway           │
│  Option 2: Each service validates (JWT makes this cheap)       │
│                                                                 │
│                      ┌─────────────┐                            │
│                      │ Auth Service│  ◀── Login, token issue   │
│                      │  (Stateful) │      Refresh tokens       │
│                      └──────┬──────┘                            │
│                             │                                   │
│                      ┌──────▼──────┐                            │
│                      │    Redis    │  ◀── Refresh tokens       │
│                      │  (Sessions) │      Blacklist             │
│                      └─────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Best Practices

```yaml
Token Configuration:
  access_token:
    lifetime: 15 minutes
    storage: Memory/LocalStorage (web), Keychain (mobile)
    validation: Local (public key)

  refresh_token:
    lifetime: 7-30 days
    storage: HttpOnly cookie (web), Secure storage (mobile)
    validation: Server-side (Redis)

Security Headers:
  - Strict-Transport-Security: max-age=31536000
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Content-Security-Policy: default-src 'self'

Rate Limiting:
  - Login attempts: 5 per minute per IP
  - Token refresh: 10 per minute per user
  - API requests: 1000 per minute per token
```

---

## Key Takeaways

### Authentication Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Need to scale horizontally?                                    │
│       │                                                         │
│       ├── YES ──▶ Use JWT (stateless)                          │
│       │              │                                          │
│       │              ├── Short access tokens (15 min)          │
│       │              ├── Long refresh tokens (7 days)          │
│       │              └── Blacklist for emergencies             │
│       │                                                         │
│       └── NO ──▶ Sessions are fine                             │
│                    │                                            │
│                    └── Redis for session store                 │
│                                                                 │
│  Third-party login needed?                                      │
│       │                                                         │
│       └── YES ──▶ OAuth 2.0 + OIDC                             │
│                                                                 │
│  Service-to-service auth?                                       │
│       │                                                         │
│       ├── Simple ──▶ API Keys                                  │
│       └── Secure ──▶ mTLS                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Reference

| Scenario | Solution |
|----------|----------|
| Web app, single server | Session cookies |
| Web app, multiple servers | JWT + refresh tokens |
| Mobile app | JWT + secure storage |
| Third-party login | OAuth 2.0 |
| Microservices | JWT or mTLS |
| Emergency revocation | Token blacklist |

---

## Related Content

- [Rate Limiting](/system-design/api-design/rate-limiting)
- [API Design Patterns](/system-design/api-design/rest-graphql-grpc)
- [Idempotency](/system-design/api-design/idempotency)
