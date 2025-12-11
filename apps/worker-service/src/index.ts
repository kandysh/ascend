import { createDbClient } from '@ascend/db';
import {
  createNatsClient,
  subscribeToEvents,
  EventSubjects,
  ScoreUpdatedEvent,
  LeaderboardCreatedEvent,
  LeaderboardDeletedEvent,
} from '@ascend/nats-client';
import { scoreUpdatedHandler } from './handlers/score-updated.js';
import { leaderboardCreatedHandler } from './handlers/leaderboard-created.js';
import { leaderboardDeletedHandler } from './handlers/leaderboard-deleted.js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

if (process.env.NODE_ENV !== 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: resolve(__dirname, '../../../.env') });
}

async function start() {
  console.log('Starting Worker Service...');

  try {
    // Initialize connections
    const databaseUrl =
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/ascend';
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';

    createDbClient(databaseUrl);
    await createNatsClient(natsUrl);

    console.log('Database and NATS connected');

    // Subscribe to events
    await subscribeToEvents<ScoreUpdatedEvent>(
      EventSubjects.SCORE_UPDATED,
      scoreUpdatedHandler,
    );
    await subscribeToEvents<LeaderboardCreatedEvent>(
      EventSubjects.LEADERBOARD_CREATED,
      leaderboardCreatedHandler,
    );
    await subscribeToEvents<LeaderboardDeletedEvent>(
      EventSubjects.LEADERBOARD_DELETED,
      leaderboardDeletedHandler,
    );

    console.log('Subscribed to events:');
    console.log(`   - ${EventSubjects.SCORE_UPDATED}`);
    console.log(`   - ${EventSubjects.LEADERBOARD_CREATED}`);
    console.log(`   - ${EventSubjects.LEADERBOARD_DELETED}`);

    console.log('Worker service is running...');
  } catch (error) {
    console.error('Failed to start worker service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down worker service...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down worker service...');
  process.exit(0);
});

start();
