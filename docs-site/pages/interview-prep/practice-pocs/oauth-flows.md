# POC #87: OAuth 2.0 Flows

> **Difficulty:** 🟡 Intermediate
> **Time:** 30 minutes
> **Prerequisites:** Node.js, HTTP basics, JWT concepts

## What You'll Learn

OAuth 2.0 is an authorization framework that enables third-party applications to obtain limited access to user accounts without exposing passwords.

```
OAUTH 2.0 AUTHORIZATION CODE FLOW:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  User        Client App       Auth Server       Resource API    │
│   │              │                 │                 │          │
│   │──1.Login────▶│                 │                 │          │
│   │              │──2.Redirect────▶│                 │          │
│   │◀─────────────┼─────────────────│                 │          │
│   │──3.Consent──▶│                 │                 │          │
│   │              │◀─4.Auth Code────│                 │          │
│   │              │──5.Exchange────▶│                 │          │
│   │              │◀─6.Tokens───────│                 │          │
│   │              │──7.API Call────────────────────▶  │          │
│   │              │◀─8.Data────────────────────────── │          │
│   │◀─9.Response──│                 │                 │          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```javascript
// oauth-flows.js
const crypto = require('crypto');
const http = require('http');
const url = require('url');

// ==========================================
// OAUTH PROVIDER (Authorization Server)
// ==========================================

class OAuthProvider {
  constructor(config) {
    this.clients = new Map();          // Registered clients
    this.authCodes = new Map();        // Temporary auth codes
    this.tokens = new Map();           // Access tokens
    this.refreshTokens = new Map();    // Refresh tokens
    this.users = new Map();            // User database
    this.consents = new Map();         // User consents

    this.authCodeExpiry = 600;         // 10 minutes
    this.accessTokenExpiry = 3600;     // 1 hour
    this.refreshTokenExpiry = 2592000; // 30 days
  }

  // Register a client application
  registerClient(clientId, clientSecret, redirectUris, scopes) {
    this.clients.set(clientId, {
      clientId,
      clientSecret,
      redirectUris,
      allowedScopes: scopes
    });
    console.log(`📝 Registered client: ${clientId}`);
  }

  // Register a user
  registerUser(userId, email, password) {
    this.users.set(userId, {
      id: userId,
      email,
      passwordHash: this.hashPassword(password)
    });
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // ==========================================
  // AUTHORIZATION CODE FLOW
  // ==========================================

  // Step 1: Authorization Request
  authorize(params) {
    const { client_id, redirect_uri, response_type, scope, state } = params;

    // Validate client
    const client = this.clients.get(client_id);
    if (!client) {
      return { error: 'invalid_client', error_description: 'Unknown client' };
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(redirect_uri)) {
      return { error: 'invalid_redirect_uri', error_description: 'Invalid redirect URI' };
    }

    // Validate response type
    if (response_type !== 'code') {
      return { error: 'unsupported_response_type' };
    }

    // Validate scopes
    const requestedScopes = scope ? scope.split(' ') : [];
    const invalidScopes = requestedScopes.filter(s => !client.allowedScopes.includes(s));
    if (invalidScopes.length > 0) {
      return { error: 'invalid_scope', error_description: `Invalid scopes: ${invalidScopes.join(', ')}` };
    }

    // Return authorization request for consent screen
    return {
      success: true,
      client_name: client_id,
      scopes: requestedScopes,
      redirect_uri,
      state
    };
  }

  // Step 2: User grants consent and we generate auth code
  grantAuthorization(userId, clientId, scopes, redirectUri, state) {
    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');

    // Store auth code with metadata
    this.authCodes.set(code, {
      userId,
      clientId,
      scopes,
      redirectUri,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.authCodeExpiry * 1000
    });

    // Record consent
    const consentKey = `${userId}:${clientId}`;
    this.consents.set(consentKey, {
      scopes,
      grantedAt: Date.now()
    });

    console.log(`✅ Auth code generated for user ${userId}`);

    // Return redirect URL with code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    return redirectUrl.toString();
  }

  // Step 3: Exchange auth code for tokens
  exchangeAuthCode(params) {
    const { grant_type, code, redirect_uri, client_id, client_secret } = params;

    // Validate grant type
    if (grant_type !== 'authorization_code') {
      return { error: 'unsupported_grant_type' };
    }

    // Validate client credentials
    const client = this.clients.get(client_id);
    if (!client || client.clientSecret !== client_secret) {
      return { error: 'invalid_client' };
    }

    // Validate auth code
    const authCode = this.authCodes.get(code);
    if (!authCode) {
      return { error: 'invalid_grant', error_description: 'Invalid authorization code' };
    }

    // Check expiration
    if (Date.now() > authCode.expiresAt) {
      this.authCodes.delete(code);
      return { error: 'invalid_grant', error_description: 'Authorization code expired' };
    }

    // Validate redirect URI matches
    if (authCode.redirectUri !== redirect_uri) {
      return { error: 'invalid_grant', error_description: 'Redirect URI mismatch' };
    }

    // Validate client matches
    if (authCode.clientId !== client_id) {
      return { error: 'invalid_grant', error_description: 'Client mismatch' };
    }

    // Delete auth code (one-time use)
    this.authCodes.delete(code);

    // Generate tokens
    return this.generateTokens(authCode.userId, client_id, authCode.scopes);
  }

  // Generate access and refresh tokens
  generateTokens(userId, clientId, scopes) {
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // Store access token
    this.tokens.set(accessToken, {
      userId,
      clientId,
      scopes,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.accessTokenExpiry * 1000
    });

    // Store refresh token
    this.refreshTokens.set(refreshToken, {
      userId,
      clientId,
      scopes,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.refreshTokenExpiry * 1000
    });

    console.log(`🔑 Tokens generated for user ${userId}`);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenExpiry,
      refresh_token: refreshToken,
      scope: scopes.join(' ')
    };
  }

