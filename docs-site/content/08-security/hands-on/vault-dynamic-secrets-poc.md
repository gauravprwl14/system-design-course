---
title: "Vault Dynamic Secrets POC"
layer: poc
section: "08-security/hands-on"
difficulty: intermediate
tags: [vault, secrets-management, postgresql, dynamic-credentials, hashicorp, security]
category: security
prerequisites: ["Docker Desktop", "curl", "basic SQL knowledge"]
related_problems: ["credential-leakage", "secret-sprawl", "hardcoded-passwords"]
---

# POC: Vault Dynamic Secrets — Short-Lived Database Credentials

## 🗺️ Quick Overview

```mermaid
sequenceDiagram
    participant App
    participant Vault
    participant Postgres

    App->>Vault: GET /v1/database/creds/my-role
    Vault->>Postgres: CREATE ROLE app_abc123 WITH PASSWORD '...' VALID UNTIL now()+1h
    Vault-->>App: {username: app_abc123, password: s3cr3t, lease_id: ..., ttl: 3600}
    App->>Postgres: Connect with app_abc123 / s3cr3t
    Postgres-->>App: Connection OK
    Note over Vault,Postgres: After 1 hour (or on revoke)
    Vault->>Postgres: DROP ROLE app_abc123
    App->>Postgres: Connect with app_abc123 (expired)
    Postgres-->>App: FATAL: role does not exist
```

*Each request to Vault generates a unique PostgreSQL role that auto-expires — no permanent database password ever exists.*

## What You'll Build

A local environment where:
1. HashiCorp Vault (dev mode) manages a PostgreSQL secrets engine
2. Every `vault read database/creds/my-role` creates a **unique, time-limited** PostgreSQL username + password
3. A Python script fetches fresh credentials, connects, runs a query, then shows the credential expiring after TTL
4. You can renew a lease to extend its lifetime, or revoke it immediately

This demonstrates the difference between a hardcoded `.env` password (permanent, shared, leaks with git history) and dynamic credentials (per-session, auto-expire, auditable).

## Why This Matters

- **Netflix**: Uses Vault for dynamic credentials across thousands of microservices — rotating DB passwords would require coordinated deploys; Vault eliminates that entirely
- **Shopify**: Issues short-lived credentials to ephemeral CI/CD workers — a leaked CI secret becomes useless in 5 minutes instead of forever
- **Airbnb**: Each service gets its own Vault role with least-privilege DB permissions — a compromised service can only access its own tables, not all of PostgreSQL

---

## Prerequisites

- Docker Desktop installed and running
- `curl` (comes with macOS/Linux)
- Python 3.8+ (`python3 --version`)
- `psycopg2` Python package (`pip3 install psycopg2-binary`)
- 5–10 minutes

---

## Setup

### docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: vault-poc-postgres
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: vault_root          # Vault uses this superuser to create dynamic roles
      POSTGRES_PASSWORD: rootpassword
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vault_root -d appdb"]
      interval: 5s
      timeout: 3s
      retries: 10

  vault:
    image: hashicorp/vault:1.15
    container_name: vault-poc-vault
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: dev-only-token   # Fixed token for local dev only — never do this in prod
      VAULT_DEV_LISTEN_ADDRESS: "0.0.0.0:8200"
      VAULT_ADDR: "http://0.0.0.0:8200"
    ports:
      - "8200:8200"
    cap_add:
      - IPC_LOCK
    command: server -dev
    depends_on:
      postgres:
        condition: service_healthy
```

```bash
# Start both services
docker-compose up -d

# Verify both are healthy (wait ~15 seconds)
docker-compose ps
# Expected: vault-poc-postgres  running (healthy)
#           vault-poc-vault     running
```

---

## Step-by-Step

### Step 1: Enable the Database Secrets Engine

```bash
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="dev-only-token"

# Enable the database secrets engine at the default path
curl -s \
  --header "X-Vault-Token: $VAULT_TOKEN" \
  --request POST \
  --data '{"type":"database"}' \
  "$VAULT_ADDR/v1/sys/mounts/database"

