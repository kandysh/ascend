import { LeaderboardCreatedEvent } from '@ascend/nats-client';

export async function leaderboardCreatedHandler(
  data: LeaderboardCreatedEvent,
): Promise<void> {
  try {
    console.log(`✓ Leaderboard created: ${data.name} (${data.leaderboardId})`);

    // Future: Initialize leaderboard-specific resources
    // - Create Redis keys if needed
    // - Set up monitoring
    // - Initialize analytics
  } catch (error) {
    console.error('Error handling leaderboard created:', error);
    throw error;
  }
}
