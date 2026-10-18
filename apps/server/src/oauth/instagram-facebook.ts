// src/oauth/instagram-facebook.ts
//
// Instagram connection through Facebook Login: the user signs in with
// Facebook, and each Instagram professional account linked to one of their
// Pages is connected using that Page's access token. Calls go to
// graph.facebook.com rather than graph.instagram.com.
import axios from "axios";
import type { SocialAccount } from "@prisma/client";
import { uploadUrlToStorage } from "../lib/upload";

const GRAPH_VERSION = "v24.0";

/** Marker stored in SocialAccount.scope for Instagram accounts connected via Facebook. */
export const FACEBOOK_LOGIN_SCOPE = "facebook_login";

const instagramFacebookScopes = [
  "instagram_basic", // read the linked Instagram account's profile and media
  "instagram_content_publish", // publish reels, photos and carousels
  "instagram_manage_insights", // views/shares/saves for analytics
  "pages_show_list", // list the user's Pages at connect time
  "pages_read_engagement", // required to read a Page's linked Instagram account
];

export function isFacebookLoginAccount(
  account: Pick<SocialAccount, "provider" | "scope">,
): boolean {
  return account.provider === "instagram" && account.scope === FACEBOOK_LOGIN_SCOPE;
}

/** Graph API root for an Instagram account, depending on how it was connected. */
export function instagramGraphBase(
  account: Pick<SocialAccount, "provider" | "scope">,
): string {
  return isFacebookLoginAccount(account)
    ? `https://graph.facebook.com/${GRAPH_VERSION}`
    : `https://graph.instagram.com/${GRAPH_VERSION}`;
}

/** True when the env needed for this flow is present. */
export function instagramFacebookConfigured(): boolean {
  return Boolean(
    process.env.FB_APP_ID?.trim() &&
      process.env.FB_APP_SECRET?.trim() &&
      process.env.IG_FB_REDIRECT?.trim(),
  );
}

export function getInstagramFacebookAuthUrl(state: string): string {
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${new URLSearchParams({
    client_id: process.env.FB_APP_ID as string,
    redirect_uri: process.env.IG_FB_REDIRECT as string,
    state,
    scope: instagramFacebookScopes.join(","),
  })}`;
}

export async function exchangeInstagramFacebookCode(code: string) {
  const res = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    {
      params: {
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        redirect_uri: process.env.IG_FB_REDIRECT,
        code,
      },
    },
  );
  return res.data; // { access_token, token_type, expires_in? }
}

/** Upgrade a short-lived user token so the Page tokens derived from it don't expire. */
export async function exchangeForLongLivedFacebookUserToken(accessToken: string) {
  const res = await axios.get(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        fb_exchange_token: accessToken,
      },
    },
  );
  return res.data;
}

export interface LinkedInstagramAccount {
  /** Instagram professional account id (the id used for publishing). */
  id: string;
  username: string | null;
  name: string | null;
  profilePicture: string | null;
  /** Access token of the Page the account is linked to. */
  pageAccessToken: string;
  pageId: string;
}

const PAGE_FIELDS =
  "id,access_token,instagram_business_account{id,username,name,profile_picture_url}";

/** Pages from /me/accounts. Pages managed through a Business portfolio may be missing here. */
async function listPagesFromAccounts(userAccessToken: string): Promise<any[]> {
  const pages: any[] = [];
  let url: string | null = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`;
  let params: Record<string, string> | undefined = {
    access_token: userAccessToken,
    fields: PAGE_FIELDS,
    limit: "100",
  };

  while (url) {
    const res: { data: any } = await axios.get(url, { params });
    pages.push(...(res.data?.data ?? []));
    // `paging.next` is a full URL that already carries the query string.
    url = res.data?.paging?.next ?? null;
    params = undefined;
  }
  return pages;
}

/**
 * Pages Facebook granted to the app, fetched by ID from the token's granular
 * scopes. /me/accounts leaves out Pages owned through a Business portfolio
 * unless business_management is granted; reading the Page directly works.
 */
