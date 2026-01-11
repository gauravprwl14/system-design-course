# MITM Attack Prevention - Security Best Practices

**Interview Question**: *"How will you handle/prevent a Man-in-the-Middle (MITM) attack in your application?"*

**Difficulty**: 🟡 Intermediate
**Asked by**: HDFC, Security-focused Companies
**Time to Answer**: 4-5 minutes

---

## 🎯 Quick Answer (30 seconds)

**MITM Attack** = Attacker intercepts communication between client and server

**Prevention Strategies**:
1. **HTTPS/TLS** - Encrypt all traffic (most important)
2. **Certificate Pinning** - Verify server certificate
3. **HSTS** - Force HTTPS connections
4. **Mutual TLS** - Both client and server verify each other
5. **VPN** - Encrypt at network level
6. **Avoid Public WiFi** - Or use VPN when you must

**Key Rule**: **Never send sensitive data over HTTP**

---

## 📚 Detailed Explanation

### What is a MITM Attack?

```
Normal Flow:
Client <----secure----> Server

MITM Attack:
Client <--attacker--> Attacker <--server--> Server
       (sees/modifies everything)
```

**Attack Scenarios**:
1. **Public WiFi**: Attacker on same network intercepts traffic
2. **DNS Spoofing**: Redirect to fake server
3. **ARP Spoofing**: Intercept local network traffic
4. **SSL Stripping**: Downgrade HTTPS to HTTP
5. **Rogue Access Point**: Fake WiFi hotspot

---

## 🛡️ Prevention Method 1: HTTPS/TLS (Mandatory)

### Basic HTTPS Setup (Express.js)

```javascript
const express = require('express');
const https = require('https');
const fs = require('fs');

const app = express();

// Load SSL/TLS certificates
const options = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem'),
  // Optional: Intermediate certificates
  ca: fs.readFileSync('/path/to/ca-bundle.pem')
};

// Create HTTPS server
const httpsServer = https.createServer(options, app);

app.get('/', (req, res) => {
  res.send('Secure HTTPS connection!');
});

// Listen on port 443 (standard HTTPS port)
httpsServer.listen(443, () => {
  console.log('HTTPS Server running on port 443');
});

// Optional: Redirect HTTP to HTTPS
const http = require('http');
const httpApp = express();

httpApp.all('*', (req, res) => {
  res.redirect(301, `https://${req.headers.host}${req.url}`);
});

http.createServer(httpApp).listen(80);
```

### Force HTTPS with Helmet.js

```javascript
const helmet = require('helmet');

app.use(helmet());

// Force HTTPS with HSTS (HTTP Strict Transport Security)
app.use(helmet.hsts({
  maxAge: 31536000, // 1 year in seconds
  includeSubDomains: true,
  preload: true
}));

// Other security headers
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    upgradeInsecureRequests: [] // Automatically upgrade HTTP to HTTPS
  }
}));
```

**How HTTPS Prevents MITM**:
1. **Encryption**: Data encrypted with TLS
2. **Certificate Verification**: Client verifies server identity
3. **Integrity**: Tampering detected
4. **Forward Secrecy**: Past sessions can't be decrypted

---

## 🛡️ Prevention Method 2: Certificate Pinning

### What is Certificate Pinning?

Instead of trusting all certificates signed by CAs, your app only trusts specific certificates or public keys.

### Mobile App Example (React Native)

```javascript
// react-native-ssl-pinning
import { fetch as sslFetch } from 'react-native-ssl-pinning';

const pinnedCertificates = {
  'api.example.com': {
    certificates: [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' // Your server's cert hash
    ]
  }
};

async function secureFetch(url, options) {
  try {
    const response = await sslFetch(url, {
      ...options,
      sslPinning: {
        certs: ['server-cert'] // Certificate file in app bundle
      }
    });

    return response;
  } catch (error) {
    if (error.message.includes('SSL')) {
      // Certificate doesn't match pinned cert = MITM attack!
      console.error('MITM attack detected! Certificate mismatch');
      throw new Error('Insecure connection detected');
    }
    throw error;
  }
}

