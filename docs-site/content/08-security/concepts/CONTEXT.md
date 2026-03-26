# 08-security/concepts/ — Layer 2 Router

Security architecture concepts — authentication at scale, zero-trust, OAuth2/OIDC, secrets management, DDoS, mTLS, encryption at rest, and compliance.

## Files in This Section

| File | Description |
|------|-------------|
| overview | Introduction to distributed systems security and coverage map |
| authentication-at-scale | Session management, token strategies, and auth service design for high-traffic systems |
| zero-trust-architecture | Never-trust-always-verify model: identity-based access, micro-segmentation, continuous validation |
| oauth2-oidc-deep-dive | OAuth2 grant types, OIDC ID tokens, PKCE, and real-world authorization flows |
| secret-management | Vault, AWS Secrets Manager, secret rotation, and avoiding hardcoded credentials |
| ddos-protection | Layer 3/4 vs Layer 7 DDoS, rate limiting, CDN absorption, and scrubbing centers |
| mtls-certificate-management | Mutual TLS handshake, certificate lifecycle, and service-to-service auth |
| encryption-at-rest | Envelope encryption, KMS, key rotation, and database-level encryption patterns |
| compliance-architecture | Designing systems for GDPR, PCI-DSS, and SOC2 — data residency, audit logs, controls |

## Routing Table

| Task / Question | Go to |
|-----------------|-------|
| Handle login sessions at millions of users | authentication-at-scale.md |
| Eliminate implicit trust inside the perimeter | zero-trust-architecture.md |
| Understand OAuth2 scopes and grant types | oauth2-oidc-deep-dive.md |
| Store and rotate secrets safely | secret-management.md |
| Mitigate large-scale network attacks | ddos-protection.md |
| Authenticate service-to-service without passwords | mtls-certificate-management.md |
| Protect data on disk and in databases | encryption-at-rest.md |
| Meet regulatory data protection requirements | compliance-architecture.md |
