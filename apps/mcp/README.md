# Unsora MCP Server (Remote)

Streamable HTTP MCP at `https://mcp.tryunsora.com/mcp` — proxies to your Unsora public API.

```text
Claude / Cursor / ChatGPT
        ↓
https://mcp.tryunsora.com/mcp
        ↓
This server (Bearer USER_API_KEY)
        ↓
UNSORA_API_BASE_URL (Unsora API)
```

## Auth

Each MCP request must include the user's Unsora API key. Server accepts any of:

```http
apiKey: uns_...
x-api-key: uns_...
Authorization: Bearer uns_...
```

No server-side `UNSORA_API_KEY` in production. Key travels with the client connection.

**Note:** Cursor/ChatGPT remote MCP has no top-level `apiKey` field — use `headers` (see below).

## Local dev

```bash
cd mcp/unsora
cp .env.example .env
npm install
npm run dev
```

Health:

```bash
curl http://localhost:3000/health
```

Test MCP (HTTP inspector):

```bash
npx @modelcontextprotocol/inspector \
  --transport http \
  --server-url http://localhost:3000/mcp \
  --header "Authorization: Bearer uns_YOUR_KEY"
```

Or call a read-only tool after initialize via curl (inspector is easier).

## Cursor — remote connector

Simplest (plain `apiKey` header — no Bearer prefix):

```json
{
  "mcpServers": {
    "unsora": {
      "url": "https://mcp.tryunsora.com/mcp",
      "headers": {
        "apiKey": "uns_YOUR_KEY"
      }
    }
  }
}
```

Keep key out of git — use env interpolation:

```json
{
  "mcpServers": {
    "unsora": {
      "url": "https://mcp.tryunsora.com/mcp",
      "headers": {
        "apiKey": "${env:UNSORA_API_KEY}"
      }
    }
  }
}
```

Bearer also works:

```json
"headers": { "Authorization": "Bearer ${env:UNSORA_API_KEY}" }
```

## ChatGPT

Settings → Connectors → add remote MCP:

- **URL:** `https://mcp.tryunsora.com/mcp`
- **Auth:** Bearer API key (OAuth later for production distribution)

## Deploy (Railway / Fly / Render)

```bash
npm run build
npm start
```

Docker:

```bash
docker build -t unsora-mcp .
docker run -p 3000:3000 \
  -e UNSORA_API_BASE_URL=https://mvp.tryunsora.com/api/v1 \
  -e MCP_ALLOWED_HOSTS=mcp.tryunsora.com \
  unsora-mcp
```

DNS:

```text
CNAME mcp → your-platform-domain
```

## Environment

| Variable              | Default                                 | Purpose               |
| --------------------- | --------------------------------------- | --------------------- |
| `PORT`                | `3000`                                  | Listen port           |
| `HOST`                | `0.0.0.0`                               | Bind address          |
| `UNSORA_API_BASE_URL` | `https://mvp.tryunsora.com/api/v1`      | Backend API           |
| `MCP_SERVER_NAME`     | `unsora-mcp`                            | MCP server name       |
| `MCP_ALLOWED_HOSTS`   | `mcp.tryunsora.com,localhost,127.0.0.1` | Host header allowlist |

## Tools

| Tool                        | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `get_credits`               | Credit balance                                       |
| `get_subscription`          | Plan / `isActive`                                    |
| `get_accounts`              | Connected social accounts                            |
| `upload_file`               | Import a URL / base64 file into the library          |
| `list_uploads`              | List uploaded files                                  |
| `list_models`               | Video / image / motion models + exact input fields   |
| `get_price`                 | Live credit price for a generation (free)            |
| `create_image`              | Queue image job (any catalog image model)            |
| `create_influencer`         | AI influencer portraits                              |
| `create_thumbnail`          | YouTube-style 16:9 thumbnails                        |
| `create_movie_material`     | Character / location / storyboard film references    |
| `upscale_image`             | Upscale an image to 2K / 4K / 8K                     |
| `wait_for_image`            | Poll any image job                                   |
| `create_video`              | Any catalog video model (Seedance 2.5, Veo, Kling…)  |
| `create_motion_control`     | Character copies a reference video's motion          |
| `create_avatar_video`       | Talking-head video from a portrait                   |
| `upscale_video`             | Upscale a video                                      |
| `remove_watermark`          | Remove burned-in subtitles / watermarks              |
| `wait_for_video`            | Poll any video job                                   |
| `create_music`              | Mureka AI song / BGM                                 |
| `wait_for_music`            | Poll music job                                       |
| `list_voiceover_voices`     | Eleven v3 voices + previews (picker UI)              |
| `list_voices`               | All voices: MiniMax presets, Eleven v3, clones       |
| `create_voiceover`          | Script → speech (preset or cloned voice)             |
| `create_voice_clone`        | Instant voice clone from a sample                    |
| `delete_voice_clone`        | Delete a cloned voice                                |
| `change_voice`              | Speech-to-speech into a cloned voice                 |
| `wait_for_voiceover`        | Poll voiceover / voice-changer job                   |
| `create_clipping`           | Long video → short clips                             |
| `wait_for_clipping`         | Poll clipping job                                    |
| `create_post`               | Draft, schedule, or publish now (`publishNow`)       |
| `create_image_and_schedule` | Image → wait → post                                  |
| `publish_post`              | Publish a draft / scheduled post immediately         |
| `get_post` / `list_posts`   | Read posts                                           |
| `update_post`               | Edit / reschedule a draft or scheduled post          |
| `retry_post`                | Retry failed accounts of a post                      |
| `delete_post`               | Delete a post                                        |
| `get_post_analytics`        | Views / likes / comments / shares of published posts |
| `list_generations`          | Browse past results by feature                       |
| `delete_generation`         | Delete a result or uploaded file                     |

Admin only: `upload-skill`, `get-skill`, `update-skill`. App-only (preview UI
polling): `image_status`, `video_status`, `audio_status` (args `{ tool, id }`),
`clipping_status`.

## Preview widgets (MCP Apps)

Plain HTML/JS in `assets/mcp-ui/`, served as-is (no build step, no framework):

| Widget               | Resource                                       | Polls             |
| -------------------- | ---------------------------------------------- | ----------------- |
| `media-view.html`    | `ui://unsora/image`, `/video`, `/audio` (kind filled in) | `<kind>_status`   |
| `clipping-view.html` | `ui://unsora/clipping`                         | `clipping_status` |
| `voices-view.html`   | `ui://unsora/voices`                           | —                 |

A create tool returns `{ …result, generationIds, tool, kind, mcpTool, status }`;
the widget polls its status tool with `{ tool, id }` at once, after 20s, then
every 30s (media gives up after 45 min, clipping after 90). The contract is
documented at the top of `src/tools/index.ts`. `npm run preview` opens a mock
host that exercises every widget without the server.

## Project layout

```text
src/
  index.ts       # Express + Streamable HTTP (/mcp)
  auth.ts        # Bearer API key from request
  unsora-api.ts  # Unsora HTTP client + polling
  server.ts      # createMcpServer(apiKey)
  tools/index.ts # Tool registrations
assets/
  brand/         # Server icons
  mcp-ui/        # Preview widgets (plain HTML)
ui/              # npm run preview — mock host for the widgets
```

## Production checklist

- HTTPS only (`mcp.tryunsora.com`)
- Bearer auth required on every `/mcp` request
- `MCP_ALLOWED_HOSTS` set
- Rate limiting at edge (Cloudflare / platform)
- OAuth 2.1 for public ChatGPT/Claude distribution (later)
- Read-only tools first; write tools need confirmation in host app
