---
title: "Security & Auth Cheat Sheet"
description: "Authentication, authorization, encryption, and security patterns quick reference"
---

# Security & Auth Cheat Sheet

> Key concepts for security rounds and general system design interviews. Facts and decision rules only.

---

## 1. Authentication vs Authorization

| | Authentication (AuthN) | Authorization (AuthZ) |
|-|----------------------|----------------------|
| **Question** | **WHO are you?** | **WHAT can you do?** |
| **Verifies** | Identity | Permissions |
| **Tools** | JWT, session cookies, OAuth, SAML | RBAC, ABAC, IAM policies, ACLs |
| **Error code** | **401** Unauthorized | **403** Forbidden |
| **When it happens** | First (must authn before authz) | Second |

**Trap:** 401 is named "Unauthorized" but means "unauthenticated." 403 means truly unauthorized.

```mermaid
flowchart LR
    A[Request] --> B{Authenticated?}
    B -- No --> C[401 Unauthenticated\nWHO are you?]
    B -- Yes --> D{Authorized?}
    D -- No --> E[403 Forbidden\nWHAT can you do?]
    D -- Yes --> F[200 OK\nAccess Granted]
```

---

## 2. Session vs JWT

| | Session | JWT |
|-|---------|-----|
| **State** | **Stateful** — server stores session | **Stateless** — client stores token |
| **Storage** | Server-side (Redis, DB) | Client-side (cookie, localStorage) |
| **Revocation** | **Instant** — delete session from store | **Hard** — must wait for expiry or maintain blocklist |
| **Scaling** | Requires shared store (Redis) or sticky sessions | Any server can verify — no shared store needed |
| **Size** | Small cookie (session ID only) | **Larger** — base64 encoded header+payload+sig |
| **Use** | Traditional web apps, when instant revocation needed | APIs, mobile apps, microservices |

### JWT Structure
```
header.payload.signature
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImV4cCI6MTcwMH0.SIG
```
- **Header:** algorithm + token type
- **Payload:** claims (sub, exp, iat, roles) — **NOT encrypted, only signed**
- **Signature:** HMAC-SHA256 or RSA signature

### JWT Refresh Token Pattern
```
Access token:  short-lived (15 min)  — sent with every request
Refresh token: long-lived (7–30 days) — stored securely, used only to get new access token
```

### JWT Pitfalls
- `alg: none` attack — always validate algorithm, never accept `none`
- Storing **secrets** in payload — payload is base64 decoded, not encrypted
- **No revocation** without a blocklist — compromised token valid until expiry
- `localStorage` is XSS-vulnerable — prefer `HttpOnly` cookies for web

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant R as Redis (Session Store)

    Note over C,R: Session Flow (Stateful)
    C->>S: Login (credentials)
    S->>R: Store session data
    S-->>C: Set-Cookie: session_id=abc
    C->>S: Request + Cookie
    S->>R: Lookup session_id
    R-->>S: User data
    S-->>C: 200 OK

    Note over C,S: JWT Flow (Stateless)
    C->>S: Login (credentials)
    S-->>C: JWT access_token + refresh_token
    C->>S: Request + Bearer JWT
    S-->>C: Verify sig locally → 200 OK
```

---

## 3. OAuth 2.0 Flows

| Flow | Client Type | Use Case |
|------|-------------|----------|
| **Authorization Code + PKCE** | Public (SPA, mobile) | **Best practice for user-facing apps** |
| **Authorization Code** | Confidential (server-side) | Traditional web apps with server |
| **Client Credentials** | Server (no user) | **Machine-to-machine / service accounts** |
| **Device Code** | Limited input devices | CLI tools, Smart TVs, IoT |
| **Implicit** (deprecated) | SPA (legacy) | **Do not use** — replaced by Auth Code + PKCE |

### OAuth vs OIDC
- **OAuth 2.0:** Authorization framework — grants access to resources (scope-based)
- **OpenID Connect (OIDC):** Authentication layer **on top of OAuth** — adds `id_token` with user identity
- OAuth = "Can this app read my Google Drive?" OIDC = "Who is this user?"

### Key OAuth Terms
| Term | Meaning |
|------|---------|
| **Client** | App requesting access |
| **Resource Owner** | End user |
| **Authorization Server** | Issues tokens (Auth0, Cognito, Google) |
| **Resource Server** | API that accepts access tokens |
| **Scope** | Permissions requested (`read:profile`, `write:posts`) |
| **PKCE** | Proof Key for Code Exchange — prevents auth code interception |

```mermaid
sequenceDiagram
    participant U as User/Browser
    participant A as App (Client)
    participant AS as Auth Server
    participant RS as Resource Server

    U->>A: Click "Login with Google"
    A->>AS: Redirect: /authorize?code_challenge=...
    AS->>U: Show login + consent screen
    U->>AS: Approve
    AS->>A: Redirect with auth_code
    A->>AS: POST /token (code + code_verifier)
    AS-->>A: access_token + refresh_token
    A->>RS: GET /api/data + Bearer access_token
    RS-->>A: 200 Protected Data
