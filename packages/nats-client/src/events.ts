// Event types for NATS messaging

export interface ScoreUpdatedEvent {
  tenantId: string;
  projectId: string;
  leaderboardId: string;
  userId: string;
  score: number;
  increment: boolean;
  timestamp: string;
}

export interface LeaderboardCreatedEvent {
  type: string;
  leaderboardId: string;
  projectId: string;
  tenantId: string;
  name: string;
  sortOrder: 'asc' | 'desc';
  updateMode: 'replace' | 'increment' | 'best';
  ttlDays?: number;
  timestamp: string;
}

export interface LeaderboardDeletedEvent {
  type: string;
  leaderboardId: string;
  projectId: string;
  tenantId: string;
  name: string;
  timestamp: string;
}

// Event subjects (topics)
export const EventSubjects = {
  SCORE_UPDATED: 'score.updated',
  LEADERBOARD_CREATED: 'leaderboard.created',
  LEADERBOARD_DELETED: 'leaderboard.deleted',
} as const;

export type EventSubject = (typeof EventSubjects)[keyof typeof EventSubjects];
