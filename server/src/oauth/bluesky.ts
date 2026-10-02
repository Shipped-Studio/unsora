import { Agent } from "@atproto/api";
import {
  JoseKey,
  NodeOAuthClient,
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
  OAuthSession,
  atprotoLoopbackClientMetadata,
  buildAtprotoLoopbackClientId,
} from "@atproto/oauth-client-node";
import { createHash } from "crypto";
import { prisma } from "../lib/db";
import { uploadUrlToStorage } from "../lib/upload";

/**
 * Bluesky / AT Protocol OAuth.
 *
 * Unlike the other providers there is no developer portal: the client is
 * "registered" by serving a client-metadata JSON document at a public URL,
 * and that URL is the client_id. Tokens are DPoP-bound and the confidential
 * client authenticates with an ES256 key (private_key_jwt), so all token
 * handling is delegated to @atproto/oauth-client-node — sessions live in the
 * bluesky_auth_sessions table, not in SocialAccount.accessToken.
 *
 * Env:
 *   BLUESKY_REDIRECT    full callback URL, e.g.
 *                       https://sadek.tryunsora.com/api/connect/bluesky/callback
 *                       (client-metadata.json and jwks.json are served as
 *                       siblings of /callback)
 *   BLUESKY_PRIVATE_KEY ES256 private key (PKCS8 PEM or JWK JSON). Required
 *                       unless the redirect is a http://127.0.0.1 loopback
 *                       dev URL.
 */

export const BLUESKY_SCOPE = "atproto transition:generic";

const stateStore: NodeSavedStateStore = {
  async set(key: string, state: NodeSavedState) {
    await prisma.blueskyAuthState.upsert({
      where: { key },
      update: { state: JSON.stringify(state) },
      create: { key, state: JSON.stringify(state) },
    });
  },
  async get(key: string) {
    const row = await prisma.blueskyAuthState.findUnique({ where: { key } });
    return row ? (JSON.parse(row.state) as NodeSavedState) : undefined;
  },
  async del(key: string) {
    await prisma.blueskyAuthState.deleteMany({ where: { key } });
  },
};

const sessionStore: NodeSavedSessionStore = {
  async set(sub: string, session: NodeSavedSession) {
    await prisma.blueskyAuthSession.upsert({
      where: { key: sub },
      update: { session: JSON.stringify(session) },
      create: { key: sub, session: JSON.stringify(session) },
    });
  },
  async get(sub: string) {
    const row = await prisma.blueskyAuthSession.findUnique({
      where: { key: sub },
    });
    return row ? (JSON.parse(row.session) as NodeSavedSession) : undefined;
  },
  async del(sub: string) {
    await prisma.blueskyAuthSession.deleteMany({ where: { key: sub } });
  },
};

/**
 * Cross-process lock for token operations. AT Protocol refresh tokens are
 * single-use, and sessions are shared between the Express server and the
 * Trigger.dev workers that publish posts — a concurrent refresh from two
 * processes would revoke the session. A Postgres transaction-scoped advisory
 * lock serializes them since every process already shares the database.
 */
async function requestLock<T>(
  name: string,
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  const lockId = createHash("sha256").update(name).digest().readBigInt64BE(0);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
      return fn();
    },
    // Refreshes involve network round-trips; allow generous time.
    { maxWait: 30_000, timeout: 60_000 },
  );
}

function getRedirectUri(): string {
  const redirect = process.env.BLUESKY_REDIRECT;
  if (!redirect) {
    throw new Error(
      "BLUESKY_REDIRECT is not configured (full /connect/bluesky/callback URL)",
    );
  }
  return redirect;
}

function isLoopbackRedirect(redirect: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|\[::1\])(:\d+)?\//.test(redirect);
}

/** Base URL the bluesky connect endpoints are served under (…/connect/bluesky). */
export function getBlueskyPublicBase(): string {
  return getRedirectUri().replace(/\/callback\/?$/, "");
}

let clientPromise: Promise<NodeOAuthClient> | null = null;

