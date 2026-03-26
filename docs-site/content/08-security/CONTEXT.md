# 08-security/ — Layer 1 Module

Security design for distributed systems — authentication at scale, zero-trust, OAuth2/OIDC, secrets management, DDoS protection, mTLS, encryption, and compliance architecture.

## Subsections

| Folder | Layer | Description |
|--------|-------|-------------|
| concepts/ | concept | Deep-dive articles on security architecture patterns and protocols |
| hands-on/ | poc | Runnable implementations of JWT auth, OAuth flows, and RBAC |

## Article Count
- concepts/: 8 articles (+ overview)
- hands-on/: 3 articles (+ overview)
- Total: 11 articles + 2 overviews

## Routing Table

| Task / Question | Go to | Key files |
|-----------------|-------|-----------|
| Design authentication for millions of users | concepts/ | authentication-at-scale.md |
| Implement zero-trust networking | concepts/ | zero-trust-architecture.md |
| Understand OAuth2 and OIDC flows | concepts/ | oauth2-oidc-deep-dive.md |
| Manage secrets and credentials safely | concepts/ | secret-management.md |
| Protect against DDoS attacks | concepts/ | ddos-protection.md |
| Set up mutual TLS between services | concepts/ | mtls-certificate-management.md |
| Encrypt data at rest | concepts/ | encryption-at-rest.md |
| Design for GDPR, PCI-DSS, SOC2 compliance | concepts/ | compliance-architecture.md |
| Implement JWT-based auth | hands-on/ | jwt-authentication.md |
| Build OAuth login flows | hands-on/ | oauth-flows.md |
| Implement role-based access control | hands-on/ | rbac-implementation.md |

## Prerequisites
- Basic HTTP and HTTPS knowledge
- Familiarity with API design (07-api-design/)

## Connects To
- 07-api-design/ — Securing APIs with authentication and authorization
- 10-architecture/ — Service mesh for mTLS, zero-trust at the infrastructure level
- 12-interview-prep/quick-reference/security/ — Security interview quick reference