// Usage
try {
  const response = await secureFetch('https://api.example.com/user', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer token' }
  });
  const data = await response.json();
} catch (error) {
  // Handle MITM or network error
}
```

### Backend Example (Node.js HTTP Client)

```javascript
const https = require('https');
const crypto = require('crypto');

// Store your server's certificate fingerprint
const EXPECTED_CERT_FINGERPRINT = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

function makeSecureRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      ...options,
      // Verify certificate
      checkServerIdentity: (hostname, cert) => {
        // Get certificate fingerprint
        const fingerprint = cert.fingerprint.toUpperCase();

        // Compare with expected fingerprint
        if (fingerprint !== EXPECTED_CERT_FINGERPRINT) {
          return new Error(`Certificate fingerprint mismatch!
            Expected: ${EXPECTED_CERT_FINGERPRINT}
            Got: ${fingerprint}
            Possible MITM attack!`);
        }

        // Also do standard hostname verification
        return https.checkServerIdentity(hostname, cert);
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.end();
  });
}

// Usage
try {
  const data = await makeSecureRequest('https://api.example.com/data');
  console.log('Secure data:', data);
} catch (error) {
  console.error('MITM attack or connection error:', error.message);
}
```

**Pros**:
- ✅ Protects against compromised CAs
- ✅ Prevents fake certificates
- ✅ Extra layer of security

**Cons**:
- ❌ Hard to update (need app update to change cert)
- ❌ Certificate rotation requires planning
- ❌ Can break app if cert expires

---

## 🛡️ Prevention Method 3: HSTS (HTTP Strict Transport Security)

### Server Configuration

```javascript
// Express.js with Helmet
app.use(helmet.hsts({
  maxAge: 63072000, // 2 years
  includeSubDomains: true,
  preload: true
}));

// Sets header:
// Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### Nginx Configuration

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name example.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # HSTS header
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Redirect HTTP to HTTPS
    if ($scheme != "https") {
        return 301 https://$server_name$request_uri;
    }

    location / {
        proxy_pass http://localhost:3000;
    }
}

# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

**How HSTS Works**:
1. Server sends HSTS header
2. Browser remembers "always use HTTPS for this domain"
3. Future HTTP requests automatically upgraded to HTTPS
4. Prevents SSL stripping attacks

**HSTS Preload List**:
- Submit your domain to https://hstspreload.org/
- Browsers will enforce HTTPS before first visit
- Maximum protection

---

## 🛡️ Prevention Method 4: Mutual TLS (mTLS)

### Server-Side (Require Client Certificate)

```javascript
const https = require('https');
const fs = require('fs');
const express = require('express');

const app = express();

const options = {
  // Server certificate
  key: fs.readFileSync('/path/to/server-key.pem'),
  cert: fs.readFileSync('/path/to/server-cert.pem'),

  // Require client certificate
  requestCert: true,
  rejectUnauthorized: true,

  // CA that signed client certificates
  ca: fs.readFileSync('/path/to/client-ca.pem')
};

const server = https.createServer(options, app);

app.use((req, res, next) => {
  // Verify client certificate
  const cert = req.socket.getPeerCertificate();

  if (!req.client.authorized) {
    return res.status(401).json({ error: 'Invalid client certificate' });
  }

  // Extract client info from certificate
  req.clientId = cert.subject.CN;
  req.clientEmail = cert.subject.emailAddress;

  console.log('Authenticated client:', req.clientId);
  next();
});

app.get('/api/data', (req, res) => {
  res.json({
    message: 'Secure data',
    client: req.clientId
  });
});

server.listen(443);
```