# Expected response: {} (empty JSON = success)
echo "Database secrets engine enabled"
```

### Step 2: Configure the PostgreSQL Connection

Vault needs a superuser connection to create/drop dynamic roles on demand.

```bash
# Tell Vault how to connect to PostgreSQL
curl -s \
  --header "X-Vault-Token: $VAULT_TOKEN" \
  --request POST \
  --data '{
    "plugin_name": "postgresql-database-plugin",
    "allowed_roles": "my-role",
    "connection_url": "postgresql://{{username}}:{{password}}@postgres:5432/appdb?sslmode=disable",
    "username": "vault_root",
    "password": "rootpassword"
  }' \
  "$VAULT_ADDR/v1/database/config/my-postgresql"

# Expected: {"request_id":"...","data":null,...}
echo "PostgreSQL connection configured"
```

**Note**: Vault stores the root password internally and will rotate it on first use. After this step, `vault_root`'s password is managed by Vault — even you won't know it.

### Step 3: Create a Dynamic Role

A role defines the SQL template Vault runs when creating credentials, and the TTL policy.

```bash
# Create a role that generates limited-privilege users
curl -s \
  --header "X-Vault-Token: $VAULT_TOKEN" \
  --request POST \
  --data '{
    "db_name": "my-postgresql",
    "creation_statements": [
      "CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '\''{{password}}'\'' VALID UNTIL '\''{{expiration}}'\'';",
      "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";",
      "GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\";"
    ],
    "default_ttl": "1h",
    "max_ttl": "24h"
  }' \
  "$VAULT_ADDR/v1/database/roles/my-role"

# Expected: {} (success)
echo "Dynamic role created: my-role (TTL=1h, max=24h)"
```

### Step 4: Generate Dynamic Credentials

This is the core of dynamic secrets — each request creates a brand-new PostgreSQL user.

```bash
# Request credentials — run this twice to see different usernames
curl -s \
  --header "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/database/creds/my-role" | python3 -m json.tool

# Expected output:
# {
#   "request_id": "abc123...",
#   "lease_id": "database/creds/my-role/xYz789...",
#   "renewable": true,
#   "lease_duration": 3600,
#   "data": {
#     "password": "A1b2-Xz9q-Mm4r",
#     "username": "v-root-my-role-AbCdEfGh-1234567890"
#   }
# }

# Run it again — completely different username and password:
curl -s \
  --header "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/database/creds/my-role" | python3 -m json.tool
```

Each call produces a unique `v-root-my-role-<random>-<timestamp>` username. You can verify this in PostgreSQL:

```bash
docker exec vault-poc-postgres psql -U vault_root -d appdb -c "\du" | grep "v-root"
# Expected: two rows for the two dynamic users you just created
```

### Step 5: Use the Credential From an Application

Save this as `app.py` and run it to simulate an application fetching and using Vault credentials.

```python
#!/usr/bin/env python3
"""
app.py — Demonstrates Vault dynamic credential usage
"""

import json
import os
import time
import urllib.request
import psycopg2

VAULT_ADDR  = os.getenv("VAULT_ADDR", "http://localhost:8200")
VAULT_TOKEN = os.getenv("VAULT_TOKEN", "dev-only-token")
VAULT_ROLE  = "my-role"


def fetch_db_credentials():
    """Ask Vault for a fresh set of DB credentials."""
    url = f"{VAULT_ADDR}/v1/database/creds/{VAULT_ROLE}"
    req = urllib.request.Request(url, headers={"X-Vault-Token": VAULT_TOKEN})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    creds = data["data"]
    lease = data["lease_id"]
    ttl   = data["lease_duration"]
    print(f"[Vault] Issued credential:")
    print(f"  username : {creds['username']}")
    print(f"  password : {creds['password']}")
    print(f"  lease_id : {lease}")
    print(f"  ttl      : {ttl}s ({ttl // 60} minutes)")
    return creds, lease, ttl


def connect_and_query(username, password):
    """Connect to PostgreSQL with the Vault-issued credential."""
    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        dbname="appdb",
        user=username,
        password=password,
        connect_timeout=5,
    )
    cur = conn.cursor()
    cur.execute("SELECT current_user, now();")
    row = cur.fetchone()
    print(f"[DB] Connected as: {row[0]}")
    print(f"[DB] Server time:  {row[1]}")
    conn.close()


