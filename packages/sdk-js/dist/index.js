export class AscendSDK {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl = 'http://localhost:3000') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    async updateScore(userId, leaderboardId, score) {
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
    async getLeaderboardTop(leaderboardId, limit = 10) {
        const response = await fetch(`${this.baseUrl}/leaderboards/${leaderboardId}/top?limit=${limit}`, {
            headers: {
                'X-Api-Key': this.apiKey,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
        }
        return response.json();
    }
    async getUserRank(leaderboardId, userId) {
        const response = await fetch(`${this.baseUrl}/leaderboards/${leaderboardId}/rank/${userId}`, {
            headers: {
                'X-Api-Key': this.apiKey,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch user rank: ${response.statusText}`);
        }
        return response.json();
    }
}
