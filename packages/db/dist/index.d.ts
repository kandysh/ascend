import postgres from 'postgres';
export declare function createDbClient(connectionString?: string): import("drizzle-orm/postgres-js").PostgresJsDatabase<Record<string, unknown>> & {
    $client: postgres.Sql<{}>;
};
export declare function getDbClient(): import("drizzle-orm/postgres-js").PostgresJsDatabase<Record<string, unknown>> & {
    $client: postgres.Sql<{}>;
};
export * from './schema.js';
export { sql, eq, and, or, desc, asc } from 'drizzle-orm';
//# sourceMappingURL=index.d.ts.map