async function listPagesFromGrant(userAccessToken: string): Promise<any[]> {
  try {
    const debug = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`, {
      params: {
        input_token: userAccessToken,
        access_token: `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`,
      },
    });
    const pageIds = new Set<string>();
    for (const grant of debug.data?.data?.granular_scopes ?? []) {
      if (grant.scope === "pages_show_list" || grant.scope === "pages_read_engagement") {
        for (const id of grant.target_ids ?? []) pageIds.add(String(id));
      }
    }

    const pages: any[] = [];
    for (const id of pageIds) {
      try {
        const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${id}`, {
          params: { access_token: userAccessToken, fields: PAGE_FIELDS },
        });
        pages.push(res.data);
      } catch (error: any) {
        console.error(
          "Could not read a granted Page:",
          error?.response?.data?.error?.message || error.message,
        );
      }
    }
    return pages;
  } catch (error: any) {
    console.error(
      "Could not read granted Pages from the token:",
      error?.response?.data?.error?.message || error.message,
    );
    return [];
  }
}

/**
 * Every Instagram professional account linked to a Page the user granted.
 * Pages without a linked account are skipped.
 */
export async function getLinkedInstagramAccounts(
  userAccessToken: string,
): Promise<LinkedInstagramAccount[]> {
  const hasInstagram = (page: any) => page?.instagram_business_account?.id && page?.access_token;

  let pages = await listPagesFromAccounts(userAccessToken);
  if (!pages.some(hasInstagram)) {
    pages = [...pages, ...(await listPagesFromGrant(userAccessToken))];
  }

  const accounts: LinkedInstagramAccount[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const ig = page.instagram_business_account;
    if (!hasInstagram(page) || seen.has(ig.id)) continue;
    seen.add(ig.id);

    // Re-host the avatar: Instagram CDN URLs are signed and expire.
    let profilePicture: string | null = null;
    if (ig.profile_picture_url) {
      try {
        const uploaded = await uploadUrlToStorage(ig.profile_picture_url);
        profilePicture = uploaded.fileUrl || null;
      } catch (uploadError) {
        console.error("Failed to re-host Instagram avatar:", uploadError);
      }
    }

    accounts.push({
      id: ig.id,
      username: ig.username || null,
      name: ig.name || null,
      profilePicture,
      pageAccessToken: page.access_token,
      pageId: page.id,
    });
  }

  return accounts;
}

/**
 * What Facebook actually granted, for logging when no Instagram account turns
 * up. Counts and permission names only: no tokens, no IDs.
 */
export async function describeFacebookGrant(userAccessToken: string) {
  const summary: Record<string, unknown> = {};
  const call = async (path: string, params: Record<string, string>) => {
    try {
      const res = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
        params,
      });
      return res.data;
    } catch (error: any) {
      return { __error: error?.response?.data?.error?.message || error.message };
    }
  };

  const permissions = await call("me/permissions", { access_token: userAccessToken });
  summary.permissions = permissions.__error
    ? permissions.__error
    : (permissions.data ?? []).map((p: any) => `${p.permission}:${p.status}`);

  const pages = await call("me/accounts", {
    access_token: userAccessToken,
    fields: "instagram_business_account{id}",
    limit: "100",
  });
  if (pages.__error) {
    summary.pages = pages.__error;
  } else {
    const list: any[] = pages.data ?? [];
    summary.pages = {
      returned: list.length,
      withLinkedInstagram: list.filter((p) => p.instagram_business_account?.id).length,
    };
  }

  // Granular grants: which assets each permission was given for.
  const debug = await call("debug_token", {
    input_token: userAccessToken,
    access_token: `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`,
  });
  summary.granularScopes = debug.__error
    ? debug.__error
    : (debug.data?.granular_scopes ?? []).map(
        (g: any) => `${g.scope}:${(g.target_ids ?? []).length} target(s)`,
      );

  return summary;
}

/** Fresh username and avatar for an account connected via Facebook. */
export async function getInstagramFacebookAccountInfo(
  igUserId: string,
  accessToken: string,
) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}`,
      {
        params: {
          fields: "username,profile_picture_url",
          access_token: accessToken,
        },
      },
    );

    let profilePicture: string | null = null;
    if (res.data.profile_picture_url) {
      const uploaded = await uploadUrlToStorage(res.data.profile_picture_url);
      profilePicture = uploaded.fileUrl || null;
    }

    return { username: res.data.username || null, profilePicture };
  } catch (error: any) {
    console.error(
      "Error fetching Instagram account info via Facebook:",
      error?.response?.data || error.message,
    );
    return null;
  }
}
