// Loads .env and exits with a clear error if any required var is missing.
// Must stay the first import so everything else sees a validated environment.
import "./lib/env";

// to load the Sentry SDK
import "./monitor/instrument";
import * as Sentry from "@sentry/node";

import express, { Application, Request, Response } from "express";
import cors from "cors";
import routes from "./routes";
import devEmailRoutes from "./routes/dev-emails.routes";
import apiV1Routes from "./api/v1/routes";
import { errorHandler } from "./middleware/errorHandler";
import { startPlatformCredentialSync } from "./lib/platform-credentials";
import openApiDocument from "./docs/openapi";

// JSON.stringify (and therefore res.json) throws on BigInt values. Prisma uses
// BigInt for fields like Asset.fileSize, so serialize BigInt as a string
// globally to avoid 500s when returning rows that contain them.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const app: Application = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Handle webhooks with raw body
app.use(
  ["/api/stripe/webhook", "/api/v1/stripe/webhook"],
  express.raw({
    type: "application/json",
    verify: (req, res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  }),
);
app.use(
  ["/api/clerk/webhooks", "/api/v1/clerk/webhooks"],
  express.raw({ type: "application/json" }),
);

// Platform webhooks: parse as JSON but preserve raw body for signature verification
const webhookJsonParser = express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf.toString();
  },
});
app.use(
  ["/api/webhooks/facebook", "/api/v1/webhooks/facebook"],
  webhookJsonParser,
);
app.use(
  ["/api/webhooks/instagram", "/api/v1/webhooks/instagram"],
  webhookJsonParser,
);
app.use(["/api/webhooks/tiktok", "/api/v1/webhooks/tiktok"], webhookJsonParser);
// YouTube PubSubHubbub sends Atom XML
app.use(
  ["/api/webhooks/youtube", "/api/v1/webhooks/youtube"],
  express.text({
    type: ["application/atom+xml", "application/xml", "text/xml"],
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  }),
);

// Regular JSON parsing for all other routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get(
  ["/api/openapi.json", "/api/v1/openapi.json", "/api-docs/openapi.json"],
  (_req: Request, res: Response) => {
    res.json(openApiDocument);
  },
);

app.get("/api-docs", (_req: Request, res: Response) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Unsora API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    <style>
      html { box-sizing: border-box; }
      *, *:before, *:after { box-sizing: inherit; }
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function () {
        SwaggerUIBundle({
          url: "/api-docs/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset,
          ],
          layout: "StandaloneLayout",
        });
      };
    </script>
  </body>
</html>`);
});

// Routes — register before error-handling middleware.
// The v1 API (API-key auth) is matched first; requests that don't match a
// v1 route fall through to the internal routes mounted below.
app.use("/api/v1", apiV1Routes);
app.use("/api", routes);

// Email template preview for development (see routes/dev-emails.routes.ts).
if (process.env.NODE_ENV !== "production") {
  app.use("/dev/emails", devEmailRoutes);
}

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK" });
});

app.get("/debug-sentry", (_req: Request, _res: Response) => {
  throw new Error("My first Sentry error!");
});

// Sentry must sit after all routes; it captures errors and forwards to the next error handler.
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

// Platform credentials saved in /admin load into process.env before the
// first request; a failure falls back to the environment's values.
startPlatformCredentialSync()
  .catch((err) => console.error("[platform-credentials] initial load failed:", err))
  .finally(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  });

export default app;
