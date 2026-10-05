import { z } from "zod";
import { loadEnv } from "./load-env";

// Load .env before validating — this module must be the first import of the
// entry point so every other module (including Sentry instrument) sees a
// validated environment.
loadEnv();

const required = z.string().min(1);
// Treat empty strings ("VAR=" in .env) the same as unset.
const optional = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const schema = z.object({
  // Server
  PORT: optional,
  CLIENT_URL: required,

  // Database
  DATABASE_URL: required,
  REDIS_URL: optional,

  // Auth — Clerk
  CLERK_PUBLISHABLE_KEY: required,
  CLERK_SECRET_KEY: required,
  CLERK_WEBHOOK_SIGNING_SECRET: required,

  // Billing — Stripe
  STRIPE_SECRET_KEY: required,
  STRIPE_WEBHOOK_SECRET: required,
  STRIPE_SUCCESS_URL: required,
  STRIPE_CANCEL_URL: required,

  // AI / Generation APIs
  OPENAI_API_KEY: required,
  OPENROUTER_API_KEY: required,
  REPLICATE_API_KEY: required,
  WAVESPEED_API_KEY: required,
  // Catalog pricing — see lib/generation-pricing.ts. Defaults 0.20 / 0.028.
  GENERATION_MARGIN: optional,
  CREDIT_USD_VALUE: optional,
  SEEDANCE_API_KEY: required,
  WAYIN_API_KEY: required,
  SUPADATA_API_KEY: required,
  ELEVENLABS_API_KEY: optional,

  // Video rendering — Remotion (AWS Lambda)
  REMOTION_AWS_REGION: required,
  REMOTION_AWS_ACCESS_KEY_ID: required,
  REMOTION_AWS_SECRET_ACCESS_KEY: required,
  REMOTION_LAMBDA_FUNCTION_NAME: required,
  REMOTION_SERVE_URL: required,

  // Storage — Supabase
  SUPABASE_URL: required,
  SUPABASE_SECRET_KEY: required,
  SUPABASE_STORAGE_BUCKET: required,
  MEDIA_STORAGE_BASE: optional,
  MEDIA_CDN_BASE: optional,

  // Background jobs — Trigger.dev
  TRIGGER_SECRET_KEY: required,
  TRIGGER_PROJECT_REF: optional,

  // Public API keys — Unkey
  UNKEY_ROOT_KEY: required,
  UNKEY_API_ID: required,

  // Social connect — OAuth
  YOUTUBE_API_KEY: required,
  GOOGLE_CLIENT_ID: required,
  GOOGLE_CLIENT_SECRET: required,
  GOOGLE_REDIRECT_URI: required,
  TIKTOK_CLIENT_KEY: required,
  TIKTOK_CLIENT_SECRET: required,
  TIKTOK_REDIRECT: required,
  FB_APP_ID: required,
  FB_APP_SECRET: required,
  FB_REDIRECT: required,
  IG_APP_ID: required,
  IG_APP_SECRET: required,
  IG_REDIRECT: required,
  LINKEDIN_APP_ID: required,
  LINKEDIN_APP_SECRET: required,
  LINKEDIN_REDIRECT: required,
  BLUESKY_REDIRECT: required,
  BLUESKY_PRIVATE_KEY: required,
  THREADS_APP_ID: optional,
  THREADS_APP_SECRET: optional,
  THREADS_REDIRECT: optional,
  PINTEREST_APP_ID: optional,
  PINTEREST_APP_SECRET: optional,
  PINTEREST_REDIRECT: optional,
  // Test deployments only: send board/pin calls to Pinterest's sandbox with
  // this portal-generated token (Trial-access apps can only pin there).
  PINTEREST_SANDBOX_TOKEN: optional,
  X_CLIENT_ID: optional,
  X_CLIENT_SECRET: optional,
  X_REDIRECT: optional,
  GOOGLE_BUSINESS_REDIRECT: optional,

  // Incoming platform webhooks
  FB_WEBHOOK_VERIFY_TOKEN: optional,
  IG_WEBHOOK_VERIFY_TOKEN: optional,
  YOUTUBE_WEBHOOK_SECRET: optional,
  TIKTOK_WEBHOOK_SECRET: optional,

  // Monitoring / admin
  SENTRY_DSN: optional,
  ADMIN_EMAILS: optional,

  // Transactional email (src/emails). Unset = no mail is sent.
  PLUNK_SECRET_KEY: optional,
  PLUNK_FROM_EMAIL: optional,
  PLUNK_API_URL: optional,
  SIGNUP_NOTIFICATION_EMAIL: optional,
  LOW_CREDITS_THRESHOLD: optional,
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
