# Security & Encryption - Interview Questions

## 📋 Questions Covered

1. [Encryption Basics: RSA vs AES](./01-rsa-vs-aes.md)
2. [Hashing vs Encryption](./02-hashing-vs-encryption.md)
3. [SHA-1 vs SHA-2](./03-sha-comparison.md)
4. [Symmetric vs Asymmetric Encryption](./04-symmetric-vs-asymmetric.md)
5. [MITM Attack Prevention](./05-mitm-attack.md)
6. [API Security Best Practices](./06-api-security.md)
7. [Securing Requests at AWS Level](./07-aws-security.md)
8. [Certificate Management & TLS](./08-tls-certificates.md)

## 🎯 Quick Reference

| Question | Quick Answer | Article |
|----------|--------------|---------|
| RSA vs AES? | RSA: asymmetric (slow, small data), AES: symmetric (fast, large data) | [#01](./01-rsa-vs-aes.md) |
| Hash vs Encrypt? | Hash: one-way (passwords), Encrypt: two-way (data protection) | [#02](./02-hashing-vs-encryption.md) |
| SHA-1 vs SHA-2? | SHA-2 stronger (256/512-bit), SHA-1 deprecated (160-bit) | [#03](./03-sha-comparison.md) |
| Prevent MITM? | HTTPS/TLS, certificate pinning, mutual TLS | [#05](./05-mitm-attack.md) |

## 💡 Interview Tips

**Common Follow-ups**:
- "When would you use each?"
- "How do you implement this?"
- "What are the performance implications?"
- "How do you handle key management?"

**Red Flags to Avoid**:
- ❌ Saying "encryption is secure" without specifying algorithm
- ❌ Not mentioning key management
- ❌ Confusing hashing with encryption
- ❌ Not discussing TLS/HTTPS for MITM
