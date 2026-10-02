// src/services/tokenService.js
import { prisma } from "../lib/db";
import { refreshGoogleToken } from "../oauth/google.js";
import { refreshTikTokToken } from "../oauth/tiktok.js";
import { refreshFacebookToken } from "../oauth/facebook.js";
import { refreshInstagramToken } from "../oauth/instagram.js";

export async function ensureValidToken(accountId: string) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) throw new Error("Account not found");

  // Not expired → return token
  if (
    account.expiresAt &&
    account.expiresAt > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return account.accessToken;
  }

  // Refresh depending on provider
  let newToken;
  switch (account.provider) {
    case "google":
      newToken = await refreshGoogleToken(account.refreshToken as string);
      break;
    case "tiktok":
      newToken = await refreshTikTokToken(account.refreshToken as string);
      break;
    case "facebook":
      newToken = await refreshFacebookToken(account.accessToken as string);
      break;
    case "instagram":
      newToken = await refreshInstagramToken(account.accessToken as string);
      break;
    default:
      throw new Error("Unknown provider");
  }

  const expiresAt = newToken.expires_in
    ? new Date(Date.now() + newToken.expires_in * 1000)
    : null;

  const updated = await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      accessToken: newToken.access_token,
      refreshToken: newToken.refresh_token ?? account.refreshToken,
      expiresAt,
    },
  });

  return updated.accessToken;
}
