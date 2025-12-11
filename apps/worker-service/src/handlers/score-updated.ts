import { getDbClient } from '@ascend/db';
import { ScoreUpdatedEvent } from '@ascend/nats-client';

export async function scoreUpdatedHandler(
  data: ScoreUpdatedEvent,
): Promise<void> {
  const sql = getDbClient();

  try {
    // Persist score event to database
    await sql`
      INSERT INTO score_events (
        tenant_id, project_id, leaderboard_id, user_id, score, increment
      )
      VALUES (
        ${data.tenantId}, ${data.projectId}, ${data.leaderboardId}, 
        ${data.userId}, ${data.score}, ${data.increment}
      )
    `;

    console.log(
      `✓ Persisted score event: ${data.userId} scored ${data.score} on ${data.leaderboardId}`,
    );
  } catch (error) {
    console.error('Error persisting score event:', error);
    throw error;
  }
}
