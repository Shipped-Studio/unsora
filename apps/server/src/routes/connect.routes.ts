import express from "express";
import { ConnectController } from "../controllers/connect.controller";
import { requireAuth } from "../middleware/auth";
import { checkSocialAccountLimit } from "../middleware/check-limit";
import { requireSchedulerAccess } from "../middleware/require-scheduler-access";
import { platformAvailability, requirePlatform } from "../lib/platforms";

const router = express.Router();
const connectController = new ConnectController();

// Which platforms are live on this deployment (lib/platforms.ts).
router.get("/platforms", requireAuth, async (_req, res) => {
  res.json({ success: true, data: await platformAvailability() });
});

// AUTH URL ENDPOINTS — scheduler access (paid plan or free tier), then the account limit
router.get(
  "/google",
  requireAuth,
  requirePlatform("google"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getGoogleAuthUrl
);
router.get(
  "/tiktok",
  requireAuth,
  requirePlatform("tiktok"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getTikTokAuthUrl
);
router.get(
  "/facebook",
  requireAuth,
  requirePlatform("facebook"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getFacebookAuthUrl
);
router.get(
  "/instagram",
  requireAuth,
  requirePlatform("instagram"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getInstagramAuthUrl
);
// Instagram through Facebook Login (Page-linked professional accounts).
router.get(
  "/instagram/facebook",
  requireAuth,
  requirePlatform("instagram_facebook"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getInstagramFacebookAuthUrl
);
router.get(
  "/bluesky",
  requireAuth,
  requirePlatform("bluesky"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getBlueskyAuthUrl
);
router.get(
  "/threads",
  requireAuth,
  requirePlatform("threads"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getThreadsAuthUrl
);
router.get(
  "/pinterest",
  requireAuth,
  requirePlatform("pinterest"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getPinterestAuthUrl
);
router.get(
  "/linkedin",
  requireAuth,
  requirePlatform("linkedin"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getLinkedInAuthUrl
);
router.get(
  "/x",
  requireAuth,
  requirePlatform("x"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getXAuthUrl
);
router.get(
  "/google_business",
  requireAuth,
  requirePlatform("google_business"),
  requireSchedulerAccess,
  checkSocialAccountLimit,
  connectController.getGoogleBusinessAuthUrl
);

// BLUESKY (AT PROTOCOL) CLIENT DISCOVERY — must be public: the URL of
// client-metadata.json is the OAuth client_id, and authorization servers
// fetch both documents during the authorization flow.
router.get(
  "/bluesky/client-metadata.json",
  connectController.serveBlueskyClientMetadata
);
router.get("/bluesky/jwks.json", connectController.serveBlueskyJwks);

// CALLBACK HANDLERS — no auth middleware: these are browser redirects from
// the provider (no Clerk context guaranteed); the user is identified via the
// OAuth `state` parameter, and plan/limit checks already ran on the auth-URL
// endpoints above.
router.get("/google/callback", connectController.handleGoogleCallback);
// TikTok OAuth redirect. Path intentionally avoids the "tiktok" substring:
// TikTok app review rejects redirect URIs containing their brand name.
router.get("/tt/callback", connectController.handleTikTokCallback);
router.get("/facebook/callback", connectController.handleFacebookCallback);
router.get("/instagram/callback", connectController.handleInstagramCallback);
router.get(
  "/instagram/facebook/callback",
  connectController.handleInstagramFacebookCallback
);
router.get("/bluesky/callback", connectController.handleBlueskyCallback);
router.get("/threads/callback", connectController.handleThreadsCallback);
router.get("/pinterest/callback", connectController.handlePinterestCallback);
router.get("/linkedin/callback", connectController.handleLinkedInCallback);
router.get("/x/callback", connectController.handleXCallback);
router.get(
  "/google_business/callback",
  connectController.handleGoogleBusinessCallback
);

// ACCOUNT MANAGEMENT
router.get(
  "/accounts",
  requireAuth,
  connectController.getConnectedAccounts,
);
router.post(
  "/accounts/:accountId/refresh",
  requireAuth,
  connectController.refreshAccount
);
router.delete(
  "/accounts/:accountId",
  requireAuth,
  connectController.disconnectAccount
);

// TIKTOK CREATOR INFO - Required for posting to TikTok
router.get(
  "/tiktok/:accountId/creator-info",
  requireAuth,
  connectController.getTikTokCreatorInfo
);

// PINTEREST BOARDS - target board selection for pin publishing
router.get(
  "/pinterest/:accountId/boards",
  requireAuth,
  connectController.getPinterestBoards
);

export default router;
