import postgres from 'postgres';
export declare function createDbClient(connectionString?: string): postgres.Sql<{}>;
export declare function getDbClient(): postgres.Sql<{}>;
export declare function closeDbClient(): Promise<void>;
export * from './schema.js';
//# sourceMappingURL=index.d.ts.map