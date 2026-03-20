---
title: "Synthetic Monitoring POC: Playwright + Alerts + Dashboard"
date: "2026-03-20"
category: "hands-on-poc"
subcategories: ["observability", "synthetic-monitoring", "playwright", "alerting"]
personas: ["Senior Engineer", "SRE", "Tech Lead"]
tags: ["synthetic-monitoring", "playwright", "pagerduty", "slack", "sqlite", "express", "availability", "uptime"]
description: "Build a complete synthetic monitoring system from scratch: HTTP checks, API correctness checks, Playwright browser transactions, consecutive-failure alerting, result history, and a live status dashboard."
reading_time: "30 min"
difficulty: "senior"
status: "published"
---

# Synthetic Monitoring POC: Playwright + Alerts + Dashboard

This POC builds a production-grade synthetic monitoring system from scratch:
- HTTP availability checks (endpoint up + response correct)
- API correctness checks (not just 200, but valid response body)
- Multi-step Playwright browser transaction (login → navigate → assert)
- Cron runner: all checks run every 30 seconds
- SQLite result history (swap for Redis/Postgres in production)
- Slack + PagerDuty webhook alerts on consecutive failures
- Express dashboard: live green/red status per check

By the end, you have a monitoring system that catches outages in under 30 seconds and pages the right person automatically.

---

## Prerequisites

```bash
node --version   # >= 18
npm --version    # >= 9
```

---

## Project Structure

```
synthetic-monitoring-poc/
├── package.json
├── checks/
│   ├── availability-check.js
│   ├── api-correctness-check.js
│   └── browser-transaction-check.js
├── runner/
│   ├── check-runner.js
│   └── scheduler.js
├── storage/
│   └── result-store.js
├── alerting/
│   └── alert-manager.js
├── dashboard/
│   └── server.js
└── config/
    └── checks-config.js
```

---

## Step 1: Package Setup

```json
// package.json
{
  "name": "synthetic-monitoring-poc",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dashboard": "node dashboard/server.js"
  },
  "dependencies": {
    "@playwright/test": "^1.42.0",
    "better-sqlite3": "^9.4.3",
    "express": "^4.18.2",
    "node-cron": "^3.0.3"
  }
}
```

```bash
npm install
npx playwright install chromium  # Install browser binary
```

---

## Step 2: Check Configuration

```javascript
// config/checks-config.js

module.exports = {
  checks: [
    // ── Availability Checks ────────────────────────────────────────────────
    {
      id: 'home-page',
      name: 'Home Page Available',
      type: 'availability',
      url: 'https://example.com',
      expected_status: 200,
      max_duration_ms: 3000,
      contains: 'Example Domain',   // Content assertion — not just status
      schedule: '*/30 * * * * *',   // Every 30 seconds
      alert: { consecutive_failures: 2, locations_required: 1 },
    },
    {
      id: 'api-health',
      name: 'API Health Endpoint',
      type: 'availability',
      url: 'https://httpbin.org/status/200',
      expected_status: 200,
      max_duration_ms: 2000,
      schedule: '*/30 * * * * *',
      alert: { consecutive_failures: 2, locations_required: 1 },
    },
    {
      id: 'ssl-certificate',
      name: 'SSL Certificate Valid',
      type: 'ssl',
      hostname: 'example.com',
      alert_days_before_expiry: 30,
      schedule: '0 9 * * *',       // Once daily at 9 AM
      alert: { consecutive_failures: 1, locations_required: 1 },
    },

    // ── API Correctness Checks ─────────────────────────────────────────────
    {
      id: 'api-get-todo',
      name: 'API Returns Valid Data',
      type: 'api_correctness',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      method: 'GET',
      expected_status: 200,
      max_duration_ms: 3000,
      assertions: [
        { field: 'id', type: 'equals', value: 1 },
        { field: 'title', type: 'exists' },
        { field: 'completed', type: 'is_boolean' },
      ],
      schedule: '*/30 * * * * *',
      alert: { consecutive_failures: 2, locations_required: 1 },
    },
    {
      id: 'api-post-create',
      name: 'API POST Creates Resource',
      type: 'api_correctness',
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { title: 'synthetic-test', body: 'test-content', userId: 1 },
      expected_status: 201,
      max_duration_ms: 3000,
      assertions: [
        { field: 'id', type: 'exists' },
        { field: 'title', type: 'equals', value: 'synthetic-test' },
      ],
      schedule: '*/30 * * * * *',
      alert: { consecutive_failures: 2, locations_required: 1 },
    },

    // ── Browser Transaction Checks ─────────────────────────────────────────
    {
      id: 'browser-search-flow',
      name: 'Browser: Search and Navigate',
      type: 'browser_transaction',
      script: 'search-flow',       // References a script file
      max_duration_ms: 30000,
      schedule: '0 */2 * * * *',  // Every 2 minutes (browser checks are expensive)
      alert: { consecutive_failures: 2, locations_required: 1 },
    },
  ],

  // Alerting configuration
  alerting: {
    slack: {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      webhook_url: process.env.SLACK_WEBHOOK_URL,
      channel: '#monitoring-alerts',
    },
    pagerduty: {
      enabled: !!process.env.PAGERDUTY_ROUTING_KEY,
      routing_key: process.env.PAGERDUTY_ROUTING_KEY,
      severity: 'critical',
    },
  },
};
```

