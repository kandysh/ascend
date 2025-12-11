import { pgTable, text, timestamp, uuid, integer, boolean, } from 'drizzle-orm/pg-core';
export const tenants = pgTable('tenants', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const projects = pgTable('projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
        .notNull()
        .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const apiKeys = pgTable('api_keys', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
        .notNull()
        .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),
});
export const leaderboards = pgTable('leaderboards', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
        .notNull()
        .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    sortOrder: text('sort_order', { enum: ['asc', 'desc'] })
        .notNull()
        .default('desc'),
    updateMode: text('update_mode', { enum: ['replace', 'increment', 'best'] })
        .notNull()
        .default('best'),
    resetSchedule: text('reset_schedule'),
    ttlDays: integer('ttl_days'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const seasons = pgTable('seasons', {
    id: uuid('id').primaryKey().defaultRandom(),
    leaderboardId: uuid('leaderboard_id')
        .notNull()
        .references(() => leaderboards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
