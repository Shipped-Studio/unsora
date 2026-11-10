import * as Sentry from "@sentry/node";
import { loadEnv } from "../lib/load-env";

loadEnv();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  // Sentry Logs: lib/logger.ts sends every server log line here, linked to
  // the request or task it came from.
  enableLogs: true,
});
