system:
  components:
    api: Express
    leaderboard: Redis ZSET
    database: PostgreSQL
    observability: OpenTelemetry
  flow:
    - Frontend Dashboard -> Express API
    - External Clients -> Express API
    - Express API -> Redis
    - Express API -> PostgreSQL
    - Express API -> OTEL Collector

multi_tenancy:
  auth:
    type: api_key
    header: X-Api-Key
    storage:
      hashed: true
      db: PostgreSQL
  redis_namespace: "l:{tenant}:{project}:{leaderboard}"

leaderboards:
  storage:
    realtime: Redis
    durable: PostgreSQL
  redis_operations:
    - ZINCRBY
    - ZRANGE
    - ZREVRANK
    - ZMSCORE

api:
  base: /v1
  endpoints:
    scores_update: POST /scores/update
    leaderboard_top: GET /leaderboards/{id}/top
    leaderboard_rank: GET /leaderboards/{id}/rank/{user}
    leaderboard_create: POST /leaderboards
    leaderboard_delete: DELETE /leaderboards/{id}
    usage: GET /usage

performance:
  hot_path: Redis_only
  target_latency_ms: 10

observability:
  collector: OTEL Collector
  backends:
    metrics: Prometheus
    logs: Loki
    traces: Tempo
  ui: Grafana

billing:
  plans:
    free:
      ops_per_month: 100000
    hobby:
      ops_per_month: 2000000
    pro:
      ops_per_month: 20000000
    enterprise:
      ops_per_month: unlimited

rate_limits:
  free: 30
  hobby: 100
  pro: 300

frontend:
  framework: Next.js
  styling:
    - Tailwind
    - shadcn
  theme: dark

repo_structure:
  apps:
    - api
    - dashboard
    - collector
  packages:
    - types
    - sdk-js
    - eslint-config
  infra:
    - docker-compose.yml
    - grafana
  docs:
    - blueprints.md
