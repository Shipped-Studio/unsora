# Unsora

AI content generation and social scheduling. Generate images, video, voiceovers, music and clips, then schedule and publish them to connected social accounts, from the web app, the public API, or any MCP client.

## Repository layout

A [pnpm](https://pnpm.io) workspace orchestrated with [Turborepo](https://turborepo.com).

| Path | Package | What it is | Runs on |
| --- | --- | --- | --- |
| [`apps/client`](apps/client) | `@unsora/client` | Next.js web app | Vercel |
| [`apps/server`](apps/server) | `@unsora/server` | Express API (app routes + public `/api/v1`), Prisma/Postgres, Trigger.dev background tasks in `src/queue` | Railway (API) + Trigger.dev (tasks) |
| [`apps/mcp`](apps/mcp) | `@unsora/mcp` | Remote MCP server that exposes the public API as tools, with OAuth via Clerk or API-key auth | Railway |
| [`apps/remotion`](apps/remotion) | `@unsora/remotion` | Remotion compositions (subtitle rendering) used by the server through Remotion Lambda | AWS Lambda |

Shared code goes in `packages/*` (none yet).

```
client ──► server /api ──► Postgres, Supabase storage, AI providers
                │
                ├──► Trigger.dev tasks (apps/server/src/queue)
                └──► Remotion Lambda (apps/remotion)
mcp ─────► server /api/v1
```

## Local development

Requires Node 20 (see `.node-version`), pnpm 10 (`corepack enable` picks the pinned version) and a Postgres database.

```bash
pnpm install          # also generates the Prisma client

# one-time per app: copy the example env and fill it in
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
cp apps/mcp/.env.example apps/mcp/.env

pnpm dev:server       # API on :8000
pnpm dev:trigger      # Trigger.dev dev worker for background tasks
pnpm dev:client       # web app on :3000
pnpm dev:mcp          # MCP server on :3002
```

Other tasks run through Turborepo across every app: `pnpm build`, `pnpm typecheck`, `pnpm lint`. Add `--filter=@unsora/<app>` to target one.

Database migrations live in `apps/server/prisma`. Run them with `pnpm --filter @unsora/server migrate`.

## Deployment

- **client**: Vercel project with Root Directory `apps/client`. `apps/client/vercel.json` uses `turbo-ignore` to skip builds when nothing the client depends on changed.
- **server**, **mcp**: Railway services that build from the repository root with Config File Path `/apps/server/railway.json` and `/apps/mcp/railway.json`. Each config sets the Turborepo build command, the start command and watch paths, so a service only redeploys when its app or the workspace config changes.
- **Background tasks**: run the *Deploy Trigger.dev tasks* workflow (or `pnpm dlx trigger.dev deploy` from `apps/server`) after the API deploy that a task change depends on.
- **remotion**: deploy the site with `npx remotion lambda sites create src/index.ts --site-name=<name>` from `apps/remotion`, then set `REMOTION_SERVE_URL` on the server.

Deploy the server before the MCP server when new MCP tools call new API endpoints.

## CI

`.github/workflows/ci.yml` installs the workspace and runs `turbo run typecheck --affected` plus the server and MCP builds, so only apps touched by a change are checked.
