# Auth Service

The Auth/Tenant service manages authentication, tenants, projects, and API keys.

## Features

- **Tenant Management**: Create and manage tenants
- **Project Management**: Create projects under tenants
- **API Key Management**: Generate, rotate, and revoke API keys
- **API Key Validation**: Validate API keys for the gateway

## API Endpoints

### Health Check

- `GET /health` - Service health check

### Tenants

- `POST /tenants` - Create a new tenant
- `GET /tenants/:id` - Get tenant by ID
- `GET /tenants` - List all tenants

### Projects

- `POST /projects` - Create a new project
- `GET /projects/:id` - Get project by ID
- `GET /projects/tenant/:tenantId` - List projects for a tenant

### API Keys

- `POST /api-keys` - Create a new API key
- `POST /api-keys/:id/rotate` - Rotate an API key (revokes old, creates new)
- `DELETE /api-keys/:id` - Revoke an API key
- `GET /api-keys/project/:projectId` - List API keys for a project

### Validation

- `POST /validate` - Validate an API key and return tenant/project context

## Environment Variables

```env
PORT=3001
DATABASE_URL=postgres://localhost:5432/ascend
```

## Usage

```bash
# Development
pnpm run dev

# Build
pnpm run build

# Production
pnpm start
```

## Example: Creating an API Key

```bash
# 1. Create a tenant
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "email": "admin@acme.com"}'

# 2. Create a project
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "<tenant-id>", "name": "Game Server"}'

# 3. Create an API key
curl -X POST http://localhost:3001/api-keys \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<project-id>", "name": "Production Key"}'

# 4. Validate the API key
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "ak_..."}'
```
