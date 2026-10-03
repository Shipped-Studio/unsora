import axios from "axios";
import { createHash } from "crypto";
import { uploadUrlToStorage } from "../lib/upload";

/**
 * X (Twitter) OAuth 2.0 authorization code flow with PKCE, as a confidential
 * client. Access tokens last 2 hours. offline.access issues a refresh token
 * that rotates on every refresh, so the new refresh_token must always be
 * stored (the token refresh service serializes refreshes per account).
 *
 * Env: X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT
 */

const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const X_API = "https://api.x.com/2";

const xScopes = [
  "tweet.read", // read back published posts and their metrics
  "tweet.write", // create posts
  "users.read", // profile info at connect time
  "media.write", // upload images and video
  "offline.access", // refresh token
];

function basicAuthHeader(): string {
  const credentials = Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

/** S256 challenge for a PKCE code verifier. */
function codeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function getXAuthUrl(state: string, codeVerifier: string): string {
  return `${X_AUTHORIZE_URL}?${new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID as string,
    redirect_uri: process.env.X_REDIRECT as string,
    scope: xScopes.join(" "),
    state,
    code_challenge: codeChallenge(codeVerifier),
    code_challenge_method: "S256",
  })}`;
}

export async function exchangeXCode(code: string, codeVerifier: string) {
  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.X_REDIRECT as string,
    code_verifier: codeVerifier,
    client_id: process.env.X_CLIENT_ID as string,
  });

  const res = await axios.post(`${X_API}/oauth2/token`, formData, {
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.data.access_token) {
    console.error("X token response missing fields:", res.data);
    throw new Error("Invalid X token response");
  }

  // { token_type, access_token, refresh_token, expires_in, scope }
  return res.data;
}

export async function refreshXToken(refreshToken: string) {
  const formData = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.X_CLIENT_ID as string,
  });

  const res = await axios.post(`${X_API}/oauth2/token`, formData, {
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.data.access_token) {
    console.error("X refresh response missing fields:", res.data);
    throw new Error("Invalid X refresh response");
  }

  // The refresh_token rotates — callers must store the new one.
  return res.data;
}

export async function getXUser(accessToken: string) {
  try {
    const res = await axios.get(`${X_API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { "user.fields": "profile_image_url,username,name" },
    });

    const user = res.data?.data;
    if (!user?.id) return null;

    let uploadedProfilePicture: string | null = null;
    if (user.profile_image_url) {
      try {
        // The default URL is a 48px "_normal" variant; ask for the full size.
        const fullSize = String(user.profile_image_url).replace(
          "_normal.",
          "_400x400.",
        );
        const uploaded = await uploadUrlToStorage(fullSize);
        uploadedProfilePicture = uploaded.fileUrl || null;
      } catch (uploadError) {
        console.error("Failed to re-host X avatar:", uploadError);
      }
    }

    return {
      id: user.id as string,
      name: (user.name as string) || null,
      username: (user.username as string) || null,
      profilePicture: uploadedProfilePicture,
    };
  } catch (error: any) {
    console.error("Error fetching X user:", error?.response?.data || error);
    return null;
  }
}

/** Best-effort token revocation on disconnect. */
export async function revokeXToken(token: string): Promise<void> {
  try {
    await axios.post(
      `${X_API}/oauth2/revoke`,
      new URLSearchParams({
        token,
        client_id: process.env.X_CLIENT_ID as string,
      }),
      {
        headers: {
          Authorization: basicAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
  } catch (error: any) {
    console.error("X token revoke failed:", error?.response?.data || error);
  }
}
