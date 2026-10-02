import "dotenv/config";
import { z } from "zod";

const required = z.string().min(1);
// Treat empty strings ("VAR=" in .env) the same as unset.
const optional = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const schema = z.object({
  PORT: optional,
  HOST: optional,

  MCP_PUBLIC_URL: required,
  MCP_PATH: optional,
  MCP_ALLOWED_HOSTS: required,
  MCP_SERVER_NAME: optional,

  CLERK_PUBLISHABLE_KEY: required,
  CLERK_SECRET_KEY: required,

  UNSORA_API_BASE_URL: required,
  MCP_MEDIA_DOMAINS: optional,
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
  );
  console.error(
    [
      "",
      "❌ Invalid or missing environment variables:",
      ...missing,
      "",
      "Copy .env.example to .env and fill in the values above.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

/** Validated, typed environment. Prefer this over raw process.env. */
export const env = parsed.data;