---

## Step 3: Check Implementations

```javascript
// checks/availability-check.js
const tls = require('tls');

async function runAvailabilityCheck(config) {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeout_ms || config.max_duration_ms || 10000
    );

    const response = await fetch(config.url, {
      method: config.method || 'GET',
      headers: config.headers || {},
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - start;
    const body = await response.text();
    const failures = [];

    // Status code assertion
    const expectedStatus = config.expected_status || 200;
    if (response.status !== expectedStatus) {
      failures.push(`Status: expected ${expectedStatus}, got ${response.status}`);
    }

    // Response time assertion
    if (config.max_duration_ms && duration > config.max_duration_ms) {
      failures.push(`Latency: ${duration}ms exceeded ${config.max_duration_ms}ms`);
    }

    // Content assertions
    if (config.contains && !body.includes(config.contains)) {
      failures.push(`Content: response missing expected string "${config.contains}"`);
    }

    if (config.not_contains && body.includes(config.not_contains)) {
      failures.push(`Content: response contains forbidden string "${config.not_contains}"`);
    }

    return {
      passed: failures.length === 0,
      duration_ms: duration,
      status_code: response.status,
      failures,
      body_snippet: body.slice(0, 200),
    };

  } catch (err) {
    const duration = Date.now() - start;
    const isTimeout = err.name === 'AbortError';

    return {
      passed: false,
      duration_ms: duration,
      status_code: null,
      failures: [isTimeout ? `Timeout after ${duration}ms` : `Request failed: ${err.message}`],
    };
  }
}

async function runSSLCheck(config) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      443,
      config.hostname,
      { servername: config.hostname },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        const expiryDate = new Date(cert.valid_to);
        const daysUntilExpiry = Math.floor((expiryDate - Date.now()) / 86_400_000);
        const threshold = config.alert_days_before_expiry || 30;

        resolve({
          passed: daysUntilExpiry > threshold,
          duration_ms: 0,
          days_until_expiry: daysUntilExpiry,
          expiry_date: expiryDate.toISOString(),
          issuer: cert.issuer?.O,
          failures: daysUntilExpiry <= threshold
            ? [`SSL expires in ${daysUntilExpiry} days (threshold: ${threshold})`]
            : [],
        });
      }
    );

    socket.on('error', (err) => {
      resolve({ passed: false, failures: [`SSL connection error: ${err.message}`] });
    });

    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve({ passed: false, failures: ['SSL check timed out'] });
    });
  });
}

module.exports = { runAvailabilityCheck, runSSLCheck };
```

