# API docs

## Stack

- **Spec source:** `src/docs/openapi.ts` (OpenAPI 3.1, TypeScript object)
- **UI:** [Swagger UI](https://swagger.io/tools/swagger-ui/) served at `GET /api-docs`
- **Raw spec:** `GET /api-docs/openapi.json` (also `/api/v1/openapi.json`, `/api/openapi.json`)
- **Export:** `npm run docs:export-openapi` writes `openapi.json` into the [docs repo](https://github.com/Shipped-Studio/docs.tryunsora.com), expected as a sibling of this repo (`../docs`). Set `DOCS_DIR` to use another path.

Public API routes live under **`/api/public/*`** (alias: `/api/v1/public/*`). Auth: Clerk JWT or API key (`Authorization: Bearer …`).

## How to add endpoint docs

1. Implement the route under `src/api/v1/`
2. Edit `src/docs/openapi.ts` — add schemas under `components.schemas`, paths under `paths` (prefix with `/public/…`)
3. Add `security: [{ bearerAuth: [] }]` when the route requires auth
4. Restart the server and verify at `http://localhost:3001/api-docs`
