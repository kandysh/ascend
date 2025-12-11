import { LeaderboardDeletedEvent } from '@ascend/nats-client';

export async function leaderboardDeletedHandler(
  data: LeaderboardDeletedEvent,
): Promise<void> {
  try {
    console.log(`✓ Leaderboard deleted: ${data.name} (${data.leaderboardId})`);

    // Future: Cleanup leaderboard resources
    // - Delete Redis keys
    // - Archive historical data
    // - Clean up analytics
  } catch (error) {
    console.error('Error handling leaderboard deleted:', error);
    throw error;
  }
}