```javascript
// checks/api-correctness-check.js

function evaluateAssertion(data, assertion) {
  const value = getNestedValue(data, assertion.field);

  switch (assertion.type) {
    case 'exists':
      return value !== undefined && value !== null
        ? null
        : `Field "${assertion.field}" is missing or null`;

    case 'equals':
      return value === assertion.value
        ? null
        : `Field "${assertion.field}": expected ${JSON.stringify(assertion.value)}, got ${JSON.stringify(value)}`;

    case 'not_equals':
      return value !== assertion.value
        ? null
        : `Field "${assertion.field}" should not equal ${JSON.stringify(assertion.value)}`;

    case 'is_string':
      return typeof value === 'string'
        ? null
        : `Field "${assertion.field}" should be a string, got ${typeof value}`;

    case 'is_number':
      return typeof value === 'number'
        ? null
        : `Field "${assertion.field}" should be a number, got ${typeof value}`;

    case 'is_boolean':
      return typeof value === 'boolean'
        ? null
        : `Field "${assertion.field}" should be a boolean, got ${typeof value}`;

    case 'is_array':
      return Array.isArray(value)
        ? null
        : `Field "${assertion.field}" should be an array`;

    case 'length_gt':
      return (value?.length || 0) > assertion.value
        ? null
        : `Field "${assertion.field}" length ${value?.length} not > ${assertion.value}`;

    case 'contains':
      return String(value).includes(assertion.value)
        ? null
        : `Field "${assertion.field}" value "${value}" does not contain "${assertion.value}"`;

    default:
      return `Unknown assertion type: ${assertion.type}`;
  }
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

async function runApiCorrectnessCheck(config) {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeout_ms || config.max_duration_ms || 10000
    );

    const response = await fetch(config.url, {
      method: config.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - start;
    const failures = [];

    // Status check
    if (response.status !== (config.expected_status || 200)) {
      failures.push(`Status: expected ${config.expected_status || 200}, got ${response.status}`);
    }

    // Latency check
    if (config.max_duration_ms && duration > config.max_duration_ms) {
      failures.push(`Latency: ${duration}ms exceeded ${config.max_duration_ms}ms`);
    }

    // Parse body and run assertions
    let data;
    try {
      data = await response.json();
    } catch {
      failures.push('Response body is not valid JSON');
      return { passed: false, duration_ms: duration, status_code: response.status, failures };
    }

    if (config.assertions) {
      for (const assertion of config.assertions) {
        const failure = evaluateAssertion(data, assertion);
        if (failure) failures.push(failure);
      }
    }

    return {
      passed: failures.length === 0,
      duration_ms: duration,
      status_code: response.status,
      failures,
      response_snippet: JSON.stringify(data).slice(0, 300),
    };

  } catch (err) {
    return {
      passed: false,
      duration_ms: Date.now() - start,
      status_code: null,
      failures: [err.name === 'AbortError' ? `Timeout` : `Request error: ${err.message}`],
    };
  }
}

module.exports = { runApiCorrectnessCheck };
```

```javascript
// checks/browser-transaction-check.js
const { chromium } = require('@playwright/test');

// Map of script name → transaction function
const TRANSACTION_SCRIPTS = {
  'search-flow': runSearchFlowTransaction,
};

async function runSearchFlowTransaction(page) {
  const timings = {};
  const errors = [];

  // Capture JS console errors
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`Console: ${msg.text().slice(0, 200)}`);
  });

  // Step 1: Load page
  const t1 = Date.now();
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
  timings.page_load_ms = Date.now() - t1;

  // Assert page title
  const title = await page.title();
  if (!title) throw new Error('Page title is empty');

  // Step 2: Look for main content
  const t2 = Date.now();
  await page.waitForSelector('h1', { timeout: 5000 });
  timings.content_visible_ms = Date.now() - t2;

  // Step 3: Verify a link is clickable
  const links = await page.$$('a');
  if (links.length === 0) throw new Error('No links found on page');

  return { timings, errors };
}

async function runBrowserTransactionCheck(config) {
  const script = TRANSACTION_SCRIPTS[config.script];
  if (!script) {
    return {
      passed: false,
      failures: [`Unknown transaction script: "${config.script}"`],
    };
  }

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'SyntheticMonitor/1.0 (+https://monitoring.example.com)',
  });

  const page = await context.newPage();
  const start = Date.now();
  let screenshotPath = null;

  try {
    const result = await Promise.race([
      script(page),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Transaction timeout after ${config.max_duration_ms}ms`)), config.max_duration_ms || 30000)
      ),
    ]);

    return {
      passed: true,
      duration_ms: Date.now() - start,
      timings: result.timings,
      javascript_errors: result.errors,
      failures: [],
    };

  } catch (err) {
    // Take screenshot on failure
    try {
      screenshotPath = `/tmp/synthetic-failure-${config.id}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch {}

    return {
      passed: false,
      duration_ms: Date.now() - start,
      failures: [err.message],
      screenshot_path: screenshotPath,
    };

  } finally {
    await browser.close();
  }
}

module.exports = { runBrowserTransactionCheck };
```

---

## Step 4: Result Store (SQLite)

```javascript
// storage/result-store.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'results.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);

    // Enable WAL mode for concurrent reads + writes
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS check_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        check_id TEXT NOT NULL,
        check_name TEXT NOT NULL,
        check_type TEXT NOT NULL,
        passed INTEGER NOT NULL,    -- 1 = pass, 0 = fail
        duration_ms REAL,
        status_code INTEGER,
        failures TEXT,              -- JSON array of failure messages
        metadata TEXT,              -- JSON object with extra data
        checked_at INTEGER NOT NULL -- Unix timestamp (ms)
      );

      CREATE INDEX IF NOT EXISTS idx_check_id_time
        ON check_results (check_id, checked_at DESC);

      CREATE INDEX IF NOT EXISTS idx_checked_at
        ON check_results (checked_at DESC);
    `);
  }
  return db;
}

