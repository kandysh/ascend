/**
 * @fileoverview Database migration script for PostgreSQL schema
 * @module db/migrate
 */

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/ascend';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * SQL migrations to run in order
 * @type {Array<{name: string, sql: string}>}
 */
const migrations = [
  {
    name: '001_create_tenants',
    sql: `
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        plan VARCHAR(50) NOT NULL DEFAULT 'free',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
      CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
    `,
  },
  {
    name: '002_create_projects',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id);
    `,
  },
  {
    name: '003_create_api_keys',
    sql: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        key_prefix VARCHAR(12) NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
    `,
  },
  {
    name: '004_create_leaderboards',
    sql: `
      CREATE TABLE IF NOT EXISTS leaderboards (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        sort_order VARCHAR(10) NOT NULL DEFAULT 'desc',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, project_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_leaderboards_tenant_id ON leaderboards(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_leaderboards_project_id ON leaderboards(project_id);
    `,
  },
  {
    name: '005_create_score_events',
    sql: `
      CREATE TABLE IF NOT EXISTS score_events (
        id BIGSERIAL PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        leaderboard_id VARCHAR(36) NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        score DOUBLE PRECISION NOT NULL,
        delta DOUBLE PRECISION,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_score_events_tenant_id ON score_events(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_score_events_leaderboard_id ON score_events(leaderboard_id);
      CREATE INDEX IF NOT EXISTS idx_score_events_user_id ON score_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_score_events_created_at ON score_events(created_at);
    `,
  },
  {
    name: '006_create_usage',
    sql: `
      CREATE TABLE IF NOT EXISTS usage (
        id BIGSERIAL PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        month VARCHAR(7) NOT NULL,
        operation_count BIGINT NOT NULL DEFAULT 0,
        read_count BIGINT NOT NULL DEFAULT 0,
        write_count BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, month)
      );

      CREATE INDEX IF NOT EXISTS idx_usage_tenant_month ON usage(tenant_id, month);
    `,
  },
  {
    name: '007_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: '008_create_updated_at_trigger',
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
      CREATE TRIGGER update_tenants_updated_at
        BEFORE UPDATE ON tenants
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
      CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_leaderboards_updated_at ON leaderboards;
      CREATE TRIGGER update_leaderboards_updated_at
        BEFORE UPDATE ON leaderboards
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_usage_updated_at ON usage;
      CREATE TRIGGER update_usage_updated_at
        BEFORE UPDATE ON usage
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `,
  },
];

/**
 * Check if a migration has been executed
 * @param {string} name - Migration name
 * @returns {Promise<boolean>}
 */
async function isMigrationExecuted(name) {
  try {
    const result = await pool.query(
      'SELECT 1 FROM migrations WHERE name = $1',
      [name]
    );
    return result.rows.length > 0;
  } catch {
    // migrations table doesn't exist yet
    return false;
  }
}

/**
 * Record a migration as executed
 * @param {string} name - Migration name
 */
async function recordMigration(name) {
  await pool.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
}

/**
 * Run all pending migrations
 */
async function migrate() {
  console.log('🚀 Starting database migration...\n');

  try {
    // First, ensure migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    for (const migration of migrations) {
      const executed = await isMigrationExecuted(migration.name);

      if (executed) {
        console.log(`⏭️  Skipping ${migration.name} (already executed)`);
        continue;
      }

      console.log(`📦 Running migration: ${migration.name}`);

      try {
        await pool.query(migration.sql);
        await recordMigration(migration.name);
        console.log(`✅ Migration ${migration.name} completed\n`);
      } catch (err) {
        console.error(`❌ Migration ${migration.name} failed:`, err.message);
        throw err;
      }
    }

    console.log('\n✨ All migrations completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Seed the database with sample data for development
 */
async function seed() {
  console.log('\n🌱 Seeding database with sample data...\n');

  try {
    // Create a sample tenant
    const tenantResult = await pool.query(
      `INSERT INTO tenants (id, name, email, plan)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['demo-tenant-001', 'Demo Company', 'demo@example.com', 'hobby']
    );
    const tenantId = tenantResult.rows[0].id;
    console.log(`✅ Created tenant: ${tenantId}`);

    // Create a sample project
    const projectResult = await pool.query(
      `INSERT INTO projects (id, tenant_id, name, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, name) DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [
        'demo-project-001',
        tenantId,
        'Demo Game',
        'A demo gaming project for testing',
      ]
    );
    const projectId = projectResult.rows[0].id;
    console.log(`✅ Created project: ${projectId}`);

    // Create a sample API key (for demo purposes)
    const apiKey = `ask_demo_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 12);

    await pool.query(
      `INSERT INTO api_keys (id, tenant_id, project_id, key_hash, key_prefix, name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key_hash) DO NOTHING`,
      [
        'demo-apikey-001',
        tenantId,
        projectId,
        keyHash,
        keyPrefix,
        'Development Key',
      ]
    );
    console.log(`✅ Created API key: ${keyPrefix}...`);
    console.log(`   Full key (save this): ${apiKey}`);

    // Create sample leaderboards
    const leaderboards = [
      {
        id: 'demo-lb-001',
        name: 'global',
        description: 'Global high scores',
      },
      {
        id: 'demo-lb-002',
        name: 'weekly',
        description: 'Weekly competition',
      },
      {
        id: 'demo-lb-003',
        name: 'daily',
        description: 'Daily challenge',
      },
    ];

    for (const lb of leaderboards) {
      await pool.query(
        `INSERT INTO leaderboards (id, tenant_id, project_id, name, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, project_id, name) DO NOTHING`,
        [lb.id, tenantId, projectId, lb.name, lb.description]
      );
      console.log(`✅ Created leaderboard: ${lb.name}`);
    }

    console.log('\n✨ Database seeded successfully!');
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    throw err;
  }
}

// Run migrations
const args = process.argv.slice(2);

if (args.includes('--seed')) {
  migrate()
    .then(() => seed())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
