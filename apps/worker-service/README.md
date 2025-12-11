# Worker Service

Background worker for async processing of events via NATS.

## Features

- **Event Processing** - Subscribes to NATS events
- **Score Event Persistence** - Saves score events to Postgres
- **Leaderboard Lifecycle** - Handles leaderboard creation/deletion
- **Usage Tracking** - Counts operations for billing
- **Daily Snapshots** - Periodic leaderboard snapshots
- **Fraud Detection** - Identifies suspicious patterns

## Events Subscribed

### score.updated

Persists score updates to the database for:

- Historical analytics
- Replay capability
- Fraud detection
- Usage tracking

### leaderboard.created

Handles new leaderboard setup:

- Initialize resources
- Set up monitoring
- Configure analytics

### leaderboard.deleted

Cleanup when leaderboard is removed:

- Archive data
- Remove Redis keys
- Clean up analytics

## Architecture

```
NATS Event Bus
    ↓
Worker Service
    ├─ score.updated → Postgres (score_events)
    ├─ leaderboard.created → Setup tasks
    └─ leaderboard.deleted → Cleanup tasks
```

## Running

```bash
pnpm install
pnpm dev  # No HTTP server, just background worker
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection URL
- `NATS_URL` - NATS server URL (default: nats://localhost:4222)

## Future Enhancements

Phase 5 roadmap items to implement:

- [ ] Daily snapshots of leaderboards
- [ ] Usage counters for billing
- [ ] Fraud detection rules
- [ ] TTL eviction for expired data