def renew_lease(lease_id, increment=3600):
    """Extend the TTL of an existing credential without re-issuing it."""
    url = f"{VAULT_ADDR}/v1/sys/leases/renew"
    payload = json.dumps({"lease_id": lease_id, "increment": increment}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"X-Vault-Token": VAULT_TOKEN, "Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    new_ttl = data.get("lease_duration", "unknown")
    print(f"[Vault] Lease renewed. New TTL: {new_ttl}s")
    return new_ttl


if __name__ == "__main__":
    print("=== Step 1: Fetch credentials from Vault ===")
    creds, lease_id, ttl = fetch_db_credentials()

    print("\n=== Step 2: Connect to PostgreSQL ===")
    connect_and_query(creds["username"], creds["password"])

    print("\n=== Step 3: Renew lease (extend TTL) ===")
    renew_lease(lease_id, increment=3600)

    print("\n=== Done! Credential valid until TTL expires. ===")
    print(f"Lease ID to revoke early: {lease_id}")
```

```bash
pip3 install psycopg2-binary
python3 app.py

# Expected output:
# === Step 1: Fetch credentials from Vault ===
# [Vault] Issued credential:
#   username : v-root-my-role-AbCdEf-1717200000
#   password : A1b2-Xz9q-Mm4r-WwVv
#   lease_id : database/creds/my-role/xYz789AbCd
#   ttl      : 3600s (60 minutes)
#
# === Step 2: Connect to PostgreSQL ===
# [DB] Connected as: v-root-my-role-AbCdEf-1717200000
# [DB] Server time:  2026-06-01 10:00:00.123456+00:00
#
# === Step 3: Renew lease (extend TTL) ===
# [Vault] Lease renewed. New TTL: 3600s
#
# === Done! Credential valid until TTL expires. ===
```

### Step 6: Revoke a Credential Early (Incident Response)

In a real breach scenario, you revoke the credential immediately — no password rotation needed.

```bash
# Capture a fresh lease ID
CREDS=$(curl -s \
  --header "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/database/creds/my-role")

LEASE_ID=$(echo $CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['lease_id'])")
USERNAME=$(echo $CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['username'])")
PASSWORD=$(echo $CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['password'])")

echo "Credential issued: $USERNAME"

# Verify it works before revoke
docker exec vault-poc-postgres \
  psql "postgresql://${USERNAME}:${PASSWORD}@localhost:5432/appdb" \
  -c "SELECT current_user;" 2>&1
# Expected: current_user = v-root-my-role-...

# Revoke the lease immediately
curl -s \
  --header "X-Vault-Token: $VAULT_TOKEN" \
  --request PUT \
  --data "{\"lease_id\": \"$LEASE_ID\"}" \
  "$VAULT_ADDR/v1/sys/leases/revoke"

echo "Lease revoked. Testing connection..."

# Try connecting with the revoked credential
docker exec vault-poc-postgres \
  psql "postgresql://${USERNAME}:${PASSWORD}@localhost:5432/appdb" \
  -c "SELECT current_user;" 2>&1
# Expected: psql: error: FATAL: role "v-root-my-role-..." does not exist
```

Revocation propagates in under 100ms — the PostgreSQL role is dropped immediately.

---

## What to Observe

**1. Each credential is unique:**
```bash
# Run 3 times — 3 different usernames
for i in 1 2 3; do
  curl -s --header "X-Vault-Token: $VAULT_TOKEN" \
    "$VAULT_ADDR/v1/database/creds/my-role" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['username'])"
done
# v-root-my-role-AbCd-1717200001
# v-root-my-role-EfGh-1717200002
# v-root-my-role-IjKl-1717200003
```

**2. Active credentials are visible in PostgreSQL:**
```bash
docker exec vault-poc-postgres \
  psql -U vault_root -d appdb \
  -c "SELECT usename, valuntil FROM pg_user WHERE usename LIKE 'v-root%';"
