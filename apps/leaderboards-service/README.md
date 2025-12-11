# Leaderboards Service

Control plane for managing leaderboard configurations and seasons.

## Features

- **Leaderboard CRUD** - Create, read, update, delete leaderboards
- **Season Management** - Create and manage seasonal leaderboards
- **TTL Policies** - Configure time-to-live for leaderboard data
- **Reset Schedules** - Configure automatic leaderboard resets
- **Update Modes** - Support for replace, increment, and best score modes
- **Event Publishing** - Emits leaderboard lifecycle events
- **Internal Auth** - Secured via X-Internal-Secret header

## Endpoints

### Leaderboards

#### POST /leaderboards

Create a new leaderboard.

```json
{
  "name": "Global Leaderboard",
  "description": "Main competitive leaderboard",
  "sortOrder": "desc",
  "updateMode": "best",
  "resetSchedule": "0 0 * * 0",
  "ttlDays": 30
}
```

**Update Modes:**

- `replace` - Always replace the score
- `increment` - Add to existing score
- `best` - Keep the best score (highest for desc, lowest for asc)

#### GET /leaderboards

List all leaderboards for the current project.

#### GET /leaderboards/:id

Get a specific leaderboard by ID.

#### PUT /leaderboards/:id

Update a leaderboard configuration.

```json
{
  "name": "Updated Name",
  "description": "New description",
  "isActive": true,
  "ttlDays": 60
}
```

#### DELETE /leaderboards/:id

Delete a leaderboard (cascades to seasons).

### Seasons

#### POST /seasons

Create a new season for a leaderboard.

```json
{
  "leaderboardId": "uuid",
  "name": "Season 1",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-03-31T23:59:59Z"
}
```

#### GET /seasons/leaderboard/:leaderboardId

List all seasons for a specific leaderboard.

#### GET /seasons/:id

Get a specific season by ID.

#### PATCH /seasons/:id/activate

Activate or deactivate a season.

```json
{
  "isActive": false
}
```

#### DELETE /seasons/:id

Delete a season.

## Database Schema

### Leaderboards Table

- `id` - UUID primary key
- `projectId` - Foreign key to projects
- `name` - Leaderboard name
- `description` - Optional description
- `sortOrder` - asc or desc (default: desc)
- `updateMode` - replace, increment, or best (default: best)
- `resetSchedule` - Cron expression for automatic resets
- `ttlDays` - Time-to-live in days
- `isActive` - Active status
- `metadata` - JSON metadata
- `createdAt` - Timestamp
- `updatedAt` - Timestamp

### Seasons Table

- `id` - UUID primary key
- `leaderboardId` - Foreign key to leaderboards
- `name` - Season name
- `startDate` - Season start date
- `endDate` - Season end date
- `isActive` - Active status
- `metadata` - JSON metadata
- `createdAt` - Timestamp

## Events Published

- `leaderboard.created` - When a new leaderboard is created
- `leaderboard.deleted` - When a leaderboard is deleted

## Running

```bash
pnpm install
pnpm dev  # Port 3003
```

## Environment Variables

- `PORT` - Server port (default: 3003)
- `DATABASE_URL` - PostgreSQL connection URL
- `INTERNAL_API_SECRET` - Internal service authentication secret

## Example Usage

```bash
# Create a leaderboard
curl -X POST http://localhost:3003/leaderboards \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -H "X-Project-Id: project-uuid" \
  -d '{
    "name": "Weekly High Scores",
    "sortOrder": "desc",
    "updateMode": "best",
    "ttlDays": 7
  }'

# Create a season
curl -X POST http://localhost:3003/seasons \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -H "X-Project-Id: project-uuid" \
  -d '{
    "leaderboardId": "leaderboard-uuid",
    "name": "Summer 2024",
    "startDate": "2024-06-01T00:00:00Z",
    "endDate": "2024-08-31T23:59:59Z"
  }'
```
