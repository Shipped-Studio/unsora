// src/oauth/instagram.js
import axios from "axios";
import { uploadUrlToStorage } from "../lib/upload";

// Instagram  - redirect to Instagram
export function getInstagramAuthUrl(state: string) {
  return `https://www.instagram.com/oauth/authorize?${new URLSearchParams({
    enable_fb_login: "0",
    client_id: process.env.IG_APP_ID as string,
    redirect_uri: process.env.IG_REDIRECT as string,
    response_type: "code",
    state,
    scope: [
      "instagram_business_basic",
      "instagram_business_content_publish",
      // Needed to read views/shares/saves via the insights API for analytics.
      "instagram_business_manage_insights",
    ].join(","),
  })}`;
}

// Exchange code for access token
export async function exchangeInstagramCode(code: string) {
  const formData = new URLSearchParams();
  formData.append("client_id", process.env.IG_APP_ID as string);
  formData.append("client_secret", process.env.IG_APP_SECRET as string);
  formData.append("grant_type", "authorization_code");
  formData.append("redirect_uri", process.env.IG_REDIRECT as string);
  formData.append("code", code);

  const res = await axios.post(
    `https://api.instagram.com/oauth/access_token`,
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  return res.data;
}

// Get Instagram Business Account connected to Facebook Pages
export async function getInstagramBusinessAccount(accessToken: string) {
  try {
    const res = await axios.get("https://graph.instagram.com/v21.0/me", {
      params: {
        fields: "user_id,username,name,profile_picture_url",
        access_token: accessToken,
      },
    });

    // Re-host the avatar in our storage: Instagram CDN URLs are signed and
    // expire after a few days, so storing them directly breaks avatars.
    let uploadedProfilePicture: string | null = null;
    if (res.data.profile_picture_url) {
      try {
        const uploaded = await uploadUrlToStorage(res.data.profile_picture_url);
        uploadedProfilePicture = uploaded.fileUrl || null;
      } catch (uploadError) {
        console.error("Failed to re-host Instagram avatar:", uploadError);
      }
    }

    return {
      id: res.data.user_id,
      username: res.data.username || null,
      name: res.data.name || null,
      profilePicture: uploadedProfilePicture,
    };
  } catch (error: any) {
    console.error("Instagram API error:", {
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      params: {
        ...error.config?.params,
        access_token: "[redacted]",
      },
    });

    return null;
  }
}

export async function getInstagramAccountInfo(accessToken: string) {
  try {
    const res = await axios.get(`https://graph.instagram.com/v24.0/me`, {
      params: {
        fields: "id,username,profile_picture_url",
        access_token: accessToken,
      },
    });

    let uploadedProfilePicture: string | null = null;
    if (res.data.profile_picture_url) {
      const uploaded = await uploadUrlToStorage(res.data.profile_picture_url);
      uploadedProfilePicture = uploaded.fileUrl || null;
    }

    return {
      username: res.data.username || null,
      profilePicture: uploadedProfilePicture,
    };
  } catch (error) {
    console.error("Error fetching Instagram account info:", error);
    return null;
  }
}

// Exchange short-lived token for long-lived token (for Instagram Business API)
export async function exchangeForLongLivedToken(accessToken: string) {
  try {
    const res = await axios.get(`https://graph.instagram.com/access_token`, {
      params: {
        grant_type: "ig_exchange_token",
        client_secret: process.env.IG_APP_SECRET,
        access_token: accessToken,
      },
    });

    return res.data; // { access_token, token_type, expires_in }
  } catch (error: any) {
    const detail =
      error.response?.data?.error?.message ||
      error.response?.data?.error_message ||
      error.message;
    console.error("Error exchanging for long-lived token:", detail);
    throw new Error(`Instagram long-lived token exchange failed: ${detail}`);
  }
}

// Refresh an existing long-lived token (extends expiry by 60 days). Note:
// Instagram only refreshes long-lived tokens that are at least 24 hours old.
export async function refreshInstagramToken(accessToken: string) {
  try {
    const res = await axios.get(
      "https://graph.instagram.com/refresh_access_token",
      {
        params: {
          grant_type: "ig_refresh_token",
          access_token: accessToken,
        },
      },
    );

    return res.data; // { access_token, token_type, expires_in }
  } catch (error: any) {
    const detail = error.response?.data?.error?.message || error.message;
    console.error("Error refreshing Instagram token:", detail);
    throw new Error(`Instagram token refresh failed: ${detail}`);
  }
}

export async function disconnectInstagramUser(accessToken: string) {
  try {
    const res = await axios.delete(
      `https://graph.instagram.com/v24.0/me/permissions`,
      {
        params: {
          access_token: accessToken,
        },
      },
    );

    return res.data;
  } catch (error) {
    console.error("Error disconnecting Instagram user:", error);
    throw error;
  }
}
