import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
let dbClient = null;
export function createDbClient(connectionString) {
    if (dbClient) {
        return dbClient;
    }
    const queryClient = postgres(connectionString ||
        process.env.DATABASE_URL ||
        'postgres://localhost:5432/ascend');
    dbClient = drizzle(queryClient, { schema });
    return dbClient;
}
export function getDbClient() {
    if (!dbClient) {
        throw new Error('Database client not initialized. Call createDbClient first.');
    }
    return dbClient;
}
export * from './schema.js';
export { sql, eq, and, or, desc, asc } from 'drizzle-orm';
