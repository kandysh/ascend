export declare class AscendSDK {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string, baseUrl?: string);
    updateScore(userId: string, leaderboardId: string, score: number): Promise<any>;
    getLeaderboardTop(leaderboardId: string, limit?: number): Promise<any>;
    getUserRank(leaderboardId: string, userId: string): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map