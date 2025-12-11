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

- [x] Implement Fastify-based API Gateway
- [x] Validate X-Api-Key using Auth Service
- [x] Inject tenant context into headers
- [x] Add rate limiting per tenant
- [x] Add usage counter middleware
- [x] Route: /scores → Scores Service
- [x] Route: /leaderboards → Leaderboards Service
- [x] Route: /billing → Billing Service

## Phase 3 — Scores Service (Day 5–8)

- [x] Scaffold Fastify Scores Service
- [x] Add Redis client
- [x] Implement POST /scores/update
- [x] Implement GET /leaderboards/:id/top
- [x] Implement GET /leaderboards/:id/rank/:user
- [x] Implement optional batch updates
- [x] Add event publishing: score.updated
- [x] Benchmark Redis operations

## Phase 4 — Leaderboards Service (Day 8–10)

- [x] Scaffold service
- [x] Create Postgres tables: leaderboards, seasons
- [x] Implement CRUD: create/update/delete leaderboard
- [x] Add season/TTL policies
- [x] Publish events: leaderboard.created, leaderboard.deleted

## Phase 5 — Worker & Event Bus (Day 10–13)

- [ ] Create Worker service
- [ ] Subscribe to NATS topics
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
