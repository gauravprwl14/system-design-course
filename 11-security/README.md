# Security & Authentication

> Protect your systems and users

## 📋 Overview

Security is not optional. Learn authentication, authorization, and security best practices for building secure systems at scale.

## 📚 Articles

### Authentication & Authorization (🟢 Beginner)
1. [Authentication Basics](./01-auth-basics.md) - Sessions vs tokens
2. [JWT Tokens](./02-jwt.md) - Stateless authentication
3. [OAuth 2.0](./03-oauth.md) - Third-party login
4. [Session Management](./04-session-management.md) - Server-side sessions
5. [Password Security](./05-password-security.md) - Hashing, salting

### API Security (🟡 Intermediate)
6. [API Keys](./06-api-keys.md) - Service authentication
7. [Rate Limiting](./07-rate-limiting.md) - Prevent abuse
8. [CORS](./08-cors.md) - Cross-origin requests
9. [Input Validation](./09-input-validation.md) - Prevent injection
10. [HTTPS & TLS](./10-https-tls.md) - Encryption in transit

### Advanced Security (🔴 Advanced)
11. [DDoS Protection](./11-ddos-protection.md) - Defend against attacks
12. [Encryption at Rest](./12-encryption-rest.md) - Secure stored data
13. [Security Headers](./13-security-headers.md) - Browser security
14. [SQL Injection Prevention](./14-sql-injection.md) - Parameterized queries
15. [XSS Prevention](./15-xss-prevention.md) - Cross-site scripting

## 🎯 Security Checklist

- ✅ Use HTTPS everywhere
- ✅ Validate and sanitize all inputs
- ✅ Use parameterized queries (prevent SQL injection)
- ✅ Hash passwords with bcrypt/argon2
- ✅ Implement rate limiting
- ✅ Use security headers (CSP, HSTS, etc.)
- ✅ Keep dependencies updated
- ✅ Implement logging and monitoring
- ✅ Use least privilege principle
- ✅ Regular security audits

## 🚨 OWASP Top 10

1. Broken Access Control
2. Cryptographic Failures
3. Injection
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable Components
7. Authentication Failures
8. Software Integrity Failures
9. Logging Failures
10. Server-Side Request Forgery

Start with [Authentication Basics](./01-auth-basics.md)!
