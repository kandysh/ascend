# Multitenant Leaderboard SaaS — Microservices Architecture Blueprint

This document provides a clean, production-grade architecture for a **microservices-based, enterprise-ready, multi-tenant Leaderboard SaaS platform**. It is optimized for showcasing backend mastery, distributed systems thinking, DevOps competency, observability, and SaaS product design.

---

# 1. System Overview

A distributed, scalable, fast, multi-tenant leaderboard system with strong separation of concerns.

```
                 ┌──────────────┐
                 │   SDKs / API │
                 └──────┬───────┘
                        │
                 ┌──────▼────────┐
                 │  API Gateway   │
                 └───┬───┬───┬───┘
        ┌────────────┘   │   └─────────────┐
   REST │                 │                 │ gRPC/REST
        ▼                 ▼                 ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Scores Svc   │   │ Leaderboards  │   │ Auth/Tenant  │
│ (hot path)   │   │ (control pane)│   │  Service     │
└─────┬────────┘   └──────┬───────┘   └──────┬───────┘
      │ Redis ZSET         │Postgres         │ Postgres
      ▼                    ▼                 ▼
┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│ Redis Engine │    │ Metadata DB  │   │ Keys/Billing │
└──────┬───────┘    └──────────────┘   └──────────────┘
       │
       ▼
┌──────────────┐      Kafka/NATS      ┌────────────────────┐
│Worker/Batcher│◀─────────────────────│ Event Bus           │
└──────┬───────┘                      └───────▲────────────┘
       │                                   │
       ▼                                   │
┌──────────────┐                           │
│ Analytics Svc │◀─────────────────────────┘
└──────────────┘

Observability Stack: OTEL Collector → Prometheus + Loki + Tempo → Grafana
```

---

# 2. Microservice Catalog

Each component is independently deployable and horizontally scalable.

## **1. API Gateway**

- Validates `X-Api-Key`
- Rate limiting per tenant
- Routes requests to services
- Injects trace context

## **2. Auth/Tenant Service**

- Stores & manages API keys (hashed)
- Tracks tenants & billing plans
- Provides metadata to gateway

## **3. Scores Service (Core Hot Path)**

- Responsible for _all real-time leaderboard operations_
- Performs `ZINCRBY`, `ZREVRANK`, `ZREVRANGE`, `ZMSCORE`
- Publishes `score.updated` to event bus

## **4. Leaderboards Service (Control Plane)**

- CRUD for leaderboards
- TTL, season resets, aggregation modes
- Metadata stored in Postgres

## **5. Worker / Ingest Service**

- Consumes `score.updated` events
- Writes score events to Postgres (append-only)
- Snapshotting leaderboards
- Fraud detection rules
- Billing usage increments

## **6. Billing & Usage Service**

- Aggregates usage metrics
- Enforces plan restrictions
- Integrates with billing provider

## **7. Analytics Service**

- Builds aggregates for dashboards
- Provides trending, time-series insights

## **8. Dashboard (Next.js)**

- Tenant admin UI
- Insights, usage, logs, traces, leaderboard previews

## **9. Observability Stack**

- OTEL → Collector → Prometheus/Loki/Tempo → Grafana
- Full tracing across services

---

# 3. Data Architecture

## **Redis (Owned by Scores Service)**

The real-time store.

Key design:

```
l:{tenant}:{project}:{leaderboard}
```

Uses ZSET commands:

- `ZINCRBY` → atomic score updates
- `ZREVRANGE` → top N
- `ZREVRANK` → rank lookup
- `ZMSCORE` → batch score queries

## **Postgres (Owned by Control Plane + Worker)**

Tables:

- `tenants`
- `api_keys`
- `leaderboards`
- `score_events` (append-only)
- `usage_rollups`
- `seasons`
- `fraud_flags`

## **Event Bus (Kafka/NATS)**

Topics:

- `score.updated`
- `leaderboard.created`
- `leaderboard.deleted`
- `usage.record`
- `snapshot.trigger`
- `fraud.alert`

---

# 4. Multitenancy Model

### **Identity = API Key**

The `X-Api-Key` identifies tenant, project, and plan.

### **Redis Isolation**

Namespaced ZSET keys prevent cross-contamination.

### **Database Isolation**

Every table includes `tenant_id`, optionally enforced via PostgreSQL RLS.

