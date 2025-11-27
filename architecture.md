# 🏗️ Architecture Overview

A clear, modern, production-grade architecture for the **Leaderboard SaaS Platform**.

---

# 1. High-Level System Architecture

```
Frontend Dashboard ───┐
External API Clients ─┼────> Express API Layer
                      │
                      ├── Redis (ZSET)       — Real-time leaderboard engine
                      ├── PostgreSQL         — Tenants, plans, events, billing
                      └── OpenTelemetry      — Logs, metrics, traces → Collector → Grafana Stack
```

### Design Goals

* Ultra-low latency (<10 ms)
* Multi-tenant and secure
* Minimal infra, maximal performance
* Horizontally scalable
* Cheap enough for bootstrapping

---

# 2. Component Responsibilities

## Express API

* Single backend application
* Route handling, validation, auth
* Multitenant context extraction
* Pino structured logging
* OTEL auto-instrumented

## Redis (ZSET)

* Source of truth for score and rank data
* Sub-millisecond reads/writes
* Supports atomic increments and real-time queries

## PostgreSQL

* Metadata & persistent storage
* Score events for analytics
* API key storage (hashed)
* Billing rollups

## OpenTelemetry

* Collects logs, metrics, traces
* Pushes to an OTEL Collector
* Outputs to Prometheus, Loki, Tempo

## Grafana

* Unified visibility for:

  * API latency
  * Errors
  * Redis memory
  * Usage per tenant
  * Tracing

---

# 3. Data Flow

### Real-time Write

```
Client → Express /scores/update
         → Redis ZINCRBY
         → (Async) Postgres insertion into score_events
```

### Real-time Read

```
Client → Express /leaderboards/:id/top
         → Redis ZRANGE
```

### Dashboard Read

```
Frontend → Express → Postgres
```

Dashboard never reads Redis directly.

---

# 4. Multi-Tenant Isolation

* API Key is the identity layer
* API Keys mapped to tenant + project in Postgres
* Redis namespaces enforce isolation

```
l:{tenant}:{project}:{leaderboard}
```

Example:

```
l:23:race_app:global
```

---

# 5. Observability Architecture

```
Express → OTEL SDK → OTEL Collector
                    ├── Prometheus (metrics)
                    ├── Loki (logs)
                    └── Tempo (traces)
                                 ↓
                              Grafana
```

### Metrics

* Latency percentiles
* Redis RTT
* Request counts per tenant
* Rate limiting events

### Tracing

* Express middleware traces
* Redis operations
* Postgres inserts
* Error stacks

### Logging

* Pino → JSON logs with trace IDs

---

# 6. API Architecture

### Middleware stack

```
1. Extract API key
2. Load tenant + project context
3. OTEL tracing middleware
4. Rate limiter (Redis)
5. JSON body parser
6. Route handler
7. Error handler with OTEL logs
```

### Core Endpoints

```
POST   /v1/scores/update
GET    /v1/leaderboards/:id/top
GET    /v1/leaderboards/:id/rank/:user
POST   /v1/leaderboards
DELETE /v1/leaderboards/:id
GET    /v1/usage
```

---

# 7. Performance Model

* Redis-only hot path
* No joins or ORMs
* Express kept lean
* All analytics aggregated asynchronously
* Redis handles millions of ops/month on tiny hardware

Target: **<10ms global latency**

---

# 8. Deployment Architecture

### MVP (Recommended)

* Fly.io / Railway / Render for API
* Upstash / Aiven for Redis
* Neon / Supabase for PostgreSQL
* 1 small VM with Docker Compose for Grafana stack

### Scaling

* Regional edge deployments
* Redis cluster scaling
* Global read replicas for Postgres
* CDN caching scoreboard reads

---

# 9. Repository Layout

```
/apps
  /api
  /dashboard
  /collector
/packages
  /types
  /sdk-js
  /eslint-config
/infra
  docker-compose.yml
  grafana/
/docs
  architecture.md
  blueprints.md
```

---

# 10. Architectural Philosophy

* **Simple > Complex**
* **Performance > Abstraction**
* **Visibility > Blind Debugging**
* **Monorepo > Microservices (for MVP)**

If it’s not necessary, don’t build it.

---

# End of architecture.md
