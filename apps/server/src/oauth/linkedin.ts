import axios from "axios";
import { uploadUrlToStorage } from "../lib/upload";

/**
 * LinkedIn OAuth 2.0 (3-legged). Access tokens last 60 days. Refresh tokens
 * are only issued to apps with programmatic refresh enabled (approved
 * Marketing/Community partners) — standard apps get no refresh_token and the
 * member must reconnect when the token expires.
 *
 * Profile info comes from the OpenID Connect /v2/userinfo endpoint (openid +
 * profile scopes); posting as the member needs w_member_social ("Share on
 * LinkedIn" product).
 *
 * Env: LINKEDIN_APP_ID, LINKEDIN_APP_SECRET, LINKEDIN_REDIRECT
 */

const LINKEDIN_OAUTH = "https://www.linkedin.com/oauth/v2";
const LINKEDIN_API = "https://api.linkedin.com";

const linkedinScopes = [
  "openid", // OpenID Connect sign-in
  "profile", // name + picture at connect time
  "email", // account email (shown in the dashboard)
  "w_member_social", // create posts on the member's behalf
];

export function getLinkedInAuthUrl(state: string): string {
  return `${LINKEDIN_OAUTH}/authorization?${new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_APP_ID as string,
    redirect_uri: process.env.LINKEDIN_REDIRECT as string,
    scope: linkedinScopes.join(" "),
    state,
  })}`;
}

export async function exchangeLinkedInCode(code: string) {
  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.LINKEDIN_APP_ID as string,
    client_secret: process.env.LINKEDIN_APP_SECRET as string,
    redirect_uri: process.env.LINKEDIN_REDIRECT as string,
  });

  const res = await axios.post(`${LINKEDIN_OAUTH}/accessToken`, formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.data.access_token) {
    console.error("LinkedIn token response missing fields:", res.data);
    throw new Error("Invalid LinkedIn token response");
  }

  // { access_token, expires_in, scope, refresh_token?, refresh_token_expires_in? }
  return res.data;
}

export async function refreshLinkedInToken(refreshToken: string) {
  const formData = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_APP_ID as string,
    client_secret: process.env.LINKEDIN_APP_SECRET as string,
  });

  const res = await axios.post(`${LINKEDIN_OAUTH}/accessToken`, formData, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.data.access_token) {
    console.error("LinkedIn refresh response missing fields:", res.data);
    throw new Error("Invalid LinkedIn refresh response");
  }

  return res.data;
}

export async function getLinkedInUser(accessToken: string) {
  try {
    const res = await axios.get(`${LINKEDIN_API}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let uploadedProfilePicture: string | null = null;
    if (res.data.picture) {
      try {
        const uploaded = await uploadUrlToStorage(res.data.picture);
        uploadedProfilePicture = uploaded.fileUrl || null;
      } catch (uploadError) {
        console.error("Failed to re-host LinkedIn avatar:", uploadError);
      }
    }

    return {
      // OpenID `sub` — stable member id, also the urn:li:person:{id} id.
      id: res.data.sub as string,
      name: (res.data.name as string) || null,
      email: (res.data.email as string) || null,
      profilePicture: uploadedProfilePicture,
    };
  } catch (error: any) {
    console.error(
      "Error fetching LinkedIn user:",
      error?.response?.data || error,
    );
    return null;
  }
}