```

---

## 4. Encryption Quick Reference

### Algorithm Choices

| Type | Algorithm | Use Case | Speed |
|------|-----------|----------|-------|
| **Symmetric** | AES-256-GCM | Data at rest, bulk encryption | Fast |
| **Asymmetric** | RSA-2048, ECDSA P-256 | Key exchange, digital signatures | Slow |
| **Password hashing** | **bcrypt, Argon2** | Storing passwords — slow by design | Very slow |
| **General hashing** | SHA-256 | Data integrity, content addressing | Fast |
| **HMAC** | HMAC-SHA256 | Message authentication (JWT sig, webhooks) | Fast |

### Never Use
- **MD5** — broken (collision attacks, rainbow tables)
- **SHA-1** — deprecated, collision attacks demonstrated
- **AES-ECB mode** — identical plaintext blocks → identical ciphertext (no semantic security)
- **DES / 3DES** — too short key length
- **Plaintext passwords** — always hash with bcrypt/Argon2

### TLS in Practice
```
1. Asymmetric (RSA/ECDHE) → exchange symmetric session key
2. Symmetric (AES-256-GCM) → encrypt actual data transfer
```
**Why both:** Asymmetric is too slow for bulk data. Symmetric is fast but needs secure key exchange.

```mermaid
graph LR
    subgraph TLS["TLS Handshake"]
        A[Client Hello] --> B[Server Hello + Cert]
        B --> C[Verify Cert via CA]
        C --> D[Key Exchange\nECDHE / RSA]
        D --> E[Shared Session Key]
    end
    E --> F[AES-256-GCM\nBulk Data Transfer]
```

### Encryption at Rest vs In Transit

| | In Transit | At Rest |
|-|-----------|---------|
| **What** | Network traffic | Stored data (S3, EBS, RDS) |
| **How** | TLS/HTTPS | AES-256, KMS-managed keys |
| **AWS** | ACM certs, forced HTTPS | Server-side encryption (SSE) |

```mermaid
graph TD
    subgraph Transit["In Transit"]
        T1[HTTPS / TLS] --> T2[ACM Certificates]
        T1 --> T3[HSTS Headers]
    end
    subgraph Rest["At Rest"]
        R1[AES-256 Encryption] --> R2[KMS-Managed Keys]
        R1 --> R3[S3 SSE / EBS / RDS]
    end
```

---

## 5. Common Attack Vectors + Mitigations

| Attack | What It Does | Mitigation |
|--------|-------------|------------|
| **SQL Injection** | Malicious SQL via user input | **Parameterized queries**, ORM, input validation |
| **XSS (Stored/Reflected)** | Inject scripts executed in victim's browser | Escape output, **CSP headers**, `HttpOnly` cookies |
| **CSRF** | Forged requests using victim's session | **CSRF tokens**, `SameSite=Strict` cookies |
| **MITM** | Intercept/modify traffic in transit | **TLS/HTTPS**, HSTS, cert pinning |
| **DDoS** | Overwhelm with traffic volume | Rate limiting, WAF, **Shield Advanced**, Anycast |
| **SSRF** | Server fetches attacker-controlled URL | Validate/allowlist URLs, **block AWS metadata** (169.254.169.254) |
| **Path Traversal** | `../../../etc/passwd` in file paths | Canonicalize paths, reject `..`, serve from chroot |
| **Broken Auth** | Weak sessions, credential stuffing | MFA, account lockout, **HaveIBeenPwned** check |
| **Insecure Deserialization** | Malicious payload in serialized objects | Validate before deserializing, use JSON not Java serialization |
| **XXE** | XML parser processes external entities | Disable external entities in XML parser config |

**SSRF AWS risk:** Attacker uses SSRF to hit `http://169.254.169.254/latest/meta-data/` and steal IAM credentials. Mitigation: IMDSv2 (require PUT token), block metadata IP at WAF.

```mermaid
flowchart LR
    A[Attacker Input] --> B{Attack Type}
    B --> C[SQL Injection\n→ Parameterized queries]
    B --> D[XSS\n→ CSP + HttpOnly cookies]
    B --> E[CSRF\n→ SameSite + CSRF token]
    B --> F[SSRF\n→ URL allowlist + IMDSv2]
    B --> G[MITM\n→ TLS + HSTS]
    B --> H[DDoS\n→ WAF + Shield]
```

