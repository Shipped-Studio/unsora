import { Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import prisma from "../lib/db";
import { grantCredits } from "../lib/credits";
import {
  isApiKeyToken,
  isLegacyApiKeyToken,
  mirrorUnkeyKey,
  validateApiKey,
} from "../lib/api-keys";
import { isUnkeyConfigured, verifyUnkeyKey } from "../lib/unkey";

// Extend Express Request type to include auth
declare global {
  namespace Express {
    interface Request {
      auth: {
        userId: string;
        apiKeyId?: string;
      };
    }
  }
}

const clerkOpts = {
  signInUrl: undefined as unknown as string,
  isSatellite: false,
} as const;

/**
 * Auto-creates a DB user record on their first request (get-or-create pattern).
 * Fetches real email from Clerk when available, falls back to a placeholder.
 * Grants a small initial credit bucket so new accounts can immediately test
 * generation without having to go through Stripe.
 */
async function ensureDbUser(clerkId: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (existing) return;
  await createDbUser(clerkId);
}

async function createDbUser(clerkId: string): Promise<{ id: string }> {

  // Fetch email from Clerk; fall back to a safe placeholder if unavailable.
  let email = `${clerkId}@auto.unsora.internal`;
  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    email = clerkUser.emailAddresses[0]?.emailAddress ?? email;
  } catch {
    // Non-fatal — placeholder email is fine for now.
  }

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, email },
  });

  // Grant 100 free credits on first sign-in so generation works out of the box.
  await grantCredits({
    userId: user.id,
    amount: 100,
    source: "PROMOTION",
    reason: "welcome:auto-grant",
    expiresAt: null,
    metadata: { note: "Auto-granted on first API request" },
  });

  return user;
}

/**
 * Unkey is the source of truth for public API keys, but
 * `credit_transactions.apiKeyId` and `api_idempotency_records.apiKeyId` have
 * FKs to the local `api_keys` table. Mirror each Unkey key as a shadow row
 * (id = Unkey keyId) so those FKs are satisfied. Cached in-memory so the
 * lookup only hits the DB once per key per process.
 */
const knownApiKeyIds = new Set<string>();

async function ensureApiKeyRecord(keyId: string, clerkId: string): Promise<void> {
  if (knownApiKeyIds.has(keyId)) return;

  const existing = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { id: true },
  });
  if (!existing) {
    const user =
      (await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      })) ?? (await createDbUser(clerkId));

    await mirrorUnkeyKey({ keyId, userId: user.id });
  }
  knownApiKeyIds.add(keyId);
}

/**
 * API-safe auth middleware. Uses clerkMiddleware() (never redirects) and
 * auto-creates the user in the DB on their first request so callers don't
 * need a separate sign-up/sync step.
 */
export const requireAuth = [
  clerkMiddleware(clerkOpts),
  async (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fire-and-forget user bootstrap — if the DB is unreachable this
    // shouldn't block the request (the controller will fail more gracefully).
    try {
      await ensureDbUser(auth.userId);
    } catch {
      // Swallow — controllers that need the user will return their own errors.
    }

    (req as Request & { auth: { userId: string } }).auth = { userId: auth.userId };
    next();
  },
];

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Accepts Clerk JWT or Unsora API key (`uns_live_*` / `uns_test_*`).
 * Sets req.auth.userId to the user's clerkId in both cases.
 */
export const requireAuthOrApiKey = [
  clerkMiddleware(clerkOpts),
  async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);

    if (token && isApiKeyToken(token)) {
      // Prefer Unkey-managed keys. Unkey enforces the per-key rate limit and
      // hands back the owning user via the key's externalId (= clerkId).
      if (isUnkeyConfigured()) {
        try {
          const verified = await verifyUnkeyKey(token);
          if (verified.ok) {
            // Mirror the Unkey key locally so FK writes (credit transactions,
            // idempotency records) don't violate credit_transactions_apiKeyId_fkey.
            // If mirroring fails, proceed without apiKeyId — losing per-key
            // attribution beats failing the whole request on the FK.
            let apiKeyId: string | undefined = verified.keyId;
            try {
              await ensureApiKeyRecord(verified.keyId, verified.clerkId);
            } catch (err) {
              console.error("[auth] ensureApiKeyRecord failed:", err);
              apiKeyId = undefined;
            }
            req.auth = {
              userId: verified.clerkId,
              apiKeyId,
            };
            return next();
          }
          if (verified.rateLimited) {
            return res.status(429).json({
              success: false,
              error: "API key rate limit exceeded",
              code: "RATE_LIMIT_EXCEEDED",
            });
          }
        } catch (err) {
          console.error("[auth] Unkey verify error:", err);
          // Fall through to legacy validation rather than hard-failing.
        }
      }

      // Legacy fallback for keys issued before the Unkey migration.
      if (isLegacyApiKeyToken(token)) {
        const result = await validateApiKey(token);
        if (result) {
          req.auth = {
            userId: result.clerkId,
            apiKeyId: result.apiKeyId,
          };
          return next();
        }
      }

      return res.status(401).json({ error: "Unauthorized" });
    }

    // Accept both Clerk session JWTs (web app) and OAuth access tokens.
    // Remote MCP clients (e.g. Claude) connect via Clerk OAuth, which issues
    // oauth_token, not session_token. Without this, OAuth callers 401.
    const auth = getAuth(req, {
      acceptsToken: ["session_token", "oauth_token"],
    });
    if (!auth.isAuthenticated || !auth.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = auth.userId;

    try {
      await ensureDbUser(userId);
    } catch {
      // Swallow — controllers that need the user will return their own errors.
    }

    req.auth = { userId };
    next();
  },
];
