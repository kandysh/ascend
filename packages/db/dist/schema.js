import { pgTable, text, timestamp, uuid, integer, boolean, decimal, pgEnum, } from 'drizzle-orm/pg-core';
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
export const scoreEvents = pgTable('score_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    projectId: uuid('project_id')
        .notNull()
        .references(() => projects.id, { onDelete: 'cascade' }),
    leaderboardId: text('leaderboard_id').notNull(),
    userId: text('user_id').notNull(),
    score: integer('score').notNull(),
    increment: boolean('increment').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Billing enums and tables
export const planTypeEnum = pgEnum('plan_type', ['free', 'pro', 'enterprise']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
    'active',
    'cancelled',
    'past_due',
]);
export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
        .notNull()
        .references(() => tenants.id, { onDelete: 'cascade' }),
    planType: planTypeEnum('plan_type').notNull().default('free'),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const usageRecords = pgTable('usage_records', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
        .notNull()
        .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
        .notNull()
        .references(() => projects.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull(),
    scoreUpdates: integer('score_updates').notNull().default(0),
    leaderboardReads: integer('leaderboard_reads').notNull().default(0),
    totalRequests: integer('total_requests').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const invoices = pgTable('invoices', {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
        .notNull()
        .references(() => tenants.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
        .notNull()
        .references(() => subscriptions.id),
    invoiceNumber: text('invoice_number').notNull().unique(),
    status: text('status').notNull().default('draft'),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    dueDate: timestamp('due_date').notNull(),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
