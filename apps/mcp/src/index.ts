// Loads .env and exits with a clear error if any required var is missing.
// Must stay the first import so everything else sees a validated environment.
import "./env.js";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { mcpAuthClerk } from "@clerk/mcp-tools/express";
import { fetchClerkAuthorizationServerMetadata } from "@clerk/mcp-tools/server";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, Response } from "express";

import { tryGetApiKeyFromRequest } from "./auth.js";
import { createMcpServer, type McpProfile } from "./server.js";
import { UnsoraApi } from "./unsora-api.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const MCP_PUBLIC_URL = process.env.MCP_PUBLIC_URL;
const MCP_PATH = process.env.MCP_PATH || "/mcp";
const MCP_RESOURCE_URL = `${MCP_PUBLIC_URL}${MCP_PATH}`;
const MCP_SCHEDULER_PATH = "/scheduler";

/**
 * Each path is its own MCP server with its own tool set; API keys and Clerk
 * OAuth work on all of them.
 */
const MCP_ENDPOINTS: { path: string; profile: McpProfile }[] = [
  { path: MCP_PATH, profile: "full" },
  { path: MCP_SCHEDULER_PATH, profile: "scheduler" },
];

/** RFC 9728 path-suffixed metadata URL — also what mcpAuthClerk's 401 points at. */
function protectedResourceMetadataPath(mcpPath: string): string {
  return `/.well-known/oauth-protected-resource${mcpPath}`;
}

const allowedHosts = process.env.MCP_ALLOWED_HOSTS?.split(",");

const app = createMcpExpressApp({
  host: HOST,
  allowedHosts,
});

app.set("trust proxy", true);

const corsMiddleware = cors({
  origin: true,
  credentials: true,
  exposedHeaders: ["WWW-Authenticate"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Mcp-Session-Id",
    "mcp-session-id",
    "Accept",
  ],
  methods: ["GET", "POST", "OPTIONS"],
});

app.use(corsMiddleware);

/**
 * Public routes — must stay before clerkMiddleware.
 * Claude discovers OAuth via these .well-known endpoints.
 */
// Brand assets (server icon shown in MCP clients). Lives at ../assets from
// both src/ (tsx dev) and dist/ (production build).
app.use(
  "/assets",
  express.static(fileURLToPath(new URL("../assets", import.meta.url)), {
    maxAge: "1d",
  }),
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: process.env.MCP_SERVER_NAME || "unsora-mcp",
    mcp: MCP_PATH,
    scheduler: MCP_SCHEDULER_PATH,
    publicUrl: MCP_RESOURCE_URL,
    auth: ["api_key", "clerk_oauth"],
    allowedHosts,
  });
});

const OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "public_metadata",
  "private_metadata",
  "offline_access",
];

