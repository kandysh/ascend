import { LeaderboardDeletedEvent } from '@ascend/nats-client';
import { getRedisClient } from '@ascend/redis-client';

export async function leaderboardDeletedHandler(
  data: LeaderboardDeletedEvent,
): Promise<void> {
  try {
    console.log(`Leaderboard deleted: ${data.name} (${data.leaderboardId})`);

    const redis = getRedisClient();

    // Construct the exact Redis keys for this leaderboard
    const scoreKey = `l:${data.tenantId}:${data.projectId}:${data.leaderboardId}`;
    const metadataKey = `l:meta:${data.tenantId}:${data.projectId}:${data.leaderboardId}`;

    // Delete both keys
    const deleted = await redis.del(scoreKey, metadataKey);

    if (deleted > 0) {
      console.log(
        `Deleted ${deleted} Redis key(s) for leaderboard ${data.leaderboardId}`,
      );
    } else {
      console.log(
        `No Redis keys found for leaderboard ${data.leaderboardId} (may not have had any scores)`,
      );
    }

    console.log(`Cleaned up Redis data for leaderboard ${data.leaderboardId}`);
  } catch (error) {
    console.error('Error handling leaderboard deleted:', error);
    throw error;
  }
}
