# JWT vs Session vs OAuth 2.0 - Authentication Comparison

**Interview Question**: *"What is the difference between JWT and Session authentication? When would you use JWT over OAuth 2.0?"*

**Difficulty**: 🟡 Intermediate
**Asked by**: HDFC, Amazon, Most Tech Companies
**Time to Answer**: 4-5 minutes

---

## 🎯 Quick Answer (30 seconds)

**Session-Based Auth** (Traditional):
- Server stores session data
- Client gets session ID in cookie
- **Stateful**: Server must remember all sessions
- **Best for**: Traditional web apps, admin panels

**JWT (JSON Web Token)**:
- Self-contained token (no server storage)
- Client stores token, sends with each request
- **Stateless**: Server doesn't store anything
- **Best for**: APIs, microservices, mobile apps

**OAuth 2.0**:
- **Authorization framework**, not authentication
- Delegates access to third-party (Google, Facebook login)
- Uses tokens (often JWTs) internally
- **Best for**: Third-party login, API access delegation

**Key Difference**: Session = server-side storage, JWT = client-side storage, OAuth 2.0 = third-party authorization

---

## 📚 Detailed Explanation

### Session-Based Authentication (Traditional)

```javascript
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

// Configure session
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true, // HTTPS only
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Verify credentials (pseudo code)
  const user = await db.findUser(username);
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create session (stored on server)
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  res.json({ message: 'Logged in successfully' });
  // Session ID sent to client as cookie automatically
});

// Protected route
app.get('/profile', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Session data available
  res.json({
    userId: req.session.userId,
    username: req.session.username,
    role: req.session.role
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out' });
  });
});
```

**How Session Auth Works**:
1. User logs in with credentials
2. Server creates session, stores in memory/Redis/database
3. Server sends session ID to client (as cookie)
4. Client sends cookie with every request
5. Server looks up session by ID to verify user

**Pros**:
- ✅ Easy to invalidate (server controls sessions)
- ✅ Server can revoke access immediately
- ✅ Familiar pattern for developers
- ✅ Works well with server-side rendering

**Cons**:
- ❌ Requires server-side storage (memory, Redis, DB)
- ❌ Difficult to scale horizontally (session stickiness needed)
- ❌ CORS issues with cookies
- ❌ Not suitable for microservices

### JWT (JSON Web Token) Authentication

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Verify credentials
  const user = await db.findUser(username);
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create JWT (self-contained, no server storage)
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'your-app',
      audience: 'your-app-users'
    }
  );

  res.json({ token });
  // Client stores token (localStorage, memory, cookie)
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.user = payload; // Attach user data from token
    next();
  });
}

// Protected route
app.get('/profile', authenticateToken, (req, res) => {
  // User data from JWT payload
  res.json({
    userId: req.user.userId,
    username: req.user.username,
    role: req.user.role
  });
});

// Refresh token endpoint
app.post('/refresh', authenticateToken, (req, res) => {
  // Generate new token with extended expiry
  const newToken = jwt.sign(
    {
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token: newToken });
});
```

**JWT Structure**:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywicm9sZSI6ImFkbWluIn0.signature

Header (algorithm)   Payload (data)          Signature
```

**How JWT Works**:
1. User logs in with credentials
2. Server creates JWT, signs it with secret key
3. Client stores JWT (localStorage, memory, cookie)
4. Client sends JWT in Authorization header
5. Server verifies signature and extracts payload

**Pros**:
- ✅ Stateless (no server-side storage)
- ✅ Scales horizontally easily
- ✅ Works across domains (CORS friendly)
- ✅ Perfect for microservices
- ✅ Mobile-friendly (no cookies needed)
- ✅ Self-contained (all data in token)

**Cons**:
- ❌ Hard to revoke before expiry
- ❌ Token size larger than session ID
- ❌ Payload visible (base64, not encrypted)
- ❌ Security risk if stored in localStorage (XSS)

### OAuth 2.0 (Authorization Framework)