  // Refresh access token
  refreshAccessToken(params) {
    const { grant_type, refresh_token, client_id, client_secret } = params;

    if (grant_type !== 'refresh_token') {
      return { error: 'unsupported_grant_type' };
    }

    // Validate client
    const client = this.clients.get(client_id);
    if (!client || client.clientSecret !== client_secret) {
      return { error: 'invalid_client' };
    }

    // Validate refresh token
    const tokenData = this.refreshTokens.get(refresh_token);
    if (!tokenData) {
      return { error: 'invalid_grant', error_description: 'Invalid refresh token' };
    }

    if (Date.now() > tokenData.expiresAt) {
      this.refreshTokens.delete(refresh_token);
      return { error: 'invalid_grant', error_description: 'Refresh token expired' };
    }

    // Generate new access token (keep same refresh token)
    const accessToken = crypto.randomBytes(32).toString('hex');

    this.tokens.set(accessToken, {
      userId: tokenData.userId,
      clientId,
      scopes: tokenData.scopes,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.accessTokenExpiry * 1000
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenExpiry,
      scope: tokenData.scopes.join(' ')
    };
  }

  // Validate access token (Resource Server)
  validateToken(accessToken) {
    const tokenData = this.tokens.get(accessToken);

    if (!tokenData) {
      return { valid: false, error: 'Invalid token' };
    }

    if (Date.now() > tokenData.expiresAt) {
      this.tokens.delete(accessToken);
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      userId: tokenData.userId,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes
    };
  }

  // Revoke token
  revokeToken(token) {
    const deleted = this.tokens.delete(token) || this.refreshTokens.delete(token);
    if (deleted) {
      console.log(`🔒 Token revoked`);
    }
    return deleted;
  }
}

// ==========================================
// CLIENT APPLICATION
// ==========================================

class OAuthClient {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.authorizationEndpoint = config.authorizationEndpoint;
    this.tokenEndpoint = config.tokenEndpoint;
    this.scopes = config.scopes || [];
  }

