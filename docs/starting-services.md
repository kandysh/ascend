# Quick Reference - Starting Services

## The Solution

All services manually load `.env` from project root using `__dirname`:

```typescript
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get directory of current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (3 levels up from src/index.ts)
config({ path: resolve(__dirname, '../../../.env') });
```

This works regardless of where the service is started because it uses the module's location, not the current working directory.

## Starting Services

### From Project Root (Recommended)

```bash
pnpm service:auth      # Auth service
pnpm service:gateway   # Gateway
```

### From Service Directory (Also Works)

```bash
cd apps/auth-service
pnpm dev

cd apps/gateway
pnpm dev
```

Both methods work correctly!

## Complete Startup Sequence

```bash
# Terminal 1: Infrastructure
pnpm infra:start

# Terminal 2: Database
pnpm db:migrate

# Terminal 3: Auth Service
pnpm service:auth

# Terminal 4: Gateway
pnpm service:gateway
```

## How It Works

### The Problem with `process.cwd()`
```typescript
// ❌ This breaks when starting from different directories
config({ path: resolve(process.cwd(), '.env') });
```

### The Solution with `__dirname`
```typescript
// ✅ Always resolves relative to the module file
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
```

**Why it works:**
- `__dirname` is relative to the source file location
- `../../../` goes from `apps/auth-service/src/` → project root
- Works whether you run from project root or service directory

## Adding New Services

1. Add `dotenv` dependency:
   ```json
   "dependencies": {
     "dotenv": "^16.4.7"
   }
   ```

2. Add to `src/index.ts` (before any imports that need env vars):
   ```typescript
   import { config } from 'dotenv';
   import { resolve, dirname } from 'path';
   import { fileURLToPath } from 'url';
   
   const __filename = fileURLToPath(import.meta.url);
   const __dirname = dirname(__filename);
   
   // Adjust path based on service depth
   config({ path: resolve(__dirname, '../../../.env') });
   ```

3. Configure @fastify/env:
   ```typescript
   await fastify.register(env, {
     schema: envSchema,
     dotenv: false, // We loaded manually above
   });
   ```

4. Add npm script:
   ```json
   "service:myservice": "pnpm run --filter @ascend/myservice dev"
   ```

## Why This Approach?

✅ **Works Everywhere** - Same code works from any directory
✅ **No CWD Dependency** - Uses module location, not working directory
✅ **ESM Compatible** - Works with ES modules (no magic `__dirname`)
✅ **Explicit** - Clear where env file is loaded from
✅ **Reliable** - No surprises based on where you run the command