```javascript
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Configure Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    // accessToken: Use to access Google APIs on behalf of user
    // profile: User info from Google

    // Find or create user in your database
    let user = await db.findUserByGoogleId(profile.id);

    if (!user) {
      user = await db.createUser({
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName
      });
    }

    // Create your own JWT or session
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return done(null, { user, token, accessToken });
  }
));

// Google login route
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google callback route
app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // Send JWT to client
    res.json({
      token: req.user.token,
      user: req.user.user
    });
  }
);

// Use Google access token to fetch user data
app.get('/google-profile', authenticateToken, async (req, res) => {
  // User's Google access token stored in DB
  const googleToken = await db.getGoogleToken(req.user.userId);

  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${googleToken}` }
  });

  const googleProfile = await response.json();
  res.json(googleProfile);
});
```

**OAuth 2.0 Flow (Authorization Code)**:
```
1. User clicks "Login with Google"
2. Redirect to Google login page
3. User grants permission
4. Google redirects back with authorization code
5. Exchange code for access token
6. Use access token to access Google APIs
7. Create your own session/JWT for your app
```

**Pros**:
- ✅ No password management (delegated to provider)
- ✅ Single Sign-On (SSO) across apps
- ✅ Granular permissions (scopes)
- ✅ Access third-party APIs (Google Drive, Gmail, etc.)
- ✅ Industry standard

**Cons**:
- ❌ Complex to implement correctly
- ❌ Dependency on third-party provider
- ❌ Privacy concerns (data sharing)
- ❌ Requires internet connection

---

## 🔄 Real-World Examples

### Example 1: E-commerce Site (Session + JWT Hybrid)

```javascript
// Use sessions for web users (better UX)
// Use JWT for mobile app API

class AuthService {
  // Web: Session-based
  async loginWeb(req, res) {
    const user = await this.verifyCredentials(req.body);

    // Create session
    req.session.userId = user.id;
    req.session.regenerate(() => {
      res.redirect('/dashboard');
    });
  }

  // Mobile API: JWT
  async loginMobile(req, res) {
    const user = await this.verifyCredentials(req.body);

    // Create JWT
    const token = jwt.sign(
      { userId: user.id, deviceId: req.headers['device-id'] },
      JWT_SECRET,
      { expiresIn: '30d' } // Longer for mobile
    );

    res.json({ token });
  }

  // Admin panel: Session (easy to revoke)
  async loginAdmin(req, res) {
    const admin = await this.verifyAdminCredentials(req.body);

    req.session.adminId = admin.id;
    req.session.permissions = admin.permissions;
    req.session.cookie.maxAge = 2 * 60 * 60 * 1000; // 2 hours only

    res.redirect('/admin/dashboard');
  }
}
```

### Example 2: Microservices with JWT

```javascript
// API Gateway validates JWT, forwards to services
class APIGateway {
  async forwardRequest(req, res) {
    // Validate JWT
    const token = req.headers.authorization?.split(' ')[1];
    const user = await this.validateJWT(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Forward to microservice with user context
    const response = await fetch(`http://user-service/api/profile`, {
      headers: {
        'X-User-Id': user.userId,
        'X-User-Role': user.role,
        'Authorization': req.headers.authorization
      }
    });

    const data = await response.json();
    res.json(data);
  }
}

// User Service (validates JWT independently)
class UserService {
  async getProfile(req, res) {
    // Each service can validate JWT independently (stateless!)
    const user = await this.validateJWT(req.headers.authorization);

    const profile = await db.getProfile(user.userId);
    res.json(profile);
  }
}
```

### Example 3: Refresh Token Pattern (Best Practice)

```javascript
class TokenService {
  // Access token (short-lived, 15 min)
  generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, role: user.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
  }

