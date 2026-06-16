# TempMail - mailtemp.web.id

Temporary email service powered by Cloudflare Workers + D1.

## Features

- Generate random or custom email addresses
- Real-time inbox with auto-refresh
- Auto-extract verification/OTP codes
- API key authentication for programmatic access
- Auto-delete emails after 1 hour
- Beautiful dark UI with animations

## Architecture

- **worker-email**: Receives incoming emails via Cloudflare Email Routing
- **worker-api**: REST API (generate email, fetch inbox, extract codes, API keys)
- **frontend**: Static HTML + JS (deploy to Cloudflare Pages)

## Setup

### 1. Create D1 Database

```bash
wrangler d1 create mailtemp-db
```

Copy the `database_id` and update both `wrangler.toml` files.

### 2. Create Tables

```bash
wrangler d1 execute mailtemp-db --remote --command="CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, address TEXT NOT NULL, sender TEXT NOT NULL, subject TEXT DEFAULT 'No Subject', body TEXT DEFAULT '', html TEXT DEFAULT '', received_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_address ON emails(address); CREATE INDEX IF NOT EXISTS idx_received_at ON emails(received_at); CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_used INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_key_hash ON api_keys(key_hash);"
```

### 3. Deploy Workers

```bash
cd worker-email && wrangler deploy && cd ..
cd worker-api && wrangler deploy && cd ..
```

### 4. Deploy Frontend

```bash
cd frontend && wrangler pages deploy . --project-name=mailtemp-web && cd ..
```

### 5. Configure Email Routing

In Cloudflare Dashboard:
1. Go to Email > Email Routing
2. Set catch-all rule to "Send to Worker" > select "mailtemp"

### 6. Custom Domain (Optional)

In Cloudflare Dashboard:
1. Workers & Pages > mailtemp-web > Custom Domains
2. Add `mailtemp.web.id`

## API Endpoints

### Public (no auth)
- `GET /api/generate` - Generate random email
- `GET /api/generate?username=xxx` - Generate custom email
- `GET /api/inbox/:address` - Get inbox
- `GET /api/email/:id` - Read email
- `DELETE /api/email/:id` - Delete email
- `GET /api/extract-code/:address` - Extract verification codes

### Protected (API key required)
- `POST /api/key/generate` - Generate API key
- `GET /api/key/verify` - Verify API key
- `GET /api/v1/generate` - Generate email
- `POST /api/v1/generate` - Generate with custom username
- `GET /api/v1/inbox/:address` - Get inbox
- `GET /api/v1/extract-code/:address` - Extract codes
- `GET /api/v1/wait-code/:address` - Wait for verification code

## License

MIT