function saveResult(checkConfig, result) {
  const db = getDb();

  const stmt = db.prepare(`
    INSERT INTO check_results
      (check_id, check_name, check_type, passed, duration_ms, status_code, failures, metadata, checked_at)
    VALUES
      (@check_id, @check_name, @check_type, @passed, @duration_ms, @status_code, @failures, @metadata, @checked_at)
  `);

  stmt.run({
    check_id: checkConfig.id,
    check_name: checkConfig.name,
    check_type: checkConfig.type,
    passed: result.passed ? 1 : 0,
    duration_ms: result.duration_ms || null,
    status_code: result.status_code || null,
    failures: JSON.stringify(result.failures || []),
    metadata: JSON.stringify({
      timings: result.timings,
      screenshot_path: result.screenshot_path,
      days_until_expiry: result.days_until_expiry,
    }),
    checked_at: Date.now(),
  });
}

// Get last N results for a check (used for consecutive-failure detection)
function getRecentResults(checkId, count = 3) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM check_results
    WHERE check_id = ?
    ORDER BY checked_at DESC
    LIMIT ?
  `).all(checkId, count);
}

// Get latest result per check (for dashboard)
function getLatestResults() {
  const db = getDb();
  return db.prepare(`
    SELECT cr.*
    FROM check_results cr
    INNER JOIN (
      SELECT check_id, MAX(checked_at) AS max_time
      FROM check_results
      GROUP BY check_id
    ) latest ON cr.check_id = latest.check_id AND cr.checked_at = latest.max_time
    ORDER BY cr.check_name
  `).all();
}

// Get check history for a specific check (for trend graphs)
function getCheckHistory(checkId, hours = 24) {
  const db = getDb();
  const since = Date.now() - hours * 3600 * 1000;
  return db.prepare(`
    SELECT * FROM check_results
    WHERE check_id = ? AND checked_at > ?
    ORDER BY checked_at DESC
  `).all(checkId, since);
}

// Cleanup old results (run daily)
function pruneOldResults(daysToKeep = 30) {
  const db = getDb();
  const cutoff = Date.now() - daysToKeep * 86_400_000;
  const result = db.prepare('DELETE FROM check_results WHERE checked_at < ?').run(cutoff);
  return result.changes;
}

module.exports = { saveResult, getRecentResults, getLatestResults, getCheckHistory, pruneOldResults };
```

---

## Step 5: Alert Manager

