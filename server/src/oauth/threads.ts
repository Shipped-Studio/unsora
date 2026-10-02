import axios from "axios";
import { uploadUrlToStorage } from "../lib/upload";

/**
 * Threads OAuth (Meta, but fully separate from Facebook/Instagram):
 * own app id, own tokens, own graph.threads.net endpoints. Long-lived
 * tokens last ~60 days and are refreshed via th_refresh_token (the token
 * must be at least 24h old and still valid to refresh).
 *
 * Env: THREADS_APP_ID, THREADS_APP_SECRET, THREADS_REDIRECT
 */

const THREADS_GRAPH = "https://graph.threads.net";

const threadsScopes = [
  "threads_basic", // profile + media reading
  "threads_content_publish", // create/publish containers
  "threads_manage_insights", // post + account insights
];

export function getThreadsAuthUrl(state: string): string {
  return `https://threads.net/oauth/authorize?${new URLSearchParams({
    client_id: process.env.THREADS_APP_ID as string,
    redirect_uri: process.env.THREADS_REDIRECT as string,
    scope: threadsScopes.join(","),
    response_type: "code",
    state,
  })}`;
}

/** Exchange the auth code for a short-lived token (+ threads user id). */
export async function exchangeThreadsCode(code: string) {
  const formData = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID as string,
    client_secret: process.env.THREADS_APP_SECRET as string,
    grant_type: "authorization_code",
    redirect_uri: process.env.THREADS_REDIRECT as string,
    code,
  });

  const res = await axios.post(`${THREADS_GRAPH}/oauth/access_token`, formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.data.access_token || !res.data.user_id) {
    console.error("Threads token response missing fields:", res.data);
    throw new Error("Invalid Threads token response");
  }

  return res.data; // { access_token, user_id }
}

/** Upgrade a short-lived token to a long-lived (~60 day) token. */
export async function exchangeForLongLivedThreadsToken(accessToken: string) {
  const res = await axios.get(`${THREADS_GRAPH}/access_token`, {
    params: {
      grant_type: "th_exchange_token",
      client_secret: process.env.THREADS_APP_SECRET as string,
      access_token: accessToken,
    },
  });

  return res.data; // { access_token, token_type, expires_in }
}

/** Refresh an unexpired long-lived token (must be at least 24h old). */
export async function refreshThreadsToken(accessToken: string) {
  const res = await axios.get(`${THREADS_GRAPH}/refresh_access_token`, {
    params: {
      grant_type: "th_refresh_token",
      access_token: accessToken,
    },
  });

  return res.data; // { access_token, token_type, expires_in }
}

export async function getThreadsProfile(accessToken: string) {
  try {
    const res = await axios.get(`${THREADS_GRAPH}/v1.0/me`, {
      params: {
        fields: "id,username,name,threads_profile_picture_url",
        access_token: accessToken,
      },
    });

    // Re-host the avatar: Meta CDN URLs are signed and expire.
    let uploadedProfilePicture: string | null = null;
    if (res.data.threads_profile_picture_url) {
      try {
        const uploaded = await uploadUrlToStorage(
          res.data.threads_profile_picture_url,
        );
        uploadedProfilePicture = uploaded.fileUrl || null;
      } catch (uploadError) {
        console.error("Failed to re-host Threads avatar:", uploadError);
      }
    }

    return {
      id: res.data.id as string,
      username: (res.data.username as string) || null,
      name: (res.data.name as string) || null,
      profilePicture: uploadedProfilePicture,
    };
  } catch (error: any) {
    console.error(
      "Error fetching Threads profile:",
      error?.response?.data || error,
    );
    return null;
  }
}
