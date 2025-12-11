# Scores Service

Real-time leaderboard score management service for Ascend.

## Features

- **Score Updates** - Submit individual or batch score updates
- **Top N Queries** - Fetch top players from leaderboards
- **Rank Lookups** - Get player rank and neighbors
- **Redis-backed** - Ultra-fast leaderboard operations using Redis ZSETs
- **Event Publishing** - Emits score.updated events for async processing
- **Internal Auth** - Secured via X-Internal-Secret header

## Endpoints

### POST /scores/update

Update a single user's score on a leaderboard.

```json
{
  "leaderboardId": "global",
  "userId": "user123",
  "score": 1000,
  "increment": false
}
```

### POST /scores/batch-update

Update multiple scores in a single operation.

```json
{
  "updates": [
    { "leaderboardId": "global", "userId": "user1", "score": 100 },
    { "leaderboardId": "global", "userId": "user2", "score": 200 }
  ]
}
```

### GET /leaderboards/:id/top

Get top N entries from a leaderboard.

Query params:

- `limit` (default: 10, max: 100)
- `offset` (default: 0)

### GET /leaderboards/:id/rank/:userId

Get a user's rank and score.

Query params:

- `withNeighbors` (boolean): Include surrounding players
- `neighborCount` (default: 2): Number of neighbors above/below

## Redis Key Format

```
l:{tenantId}:{projectId}:{leaderboardId}
```

## Running

```bash
pnpm install
pnpm dev  # Port 3002
```

## Environment Variables

- `PORT` - Server port (default: 3002)
- `REDIS_URL` - Redis connection URL
- `INTERNAL_API_SECRET` - Internal service authentication secret