### **Service Authorization**

Gateway performs auth; downstream services assume authenticated requests.

---

# 5. Hot Path Logic (Scores Service)

```
Client → Gateway → Scores Service → Redis → Response (sub-5ms)
```

### Score Update Flow

1. Validate API key via Gateway
2. Validate leaderboard
3. Redis: `ZINCRBY`
4. Redis: `ZSCORE` or `ZREVRANK`
5. Respond immediately
6. Publish `score.updated` event

### Read Flow

```
Client → top N → Redis ZREVRANGE
```

Never hits Postgres in real-time path.

---

# 6. Async Processing (Worker Service)

The worker ensures durability, billing, and analytics.

Triggered by event bus:

- Insert score events to DB
- Update usage counters
- Detect fraud (unusual spikes)
- Snapshot leaderboards (daily/hourly)
- TTL eviction or seasonal resets

---

# 7. Billing Architecture

### Usage Model: Ops-based Billing

Operations counted as:

- Score updates
- Read queries
- Leaderboard operations

### Redis Counter:

```
INCR usage:{tenant}:{date}
```

### Worker rolls up usage → Postgres daily.

### Plans

- Free — 100k ops/month
- Hobby — 2M ops
- Pro — 20M ops
- Enterprise — custom

---

# 8. Observability & Tracing

All services instrumented using OTEL.

### Trace Flow

```
SDK → Gateway → Scores → Redis
               → Event Bus → Worker → Postgres
```

### Components

- **Traces**: Tempo
- **Logs**: Loki
- **Metrics**: Prometheus

### Key metrics

- Redis latency
- P99 request latency
- Request volume per tenant
- Error rate
- Worker lag

---

# 9. Security Architecture

- API keys stored hashed (bcrypt/libsodium)
- Gateway rate limits & quotas
- TLS everywhere
- Postgres RLS for tenant isolation
- Secrets stored in Vault/cloud SM
- Audit logging for all admin actions

---

# 10. Deployment & Infra

## Recommended Stack

- Kubernetes (GKE / EKS / Fly K8s)
- Managed Redis (Upstash, Elasticache)
- Managed Postgres (Neon, RDS)
- Kafka (Confluent Cloud)
- OTEL collector (DaemonSet)

## CI/CD

- GitHub Actions
- Build → Test → Publish → Deploy (Helm or K8s YAML)

---

# 11. Testing Strategy

- **Unit tests**: per service
- **Integration tests**: Redis + Postgres via Testcontainers
- **Contract tests**: API Gateway → services
- **E2E**: simulate client scoring + dashboard read
- **Load tests**: k6 for leaderboard update bursts

---

# 12. Repository Structure (Turborepo)

```
/apps
  /gateway
  /auth
  /scores
  /leaderboards
  /worker
  /billing
  /analytics
  /dashboard

/packages
  /types
  /utils
  /redis
  /db
  /sdk-js

/infra
  /k8s
  /helm
  docker-compose.dev.yml

/docs
  architecture-microservices.md
```

---

# 13. Demo / Presentation Flow

For interviews or portfolio, showcase:

1. Create a tenant + API key via Auth Service
2. Send live score updates through SDK
3. Watch real-time ranks update
4. Open Grafana: show full trace from SDK → Redis
5. Show billing counters increasing
6. Show snapshot tables in Postgres
7. Kill Scores service pod → demonstrate resilience
8. Trigger fraud detection → alert surfaced in dashboard

---

# 14. Milestone Roadmap

**Week 1:** Gateway, Auth Service, Scores Service (Redis hot path)
**Week 2:** Worker + Event Bus + DB events
**Week 3:** Leaderboards Service + Dashboard UI
**Week 4:** Billing, usage, analytics
**Week 5:** Observability + CI/CD + k8s deployment
**Week 6:** Polish + docs + sample SDKs

---

# Summary

This microservices architecture:

- Demonstrates **high-performance backend engineering** (Redis ZSET, Fastify)
- Shows **distributed systems skills** (Kafka, workers, async consistency)
- Implements **multi-tenant SaaS principles** (namespacing, billing, auth)
- Includes **enterprise-grade observability** (OTEL, Grafana)
- Highlights **solid DevOps/k8s expertise**
- Provides **extensible product features** (seasons, snapshots, analytics)

Perfect for interviews, portfolio, or actual production SaaS.