```javascript
// alerting/alert-manager.js
const { getRecentResults } = require('../storage/result-store');
const config = require('../config/checks-config');

// Track active incidents to avoid duplicate alerts
const activeIncidents = new Map();

async function evaluateAlert(checkConfig, latestResult) {
  const alertConfig = checkConfig.alert;
  if (!alertConfig) return;

  const recentResults = getRecentResults(checkConfig.id, 3);
  const consecutiveFails = recentResults
    .slice(0, alertConfig.consecutive_failures)
    .filter(r => r.passed === 0)
    .length;

  const incidentKey = checkConfig.id;
  const isInIncident = activeIncidents.has(incidentKey);

  if (!latestResult.passed && consecutiveFails >= alertConfig.consecutive_failures) {
    if (!isInIncident) {
      // New incident — fire alert
      activeIncidents.set(incidentKey, {
        started_at: Date.now(),
        failures: latestResult.failures,
      });
      await fireAlert(checkConfig, latestResult, 'triggered');
    }
    // Already in incident — don't re-alert (avoid spam)

  } else if (latestResult.passed && isInIncident) {
    // Recovery
    const incident = activeIncidents.get(incidentKey);
    activeIncidents.delete(incidentKey);
    const duration = Math.round((Date.now() - incident.started_at) / 1000);
    await fireAlert(checkConfig, latestResult, 'resolved', duration);
  }
}

async function fireAlert(checkConfig, result, status, durationSeconds) {
  const isResolved = status === 'resolved';

  console.log(
    `[ALERT] ${isResolved ? 'RESOLVED' : 'TRIGGERED'}: ${checkConfig.name}` +
    (isResolved ? ` (down for ${durationSeconds}s)` : '') +
    (!isResolved ? ` — ${result.failures.join(', ')}` : '')
  );

  // Fire Slack + PagerDuty in parallel
  await Promise.allSettled([
    sendSlackAlert(checkConfig, result, status, durationSeconds),
    sendPagerDutyAlert(checkConfig, result, status, durationSeconds),
  ]);
}

async function sendSlackAlert(checkConfig, result, status, durationSeconds) {
  const slackConfig = config.alerting.slack;
  if (!slackConfig.enabled) return;

  const isResolved = status === 'resolved';
  const color = isResolved ? 'good' : 'danger';
  const emoji = isResolved ? ':white_check_mark:' : ':red_circle:';

  const payload = {
    channel: slackConfig.channel,
    attachments: [{
      color,
      fallback: `${emoji} ${checkConfig.name} is ${isResolved ? 'UP' : 'DOWN'}`,
      title: `${emoji} ${checkConfig.name}`,
      fields: [
        {
          title: 'Status',
          value: isResolved ? `Resolved (was down for ${durationSeconds}s)` : 'FAILING',
          short: true,
        },
        {
          title: 'Check Type',
          value: checkConfig.type,
          short: true,
        },
        ...(checkConfig.url ? [{ title: 'URL', value: checkConfig.url, short: false }] : []),
        ...(!isResolved ? [{
          title: 'Failures',
          value: result.failures.join('\n'),
          short: false,
        }] : []),
        {
          title: 'Duration',
          value: `${result.duration_ms}ms`,
          short: true,
        },
      ],
      ts: Math.floor(Date.now() / 1000),
    }],
  };

  const response = await fetch(slackConfig.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`Slack alert failed: ${response.status} ${await response.text()}`);
  }
}

async function sendPagerDutyAlert(checkConfig, result, status, durationSeconds) {
  const pdConfig = config.alerting.pagerduty;
  if (!pdConfig.enabled) return;

  const isResolved = status === 'resolved';
  const dedupKey = `synthetic-${checkConfig.id}`;

  const payload = {
    routing_key: pdConfig.routing_key,
    event_action: isResolved ? 'resolve' : 'trigger',
    dedup_key: dedupKey,
    payload: {
      summary: `${checkConfig.name} is ${isResolved ? 'RECOVERED' : 'FAILING'}: ${result.failures?.[0] || ''}`,
      severity: pdConfig.severity,
      source: 'synthetic-monitoring',
      group: 'synthetic-checks',
      custom_details: {
        check_id: checkConfig.id,
        check_type: checkConfig.type,
        url: checkConfig.url || checkConfig.hostname,
        duration_ms: result.duration_ms,
        failures: result.failures,
        ...(isResolved ? { recovery_after_seconds: durationSeconds } : {}),
      },
    },
  };

  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`PagerDuty alert failed: ${response.status}`);
  }
}

module.exports = { evaluateAlert };
```

---

## Step 6: Check Runner + Scheduler

