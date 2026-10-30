# RoktoBondhu (রক্তবন্ধু) — Real-Time Blood Donation Matcher

[![CI Pipeline](https://github.com/ZamanAsad007/RoktoBondhu/actions/workflows/ci.yml/badge.svg)](https://github.com/ZamanAsad007/RoktoBondhu/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/badge/release-v2.0.0-red.svg)](https://github.com/ZamanAsad007/RoktoBondhu/releases)

> **Medical Disclaimer:** This is an engineering portfolio and learning project, not a certified medical device or clinical product. Eligibility rules, cooldown intervals, and compatibility matrices are configurable defaults and must strictly follow local public health guidelines.

**RoktoBondhu (রক্তবন্ধু)** is a high-reliability, distributed emergency blood matching network for Bangladesh. It connects emergency patients with verified, compatible, and available volunteer donors in expanding geographic proximity waves while strictly enforcing transactional row locks to prevent oversubscription, masking contact details to prevent harassment, and maintaining resilience via transactional outbox patterns.

---

## 1. Problem Statement

In developing regions, emergency blood requests often circulate as chaotic, unverified social media posts and frantic phone chains:
- **No Compatibility Verification:** Incompatible or ineligible donors travel to hospitals only to be turned away.
- **Alert Fatigue & Concurrency Race:** Blasting thousands of donors simultaneously creates spam; or multiple donors arrive when only 1 or 2 units are required.
- **Privacy Harassment:** Requester and patient personal phone numbers are publicly broadcast, leading to predatory commercial blood brokers, harassment, and fraud.

**RoktoBondhu solves this with:**
1. **PostGIS Proximity Waves:** Automated geographic concentric rings (0–5km, 5–10km, 10–25km, 25–50km+) notifying the closest compatible donors first.
2. **Race-Proof Concurrency:** Exclusive row-level locking (`SELECT ... FOR UPDATE`) guarantees that exactly `N` units needed are accepted without race conditions.
3. **Masked Communication:** Ephemeral in-app chat with phone number protection and content filtering until voluntary mutual reveal.
4. **Reliability Pack:** Transactional outbox pattern, idempotent APIs, Redis-backed rate limiting, and Prometheus/Grafana observability.

---

## 2. System Architecture

```text
                                  +---------------------------------------+
                                  |            Web Browser / PWA          |
                                  |     (React 18 + Vite + i18next)       |
                                  +-------------------+-------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |             Nginx Gateway             |
                                  |           Reverse Proxy (:80)         |
                                  +----+-----------------------------+----+
                                       |                             |
                        /api, /metrics |                             | / (Static SPA)
                                       v                             v
                           +-----------------------+     +-----------------------+
                           |       Core API        |     |     Frontend Nginx    |
                           |    (Node.js :5000)    |     |     Web Container     |
                           +---+-------+-------+---+     +-----------------------+
                               |       |       |
            Transactional DB / |       |       | Background Jobs /
            Outbox Table       v       |       v Event Bus
                   +---------------+   |   +---------------+
                   |  PostgreSQL   |   |   | Redis 7 &     |
                   |  16 + PostGIS |   |   | BullMQ Queues |
                   +---------------+   |   +-------+-------+
                                       |           |
                                       |           v
                                       |   +-----------------------+
                                       |   |  Notification Service |
                                       |   |  (Worker Daemon)      |
                                       |   +---+-------+-------+---+
                                       |       |       |       |
                                       v       v       v       v
                                  SSE Stream Mailpit Web Push Telegram
                                  (/api/stream) (SMTP) (VAPID)  Bot API
```

### Observability & Infrastructure
```text
  +--------------------+         Scrapes :5000/metrics         +--------------------+
  |     Prometheus     | ------------------------------------> |      Core API      |
  |     (Port 9090)    |                                       | (prom-client)      |
  +---------+----------+                                       +--------------------+
            |
            | DataSource (PromQL)
            v
  +--------------------+
  |      Grafana       | Pre-provisioned Dashboards:
  |     (Port 3001)    | Waves, Accepts, Latency, Queue Depth
  +--------------------+
```

---

## 3. Extended Feature Matrix (v2.0.0)

| Phase | Category | Description | Status |
|---|---|---|---|
| **0-7** | **Core Matching** | PostGIS proximity waves, compatibility matrix, BullMQ escalation, row locks | Done |
| **8-12** | **Full Stack & Safety** | React SPA, donor feed, abuse reporting, multi-stage Docker & CI | Done |
| **14** | **Stats & Gamification** | Streak calculation, badge engine (Life Saver, Rapid Responder), PDF certificates | Done |
| **15** | **SOS & Public Sharing** | Instant SOS radius widening (25km+), public shareable URLs (`/s/:token`), OG tags | Done |
| **16** | **Real-Time Streaming** | Server-Sent Events (SSE) with Redis Pub/Sub broadcast | Done |
| **17** | **Orgs & Blood Banks** | Organization dashboards (`ORG`), live inventory tracker, blood drive RSVPs | Done |
| **18** | **Trust & Smarter Ranking** | Reliability score (0-100), Candidate Ranking V2 engine, slip verification | Done |
| **19** | **Masked In-App Chat** | WebSocket real-time chat, phone protection, scam filters, voluntary phone share | Done |
| **20** | **i18n, PWA & Web Push** | Full Bangla/English localization, offline PWA caching, VAPID Web Push alerts | Done |
| **21** | **Telegram Bot Channel** | `@roktobondhu_bot` integration, 6-digit account linking, inline Accept/Decline | Done |
| **22** | **Heatmap & Forecasting** | PostGIS `ST_SnapToGrid` heatmap, 4-week moving average demand, CSV export | Done |
| **23** | **Reliability Pack** | Transactional outbox, idempotency keys, brute-force rate limiter, Grafana metrics | Done |
| **24** | **Final Release Polish** | "How matching works" page, comprehensive documentation, and v2.0.0 release | Done |

---

## 4. Key Design Decisions

### 4.1 Strict Row-Locking for Concurrency Control
```sql
-- Executed inside an isolated PostgreSQL transaction
BEGIN;
SELECT * FROM blood_requests WHERE id = $1 FOR UPDATE;

-- Check if accepted donors < units_needed
UPDATE request_matches 
SET status = 'ACCEPTED', responded_at = NOW() 
WHERE id = $2;

COMMIT;
```
When multiple donors click **Accept** concurrently on their phones, the first transaction locks the blood request row. Subsequent transactions wait and verify if slots remain. If the request was filled, they roll back immediately with HTTP `409 Conflict ("Blood request is already fulfilled")`.

### 4.2 Candidate Ranking V2 Engine
When dozens of donors are eligible, RoktoBondhu sorts them using multi-objective scoring:
$$\text{Score} = (0.35 \times \text{Proximity}) + (0.25 \times \text{Reliability}) + (0.15 \times \text{ResponseSpeed}) + (0.15 \times \text{Recency}) + (0.10 \times \text{Verification})$$

### 4.3 Transactional Outbox Pattern
To prevent lost jobs during broker outages or crashes, notification and wave jobs are saved to an `outbox` table in the *same* database transaction as the state change. A background publisher loop with `SELECT ... FOR UPDATE SKIP LOCKED` guarantees at-least-once delivery to BullMQ.

### 4.4 Idempotent Request APIs
Endpoints `POST /api/requests` and `POST /api/matches/:id/accept` support the `Idempotency-Key` HTTP header. Retried requests due to spotty mobile connections replay the cached status and payload with header `X-Cache-Lookup: HIT`, eliminating duplicate requests.

---

## 5. Quick Start (One-Command Launch)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) >= 20 (for local testing)

### Launch the Complete Stack
```bash
# 1. Clone repository
git clone https://github.com/ZamanAsad007/RoktoBondhu.git
cd RoktoBondhu

# 2. Start full Docker Compose environment
make up
```

### Access Ports & Services
| Component | URL | Notes |
|---|---|---|
| **Web Application** | `http://localhost:3000` (or `http://localhost`) | React SPA + PWA |
| **How Matching Works** | `http://localhost:3000/how-matching-works` | Interactive Architecture Guide |
| **API Gateway** | `http://localhost:5000/api` | Express REST API |
| **Prometheus Metrics** | `http://localhost:5000/metrics` | Prometheus Metrics Endpoint |
| **Prometheus UI** | `http://localhost:9090` | Time-series query interface |
| **Grafana Dashboards** | `http://localhost:3001` | User: `admin` / Password: `admin` |
| **Mailpit Webmail** | `http://localhost:8025` | Development SMTP Inspector |
| **PostgreSQL / PostGIS** | `localhost:5433` | Database (`roktobondhu`) |
| **Redis** | `localhost:6380` | Cache & BullMQ message bus |

---

## 6. Testing & Quality Assurance

Run the complete test suite across Core API, Notification Service, and Frontend:
```bash
# Full monorepo test suite
npm test

# Service-specific tests
npm --workspace=services/core-api run test
npm --workspace=services/notification-service run test
npm --workspace=frontend run test
```

### Test Coverage Highlights
- **Matching & Concurrency:** Concurrency simulations testing simultaneous donor accepts under row locks.
- **Ranking Engine:** Unit tests comparing V1 vs V2 candidate selection.
- **Chaos & Reliability:** Redis and queue outages mid-wave, outbox recovery, idempotency replaying, and login brute-force testing.
- **Frontend Vitest:** Component tests covering i18n, PWA prompts, masked chat, live SSE streams, and heatmap grid rendering.

---

## 7. Interactive Emergency Demo

```bash
# Seed 200 volunteer donors across Dhaka and execute live matching demo
make demo
```
This script:
1. Applies all PostgreSQL database migrations.
2. Seeds 200 volunteer donors across Dhaka neighborhoods.
3. Creates a critical 2-unit emergency request at Dhaka Medical College Hospital.
4. Triggers wave-1 matching, dispatches real-time SSE alerts, emails via Mailpit, and outbox publisher jobs.

---

## 8. License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