  // Refresh token (long-lived, 7 days, stored in DB)
  async generateRefreshToken(user) {
    const refreshToken = jwt.sign(
      { userId: user.id, tokenId: uuidv4() },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token in DB (can be revoked!)
    await db.saveRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    return refreshToken;
  }

  // Refresh endpoint
  async refresh(req, res) {
    const { refreshToken } = req.body;

    // Verify token
    const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    // Check if token exists in DB (not revoked)
    const storedToken = await db.getRefreshToken(refreshToken);
    if (!storedToken) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const user = await db.getUser(payload.userId);
    const newAccessToken = this.generateAccessToken(user);

    res.json({ accessToken: newAccessToken });
  }

  // Revoke all tokens for user (logout from all devices)
  async revokeAllTokens(userId) {
    await db.deleteRefreshTokens(userId);
  }
}
```

---

## 📊 Comparison Table

| Feature | Session | JWT | OAuth 2.0 |
|---------|---------|-----|-----------|
| **Storage** | Server-side | Client-side | Server + Client |
| **State** | Stateful | Stateless | Stateful (tokens in DB) |
| **Scalability** | Difficult (sticky sessions) | Easy (stateless) | Medium |
| **Revocation** | Easy (delete session) | Hard (wait for expiry) | Easy (revoke tokens) |
| **Size** | Small (session ID) | Large (full token) | Large |
| **CORS** | Cookie issues | Easy (header-based) | Easy |
| **Mobile** | Not ideal | Perfect | Good |
| **Microservices** | Difficult | Perfect | Good |
| **Use Case** | Web apps | APIs, SPAs, mobile | Third-party login |
| **Security** | CSRF vulnerable | XSS vulnerable | Complex but secure |
| **Performance** | DB lookup each request | No DB lookup | Token validation |

---

## 🎓 Interview Follow-up Questions

### Q: "Where should I store JWT on the client side?"

**Answer**:
1. **HttpOnly Cookie** (Most Secure):
   - ✅ Protected from XSS attacks
   - ❌ CSRF vulnerable (use CSRF tokens)
   - Best for web apps

2. **Memory (React state)** (Secure):
   - ✅ Lost on refresh (good for security)
   - ❌ User logged out on page reload
   - Use with refresh token in httpOnly cookie

3. **localStorage** (Avoid):
   - ❌ Vulnerable to XSS attacks
   - ❌ Accessible to any JavaScript
   - Only if you absolutely trust your code

### Q: "How do you invalidate a JWT before it expires?"

**Answer**:
- **Token Blacklist**: Store revoked tokens in Redis with expiry
- **Token Versioning**: Include version in token, increment on logout
- **Refresh Token Pattern**: Short-lived access tokens + long-lived refresh tokens
- **Check DB on critical operations**: Verify user still has permission

### Q: "Should I use OAuth 2.0 for my own app's authentication?"

**Answer**:
- ❌ **No** - OAuth 2.0 is for **authorization**, not authentication
- Use **Session or JWT** for your own users
- Use **OAuth 2.0** only for:
  - Third-party login (Google, Facebook, GitHub)
  - API access delegation
  - Single Sign-On (SSO) across multiple apps

---

## 💡 Key Takeaways

1. ✅ **Session** = Server stores state, client gets ID → Stateful, easy to revoke
2. ✅ **JWT** = Client stores token, server validates → Stateless, scalable
3. ✅ **OAuth 2.0** = Authorization framework for third-party access → SSO, API delegation
4. ✅ **Session for**: Traditional web apps, admin panels, easy revocation
5. ✅ **JWT for**: APIs, microservices, mobile apps, scalability
6. ✅ **OAuth for**: "Login with Google", third-party integrations
7. ✅ **Best practice**: Access token (15 min) + Refresh token (7 days)
8. ✅ **Store JWT**: HttpOnly cookie (web) or memory (SPA)

---

## 🔗 Related Questions

- [RSA vs AES](/interview-prep/security-encryption/rsa-vs-aes)
- [Hashing vs Encryption](/interview-prep/security-encryption/hashing-vs-encryption)

---

## 📚 Further Reading

- **JWT.io**: https://jwt.io/
- **OAuth 2.0 Spec**: https://oauth.net/2/
- **Passport.js**: https://www.passportjs.org/
- **OWASP JWT Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
