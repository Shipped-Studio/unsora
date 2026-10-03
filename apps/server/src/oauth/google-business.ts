import axios from "axios";
import { uploadUrlToStorage } from "../lib/upload";

/**
 * Google Business Profile OAuth. Reuses the YouTube Google OAuth client
 * (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) with its own redirect URI and the
 * business.manage scope, so refreshes go through refreshGoogleToken. Access
 * tokens last an hour; Google refresh tokens don't rotate.
 *
 * One Google login can manage many locations across several Business Profile
 * accounts. Each location becomes its own SocialAccount whose
 * providerAccountId is `accounts/{accountId}/locations/{locationId}`, the
 * parent path the v4 localPosts API needs.
 *
 * The Business Profile APIs are gated: the Google Cloud project needs
 * approved access, and the Account Management, Business Information and
 * My Business (v4) APIs enabled.
 *
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_BUSINESS_REDIRECT
 */

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNT_MANAGEMENT_API =
  "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFORMATION_API =
  "https://mybusinessbusinessinformation.googleapis.com/v1";
const MY_BUSINESS_V4_API = "https://mybusiness.googleapis.com/v4";

export function getGoogleBusinessAuthUrl(state: string): string {
  return `${GOOGLE_OAUTH_URL}?${new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: process.env.GOOGLE_BUSINESS_REDIRECT as string,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/business.manage",
    ].join(" "),
    access_type: "offline",
    // Always re-consent so Google returns a refresh token on reconnect too.
    prompt: "consent",
    state,
  })}`;
}

export async function exchangeGoogleBusinessCode(code: string) {
  const res = await axios.post(
    GOOGLE_TOKEN_URL,
    new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: process.env.GOOGLE_BUSINESS_REDIRECT as string,
      grant_type: "authorization_code",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  if (!res.data.access_token) {
    console.error("Google Business token response missing fields:", res.data);
    throw new Error("Invalid Google token response");
  }

  // { access_token, refresh_token, expires_in, scope, id_token }
  return res.data;
}

export interface GoogleBusinessLocation {
  /** `accounts/{accountId}/locations/{locationId}` */
  path: string;
  /** `locations/{locationId}`, stable across the accounts that can reach it. */
  locationName: string;
  title: string | null;
  /** First address line and city, or null for service-area businesses. */
  address: string | null;
}

/** Every location the signed-in Google user can manage, deduplicated. */
export async function getGoogleBusinessLocations(
  accessToken: string,
): Promise<GoogleBusinessLocation[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const accountNames: string[] = [];
  let accountsPage: string | undefined;
  do {
    const res = await axios.get(`${ACCOUNT_MANAGEMENT_API}/accounts`, {
      headers,
      params: { pageSize: 20, ...(accountsPage ? { pageToken: accountsPage } : {}) },
    });
    for (const account of res.data?.accounts ?? []) {
      if (account.name) accountNames.push(account.name as string);
    }
    accountsPage = res.data?.nextPageToken || undefined;
  } while (accountsPage);

  const byLocation = new Map<string, GoogleBusinessLocation>();
  for (const accountName of accountNames) {
    let locationsPage: string | undefined;
    do {
      const res = await axios.get(
        `${BUSINESS_INFORMATION_API}/${accountName}/locations`,
        {
          headers,
          params: {
            readMask: "name,title,storefrontAddress",
            pageSize: 100,
            ...(locationsPage ? { pageToken: locationsPage } : {}),
          },
        },
      );

      for (const location of res.data?.locations ?? []) {
        const locationName = location.name as string | undefined;
        // A location shared with a location group shows up under several
        // accounts; any one of them can post to it.
        if (!locationName || byLocation.has(locationName)) continue;

        byLocation.set(locationName, {
          path: `${accountName}/${locationName}`,
          locationName,
          title: (location.title as string) || null,
          address: formatAddress(location.storefrontAddress),
        });
      }
      locationsPage = res.data?.nextPageToken || undefined;
    } while (locationsPage);
  }

  return [...byLocation.values()];
}

/** Current title and address for one location, by its `accounts/../locations/..` path. */
export async function getGoogleBusinessLocation(
  accessToken: string,
  path: string,
): Promise<{ title: string | null; address: string | null } | null> {
  const locationName = path.slice(path.indexOf("locations/"));
  try {
    const res = await axios.get(`${BUSINESS_INFORMATION_API}/${locationName}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { readMask: "title,storefrontAddress" },
    });
    return {
      title: (res.data?.title as string) || null,
      address: formatAddress(res.data?.storefrontAddress),
    };
  } catch (error: any) {
    console.error(
      "Error fetching Google Business location:",
      error?.response?.data || error,
    );
    return null;
  }
}

/** First address line and city, or null for service-area businesses. */
function formatAddress(address: any): string | null {
  return (
    [address?.addressLines?.[0], address?.locality].filter(Boolean).join(", ") ||
    null
  );
}

/**
 * The location's logo or profile photo, re-hosted. Best effort: many
 * locations have neither, and the avatar then falls back to initials.
 */
export async function getGoogleBusinessLocationPicture(
  accessToken: string,
  path: string,
): Promise<string | null> {
  try {
    const res = await axios.get(`${MY_BUSINESS_V4_API}/${path}/media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { pageSize: 50 },
    });

    const items: any[] = res.data?.mediaItems ?? [];
    const pick =
      items.find((m) => m.locationAssociation?.category === "LOGO") ??
      items.find((m) => m.locationAssociation?.category === "PROFILE");
    const url = pick?.googleUrl || pick?.thumbnailUrl;
    if (!url) return null;

    const uploaded = await uploadUrlToStorage(url);
    return uploaded.fileUrl || null;
  } catch (error: any) {
    console.error(
      "Failed to fetch Google Business location picture:",
      error?.response?.data || error?.message || error,
    );
    return null;
  }
}
