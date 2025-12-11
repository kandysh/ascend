import { LeaderboardCreatedEvent } from '@ascend/nats-client';
import { getRedisClient } from '@ascend/redis-client';

export async function leaderboardCreatedHandler(
  data: LeaderboardCreatedEvent,
): Promise<void> {
  try {
    console.log(`Leaderboard created: ${data.name} (${data.leaderboardId})`);

    const redis = getRedisClient();

    // Initialize Redis metadata key for the leaderboard
    const metadataKey = `l:meta:${data.tenantId}:${data.projectId}:${data.leaderboardId}`;

    await redis.hset(metadataKey, {
      name: data.name,
      projectId: data.projectId,
      tenantId: data.tenantId,
      createdAt: data.timestamp,
      ttlDays: data.ttlDays?.toString() || '0',
    });

    // NOTE: Metadata does NOT expire - only score data expires
    // This ensures TTL config is always available for new score submissions

    console.log(
      `Initialized Redis metadata for leaderboard ${data.leaderboardId}${data.ttlDays ? ` with ${data.ttlDays} day TTL on scores` : ''}`,
    );
  } catch (error) {
    console.error('Error handling leaderboard created:', error);
    throw error;
  }
}
