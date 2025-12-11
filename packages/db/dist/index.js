import postgres from 'postgres';
let sql = null;
export function createDbClient(connectionString) {
    if (sql) {
        return sql;
    }
    sql = postgres(connectionString ||
        process.env.DATABASE_URL ||
        'postgres://localhost:5432/ascend', {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
    });
    return sql;
}
export function getDbClient() {
    if (!sql) {
        throw new Error('Database client not initialized. Call createDbClient first.');
    }
    return sql;
}
export async function closeDbClient() {
    if (sql) {
        await sql.end();
        sql = null;
    }
}
export * from './schema.js';