```javascript
// runner/check-runner.js
const { runAvailabilityCheck, runSSLCheck } = require('../checks/availability-check');
const { runApiCorrectnessCheck } = require('../checks/api-correctness-check');
const { runBrowserTransactionCheck } = require('../checks/browser-transaction-check');
const { saveResult } = require('../storage/result-store');
const { evaluateAlert } = require('../alerting/alert-manager');

async function runCheck(checkConfig) {
  let result;

  try {
    switch (checkConfig.type) {
      case 'availability':
        result = await runAvailabilityCheck(checkConfig);
        break;
      case 'ssl':
        result = await runSSLCheck(checkConfig);
        break;
      case 'api_correctness':
        result = await runApiCorrectnessCheck(checkConfig);
        break;
      case 'browser_transaction':
        result = await runBrowserTransactionCheck(checkConfig);
        break;
      default:
        result = { passed: false, failures: [`Unknown check type: ${checkConfig.type}`] };
    }
  } catch (err) {
    result = {
      passed: false,
      duration_ms: 0,
      failures: [`Unexpected runner error: ${err.message}`],
    };
  }

  // Log result
  const statusIcon = result.passed ? '✓' : '✗';
  const duration = result.duration_ms ? `${result.duration_ms}ms` : 'n/a';
  console.log(`[${new Date().toISOString()}] ${statusIcon} ${checkConfig.name} (${duration})`);
  if (!result.passed) {
    console.log(`  Failures: ${result.failures.join(' | ')}`);
  }

  // Store result
  saveResult(checkConfig, result);

  // Evaluate alert threshold
  await evaluateAlert(checkConfig, result);

  return result;
}

module.exports = { runCheck };
```

```javascript
// runner/scheduler.js
const cron = require('node-cron');
const { checks } = require('../config/checks-config');
const { runCheck } = require('./check-runner');
const { pruneOldResults } = require('../storage/result-store');

function startScheduler() {
  console.log(`Starting synthetic monitoring scheduler with ${checks.length} checks`);

  for (const check of checks) {
    if (check.enabled === false) {
      console.log(`  SKIP (disabled): ${check.name}`);
      continue;
    }

    if (!cron.validate(check.schedule)) {
      console.error(`  ERROR: Invalid cron schedule for "${check.name}": ${check.schedule}`);
      continue;
    }

    console.log(`  SCHEDULED: ${check.name} (${check.schedule})`);

    cron.schedule(check.schedule, async () => {
      await runCheck(check);
    });
  }

  // Run all checks immediately on startup
  console.log('Running initial checks...');
  Promise.allSettled(checks.filter(c => c.enabled !== false).map(c => runCheck(c)));

  // Daily cleanup
  cron.schedule('0 0 * * *', () => {
    const deleted = pruneOldResults(30);
    console.log(`[Cleanup] Pruned ${deleted} old check results`);
  });
}

module.exports = { startScheduler };
```

---

## Step 7: Status Dashboard

```javascript
// dashboard/server.js
const express = require('express');
const { getLatestResults, getCheckHistory } = require('../storage/result-store');

const app = express();

app.get('/', (req, res) => {
  const results = getLatestResults();

  const rows = results.map(r => {
    const passed = r.passed === 1;
    const failures = JSON.parse(r.failures || '[]');
    const age = Math.round((Date.now() - r.checked_at) / 1000);

    return `
      <tr class="${passed ? 'pass' : 'fail'}">
        <td>${passed ? '✅' : '❌'}</td>
        <td>${r.check_name}</td>
        <td>${r.check_type}</td>
        <td>${r.duration_ms !== null ? `${r.duration_ms}ms` : 'n/a'}</td>
        <td>${passed ? 'PASS' : failures.join('<br/>')}</td>
        <td>${age}s ago</td>
      </tr>
    `;
  }).join('');

  const passingCount = results.filter(r => r.passed === 1).length;
  const totalCount = results.length;
  const overallHealth = passingCount === totalCount ? 'ALL SYSTEMS OPERATIONAL'
    : passingCount === 0 ? 'MAJOR OUTAGE'
    : `PARTIAL OUTAGE (${totalCount - passingCount} checks failing)`;

  const headerColor = passingCount === totalCount ? '#4caf50' : '#f44336';

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Synthetic Monitoring Dashboard</title>
  <meta http-equiv="refresh" content="15">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f5f5f5; }
    .header { background: ${headerColor}; color: white; padding: 20px 30px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.9; }
    .container { padding: 30px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    th { background: #333; color: white; padding: 12px 16px; text-align: left; font-size: 13px; }
    td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    tr.pass td { background: #f9fff9; }
    tr.fail td { background: #fff9f9; }
    tr:last-child td { border-bottom: none; }
    .updated { text-align: right; color: #888; font-size: 12px; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${overallHealth}</h1>
    <p>${passingCount}/${totalCount} checks passing</p>
  </div>
  <div class="container">
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Check Name</th>
          <th>Type</th>
          <th>Duration</th>
          <th>Details</th>
          <th>Last Run</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="updated">Auto-refreshes every 15 seconds | ${new Date().toISOString()}</p>
  </div>
</body>
</html>`);
});

