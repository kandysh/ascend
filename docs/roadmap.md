# Leaderboard SaaS – Microservices Implementation Roadmap

## Phase 0 — Foundation Setup (Day 0–1)

- [x] Initialize PNPM workspaces
- [x] Create core directories (/apps, /packages, /infra, /docs)
- [x] Add shared packages: types, db, redis-client, utils, sdk-js
- [x] Create .env templates
- [x] Initialize GitHub repo + CI skeleton

## Phase 1 — Auth & Tenant System (Day 1–3)

- [x] Implement Auth/Tenant Fastify service
- [x] Create Postgres tables: tenants, projects, api_keys
- [x] Implement API key creation, rotation, revocation
- [x] Add API key hashing utilities
- [x] Implement Auth → Gateway lookup API
- [x] Add migrations (Drizzle)

## Phase 2 — API Gateway (Day 3–4)

- [ ] Implement Fastify-based API Gateway
- [ ] Validate X-Api-Key using Auth Service
- [ ] Inject tenant context into headers
- [ ] Add rate limiting per tenant
- [ ] Add usage counter middleware
- [ ] Route: /scores → Scores Service
- [ ] Route: /leaderboards → Leaderboards Service
- [ ] Route: /billing → Billing Service

## Phase 3 — Scores Service (Day 5–8)

- [ ] Scaffold Fastify Scores Service
- [ ] Add Redis client
- [ ] Implement POST /scores/update
- [ ] Implement GET /leaderboards/:id/top
- [ ] Implement GET /leaderboards/:id/rank/:user
- [ ] Implement optional batch updates
- [ ] Add event publishing: score.updated
- [ ] Benchmark Redis operations

## Phase 4 — Leaderboards Service (Day 8–10)

- [ ] Scaffold service
- [ ] Create Postgres tables: leaderboards, seasons
- [ ] Implement CRUD: create/update/delete leaderboard
- [ ] Add season/TTL policies
- [ ] Publish events: leaderboard.created, leaderboard.deleted

## Phase 5 — Worker & Event Bus (Day 10–13)

- [ ] Create Worker service
- [ ] Subscribe to Kafka/NATS topics
- [ ] Persist score events → Postgres
- [ ] Implement daily snapshots
- [ ] Implement usage counters
- [ ] Implement fraud detection rules
- [ ] Implement TTL eviction

## Phase 6 — Billing & Usage (Day 13–15)

- [ ] Implement Billing service
- [ ] Create tables: usage_rollups, invoices
- [ ] Aggregate daily usage
- [ ] Enforce plan limits
- [ ] Integrate Gateway with plan restrictions

## Phase 7 — Analytics Service (Day 15–18)

- [ ] Implement time-series aggregation
- [ ] Implement analytics APIs
- [ ] Build active players, score trends, traffic peaks

## Phase 8 — Dashboard (Day 18–22)

- [ ] Create Next.js dashboard
- [ ] Overview page (usage, system metrics)
- [ ] Leaderboards list page
- [ ] Leaderboard preview
- [ ] API key management page
- [ ] Billing page
- [ ] Grafana embed (logs, traces, metrics)

## Phase 9 — Observability (Day 22–24)

- [ ] Add OTEL SDK to all services
- [ ] Deploy OTEL Collector
- [ ] Deploy Prometheus, Loki, Tempo
- [ ] Create Grafana dashboards
- [ ] Configure alerts

## Phase 10 — Deployment & DevOps (Day 24–30)

- [ ] Dockerize all services
- [ ] Write Kubernetes manifests or Helm charts
- [ ] Set up GitHub Actions CI/CD
- [ ] Deploy services + Redis + Postgres + Event Bus
- [ ] Set auto-scaling rules

## Phase 11 — Final Polish (Day 30–35)

- [ ] Write documentation & API reference
- [ ] Add sample SDKs (JS, Unity, Python)
- [ ] Add public demo page
- [ ] Record walkthrough video

## Optional — Enterprise Features

- [ ] Per-tenant Redis clusters
- [ ] Event replay engine
- [ ] Multi-region latency routing
- [ ] Webhooks system
- [ ] WAF & anomaly detection