---

## 6. AWS Security Quick Reference

| Service | Purpose | Key Rule |
|---------|---------|----------|
| **IAM** | Identity & access management | **Least privilege**, roles over users, no root access keys |
| **IAM Roles** | Temporary credentials for services | EC2, Lambda, ECS → assume roles, no long-term keys |
| **KMS** | Managed encryption keys | Automatic rotation, CloudTrail audit of every key use |
| **Secrets Manager** | Store + rotate secrets | Auto-rotate DB passwords, API keys — **never hardcode** |
| **Parameter Store** | Config + secrets | Free tier for standard params, cheaper than Secrets Manager |
| **WAF** | Web application firewall | OWASP top 10 rules, rate limiting, geo blocking, IP lists |
| **Shield Standard** | Basic DDoS protection | **Free** — automatic on all AWS resources |
| **Shield Advanced** | Advanced DDoS protection | **$3,000/month** — 24/7 DRT, cost protection, detailed metrics |
| **GuardDuty** | ML threat detection | Analyzes VPC flow logs, CloudTrail, DNS — **enable everywhere** |
| **Security Hub** | Centralized security findings | Aggregates GuardDuty, Inspector, Macie, Config |
| **Inspector** | Vulnerability scanning | EC2, Lambda, container image CVE scanning |
| **Macie** | PII/sensitive data discovery | Scans S3 for SSNs, credit cards, PII |
| **CloudTrail** | API audit log | Who called what API, when, from where — **enable in all regions** |

### VPC Security Layers
```
Internet → WAF → CloudFront → ALB (public subnet)
                                  ↓
                            App servers (private subnet)
                                  ↓
                            RDS/ElastiCache (DB subnet, no internet)
```

**Security Groups vs NACLs:**
- Security Groups: **stateful**, return traffic auto-allowed, instance-level
- NACLs: **stateless**, must allow both inbound AND outbound, subnet-level

```mermaid
graph TD
    Internet --> WAF
    WAF --> CF[CloudFront CDN]
    CF --> ALB[ALB\nPublic Subnet]
    ALB --> App[App Servers\nPrivate Subnet]
    App --> DB[RDS / ElastiCache\nDB Subnet - No Internet]
    App --> SM[Secrets Manager\nKMS]
    CT[CloudTrail] -.->|Audit| IAM
    GD[GuardDuty] -.->|Threats| SH[Security Hub]
```

---

## 7. HTTPS & Certificates

