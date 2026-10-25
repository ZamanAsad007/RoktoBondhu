# RoktoBondhu (রক্তবন্ধু) - Blood Donation Matcher

A web platform that connects people who urgently need blood with nearby, compatible, and eligible donors.

> **Disclaimer:** This is a portfolio/learning project, not a medical product. Eligibility rules are configurable defaults and must follow local health guidelines.

---

## Architecture

```text
[ React Frontend ] ---> [ Nginx Gateway ] ---> [ Core API Service ]
                                                     |
                                                     +---> [ PostgreSQL + PostGIS ]
                                                     +---> [ Redis + BullMQ ]
                                                     +---> [ Mailpit (Email Dev) ]
```

### Services
- **`core-api`**: Authentication, donor profiles, geolocation queries, request matching, concurrency protection, background wave jobs.
- **`notification-service`**: Consumes notification events, manages multi-channel dispatch (In-App, Email, SMS mock).
- **`frontend`**: React web application.
- **`gateway`**: Nginx reverse proxy.

---

## Prerequisites
- Node.js >= 20
- Docker & Docker Compose

---

## Getting Started

1. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

2. **Start Infrastructure Services**
   ```bash
   docker compose up -d
   ```
   This will spin up:
   - PostgreSQL 16 + PostGIS 3.4
   - Redis 7
   - Mailpit (Web UI: `http://localhost:8025`, SMTP: `1025`)

3. **Install Dependencies & Run Migrations**
   ```bash
   npm install
   npm run migrate
   ```

4. **Start Development Server**
   ```bash
   npm run dev:api
   ```