# Shows all Vault-issued users with their expiry timestamps
```

**3. Vault audit log captures every credential read** (enable in non-dev mode):
```bash
# Enable file audit device
curl -s --header "X-Vault-Token: $VAULT_TOKEN" \
  --request PUT \
  --data '{"type":"file","options":{"file_path":"/vault/logs/audit.log"}}' \
  "$VAULT_ADDR/v1/sys/audit/file"
# Every read, renew, revoke is now logged with requestor token, timestamp, role
```

**4. Throughput — Vault handles 10,000 secret reads/sec** on a 2-core node. For DB credentials, the bottleneck is PostgreSQL's `CREATE ROLE` latency (~5ms), not Vault itself. At 10 RPS of new connections, each with a unique credential, overhead is negligible.

---

## What Breaks It

### Break 1: Vault is Down (Most Important Failure Mode)

```bash
# Stop Vault
docker-compose stop vault

# Try to fetch credentials
curl -s --header "X-Vault-Token: $VAULT_TOKEN" \
  "$VAULT_ADDR/v1/database/creds/my-role"
# Expected: curl: (7) Failed to connect to localhost port 8200

# Application cannot start — it has no DB password
python3 app.py
# Expected: urllib.error.URLError: <urlopen error [Errno 111] Connection refused>
```

**The lesson**: Never fetch credentials on every query. Cache the credential in memory until ~80% of TTL has elapsed, then refresh proactively. If Vault is unreachable at refresh time, keep using the existing credential and alert — don't crash.

```python
# Correct pattern: cache credential, refresh before expiry
import time

class VaultCredentialCache:
    def __init__(self):
        self._creds = None
        self._expires_at = 0

    def get(self):
        # Refresh when 80% of TTL has elapsed (refresh at 48min for 1h TTL)
        if time.time() > self._expires_at * 0.8:
            self._creds, _, ttl = fetch_db_credentials()
            self._expires_at = time.time() + ttl
        return self._creds
```

```bash
# Restart Vault
docker-compose start vault
```

### Break 2: Expired Credential Still in Use

```bash
# Create a credential with a 10-second TTL (for testing only — never in prod)
curl -s --header "X-Vault-Token: $VAULT_TOKEN" \
  --request POST \
  --data '{"db_name":"my-postgresql","creation_statements":["CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '\''{{password}}'\'' VALID UNTIL '\''{{expiration}}'\'';"],"default_ttl":"10s","max_ttl":"60s"}' \
  "$VAULT_ADDR/v1/database/roles/short-role"

CREDS=$(curl -s --header "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/database/creds/short-role")
U=$(echo $CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['username'])")
P=$(echo $CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['password'])")

# Works immediately
docker exec vault-poc-postgres psql "postgresql://$U:$P@localhost:5432/appdb" -c "SELECT 1;" 2>&1
# Expected: ?column? = 1

# Wait 15 seconds for TTL to expire
sleep 15

# Now fails
docker exec vault-poc-postgres psql "postgresql://$U:$P@localhost:5432/appdb" -c "SELECT 1;" 2>&1
# Expected: FATAL: role "v-root-short-role-..." does not exist
```

**The lesson**: Applications must handle `psycopg2.OperationalError` (or equivalent) by fetching fresh credentials and retrying once. This should be a standard DB connection wrapper, not scattered throughout the app.

### Break 3: Insufficient Role Permissions

The `my-role` grants `SELECT, INSERT, UPDATE` but not `DELETE` or `DROP`. Try a privileged operation:

```bash
CREDS=$(curl -s --header "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/database/creds/my-role")
U=$(echo $CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['username'])")
P=$(echo $CREDS | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['password'])")

docker exec vault-poc-postgres psql "postgresql://$U:$P@localhost:5432/appdb" \
  -c "DROP TABLE IF EXISTS test_table;" 2>&1