| Concept | Detail |
|---------|--------|
| **DV cert** | Domain validation — checks domain ownership only |
| **OV cert** | Organization validation — verifies org identity |
| **EV cert** | Extended validation — highest trust, browser indicators |
| **Let's Encrypt** | Free DV certs, **90-day TTL**, auto-renewal via ACME |
| **AWS ACM** | Free, **auto-renews**, integrates with ALB/CloudFront/API GW |
| **HSTS** | `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| **HSTS Preload** | Submit to browser preload list — HTTPS enforced before first visit |
| **Certificate Pinning** | Hard-code expected cert/key in client — prevents MITM but hard to rotate |

```mermaid
graph LR
    Domain --> CA[Certificate Authority]
    CA --> DV[DV Cert\nDomain only]
    CA --> OV[OV Cert\n+ Org verified]
    CA --> EV[EV Cert\nHighest trust]
    DV --> LE[Let's Encrypt\nFree, 90-day]
    DV --> ACM[AWS ACM\nFree, auto-renew]
    Browser --> HSTS[HSTS\nForce HTTPS]
    HSTS --> Preload[HSTS Preload List\nHTTPS before first visit]
```

---

## 8. Rate Limiting & Brute Force Protection

| Technique | How | Trade-off |
|-----------|-----|-----------|
| **Account lockout** | Lock after N failures | Too aggressive → self-DoS your users |
| **Progressive delays** | Exponential backoff between retries | User-friendly, attacker still eventually gets through |
| **CAPTCHA** | After N failures, require human proof | Friction for users, can be bypassed with AI |
| **IP rate limiting** | Redis `INCR` + `EXPIRE` per IP | VPNs and shared IPs cause false positives |
| **Device fingerprinting** | Track device attributes across sessions | Privacy concerns |
| **MFA** | Second factor required | Highest protection — should be default for sensitive actions |

```
# Redis rate limit (sliding window approximation)
key = f"login_attempts:{ip}:{user_id}"
count = redis.INCR(key)
if count == 1:
    redis.EXPIRE(key, 900)  # 15-minute window
if count > 5:
    raise TooManyRequests()
```

```mermaid
flowchart TD
    A[Login Attempt] --> B{IP Rate Limit OK?}
    B -- No --> C[429 Too Many Requests]
    B -- Yes --> D{Account Locked?}
    D -- Yes --> E[403 Account Locked]
    D -- No --> F{Credentials Valid?}
    F -- No --> G[Increment Failure Counter]
    G --> H{Count > 5?}
    H -- Yes --> I[Lock Account\n+ Alert User]
    H -- No --> J[Show Progressive Delay]
    F -- Yes --> K{MFA Required?}
    K -- Yes --> L[Prompt MFA]
    L --> M[200 Authenticated]
    K -- No --> M
```

---

## 9. OWASP Top 10 (2021)

| # | Vulnerability | Quick Test |
|---|--------------|-----------|
| 1 | **Broken Access Control** | Can user A access user B's data? |
| 2 | **Cryptographic Failures** | Sensitive data in plain text? Weak algo? |
| 3 | **Injection** (SQL, LDAP, OS, SSTI) | Unvalidated input → interpreter |
| 4 | **Insecure Design** | Threat modeling done? Security requirements? |
| 5 | **Security Misconfiguration** | Default creds? S3 public? Debug mode on? |
| 6 | **Vulnerable/Outdated Components** | Unpatched libs? Known CVEs? |
| 7 | **Identification/Authentication Failures** | Weak passwords? No MFA? Session fixation? |
| 8 | **Software/Data Integrity Failures** | Unverified CI/CD? Insecure deserialization? |
| 9 | **Security Logging/Monitoring Failures** | No audit logs? No alerting? |
| 10 | **SSRF** | Server fetches user-supplied URLs? |

**Most common in interviews:** Broken Access Control (#1), SQL Injection (#3), SSRF (#10)

```mermaid
graph LR
    TOP["OWASP Top 10 (2021)"]
    TOP --> A1[1. Broken Access Control\n→ enforce authz server-side]
    TOP --> A2[2. Cryptographic Failures\n→ use TLS + strong algos]
    TOP --> A3[3. Injection\n→ parameterized queries]
    TOP --> A5[5. Security Misconfiguration\n→ no defaults, no debug]
    TOP --> A10[10. SSRF\n→ allowlist + IMDSv2]
```

---

## 10. Security HTTP Headers

| Header | Value | Prevents |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'self'` | **XSS** — restricts script/resource sources |
| `X-Frame-Options` | `DENY` | **Clickjacking** — prevents iframe embedding |
| `X-Content-Type-Options` | `nosniff` | **MIME sniffing** — browsers respect declared content-type |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | **Protocol downgrade, MITM** — forces HTTPS |
| `Referrer-Policy` | `no-referrer` or `same-origin` | Leaking URL info to third parties |
| `Permissions-Policy` | `camera=(), microphone=()` | Restricts browser feature access |

**Check at:** [securityheaders.com](https://securityheaders.com) — grades your headers instantly.

```mermaid
graph LR
    Response[HTTP Response Headers]
    Response --> CSP[Content-Security-Policy\nprevents XSS]
    Response --> XFO[X-Frame-Options: DENY\nprevents clickjacking]
    Response --> HSTS[Strict-Transport-Security\nforces HTTPS]
    Response --> XCTO[X-Content-Type-Options: nosniff\nprevents MIME sniff]
    Response --> PP[Permissions-Policy\nrestricts browser APIs]
```

---

## 11. Zero Trust Architecture

**Core principle:** Never trust, always verify — even inside the VPN.

| Old Model | Zero Trust |
|-----------|-----------|
| Trust inside network perimeter | **Verify every request** regardless of source |
| VPN = trusted | No implicit trust from location |
| Flat internal network | **Micro-segmentation** — least privilege per service |
| Long-lived credentials | Short-lived tokens, mTLS between services |

**Implementation:** mTLS (mutual TLS) between services, service mesh (Istio, App Mesh), per-request JWT validation, network policies.

```mermaid
graph TD
    Request[Every Request] --> IdP[Identity Provider\nverify identity]
    IdP --> Device[Device Posture\ncheck]
    Device --> Policy[Policy Engine\nleast-privilege decision]
    Policy -->|Allowed| Resource[Resource Access]
    Policy -->|Denied| Block[Block + Log]
    Resource --> mTLS[mTLS between services\nno implicit internal trust]
```

---

[Deep dive: Security Interview Prep →](../12-interview-prep/quick-reference/security)
[Deep dive: Encryption & KMS →](../08-security/)
