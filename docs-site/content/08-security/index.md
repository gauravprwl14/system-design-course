# Security

Security is not optional — it is a requirement. This section covers authentication at scale, zero-trust networks, secret management, DDoS protection, and encryption patterns used in production systems.

## What You'll Learn

- **Concepts**: OAuth2/OIDC, zero-trust, mTLS, secret management, DDoS protection
- **Hands-On**: Implement JWT auth, OAuth flows, and RBAC

## Where to Start

1. [Authentication at Scale](./concepts/authentication-at-scale) — Sessions, tokens, and SSO
2. [OAuth2 & OIDC Deep Dive](./concepts/oauth2-oidc-deep-dive) — The industry standard
3. [JWT Authentication](./hands-on/jwt-authentication) — Implement JWT from scratch
4. [Zero-Trust Architecture](./concepts/zero-trust-architecture) — Never trust, always verify

## Topic Map

| Topic | Concepts | Hands-On | Interview Prep |
|-------|----------|----------|----------------|
| Auth at scale | [authentication-at-scale](./concepts/authentication-at-scale), [oauth2-oidc-deep-dive](./concepts/oauth2-oidc-deep-dive) | [jwt-authentication](./hands-on/jwt-authentication), [oauth-flows](./hands-on/oauth-flows) | [jwt-vs-session](/12-interview-prep/quick-reference/security/jwt-vs-session) |
| RBAC | — | [rbac-implementation](./hands-on/rbac-implementation) | — |
| Session management | — | [redis-session-management](/03-redis/hands-on/redis-session-management) | [jwt-vs-session](/12-interview-prep/quick-reference/security/jwt-vs-session) |
| API key management | [secret-management](./concepts/secret-management) | [api-key-management](/07-api-design/hands-on/api-key-management) | — |
| Hashing vs encryption | [encryption-at-rest](./concepts/encryption-at-rest) | — | [hashing-vs-encryption](/12-interview-prep/quick-reference/security/hashing-vs-encryption) |
| TLS/certificates | [mtls-certificate-management](./concepts/mtls-certificate-management) | — | [mitm-prevention](/12-interview-prep/quick-reference/security/mitm-prevention), [rsa-vs-aes](/12-interview-prep/quick-reference/security/rsa-vs-aes) |