function requestOrigin(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

let clerkAsMetadataPromise: Promise<Record<string, unknown>> | undefined;

function getClerkAsMetadata(): Promise<Record<string, unknown>> {
  clerkAsMetadataPromise ??= fetchClerkAuthorizationServerMetadata({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
  }).catch((error) => {
    clerkAsMetadataPromise = undefined;
    throw error;
  });
  return clerkAsMetadataPromise;
}

/**
 * OAuth discovery + registration proxy. ChatGPT registers its OAuth client
 * WITHOUT a `scope` field, and Clerk's default grant for scope-less dynamic
 * registrations is only `email offline_access profile` — then ChatGPT
 * requests `openid` at authorization time and Clerk rejects it. So we point
 * `authorization_servers` / `registration_endpoint` at this server and
 * forward registrations to Clerk with the full scope list injected.
 */
function protectedResourceMetadataHandler(mcpPath: string) {
  return (req: Request, res: Response) => {
    const origin = requestOrigin(req);
    res.json({
      resource: `${origin}${mcpPath}`,
      authorization_servers: [origin],
      scopes_supported: OAUTH_SCOPES,
      bearer_methods_supported: ["header"],
      token_types_supported: ["urn:ietf:params:oauth:token-type:access_token"],
    });
  };
}

for (const { path } of MCP_ENDPOINTS) {
  app.get(
    protectedResourceMetadataPath(path),
    protectedResourceMetadataHandler(path),
  );
}
app.get(
  "/.well-known/oauth-protected-resource",
  protectedResourceMetadataHandler(MCP_PATH),
);

app.get("/.well-known/oauth-authorization-server", async (req, res) => {
  const metadata = await getClerkAsMetadata();
  res.json({
    ...metadata,
    registration_endpoint: `${requestOrigin(req)}/oauth/register`,
    scopes_supported: OAUTH_SCOPES,
  });
});

app.post("/oauth/register", async (req, res) => {
  const metadata = await getClerkAsMetadata();
  const registrationEndpoint = metadata.registration_endpoint;
  if (typeof registrationEndpoint !== "string") {
    res.status(502).json({ error: "Clerk registration endpoint unavailable" });
    return;
  }

  const requestedScopes =
    typeof req.body?.scope === "string"
      ? req.body.scope.split(/\s+/).filter(Boolean)
      : [];
  const scope = [...new Set([...requestedScopes, ...OAUTH_SCOPES])].join(" ");

  const upstream = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req.body, scope }),
  });

  res.status(upstream.status).json(await upstream.json());
});

app.use(clerkMiddleware());

function sendOAuthChallenge(req: Request, res: Response, mcpPath: string) {
  if (res.headersSent) return;

  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${requestOrigin(req)}${protectedResourceMetadataPath(mcpPath)}"`,
  );

  res.status(401).json({
    error: "unauthorized",
    message: "OAuth authorization required",
  });
}

/**
 * Build a fresh McpServer + transport per request and tear it down on close.
 * A single shared server cannot be reused across requests: the SDK throws
 * "Already connected to a transport" on the second connect (e.g. tools/list
 * after initialize), which surfaces in Claude as "connected, 0 tools".
 */
async function handleMcpRequest(
  req: Request,
  res: Response,
  profile: McpProfile,
  resolveUnsora: (authInfo?: AuthInfo) => UnsoraApi,
): Promise<void> {
  const server = createMcpServer(resolveUnsora, profile);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

function handleApiKeyMcp(
  req: Request,
  res: Response,
  profile: McpProfile,
  apiKey: string,
): Promise<void> {
  return handleMcpRequest(req, res, profile, () => new UnsoraApi(apiKey));
}

function handleOAuthMcp(
  req: Request,
  res: Response,
  profile: McpProfile,
): Promise<void> {
  return handleMcpRequest(req, res, profile, (authInfo) => {
    const token = authInfo?.token;
    if (!token) {
      throw new Error("Missing OAuth token");
    }
    return new UnsoraApi(token);
  });
}

for (const { path, profile } of MCP_ENDPOINTS) {
  app.all(path, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      const apiKey = tryGetApiKeyFromRequest(req);
      if (apiKey) {
        await handleApiKeyMcp(req, res, profile, apiKey);
        return;
      }

      await mcpAuthClerk(req, res, async () => {
        await handleOAuthMcp(req, res, profile);
      });
    } catch (error) {
      console.error("MCP request error:", error);

      if (!res.headersSent) {
        const message = error instanceof Error ? error.message : "Internal error";

        if (
          message.toLowerCase().includes("unauthorized") ||
          message.toLowerCase().includes("missing oauth") ||
          message.toLowerCase().includes("missing token")
        ) {
          sendOAuthChallenge(req, res, path);
          return;
        }

        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message,
          },
          id: null,
        });
      }

      next(error);
    }
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Unsora MCP server listening on http://${HOST}:${PORT}`);
  console.log(`Health: ${MCP_PUBLIC_URL}/health`);
  for (const { path } of MCP_ENDPOINTS) {
    console.log(`MCP:    ${MCP_PUBLIC_URL}${path}`);
    console.log(
      `OAuth metadata: ${MCP_PUBLIC_URL}${protectedResourceMetadataPath(path)}`,
    );
  }
});
