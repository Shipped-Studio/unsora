// src/oauth/facebook.js
import axios from "axios";
import { uploadUrlToStorage } from "../lib/upload";

const facebookScopes = [
  "pages_show_list", // list the user's Pages at connect time
  "pages_read_engagement", // read likes/comments/shares on Page posts
  "pages_manage_posts", // publish posts/photos/videos to the Page
  "read_insights", // post impressions & video views for analytics
];

export function getFacebookAuthUrl(state: string): string {
  return `https://www.facebook.com/v24.0/dialog/oauth?${new URLSearchParams({
    client_id: process.env.FB_APP_ID as string,
    redirect_uri: process.env.FB_REDIRECT as string,
    state,
    scope: facebookScopes.join(","),
  })}`;
}

export async function exchangeFacebookCode(code: string) {
  const url =
    `https://graph.facebook.com/v24.0/oauth/access_token?` +
    new URLSearchParams({
      client_id: process.env.FB_APP_ID as string,
      client_secret: process.env.FB_APP_SECRET as string,
      redirect_uri: process.env.FB_REDIRECT as string,
      code,
    });

  const res = await axios.get(url);
  return res.data; // access_token
}

/**
 * List the user's Pages. Call with a LONG-LIVED user token: the page
 * access_tokens returned then never expire on their own.
 */
export async function getFacebookPages(accessToken: string) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v24.0/me/accounts`,
      {
        params: {
          access_token: accessToken,
          fields: "id,name,username,access_token",
        },
      }
    );

    if (res.data.data && res.data.data.length > 0) {
      return res.data.data;
    }

    return null;
  } catch (error: any) {
    console.error(
      "Error fetching Facebook pages:",
      error?.response?.data || error
    );
    return null;
  }
}

export async function getFacebookPagePicture(
  pageId: string,
  accessToken: string
) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v24.0/${pageId}/picture?redirect=false&access_token=${accessToken}`
    );
    const pictureUrl = res.data.data?.url || null;

    if (!pictureUrl) {
      return null;
    }

    const uploadedProfilePicture = await uploadUrlToStorage(pictureUrl);
    return uploadedProfilePicture.fileUrl || null;
  } catch (error) {
    console.error("Error fetching Facebook page picture:", error);
    return null;
  }
}

export async function refreshFacebookToken(accessToken: string) {
  // FB issues long-lived tokens (60 days)
  const url =
    `https://graph.facebook.com/v24.0/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.FB_APP_ID as string,
      client_secret: process.env.FB_APP_SECRET as string,
      fb_exchange_token: accessToken,
    });

  const res = await axios.get(url);
  return res.data;
}

// ✅ Disconnect Facebook USER from your app
export async function disconnectFacebookUser(userAccessToken: string) {
  try {
    const res = await axios.delete(
      "https://graph.facebook.com/v24.0/me/permissions",
      {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      }
    );

    return {
      success: true,
      data: res.data,
    };
  } catch (error: any) {
    console.error(
      "Error disconnecting Facebook user:",
      error?.response?.data || error.message
    );

    throw error;
  }
}
