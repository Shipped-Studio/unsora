/**
 * The server's logger. Use it instead of console.*.
 *
 * Every line goes to three places:
 *  - Sentry Logs (needs `enableLogs` in monitor/instrument.ts), linked to the
 *    active request or task trace, so a failure shows the lines that led to it.
 *  - stdout: JSON in production (Railway parses `level`/`message` and lets you
 *    filter by any field), a readable line in development.
 *  - The trigger.dev run log when called inside a task (a no-op elsewhere).
 *
 * Call it like console, or pass an object for searchable fields:
 *   logger.error("Failed to publish:", error);
 *   logger.info("Post published", { postId, provider });
 *
 * Token-like keys are redacted and request headers are never serialized,
 * because these lines leave the machine.
 */
import * as Sentry from "@sentry/node";
import { logger as triggerLogger } from "@trigger.dev/sdk";

type Level = "debug" | "info" | "warn" | "error";
type Attributes = Record<string, string | number | boolean>;

const IS_PROD = process.env.NODE_ENV === "production";
const MAX_VALUE_CHARS = 4000;
const REDACTED = "[redacted]";

const SENSITIVE_KEY =
  /token|secret|password|passwd|authorization|cookie|api[-_]?key|signature|private[-_]?key|credential/i;

/** Masks credentials that appear inside free-form strings. */
function scrub(text: string): string {
  return text
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 " + REDACTED)
    .replace(
      /((?:access_token|refresh_token|id_token|client_secret|api_key|apikey|token)["']?\s*[=:]\s*["']?)[^&\s"',}]+/gi,
      "$1" + REDACTED,
    );
}

function truncate(text: string): string {
  return text.length > MAX_VALUE_CHARS
    ? `${text.slice(0, MAX_VALUE_CHARS)}… (${text.length} chars)`
    : text;
}

/** Deep-copies a value with sensitive keys masked and cycles broken. */
function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return scrub(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, seen);
  }
  return out;
}

function toAttributeValue(value: unknown): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return truncate(value);
  if (value === undefined) return "undefined";
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

/** URL without its query string, which can carry access tokens. */
function stripQuery(url: unknown): string | undefined {
  return typeof url === "string" ? url.split("?")[0] : undefined;
}

/**
 * The useful parts of an error. Axios errors keep the method, URL path,
 * status and response body; their config and headers (Authorization) are
 * dropped.
 */
function serializeError(error: Error): Record<string, unknown> {
  const e = error as Error & {
    code?: unknown;
    cause?: unknown;
    isAxiosError?: boolean;
    config?: { method?: string; url?: string };
    response?: { status?: number; data?: unknown };
  };
  const out: Record<string, unknown> = {
    type: e.name,
    message: scrub(e.message),
    stack: e.stack ? scrub(e.stack) : undefined,
  };
  if (e.code !== undefined) out.code = String(e.code);
  if (e.isAxiosError || e.response) {
    out.http_method = e.config?.method?.toUpperCase();
    out.http_url = stripQuery(e.config?.url);
    out.http_status = e.response?.status;
    out.http_response = redact(e.response?.data);
  }
  if (e.cause instanceof Error) out.cause = scrub(e.cause.message);
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Turns console-style arguments into a message and flat attributes.
 * Strings and numbers join the message; an Error adds `error.*` fields and
 * its message; a plain object's keys become fields; anything else becomes
 * an `argN` field.
 */
function format(args: unknown[]): { message: string; attributes: Attributes } {
  const parts: string[] = [];
  const attributes: Attributes = {};

  args.forEach((arg, index) => {
    if (arg instanceof Error) {
      const fields = serializeError(arg);
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) attributes[`error.${key}`] = toAttributeValue(value);
      }
      parts.push(String(fields.message));
    } else if (isPlainObject(arg)) {
      const clean = redact(arg) as Record<string, unknown>;
      for (const [key, value] of Object.entries(clean)) {
        attributes[key] = toAttributeValue(value);
      }
    } else if (
      typeof arg === "string" ||
      typeof arg === "number" ||
      typeof arg === "boolean" ||
      typeof arg === "bigint"
    ) {
      parts.push(scrub(String(arg)));
    } else if (arg === null || arg === undefined) {
      parts.push(String(arg));
    } else {
      attributes[`arg${index}`] = toAttributeValue(redact(arg));
    }
  });

  return { message: parts.join(" ") || "(no message)", attributes };
}

function write(level: Level, message: string, attributes: Attributes) {
  const time = new Date().toISOString();
  let line: string;
  if (IS_PROD) {
    line = JSON.stringify({ level, message, time, ...attributes });
  } else {
    const { "error.stack": stack, ...rest } = attributes;
    const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    line = `${time} ${level.toUpperCase().padEnd(5)} ${message}${extra}`;
    if (typeof stack === "string") line += `\n${stack}`;
  }
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(
    line + "\n",
  );
}

function emit(level: Level, args: unknown[]) {
  // Logging must never throw into the caller.
  try {
    const { message, attributes } = format(args);
    write(level, message, attributes);
    Sentry.logger[level](message, attributes);
    triggerLogger[level](message, attributes);
  } catch {
    // Nothing sensible left to do.
  }
}

// Arrow functions so they can be passed by reference, e.g. `.catch(logger.error)`.
export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