# Expected: ERROR: must be owner of table test_table
# (or: permission denied — the dynamic user cannot drop tables)
```

**The lesson**: Vault roles enforce least-privilege at the SQL level. A compromised service account can only do what its role allows — not drop tables, not read other schemas.

---

## Hardcoded Password vs. Vault — Side by Side

| Dimension | `.env` Hardcoded Password | Vault Dynamic Secrets |
|-----------|--------------------------|----------------------|
| **Password lifetime** | Forever (until manual rotation) | 1 hour (configurable) |
| **Unique per service** | No — all services share one password | Yes — each request gets unique creds |
| **Git leak risk** | High — `.env` in git history = permanent exposure | Zero — no password ever stored in code |
| **Revocation speed** | Minutes (redeploy required) | < 100ms (lease revoke API) |
| **Audit trail** | None | Full: who, when, which role, lease ID |
| **Rotation complexity** | High (coordinate all services) | Zero (auto-expires) |
| **Vault-down impact** | None | New credentials unavailable (use cache) |
| **Setup cost** | ~1 minute | ~15 minutes |

**TTL recommendations:**
- Database credentials: **1 hour** (long enough to avoid overhead, short enough to limit blast radius)
- Sensitive API keys (payment, PII): **5–15 minutes**
- CI/CD ephemeral workers: **30 minutes** (job duration + buffer)
- Long-running batch jobs: **24 hours** (renew with job heartbeat)

---

## Extend It

1. **Add a second role with write-only permissions**: Create `write-role` that only has `INSERT` rights — a data ingestion service never needs to read what it writes. Verify that `SELECT` fails for this role.

2. **Test lease renewal under load**: Write a loop that renews 100 leases concurrently and measure Vault's response time. You'll see sub-5ms responses at this scale.

3. **Enable Vault's audit log and parse it**: Turn on file audit, generate 10 credentials, revoke 3 manually, wait for 2 to expire. Then grep the audit log to reconstruct the full lifecycle of each credential — this is the incident-response workflow.

4. **Add AppRole authentication**: Replace the hardcoded `dev-only-token` with Vault's AppRole auth method. Each service gets a `role_id` (public) + `secret_id` (short-lived) — the service exchanges these for a Vault token, then fetches DB credentials. This removes the last hardcoded secret.

5. **Integrate with a connection pool**: Wrap `psycopg2.pool.ThreadedConnectionPool` with Vault credential refresh. When credentials expire, drain the pool and re-initialize with fresh credentials — zero downtime rotation.

---

## Cleanup

```bash
docker-compose down -v
# Removes containers and the postgres data volume
```

---

## Key Takeaways

- **Zero permanent secrets**: With Vault dynamic credentials, no database password ever exists in code, config files, or environment variables — there is nothing to leak from git history or `.env` files
- **Vault handles 10,000 secret reads/sec** on minimal hardware; the real bottleneck at high scale is PostgreSQL's `CREATE ROLE` (~5ms), not Vault
- **Recommended TTLs**: 1 hour for database credentials, 5–15 minutes for payment/PII APIs, 30 minutes for CI/CD jobs — shorter TTL = smaller blast radius from any single leaked credential
- **Always cache credentials**: Fetch once, cache until 80% of TTL elapsed, then refresh proactively — if Vault is unreachable at refresh time, keep using the existing credential rather than crashing
- **Revocation is the killer feature**: Compromised credential → single API call → credential destroyed in < 100ms — compare this to rotating a shared password across 50 services

---

## References

- 📚 [HashiCorp Vault: Database Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/databases/postgresql) — Official docs for PostgreSQL dynamic credentials configuration
- 📖 [HashiCorp Blog: Dynamic Database Credentials with Vault and Kubernetes](https://www.hashicorp.com/blog/dynamic-database-credentials-with-vault-and-kubernetes) — Production patterns for credential injection in containerized environments
- 📖 [Shopify Engineering: Secrets at Scale](https://shopify.engineering/secrets-at-scale-updating-credentials-in-a-global-distributed-system) — How Shopify manages secret rotation across thousands of services
- 📺 [HashiCorp Vault: Beyond the Basics — HashiTalks 2023](https://www.youtube.com/watch?v=VYfl-DpZ5wM) — Conference talk on advanced Vault patterns including dynamic secrets and AppRole auth
- 📖 [Netflix Tech Blog: Securing Netflix's Access to Cloud Infrastructure](https://netflixtechblog.com/netflix-information-security-preventing-credential-compromise-28c07cfee6a3) — How Netflix prevents credential compromise at scale using short-lived credentials
