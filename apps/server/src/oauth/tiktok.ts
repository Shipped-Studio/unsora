// src/oauth/tiktok.js
import axios from "axios";
import { uploadUrlToStorage } from "../lib/upload";

/**
 * TikTok Creator Info Response Types
 */
export interface TikTokCreatorInfo {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
  can_post: boolean;
  can_post_reason?: string;
}

/**
 * Get TikTok Creator Info for Content Posting
 * This is required before posting to TikTok to get:
 * - Available privacy options
 * - Interaction settings (comment, duet, stitch)
 * - Max video duration
 * - Whether the creator can currently post
 */
export async function getTikTokCreatorInfo(
  accessToken: string,
): Promise<TikTokCreatorInfo | null> {
  try {
    const res = await axios.post(
      "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (res.data.data) {
      const data = res.data.data;

      // Check if creator can post
      let canPost = true;
      let canPostReason: string | undefined;

      // TikTok may return error if creator has reached posting limit
      if (res.data.error && res.data.error.code !== "ok") {
        canPost = false;
        canPostReason =
          res.data.error.message || "Creator cannot post at this time";
      }

      return {
        creator_avatar_url: data.creator_avatar_url || "",
        creator_username: data.creator_username || "",
        creator_nickname: data.creator_nickname || "",
        privacy_level_options: data.privacy_level_options || ["SELF_ONLY"],
        comment_disabled: data.comment_disabled || false,
        duet_disabled: data.duet_disabled || false,
        stitch_disabled: data.stitch_disabled || false,
        max_video_post_duration_sec: data.max_video_post_duration_sec || 600,
        can_post: canPost,
        can_post_reason: canPostReason,
      };
    }
    return null;
  } catch (error: any) {
    console.error(
      "Error fetching TikTok creator info:",
      error?.response?.data || error,
    );

    // Handle specific error codes
    if (error?.response?.data?.error?.code === "spam_risk_too_many_posts") {
      return {
        creator_avatar_url: "",
        creator_username: "",
        creator_nickname: "",
        privacy_level_options: ["SELF_ONLY"],
        comment_disabled: false,
        duet_disabled: false,
        stitch_disabled: false,
        max_video_post_duration_sec: 600,
        can_post: false,
        can_post_reason:
          "You have reached the daily posting limit. Please try again later.",
      };
    }

    return null;
  }
}

export function getTikTokAuthUrl(state) {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY as string,
    response_type: "code",
    scope: "user.info.basic,video.publish,video.list",
    redirect_uri: process.env.TIKTOK_REDIRECT as string,
    state: state,
  });

  return `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
}

export async function exchangeTikTokCode(code) {
  const formData = new URLSearchParams();
  formData.append("client_key", process.env.TIKTOK_CLIENT_KEY as string);
  formData.append("client_secret", process.env.TIKTOK_CLIENT_SECRET as string);
  formData.append("grant_type", "authorization_code");
  formData.append("redirect_uri", process.env.TIKTOK_REDIRECT as string);
  formData.append("code", code);

  const res = await axios.post(
    "https://open.tiktokapis.com/v2/oauth/token/",
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  console.log(
    "TikTok token exchange response:",
    JSON.stringify(res.data, null, 2),
  );

  // TikTok API v2 returns error in the response body, not as HTTP error
  if (res.data.error) {
    throw new Error(
      res.data.error_description ||
        res.data.error ||
        "Failed to exchange TikTok code",
    );
  }

  // Validate required fields are present
  if (!res.data.access_token || !res.data.open_id) {
    console.error("TikTok token response missing required fields:", res.data);
    throw new Error(
      "Invalid TikTok token response - missing access_token or open_id",
    );
  }

  return res.data;
}

export async function getTikTokUserInfo(accessToken) {
  try {
    const res = await axios.get("https://open.tiktokapis.com/v2/user/info/", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        fields: "open_id,union_id,avatar_url,display_name",
      },
    });

    if (res.data.data && res.data.data.user) {
      const user = res.data.data.user;

      let uploadedProfilePicture: string | null = null;
      if (user.avatar_url) {
        const uploaded = await uploadUrlToStorage(user.avatar_url);
        uploadedProfilePicture = uploaded.fileUrl || null;
      }

      return {
        displayName: user.display_name || null,
        username: user.username || null,
        profilePicture: uploadedProfilePicture,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching TikTok user info:", error);
    return null;
  }
}

export async function refreshTikTokToken(refreshToken) {
  const formData = new URLSearchParams();
  formData.append("client_key", process.env.TIKTOK_CLIENT_KEY as string);
  formData.append("client_secret", process.env.TIKTOK_CLIENT_SECRET as string);
  formData.append("grant_type", "refresh_token");
  formData.append("refresh_token", refreshToken);

  const res = await axios.post(
    "https://open.tiktokapis.com/v2/oauth/token/",
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  // TikTok API v2 returns error in the response body, not as HTTP error
  if (res.data.error) {
    throw new Error(
      res.data.error_description ||
        res.data.error ||
        "Failed to refresh TikTok token",
    );
  }

  if (!res.data.access_token) {
    console.error("TikTok refresh response missing access_token:", res.data);
    throw new Error("Invalid TikTok refresh response - missing access_token");
  }

  return res.data;
}
