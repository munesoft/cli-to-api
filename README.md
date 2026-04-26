# @munesoft/cli-to-api

> **Turn any CLI into a REST API in under 2 minutes.**

[![npm version](https://img.shields.io/npm/v/@munesoft/cli-to-api.svg)](https://www.npmjs.com/package/@munesoft/cli-to-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`@munesoft/cli-to-api` is the "Zapier for CLI tools (developer edition)." Define a JSON config, run one command, and every CLI tool on your machine becomes an HTTP endpoint with authentication, rate limiting, Swagger docs, and injection protection — zero boilerplate.

---

## ⚡ Quickstart (2 minutes)

### 1. Install or use via npx

```bash
npm install -g @munesoft/cli-to-api
# or just use npx — no install needed
```

### 2. Generate a config

```bash
npx cli-to-api init
```

Follow the prompts, or skip to a manual config:

```json
{
  "routes": [
    {
      "route": "/stripe/customers",
      "command": "stripe customers list",
      "method": "GET",
      "params": ["limit"],
      "description": "List Stripe customers"
    }
  ],
  "server": { "port": 3000 }
}
```

### 3. Start the server

```bash
npx cli-to-api start config.json
```

### 4. Call it

```bash
curl "http://localhost:3000/stripe/customers?limit=10"
```

```json
{
  "success": true,
  "output": "...",
  "error": null,
  "exitCode": 0,
  "durationMs": 142,
  "requestId": "f3a1b2c4-..."
}
```

That's it. **Your CLI is now an API.**

---

## 📦 Features

| Feature | Details |
|---|---|
| 🗺 **Auto-routing** | JSON config → HTTP routes, zero code |
| 🔐 **API key auth** | `X-API-Key` header protection |
| 🛡 **Injection prevention** | Strict whitelist + character sanitization |
| ⏱ **Timeouts** | Per-route configurable, kills runaway processes |
| 🚦 **Rate limiting** | Configurable window + max requests |
| 📄 **OpenAPI/Swagger** | Auto-generated at `/docs` and `/openapi.json` |
| 📊 **Structured responses** | Always JSON with `success`, `output`, `exitCode` |
| 🔍 **Dry-run mode** | Preview command without executing |
| 🧹 **Clean logs** | Winston-based with request IDs |
| 📦 **Programmable** | Full TypeScript API for embedding |

---

## 🛠 CLI Reference

### `start`

```bash
npx cli-to-api start <config.json> [options]

Options:
  -p, --port <number>    Port to listen on (default: 3000)
  -H, --host <host>      Host to bind (default: 0.0.0.0)
  -k, --api-key <key>    Require API key (overrides config)
  --dry-run              Validate config, don't start server
```

### `init`

```bash
npx cli-to-api init [options]

Options:
  -o, --output <file>    Output path (default: cli-to-api.config.json)
```

Interactive wizard that generates a starter config.

### `validate`

```bash
npx cli-to-api validate <config.json>
```

Check a config file for errors without starting anything.

---

## ⚙️ Config Reference

```json
{
  "routes": [
    {
      "route": "/my/endpoint",       // Required. Must start with /
      "command": "mycli subcommand", // Required. Base command (no user input here)
      "method": "GET",               // GET | POST | PUT | DELETE | PATCH
      "params": ["limit", "format"], // Allowed query/body params → CLI flags
      "description": "What it does", // Shows in Swagger docs
      "timeout": 30000,              // ms. Default: 30000. Max: 300000
      "flagStyle": "double",         // "double" (--flag) or "single" (-flag)
      "parseOutputAsJson": true,     // Try to parse stdout as JSON
      "tags": ["analytics"],         // OpenAPI tag grouping
      "env": { "MY_VAR": "value" }  // Extra env vars for this command
    }
  ],
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "basePath": "/api/v1"           // Optional prefix for all routes
  },
  "security": {
    "apiKey": "your-secret-key",    // Require X-API-Key header
    "rateLimitWindowMs": 60000,     // Rate limit window (default: 60s)
    "rateLimitMax": 60              // Max requests per window (default: 60)
  },
  "logging": {
    "level": "info",                // error | warn | info | debug
    "requests": true                // Log HTTP requests
  }
}
```

---

## 🔐 Security Model

Security is non-negotiable. Here's exactly what protects you:

### 1. Command Whitelisting
User input **never** modifies the *command* — only the *arguments*. The command is locked in your config. A request can only pass values for params you've explicitly listed in `params`.

### 2. `spawn()` — Never `exec()`
All commands run via Node's `child_process.spawn()` with `shell: false`. Arguments are passed as a discrete array — **the shell never sees them as a string**, so `;`, `&&`, `|`, `$()`, backticks etc. are completely inert.

```
# What the OS sees (safe):
execvp("stripe", ["customers", "list", "--limit", "10"])

# What exec() would do (dangerous — never used):
sh -c "stripe customers list --limit 10; rm -rf /"
```

### 3. Input Sanitization
Every param value is validated against a strict allowlist regex before reaching `spawn()`. Characters blocked include: `; & | \` $ < > \\ ( ) \n \r \t { } [ ] ! #`

### 4. Timeout + Concurrency Limits
Each route can set a `timeout` (default 30s). Process is killed with `SIGTERM` on expiry. Max 20 concurrent executions enforced globally.

### 5. API Key Auth
Set `security.apiKey` in config or pass `--api-key` on startup. All routes (except `/health` and `/docs`) require the `X-API-Key` header.

### 6. Rate Limiting
Built-in rate limiting via `express-rate-limit`. Defaults to 60 requests/minute per IP.

---

## 🌍 Real-World Use Cases

### Wrap a Python script

```json
{
  "route": "/analyze/sentiment",
  "command": "python3 /opt/scripts/sentiment.py",
  "method": "POST",
  "params": ["text", "model"],
  "timeout": 60000,
  "parseOutputAsJson": true
}
```

```bash
curl -X POST http://localhost:3000/analyze/sentiment \
  -H "Content-Type: application/json" \
  -d '{"text": "This is amazing", "model": "fast"}'
```

### Expose an internal tool

```json
{
  "route": "/db/backup",
  "command": "pg_dump mydb",
  "method": "POST",
  "params": ["format"],
  "description": "Trigger a database backup"
}
```

### Automation endpoints (webhooks, CI/CD)

```json
{
  "route": "/deploy/staging",
  "command": "bash /opt/deploy/staging.sh",
  "method": "POST",
  "params": ["branch", "tag"],
  "timeout": 120000
}
```

### System monitoring

```json
{ "route": "/system/disk",   "command": "df -h",   "method": "GET", "params": [] },
{ "route": "/system/memory", "command": "free -m",  "method": "GET", "params": [] },
{ "route": "/system/procs",  "command": "ps aux",   "method": "GET", "params": [] }
```

---

## 🔍 Dry-Run Mode

Append `?dry_run=true` to any route to preview the full command that would execute — without running it:

```bash
curl "http://localhost:3000/stripe/customers?limit=10&dry_run=true"
```

```json
{
  "dryRun": true,
  "command": "stripe",
  "args": ["customers", "list", "--limit", "10"],
  "fullCommand": "stripe customers list --limit 10",
  "requestId": "..."
}
```

---

## 🧑‍💻 Programmatic API

Use as a library in your own Express/Node app:

```typescript
import { createApp, startServer } from '@munesoft/cli-to-api';

const config = {
  routes: [
    { route: '/echo', command: 'echo', method: 'GET', params: ['message'] }
  ]
};

// Embed into your existing Express app
const cliRouter = createApp(config);
myApp.use('/cli', cliRouter);

// Or start standalone
const { app, close, port } = await startServer(config, { port: 4000 });
console.log(`Running on port ${port}`);
```

---

## 🌐 Built-in Endpoints

Every server automatically exposes:

| Endpoint | Description |
|---|---|
| `GET /health` | Status, uptime, route count |
| `GET /docs` | Swagger UI (interactive API docs) |
| `GET /openapi.json` | Raw OpenAPI 3.0 spec |

---

## 🧪 Running Tests

```bash
git clone https://github.com/munesoft/cli-to-api
cd cli-to-api
npm install
npm test
```

Tests cover: valid execution, invalid params, injection blocking, timeout handling, API auth, POST body params, dry-run mode, config validation.

---

## 🗺 Roadmap

- [x] GET/POST/PUT/DELETE/PATCH support
- [x] API key authentication
- [x] Rate limiting
- [x] Swagger/OpenAPI auto-generation
- [x] Dry-run mode
- [x] Timeout + concurrency limits
- [ ] Webhook trigger support
- [ ] Docker image
- [ ] `--help` auto-inference (parse CLI help output → params)
- [ ] Output transformation plugins

---

## 📄 License

MIT © [munesoft](https://github.com/munesoft)
