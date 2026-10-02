/**
 * Fails `next dev` / `next build` immediately if a required env var is
 * missing. Imported from next.config.ts, which Next evaluates after
 * loading .env files.
 */
const REQUIRED_ENV = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_JWT_TEMPLATE",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "NEXT_PUBLIC_API_URL",
  "API_URL",
  "NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID",
  "NEXT_PUBLIC_STRIPE_PRO_PRICE_ID",
  "NEXT_PUBLIC_STRIPE_POWER_PRICE_ID",
] as const;

export function checkEnv(): void {
  const missing = REQUIRED_ENV.filter(
    (name) => !process.env[name] || process.env[name]!.trim() === "",
  );

  if (missing.length > 0) {
    throw new Error(
      [
        "",
        "❌ Missing required environment variables:",
        ...missing.map((name) => `  - ${name}`),
        "",
        "Copy .env.example to .env and fill in the values above.",
      ].join("\n"),
    );
  }
}
