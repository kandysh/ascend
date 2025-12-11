export class AscendSDK {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async updateScore(
    userId: string,
    leaderboardId: string,
    score: number,
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/scores/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({ userId, leaderboardId, score }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update score: ${response.statusText}`);
    }

    return response.json();
  }

  async getLeaderboardTop(
    leaderboardId: string,
    limit: number = 10,
  ): Promise<Response> {
    const response = await fetch(
      `${this.baseUrl}/leaderboards/${leaderboardId}/top?limit=${limit}`,
      {
        headers: {
          'X-Api-Key': this.apiKey,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
    }

    return response.json();
  }

  async getUserRank(leaderboardId: string, userId: string): Promise<Response> {
    const response = await fetch(
      `${this.baseUrl}/leaderboards/${leaderboardId}/rank/${userId}`,
      {
        headers: {
          'X-Api-Key': this.apiKey,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch user rank: ${response.statusText}`);
    }

    return response.json();
  }
}
