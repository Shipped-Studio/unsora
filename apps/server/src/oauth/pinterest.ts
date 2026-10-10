import axios from "axios";
import { uploadUrlToStorage } from "../lib/upload";

/**
 * Pinterest OAuth (v5 API). Access tokens expire after ~30 days;
 * continuous refresh tokens last 60 days and rotate on each refresh, so a
 * new refresh_token in a refresh response must always be stored.
 *
 * Env: PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_REDIRECT
 */

export const PINTEREST_API = "https://api.pinterest.com/v5";

const pinterestScopes = [
  "user_accounts:read", // profile info at connect time
  "boards:read", // board picker for publishing
  "boards:write", // POST /pins also requires it (Pinterest answers 401 code 3 without)
  "pins:read", // pin analytics
  "pins:write", // create pins
];

function basicAuthHeader(): string {
  const credentials = Buffer.from(
    `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

export function getPinterestAuthUrl(state: string): string {
  return `https://www.pinterest.com/oauth/?${new URLSearchParams({
    client_id: process.env.PINTEREST_APP_ID as string,
    redirect_uri: process.env.PINTEREST_REDIRECT as string,
    response_type: "code",
    scope: pinterestScopes.join(","),
    state,
  })}`;
}

export async function exchangePinterestCode(code: string) {
  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.PINTEREST_REDIRECT as string,
    continuous_refresh: "true",
  });

  const res = await axios.post(`${PINTEREST_API}/oauth/token`, formData, {
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.data.access_token) {
    console.error("Pinterest token response missing fields:", res.data);
    throw new Error("Invalid Pinterest token response");
  }

  // { access_token, refresh_token, expires_in, refresh_token_expires_in, scope }
  return res.data;
}

export async function refreshPinterestToken(refreshToken: string) {
  const formData = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await axios.post(`${PINTEREST_API}/oauth/token`, formData, {
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.data.access_token) {
    console.error("Pinterest refresh response missing fields:", res.data);
    throw new Error("Invalid Pinterest refresh response");
  }

  // Continuous refresh rotates the refresh_token — callers must store it.
  return res.data;
}

export async function getPinterestUser(accessToken: string) {
  try {
    const res = await axios.get(`${PINTEREST_API}/user_account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let uploadedProfilePicture: string | null = null;
    if (res.data.profile_image) {
      try {
        const uploaded = await uploadUrlToStorage(res.data.profile_image);
        uploadedProfilePicture = uploaded.fileUrl || null;
      } catch (uploadError) {
        console.error("Failed to re-host Pinterest avatar:", uploadError);
      }
    }

    return {
      id: res.data.id as string,
      username: (res.data.username as string) || null,
      accountType: (res.data.account_type as string) || null,
      profilePicture: uploadedProfilePicture,
    };
  } catch (error: any) {
    console.error(
      "Error fetching Pinterest user:",
      error?.response?.data || error,
    );
    return null;
  }
}

export interface PinterestBoard {
  id: string;
  name: string;
  privacy: string;
}

export async function getPinterestBoards(
  accessToken: string,
): Promise<PinterestBoard[]> {
  const boards: PinterestBoard[] = [];
  let bookmark: string | undefined;

  do {
    const res = await axios.get(`${PINTEREST_API}/boards`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { page_size: 100, ...(bookmark ? { bookmark } : {}) },
    });

    for (const board of res.data?.items ?? []) {
      boards.push({
        id: board.id,
        name: board.name,
        privacy: board.privacy,
      });
    }
    bookmark = res.data?.bookmark || undefined;
  } while (bookmark);

  return boards;
}
