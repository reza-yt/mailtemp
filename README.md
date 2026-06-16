# TempMail - mailtemp.web.id

Temporary email service using Cloudflare Workers + D1.

## Architecture

- **worker-email**: Receives incoming emails via Cloudflare Email Routing
- **worker-api**: REST API for frontend (generate email, fetch inbox)
- **frontend**: Static HTML (deploy to Cloudflare Pages)

## Setup

### 1. Create D1 Database

```bash
wrangler d1 create mailtemp-db
```

Copy the `database_id` from the output and paste it into:
- `worker-email/wrangler.toml`
- `worker-api/wrangler.toml`

Then create the table:

```bash
wrangler d1 execute mailtemp-db --command="CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, address TEXT NOT NULL, sender TEXT NOT NULL, subject TEXT DEFAULT 'No Subject', body TEXT DEFAULT '', html TEXT DEFAULT '', received_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_address ON emails(address); CREATE INDEX IF NOT EXISTS idx_received_at ON emails(received_at);"
```

### 2. Deploy Email Worker

```bash
cd worker-email
wrangler deploy
```

### 3. Deploy API Worker

```bash
cd worker-api
wrangler deploy
```

### 4. Configure Email Routing

In Cloudflare Dashboard:
1. Go to Email > Email Routing
2. Set catch-all rule to "Send to Worker" > select "mailtemp"

### 5. Deploy Frontend

```bash
cd frontend
wrangler pages deploy . --project-name=mailtemp-frontend
```

## API Endpoints

- `GET /api/generate` - Generate random email address
- `GET /api/inbox/:address` - Get inbox for an address
- `GET /api/email/:id` - Get single email detail
- `DELETE /api/email/:id` - Delete an email
