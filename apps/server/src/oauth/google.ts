// src/oauth/google.js
import axios from "axios";
import querystring from "querystring";
import { uploadUrlToStorage } from "../lib/upload";

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function getGoogleAuthUrl(state) {
  return `${GOOGLE_OAUTH_URL}?${querystring.stringify({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/youtube.upload", // Upload videos
      "https://www.googleapis.com/auth/youtube.readonly", // Read channel info
    ].join(" "),
    access_type: "offline",
    prompt: "consent", // Always show consent screen to ensure user sees all permissions
    state,
  })}`;
}

/**
 * Verify that an access token has the required scopes for YouTube upload
 */
export async function verifyYouTubeScopes(accessToken) {
  try {
    const res = await axios.get(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    );

    const requiredScopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ];

    const grantedScopes = res.data.scope?.split(" ") || [];
    const missingScopes = requiredScopes.filter(
      (scope) => !grantedScopes.includes(scope)
    );

    return {
      valid: missingScopes.length === 0,
      missingScopes,
      grantedScopes,
    };
  } catch (error) {
    console.error("Error verifying YouTube scopes:", error);
    return {
      valid: false,
      missingScopes: [],
      grantedScopes: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function exchangeGoogleCode(code) {
  const res = await axios.post(
    GOOGLE_TOKEN_URL,
    querystring.stringify({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data;
}

export async function getGoogleUser(accessToken) {
  const res = await axios.get(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data; // { sub, email, ... }
}

export async function getYouTubeChannelInfo(accessToken) {
  try {
    const res = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (res.data.items && res.data.items.length > 0) {
      const channel = res.data.items[0];
      const uploadedProfilePicture = await uploadUrlToStorage(
        channel.snippet.thumbnails?.default?.url
      );

      return {
        id: channel.id,
        name: channel.snippet.title,
        // customUrl is the channel handle and already includes the leading
        // "@" (e.g. "@MyChannel") — strip it so the UI can add its own.
        username: channel.snippet.customUrl?.replace(/^@+/, "") || null,
        profilePicture: uploadedProfilePicture.fileUrl || null,
      };
    }
    // Empty items = the Google account exists but has no YouTube channel.
    return null;
  } catch (error: any) {
    const apiError = error?.response?.data?.error;
    const reason = apiError?.errors?.[0]?.reason;
    console.error(
      "Error fetching YouTube channel info:",
      apiError || error?.message || error,
    );

    // Surface the real cause instead of collapsing everything into
    // "no channel found".
    switch (reason) {
      case "authenticatedUserAccountSuspended":
        throw new Error(
          "This Google account's YouTube channel is suspended, so it cannot be connected.",
        );
      case "authenticatedUserAccountClosed":
        throw new Error(
          "This Google account's YouTube channel has been closed, so it cannot be connected.",
        );
      case "accessNotConfigured":
        throw new Error(
          "YouTube Data API is not enabled for this application. Please contact support.",
        );
      case "quotaExceeded":
        throw new Error("YouTube API quota exceeded. Please try again later.");
      case "youtubeSignupRequired":
        return null; // treated as "no channel" by callers
    }

    throw new Error(
      apiError?.message || "Failed to fetch YouTube channel info",
    );
  }
}

export async function refreshGoogleToken(refreshToken) {
  const res = await axios.post(
    GOOGLE_TOKEN_URL,
    querystring.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    })
  );
  return res.data;
}