export function getBlueskyClient(): Promise<NodeOAuthClient> {
  if (!clientPromise) {
    clientPromise = createClient().catch((error) => {
      // Don't cache a failed init (e.g. missing env) forever.
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

async function createClient(): Promise<NodeOAuthClient> {
  const redirect = getRedirectUri();

  // Local development: AT Protocol supports unregistered loopback clients
  // (client_id is a literal http://localhost URL carrying the config).
  if (isLoopbackRedirect(redirect)) {
    const clientId = buildAtprotoLoopbackClientId({
      scope: BLUESKY_SCOPE,
      redirect_uris: [redirect],
    });
    return new NodeOAuthClient({
      clientMetadata: atprotoLoopbackClientMetadata(clientId),
      stateStore,
      sessionStore,
      requestLock,
    });
  }

  const privateKey = process.env.BLUESKY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("BLUESKY_PRIVATE_KEY is not configured (ES256 key)");
  }

  const base = getBlueskyPublicBase();

  return new NodeOAuthClient({
    clientMetadata: {
      client_id: `${base}/client-metadata.json`,
      client_name: "Unsora",
      // Must stay on the client_id's domain — CLIENT_URL may point at
      // localhost in dev while the OAuth endpoints live on the public host.
      client_uri: new URL(redirect).origin,
      redirect_uris: [redirect],
      scope: BLUESKY_SCOPE,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_signing_alg: "ES256",
      dpop_bound_access_tokens: true,
      jwks_uri: `${base}/jwks.json`,
    },
    keyset: [await JoseKey.fromImportable(privateKey, "unsora-bluesky-1")],
    stateStore,
    sessionStore,
    requestLock,
  });
}

/** Build the authorization URL for a handle (or DID / PDS URL). */
export async function getBlueskyAuthUrl(
  handle: string,
  userId: string,
): Promise<string> {
  const client = await getBlueskyClient();
  const url = await client.authorize(handle, {
    state: userId,
    scope: BLUESKY_SCOPE,
  });
  return url.toString();
}

/** Complete the OAuth callback; returns the session and our userId (state). */
export async function handleBlueskyCallback(
  params: URLSearchParams,
): Promise<{ session: OAuthSession; userId: string }> {
  const client = await getBlueskyClient();
  const { session, state } = await client.callback(params);
  if (!state) {
    throw new Error("Missing OAuth state");
  }
  return { session, userId: state };
}

/**
 * Restore a stored session for a DID and wrap it in an API agent. Expired
 * access tokens are refreshed transparently and persisted back to the store.
 */
export async function getBlueskyAgent(did: string): Promise<Agent> {
  const client = await getBlueskyClient();
  try {
    const session = await client.restore(did);
    return new Agent(session);
  } catch (error) {
    console.error(`Failed to restore Bluesky session for ${did}:`, error);
    throw new Error(
      "Bluesky session is invalid or was revoked. Please reconnect your account.",
    );
  }
}

/** Delete the stored OAuth session (used when an account is disconnected). */
export async function revokeBlueskySession(did: string): Promise<void> {
  try {
    const client = await getBlueskyClient();
    await client.revoke(did);
  } catch {
    // Best effort: make sure the local session is gone even if the
    // authorization server revocation fails.
    await sessionStore.del(did);
  }
}

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName: string | null;
  profilePicture: string | null;
}

/** Fetch the authenticated user's profile (avatar re-hosted in our storage). */
export async function getBlueskyProfile(
  agent: Agent,
): Promise<BlueskyProfile> {
  const did = agent.did as string;
  const { data } = await agent.getProfile({ actor: did });

  let uploadedProfilePicture: string | null = null;
  if (data.avatar) {
    try {
      const uploaded = await uploadUrlToStorage(data.avatar);
      uploadedProfilePicture = uploaded.fileUrl || null;
    } catch (error) {
      console.error("Failed to re-host Bluesky avatar:", error);
    }
  }

  return {
    did,
    handle: data.handle,
    displayName: data.displayName || null,
    profilePicture: uploadedProfilePicture,
  };
}
