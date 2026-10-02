import express from "express";
import { ConnectController } from "../controllers/connect.controller";
import { requireAuth } from "../middleware/auth";
import { checkSocialAccountLimit } from "../middleware/check-limit";
import { requirePaidPlan } from "../middleware/require-paid-plan";

const router = express.Router();
const connectController = new ConnectController();

// AUTH URL ENDPOINTS — gated behind an active paid plan
router.get(
  "/google",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getGoogleAuthUrl
);
router.get(
  "/tiktok",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getTikTokAuthUrl
);
router.get(
  "/facebook",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getFacebookAuthUrl
);
router.get(
  "/instagram",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getInstagramAuthUrl
);
router.get(
  "/bluesky",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getBlueskyAuthUrl
);
router.get(
  "/threads",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getThreadsAuthUrl
);
router.get(
  "/pinterest",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getPinterestAuthUrl
);
router.get(
  "/linkedin",
  requireAuth,
  requirePaidPlan,
  checkSocialAccountLimit,
  connectController.getLinkedInAuthUrl
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
router.get("/bluesky/callback", connectController.handleBlueskyCallback);
router.get("/threads/callback", connectController.handleThreadsCallback);
router.get("/pinterest/callback", connectController.handlePinterestCallback);
router.get("/linkedin/callback", connectController.handleLinkedInCallback);

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