### Client-Side (Provide Certificate)

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'api.example.com',
  port: 443,
  path: '/api/data',
  method: 'GET',

  // Client certificate
  key: fs.readFileSync('/path/to/client-key.pem'),
  cert: fs.readFileSync('/path/to/client-cert.pem'),

  // Verify server certificate
  ca: fs.readFileSync('/path/to/server-ca.pem'),
  rejectUnauthorized: true
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();
```

**Use Cases for mTLS**:
- Microservice-to-microservice communication
- API-to-API authentication
- High-security environments (banking, healthcare)
- Zero-trust architecture

---

## 🛡️ Prevention Method 5: Content Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.example.com'],
      fontSrc: ["'self'", 'https://fonts.googleapis.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },

  // Prevent clickjacking
  frameguard: { action: 'deny' },

  // Prevent MIME type sniffing
  noSniff: true,

  // Disable caching for sensitive pages
  noCache: true,

  // XSS filter
  xssFilter: true,

  // Hide Express/Node.js version
  hidePoweredBy: true
}));

// Custom security headers
app.use((req, res, next) => {
  // Prevent browser from caching sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Expect-CT (Certificate Transparency)
  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
});
```

---

## 🔄 Real-World Example: Complete Secure App

```javascript
const express = require('express');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const app = express();

// 1. Security headers
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 2. Rate limiting (prevent brute force)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);

// 3. Validate origin (prevent CSRF)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://example.com', 'https://www.example.com'];

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  next();
});

// 4. API token validation
function validateAPIToken(req, res, next) {
  const token = req.headers['x-api-token'];

  if (!token) {
    return res.status(401).json({ error: 'No API token provided' });
  }

  // Verify token (check DB, verify signature, etc.)
  if (!isValidToken(token)) {
    return res.status(401).json({ error: 'Invalid API token' });
  }

  next();
}

// 5. HTTPS server
const httpsOptions = {
  key: fs.readFileSync('/path/to/privkey.pem'),
  cert: fs.readFileSync('/path/to/fullchain.pem')
};

const server = https.createServer(httpsOptions, app);

// 6. Secure endpoints
app.get('/api/sensitive-data', validateAPIToken, (req, res) => {
  res.json({
    data: 'This is protected from MITM attacks',
    encryption: 'TLS 1.3',
    timestamp: new Date().toISOString()
  });
});

// 7. HTTP redirect
const httpApp = express();
httpApp.all('*', (req, res) => {
  res.redirect(301, `https://${req.headers.host}${req.url}`);
});

require('http').createServer(httpApp).listen(80);
server.listen(443);

console.log('Secure server running on https://localhost:443');
```

---

## 📊 MITM Attack Prevention Checklist

| Method | Effectiveness | Complexity | When to Use |
|--------|--------------|------------|-------------|
| **HTTPS/TLS** | ⭐⭐⭐⭐⭐ | Easy | **Always** (mandatory) |
| **HSTS** | ⭐⭐⭐⭐ | Easy | All production sites |
| **Certificate Pinning** | ⭐⭐⭐⭐⭐ | Medium | Mobile apps, high security |
| **Mutual TLS** | ⭐⭐⭐⭐⭐ | Hard | Microservices, APIs |
| **Security Headers** | ⭐⭐⭐ | Easy | All applications |
| **VPN** | ⭐⭐⭐⭐ | Medium | Public WiFi users |
| **DNS Security** | ⭐⭐⭐ | Easy | All DNS queries |

---

## 💡 Key Takeaways

1. ✅ **Always use HTTPS** - Non-negotiable for production
2. ✅ **Enable HSTS** - Prevent SSL stripping attacks
3. ✅ **Certificate Pinning** - Extra protection for mobile apps
4. ✅ **Mutual TLS** - For service-to-service communication
5. ✅ **Security Headers** - Use Helmet.js or equivalent
6. ✅ **Never trust public WiFi** - Use VPN or mobile hotspot
7. ✅ **Validate certificates** - Check expiry, revocation, fingerprints
8. ✅ **Monitor for attacks** - Log suspicious certificate errors

---

## 🔗 Related Questions

- [RSA vs AES](/interview-prep/security-encryption/rsa-vs-aes)
- [JWT vs Session](/interview-prep/security-encryption/jwt-vs-session)

---

## 📚 Further Reading

- **OWASP MITM Prevention**: https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html
- **HSTS Preload**: https://hstspreload.org/
- **Certificate Pinning**: https://owasp.org/www-community/controls/Certificate_and_Public_Key_Pinning
- **mTLS Guide**: https://www.cloudflare.com/learning/access-management/what-is-mutual-tls/
