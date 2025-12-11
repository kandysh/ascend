export declare class AscendSDK {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string, baseUrl?: string);
    updateScore(userId: string, leaderboardId: string, score: number): Promise<Response>;
    getLeaderboardTop(leaderboardId: string, limit?: number): Promise<Response>;
    getUserRank(leaderboardId: string, userId: string): Promise<Response>;
}
//# sourceMappingURL=index.d.ts.map