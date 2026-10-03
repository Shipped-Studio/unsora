/**
 * Sending, over the Plunk HTTPS API (port 443, so it works on hosts that
 * block SMTP ports, like Railway). Plunk builds the plain-text part itself.
 *
 * Environment:
 *   PLUNK_SECRET_KEY    Secret key (sk_...) from the Plunk dashboard.
 *   PLUNK_FROM_EMAIL    Sender address on a domain verified in Plunk.
 *   PLUNK_API_URL       Optional. Defaults to Plunk's hosted API; set it when
 *                       running a self-hosted Plunk.
 *   Team inboxes: see INBOXES below.
 */
import type { RenderedEmail } from "./layout";

const DEFAULT_API_URL = "https://next-api.useplunk.com";

/** Display name on everything sent to users. */
export const FROM_NAME = "Unsora";

/**
 * Where internal notifications go. Unset means the team notice is skipped,
 * so self-hosted installs don't email anyone by default.
 */
export const INBOXES = {
  signups: () => process.env.SIGNUP_NOTIFICATION_EMAIL?.trim() || null,
} as const;

export function emailConfigured(): boolean {
  return Boolean(process.env.PLUNK_SECRET_KEY && process.env.PLUNK_FROM_EMAIL);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Display name shown alongside the from-address. */
  fromName?: string;
  replyTo?: string;
  /**
   * Plunk sends at most once per key within 24 hours. Pass one for emails
   * triggered by webhooks that may be retried (e.g. the Stripe invoice id).
   */
  idempotencyKey?: string;
}

/**
 * Sends one email. Throws on missing config or a non-2xx response, for
 * callers that must know whether it went out.
 */
export async function sendEmail({
  to,
  subject,
  html,
  fromName = FROM_NAME,
  replyTo,
  idempotencyKey,
}: SendEmailInput) {
  const apiKey = process.env.PLUNK_SECRET_KEY;
  if (!apiKey) throw new Error("PLUNK_SECRET_KEY is not configured");

  const fromEmail = process.env.PLUNK_FROM_EMAIL;
  if (!fromEmail) throw new Error("PLUNK_FROM_EMAIL is not configured");

  const base = (process.env.PLUNK_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const res = await fetch(`${base}/v1/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 255) } : {}),
    },
    body: JSON.stringify({
      to,
      subject,
      body: html,
      from: { name: fromName, email: fromEmail },
      ...(replyTo ? { reply: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Plunk send failed (${res.status}): ${detail.slice(0, 500)}`);
  }
  return res.json().catch(() => ({}));
}

export interface SendOptions {
  fromName?: string;
  replyTo?: string;
  idempotencyKey?: string;
}

/** Sends a rendered template. Throws like sendEmail. */
export function sendRendered(to: string, email: RenderedEmail, opts: SendOptions = {}) {
  return sendEmail({ to, subject: email.subject, html: email.html, ...opts });
}

/**
 * Best-effort send for notifications that must never break the calling
 * flow (webhooks, signups, credit spends, publishing): skips quietly when
 * email isn't configured and logs any failure instead of throwing.
 */
export async function sendSafely(
  label: string,
  to: string | null | undefined,
  render: () => RenderedEmail | Promise<RenderedEmail>,
  opts: SendOptions = {},
): Promise<void> {
  if (!to) return;
  if (!emailConfigured()) {
    console.warn(`[email] ${label}: PLUNK_SECRET_KEY / PLUNK_FROM_EMAIL not set, skipping`);
    return;
  }
  try {
    await sendRendered(to, await render(), opts);
  } catch (err) {
    console.error(`[email] ${label} failed:`, err);
  }
}
