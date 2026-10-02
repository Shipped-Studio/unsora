# Unsora

AI content generation and social scheduling. Generate images, video, voiceovers, music and clips, then schedule and publish them to connected social accounts, from the web app, the public API, or any MCP client.

## Repository layout

| Path | What it is | Runs on |
| --- | --- | --- |
| [`client/`](client) | Next.js web app | Vercel |
| [`server/`](server) | Express API (app routes + public `/api/v1`), Prisma/Postgres, Trigger.dev background tasks in `src/queue` | Railway (API) + Trigger.dev (tasks) |
| [`mcp/`](mcp) | Remote MCP server that exposes the public API as tools, with OAuth via Clerk or API-key auth | Railway |
| [`remotion/`](remotion) | Remotion compositions (subtitle rendering) used by the server through Remotion Lambda | AWS Lambda |

Each app is self-contained: it has its own `package.json` and lockfile, and is installed and deployed from its own directory.

```
client ──► server /api ──► Postgres, Supabase storage, AI providers
                │
                ├──► Trigger.dev tasks (server/src/queue)
                └──► Remotion Lambda (remotion/)
mcp ─────► server /api/v1
```

## Local development

Requires Node 20.18+ and a Postgres database.

```bash
npm run install:all

# one-time per app: copy the example env and fill it in
cp server/.env.example server/.env
cp client/.env.example client/.env
cp mcp/.env.example mcp/.env

npm run dev:server    # API on :8000
npm run dev:trigger   # Trigger.dev dev worker for background tasks
npm run dev:client    # web app on :3000
npm run dev:mcp       # MCP server on :3002
```

Database migrations live in `server/prisma`. Run them with `npm run migrate --prefix server`.

## Deployment

- **client**: Vercel project with Root Directory `client`. `client/vercel.json` skips builds when nothing under `client/` changed.
- **server**, **mcp**: Railway services with Root Directory `/server` and `/mcp`, and Config File Path `/server/railway.json` and `/mcp/railway.json`. The config files set watch paths so each service only redeploys when its own directory changes.
- **Background tasks**: run the *Deploy Trigger.dev tasks* workflow (or `npm run trigger:deploy --prefix server`) after the API deploy that a task change depends on.
- **remotion**: deploy the site with `npx remotion lambda sites create src/index.ts --site-name=<name>` from `remotion/`, then set `REMOTION_SERVE_URL` on the server.

Deploy the server before the MCP server when new MCP tools call new API endpoints.

## CI

`.github/workflows/ci.yml` builds or type-checks only the apps a change touches.