// JSON API for programmatic access
app.get('/api/status', (req, res) => {
  const results = getLatestResults();
  const byCheck = {};
  for (const r of results) {
    byCheck[r.check_id] = {
      name: r.check_name,
      type: r.check_type,
      passed: r.passed === 1,
      duration_ms: r.duration_ms,
      failures: JSON.parse(r.failures || '[]'),
      last_checked: new Date(r.checked_at).toISOString(),
      age_seconds: Math.round((Date.now() - r.checked_at) / 1000),
    };
  }

  const total = results.length;
  const passing = results.filter(r => r.passed === 1).length;

  res.json({
    overall: passing === total ? 'healthy' : passing === 0 ? 'down' : 'degraded',
    passing,
    total,
    checks: byCheck,
    generated_at: new Date().toISOString(),
  });
});

// Check history endpoint
app.get('/api/history/:checkId', (req, res) => {
  const history = getCheckHistory(req.params.checkId, parseInt(req.query.hours) || 24);
  res.json(history.map(r => ({
    passed: r.passed === 1,
    duration_ms: r.duration_ms,
    failures: JSON.parse(r.failures || '[]'),
    checked_at: new Date(r.checked_at).toISOString(),
  })));
});

const PORT = process.env.DASHBOARD_PORT || 8080;
app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});

module.exports = app;
```

---

## Step 8: Entry Point + Run

```javascript
// index.js
const { startScheduler } = require('./runner/scheduler');
const dashboardApp = require('./dashboard/server');

console.log('=== Synthetic Monitoring POC ===');
console.log(`Slack alerts: ${process.env.SLACK_WEBHOOK_URL ? 'ENABLED' : 'DISABLED (set SLACK_WEBHOOK_URL)'}`);
console.log(`PagerDuty: ${process.env.PAGERDUTY_ROUTING_KEY ? 'ENABLED' : 'DISABLED (set PAGERDUTY_ROUTING_KEY)'}`);
console.log('');

startScheduler();
```

```bash
# Run the complete system
npm install
npx playwright install chromium

# With alerts (optional)
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export PAGERDUTY_ROUTING_KEY="your-pagerduty-integration-key"

# Start monitoring + dashboard
node index.js

# Open dashboard
open http://localhost:8080

# Or run dashboard separately
node dashboard/server.js
```

---

## Verification

After starting, you should see:
```
=== Synthetic Monitoring POC ===
Slack alerts: DISABLED
PagerDuty: DISABLED
Starting synthetic monitoring scheduler with 5 checks
  SCHEDULED: Home Page Available (*/30 * * * * *)
  SCHEDULED: API Health Endpoint (*/30 * * * * *)
  SCHEDULED: API Returns Valid Data (*/30 * * * * *)
  ...
Running initial checks...
[2026-03-20T09:00:00.123Z] ✓ Home Page Available (234ms)
[2026-03-20T09:00:00.456Z] ✓ API Returns Valid Data (156ms)
[2026-03-20T09:00:01.789Z] ✓ Browser: Search and Navigate (2341ms)
Dashboard running at http://localhost:8080
```

Visit `http://localhost:8080` for the live dashboard and `http://localhost:8080/api/status` for the JSON API.

---

## Key Takeaways

- **Availability checks must validate content, not just status code.** A CDN serving a cached error page returns 200. Check `contains` assertions.
- **API correctness checks validate semantics.** JSON schema assertions catch regressions that status codes never will.
- **Browser transactions are expensive** (~2-5s each): schedule them every 2 minutes, not every 30 seconds.
- **`2/3 consecutive failures` threshold before alerting** is the minimum viable noise filter.
- **Track incidents with a dedup key** (PagerDuty) so one outage creates one incident, not 240 alerts over 2 hours.
- **The dashboard is for humans at a glance** — green/red per check, age of last result, actual failure message. No noise.
- **SQLite is fine for a single-region checker**. For multi-region, use Redis or a shared database as the result store.