  // Step 1: Build authorization URL
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state
    });

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  // Step 2: Exchange code for tokens (simulated)
  async exchangeCode(code, provider) {
    return provider.exchangeAuthCode({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
  }

  // Step 3: Refresh access token
  async refreshToken(refreshToken, provider) {
    return provider.refreshAccessToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
  }
}

// ==========================================
// PKCE EXTENSION (for public clients)
// ==========================================

class PKCE {
  // Generate code verifier (43-128 chars)
  static generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  // Generate code challenge from verifier
  static generateCodeChallenge(verifier) {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  // Verify code challenge
  static verifyCodeChallenge(verifier, challenge) {
    const computed = this.generateCodeChallenge(verifier);
    return computed === challenge;
  }
}

// ==========================================
// DEMONSTRATION
// ==========================================

async function demonstrate() {
  console.log('='.repeat(60));
  console.log('OAUTH 2.0 FLOWS');
  console.log('='.repeat(60));

  // Setup OAuth Provider
  const provider = new OAuthProvider();

  // Register client application
  provider.registerClient(
    'my-app',
    'super-secret-key',
    ['http://localhost:3000/callback'],
    ['read', 'write', 'profile']
  );

  // Register user
  provider.registerUser('user-123', 'user@example.com', 'password123');

  // Setup OAuth Client
  const client = new OAuthClient({
    clientId: 'my-app',
    clientSecret: 'super-secret-key',
    redirectUri: 'http://localhost:3000/callback',
    authorizationEndpoint: 'http://auth.example.com/authorize',
    tokenEndpoint: 'http://auth.example.com/token',
    scopes: ['read', 'profile']
  });

  // ===== AUTHORIZATION CODE FLOW =====
  console.log('\n--- Authorization Code Flow ---');

  // Step 1: User clicks "Login with OAuth"
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = client.getAuthorizationUrl(state);
  console.log('1. Authorization URL:', authUrl);

  // Step 2: Provider validates request
  const authParams = {
    client_id: 'my-app',
    redirect_uri: 'http://localhost:3000/callback',
    response_type: 'code',
    scope: 'read profile',
    state
  };
  const authResult = provider.authorize(authParams);
  console.log('2. Authorization validated:', authResult.success ? 'OK' : authResult.error);

  // Step 3: User grants consent
  const redirectUrl = provider.grantAuthorization(
    'user-123',
    'my-app',
    ['read', 'profile'],
    'http://localhost:3000/callback',
    state
  );
  console.log('3. Redirect URL:', redirectUrl);

  // Extract code from redirect URL
  const code = new URL(redirectUrl).searchParams.get('code');

  // Step 4: Exchange code for tokens
  const tokens = await client.exchangeCode(code, provider);
  console.log('4. Tokens received:');
  console.log('   Access Token:', tokens.access_token.substring(0, 20) + '...');
  console.log('   Refresh Token:', tokens.refresh_token.substring(0, 20) + '...');
  console.log('   Expires In:', tokens.expires_in, 'seconds');

  // Step 5: Validate access token (Resource Server)
  console.log('\n--- Token Validation ---');
  const validation = provider.validateToken(tokens.access_token);
  console.log('Token valid:', validation.valid);
  console.log('User ID:', validation.userId);
  console.log('Scopes:', validation.scopes);

  // Step 6: Refresh token
  console.log('\n--- Token Refresh ---');
  const newTokens = await client.refreshToken(tokens.refresh_token, provider);
  console.log('New Access Token:', newTokens.access_token.substring(0, 20) + '...');

  // ===== PKCE FLOW =====
  console.log('\n--- PKCE Extension (for SPAs/Mobile) ---');
  const verifier = PKCE.generateCodeVerifier();
  const challenge = PKCE.generateCodeChallenge(verifier);
  console.log('Code Verifier:', verifier);
  console.log('Code Challenge:', challenge);
  console.log('PKCE Verified:', PKCE.verifyCodeChallenge(verifier, challenge));

  // Step 7: Revoke token
  console.log('\n--- Token Revocation ---');
  provider.revokeToken(tokens.access_token);
  const afterRevoke = provider.validateToken(tokens.access_token);
  console.log('Token valid after revoke:', afterRevoke.valid);

  console.log('\n✅ Demo complete!');
}

demonstrate().catch(console.error);
```

---

## OAuth 2.0 Grant Types

| Grant Type | Use Case | Flow |
|------------|----------|------|
| **Authorization Code** | Web apps with backend | User consents, code exchanged |
| **Authorization Code + PKCE** | SPAs, mobile apps | Same + code verifier |
| **Client Credentials** | Machine-to-machine | No user, direct token |
| **Refresh Token** | Token renewal | Exchange refresh for access |
| **Device Code** | TVs, CLI tools | User authorizes on another device |

---

## Security Best Practices

```
✅ ALWAYS:
├── Use HTTPS everywhere
├── Validate redirect URIs exactly
├── Use state parameter (CSRF protection)
├── Use PKCE for public clients
├── Short-lived access tokens
└── Secure token storage

❌ NEVER:
├── Expose client secret in frontend
├── Use implicit grant (deprecated)
├── Skip state validation
├── Store tokens in localStorage
├── Use long-lived access tokens
└── Allow open redirects
```

---

## Related POCs

- [JWT Authentication](/interview-prep/practice-pocs/jwt-authentication)
- [API Key Management](/interview-prep/practice-pocs/api-key-management)
- [RBAC Implementation](/interview-prep/practice-pocs/rbac-implementation)
