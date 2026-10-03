import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";

/**
 * The OAuth `state` for connecting social accounts: which Unsora user the
 * account is for, whether the link was shared with someone else, and when it
 * expires, signed so it can't be forged or edited. Every link is valid for
 * an hour.
 *
 *   own link     the user connects their own account
 *   shared link  "Copy link" in the app: anyone who opens it can connect an
 *                account to this user's workspace, without an Unsora login
 *
 * Bluesky doesn't use this: its OAuth client keeps state server-side.
 */

const STATE_TTL_MS = 60 * 60 * 1000;

export interface ConnectState {
  userId: string;
  shared: boolean;
}

function secret(): string {
  const value = process.env.CONNECT_STATE_SECRET || process.env.CLERK_SECRET_KEY;
  if (!value) throw new Error("CONNECT_STATE_SECRET (or CLERK_SECRET_KEY) is not configured");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`connect-state:${payload}`).digest("base64url");
}

/** State for an auth URL. A shared link when the request has `?share=1`. */
export function createConnectState(userId: string, req: Request): string {
  const shared = req.query.share === "1" || req.query.share === "true";
  const payload = Buffer.from(
    JSON.stringify({ u: userId, s: shared ? 1 : 0, e: Date.now() + STATE_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The verified state, or null when it is missing, tampered with or expired. */
export function readConnectState(raw: unknown): ConnectState | null {
  if (typeof raw !== "string") return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u?: unknown;
      s?: unknown;
      e?: unknown;
    };
    if (typeof data.u !== "string" || typeof data.e !== "number" || data.e < Date.now()) return null;
    return { userId: data.u, shared: data.s === 1 };
  } catch {
    return null;
  }
}

export const EXPIRED_LINK_MESSAGE =
  "This connect link has expired or isn't valid. Start again from Unsora, or ask for a new link.";
