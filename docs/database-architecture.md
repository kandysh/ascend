# Database Architecture

## Separation of Concerns

The database layer is split into two complementary tools:

### Drizzle Kit (Schema & Migrations)

- **Purpose**: Schema definition and migration management
- **Used for**:
  - Defining database schema with type-safe TypeScript
  - Generating SQL migrations
  - Running migrations
  - Schema introspection and diffing

### postgres.js (Query Execution)

- **Purpose**: Direct database operations
- **Used for**:
  - All runtime queries (INSERT, SELECT, UPDATE, DELETE)
  - Connection pooling
  - Transaction management
  - Raw SQL with parameter interpolation

## Why This Approach?

1. **Simplicity**: Use SQL directly instead of learning query builder API
2. **Performance**: No ORM overhead, direct postgres.js queries
3. **Flexibility**: Full SQL power when needed
4. **Type Safety**: Drizzle schema provides TypeScript types
5. **Best of Both**: Type-safe schema + raw SQL queries

## Package Structure

```
packages/db/
├── src/
│   ├── schema.ts       # Drizzle schema definitions (types only)
│   ├── index.ts        # postgres.js client factory
│   └── migrate.ts      # Migration runner
├── drizzle/            # Generated SQL migrations
└── drizzle.config.ts   # Drizzle Kit configuration
```

## Usage Examples

### Schema Definition (Drizzle)

```typescript
// packages/db/src/schema.ts
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  // ...
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
```

### Queries (postgres.js)

```typescript
// In your route handlers
const sql = getDbClient();

// Insert
const [tenant] = await sql`
  INSERT INTO tenants (name, email)
  VALUES (${name}, ${email})
  RETURNING *
`;

// Select
const tenants = await sql`
  SELECT * FROM tenants
`;

// Update
await sql`
  UPDATE api_keys
  SET revoked_at = NOW()
  WHERE id = ${id}
`;

// Join
const keys = await sql`
  SELECT 
    ak.*,
    p.tenant_id
  FROM api_keys ak
  INNER JOIN projects p ON ak.project_id = p.id
`;
```

### Migrations

```bash
# Generate migration from schema changes
pnpm db:generate

# Run pending migrations
pnpm db:migrate

# Open Drizzle Studio (GUI)
pnpm db:studio
```

## Benefits

- **Clear separation**: Schema management vs. query execution
- **Type safety**: Drizzle types without query builder
- **Performance**: Direct postgres.js queries
- **SQL knowledge**: Leverage existing SQL skills
- **Maintainability**: Standard SQL is easier to read/debug
- **Flexibility**: Can use advanced SQL features without limitations
