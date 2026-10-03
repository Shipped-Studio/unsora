import { Router } from "express";
import { publicApiMiddleware } from "../../../middleware/public-api";
import { requireApiAdmin } from "../../../middleware/admin";
import { requirePaidPlan } from "../../../middleware/require-paid-plan";
import { skillsController } from "../../../controllers/skills.controller";
import { PublicImageController } from "../controllers/image.controller";
import { PublicInfluencerStudioController } from "../controllers/influencer-studio.controller";
import { PublicThumbnailController } from "../controllers/thumbnail.controller";
import { PublicClippingController } from "../controllers/clipping.controller";
import { PublicImageStatusController } from "../controllers/image-status.controller";
import { PublicVideoController } from "../controllers/video.controller";
import { PublicVideoStatusController } from "../controllers/video-status.controller";
import { PublicMusicController } from "../controllers/music.controller";
import { PublicMusicStatusController } from "../controllers/music-status.controller";
import { PublicVoiceoverController } from "../controllers/voiceover.controller";
import { PublicVoiceoverStatusController } from "../controllers/voiceover-status.controller";
import { AccountsController } from "../controllers/accounts.controller";
import { PublicPostController } from "../controllers/post.controller";
import { PublicUserController } from "../controllers/user.controller";
import { PublicUploadController } from "../controllers/upload.controller";
import { PublicVideoProcessingController } from "../controllers/video-processing.controller";
import { ImageUpscaleController } from "../../../controllers/image-upscale.controller";
import { VideoUpscalerController } from "../../../controllers/video-upscaler.controller";
import { VideoController } from "../../../controllers/video.controller";
import { MotionControlController } from "../../../controllers/motion-control.controller";
import { AvatarGenerationController } from "../../../controllers/avatar-generation.controller";
import { MovieMaterialsController } from "../../../controllers/movie-materials.controller";
import { VoiceCloneController } from "../../../controllers/voice-clone.controller";
import { VoiceConversionController } from "../../../controllers/voice-conversion.controller";
import { PostController } from "../../../controllers/post.controller";
import { analyticsController } from "../../../controllers/analytics.controller";
import { ConnectController } from "../../../controllers/connect.controller";

const router = Router();

const imageController = new PublicImageController();
const influencerController = new PublicInfluencerStudioController();
const thumbnailController = new PublicThumbnailController();
const clippingController = new PublicClippingController();
const postController = new PublicPostController();
const accountsController = new AccountsController();
const userController = new PublicUserController();
const imageStatusController = new PublicImageStatusController();
const videoController = new PublicVideoController();
const videoStatusController = new PublicVideoStatusController();
const musicController = new PublicMusicController();
const musicStatusController = new PublicMusicStatusController();
const voiceoverController = new PublicVoiceoverController();
const voiceoverStatusController = new PublicVoiceoverStatusController();
const uploadController = new PublicUploadController();
const videoProcessingController = new PublicVideoProcessingController();

// App controllers reused as-is: they read req.auth.userId (the Clerk id), which
// the public auth middleware sets for API keys and OAuth tokens alike.
const imageUpscaleController = new ImageUpscaleController();
const videoUpscalerController = new VideoUpscalerController();
const appVideoController = new VideoController();
const motionControlController = new MotionControlController();
const avatarController = new AvatarGenerationController();
const movieMaterialsController = new MovieMaterialsController();
const voiceCloneController = new VoiceCloneController();
const voiceConversionController = new VoiceConversionController();
const appPostController = new PostController();
const connectController = new ConnectController();

// Auth is applied per-route (not router.use) so this router can be mounted
// at /api/v1 without intercepting non-matching paths — unmatched requests
// fall through to the internal routes and webhooks mounted after it.
const auth = publicApiMiddleware;

// Generation status
router.get("/image/status/:id", ...auth, imageStatusController.getStatus);
router.get("/video/status/:id", ...auth, videoStatusController.getStatus);
router.get("/music/status/:id", ...auth, musicStatusController.getStatus);
router.get(
  "/voiceovers/status/:id",
  ...auth,
  voiceoverStatusController.getStatus,
);

// Video generations (all video models)
router.post("/videos/create", ...auth, videoController.create);
router.get("/videos/all", ...auth, videoController.getGenerations);
router.delete("/videos/:generationId", ...auth, videoController.deleteGeneration);

// Image generations

router.post(
  "/image-generations/create",
  ...auth,
  imageController.createGeneration,
);
router.get("/image-generations/all", ...auth, imageController.getGenerations);
router.get(
  "/image-generations/:generationId",
  ...auth,
  imageController.getGeneration,
);
router.delete(
  "/image-generations/:generationId",
  ...auth,
  imageController.deleteGeneration,
);

// Music generations
router.post(
  "/music-generations/create",
  ...auth,
  musicController.createGeneration,
);
router.get("/music-generations/all", ...auth, musicController.getGenerations);
router.get(
  "/music-generations/:generationId",
  ...auth,
  musicController.getGeneration,
);
router.delete(
  "/music-generations/:generationId",
  ...auth,
  musicController.deleteGeneration,
);

// Voiceovers (script → speech, ElevenLabs Eleven v3 via WaveSpeed)
router.get("/voiceovers/voices", ...auth, voiceoverController.getVoices);
router.post("/voiceovers/create", ...auth, voiceoverController.createGeneration);
router.get("/voiceovers/all", ...auth, voiceoverController.getGenerations);
router.delete(
  "/voiceovers/:generationId",
  ...auth,
  voiceoverController.deleteGeneration,
);

// Influencer studio
router.post("/influencer-studio/create", ...auth, influencerController.create);
router.get("/influencer-studio/all", ...auth, influencerController.getAll);
router.delete(
  "/influencer-studio/:generationId",
  ...auth,
  influencerController.delete,
);

// Thumbnails
router.post("/thumbnails/create", ...auth, thumbnailController.createGeneration);
router.get("/thumbnails", ...auth, thumbnailController.getGenerations);
router.get(
  "/thumbnails/:generationId",
  ...auth,
  thumbnailController.getGeneration,
);
router.delete(
  "/thumbnails/:generationId",
  ...auth,
  thumbnailController.deleteGeneration,
);

// Clipping
router.post("/clippings/create", ...auth, clippingController.create);
router.get("/clippings/all", ...auth, clippingController.getAll);
router.get(
  "/clippings/status/:clippingId",
  ...auth,
  clippingController.refresh,
);
router.get(
  "/clippings/refresh/:clippingId",
  ...auth,
  clippingController.refresh,
);
router.get("/clippings/:clippingId", ...auth, clippingController.getOne);
router.delete(
  "/clippings/:clippingId/clips/:clipId",
  ...auth,
  clippingController.deleteClip,
);
router.delete("/clippings/:clippingId", ...auth, clippingController.deleteJob);

// Image upscaler — jobs poll via /image/status/:id
router.post(
  "/image-upscaler/create",
  ...auth,
  imageUpscaleController.createUpscale.bind(imageUpscaleController),
);
router.get(
  "/image-upscaler/all",
  ...auth,
  imageUpscaleController.getUpscales.bind(imageUpscaleController),
);
router.delete(
  "/image-upscaler/:jobId",
  ...auth,
  imageUpscaleController.deleteUpscale.bind(imageUpscaleController),
);

// Video upscaler — jobs poll via /video/status/:id
router.post(
  "/video-upscaler/create",
  ...auth,
  videoProcessingController.createUpscale,
);
router.get(
  "/video-upscaler/all",
  ...auth,
  videoUpscalerController.getAll.bind(videoUpscalerController),
);
router.delete(
  "/video-upscaler/:jobId",
  ...auth,
  videoUpscalerController.delete.bind(videoUpscalerController),
);

// Subtitle / watermark removal — jobs poll via /video/status/:id
router.post(
  "/watermark-removal/create",
  ...auth,
  videoProcessingController.createWatermarkRemoval,
);
router.get(
  "/watermark-removal/all",
  ...auth,
  videoProcessingController.getWatermarkRemovals,
);
router.delete(
  "/watermark-removal/:videoId",
  ...auth,
  appVideoController.deleteVideo.bind(appVideoController),
);

// Motion control (Kling) — jobs poll via /video/status/:id
router.post(
  "/motion-control/create",
  ...auth,
  motionControlController.createGeneration.bind(motionControlController),
);
router.get(
  "/motion-control/all",
  ...auth,
  motionControlController.getGenerations.bind(motionControlController),
);
router.delete(
  "/motion-control/:generationId",
  ...auth,
  motionControlController.deleteGeneration.bind(motionControlController),
);

// Talking avatars (AI Avatar Maker) — jobs poll via /video/status/:id
router.post(
  "/avatar-generations/create",
  ...auth,
  avatarController.createGeneration.bind(avatarController),
);
router.get(
  "/avatar-generations/all",
  ...auth,
  avatarController.getGenerations.bind(avatarController),
);
router.delete(
  "/avatar-generations/:generationId",
  ...auth,
  avatarController.deleteGeneration.bind(avatarController),
);

// Movie materials (character/location/storyboard references) — poll via
// /image/status/:id
router.post(
  "/movie-materials/create",
  ...auth,
  movieMaterialsController.create.bind(movieMaterialsController),
);
router.get(
  "/movie-materials/all",
  ...auth,
  movieMaterialsController.getAll.bind(movieMaterialsController),
);
router.delete(
  "/movie-materials/:generationId",
  ...auth,
  movieMaterialsController.delete.bind(movieMaterialsController),
);

// Voice clones — list returns presets, Eleven v3 voices, and the user's clones
router.get(
  "/voice-clones",
  ...auth,
  voiceCloneController.listVoices.bind(voiceCloneController),
);
router.post(
  "/voice-clones/create",
  ...auth,
  voiceCloneController.createClone.bind(voiceCloneController),
);
router.delete(
  "/voice-clones/:cloneId",
  ...auth,
  voiceCloneController.deleteClone.bind(voiceCloneController),
);

// Voice changer (speech-to-speech into a cloned voice) — poll via
// /voiceovers/status/:id
router.post(
  "/voice-conversions/create",
  ...auth,
  voiceConversionController.createConversion.bind(voiceConversionController),
);
router.get(
  "/voice-conversions/all",
  ...auth,
  voiceConversionController.getConversions.bind(voiceConversionController),
);
router.delete(
  "/voice-conversions/:conversionId",
  ...auth,
  voiceConversionController.deleteConversion.bind(voiceConversionController),
);

// Skills catalog — admin only (MCP `upload-skill` / `get-skill` /
// `update-skill` tools)
router.post(
  "/skills/upload",
  ...auth,
  requireApiAdmin,
  skillsController.upload.bind(skillsController),
);
router.get(
  "/skills/:idOrSlug",
  ...auth,
  requireApiAdmin,
  skillsController.adminGet.bind(skillsController),
);
router.patch(
  "/skills/:idOrSlug",
  ...auth,
  requireApiAdmin,
  skillsController.adminUpdate.bind(skillsController),
);

// Media uploads (stored in Supabase; recorded as Asset rows)
router.post("/uploads", ...auth, uploadController.create);
router.post("/uploads/signed-url", ...auth, uploadController.createSignedUrl);
router.post("/uploads/complete", ...auth, uploadController.complete);
router.get("/uploads", ...auth, uploadController.list);
router.delete("/uploads/:assetId", ...auth, uploadController.remove);

// User
router.get("/user/credits", ...auth, userController.getCredits);
router.get("/user/subscription", ...auth, userController.getSubscription);

// Social media scheduler
router.get("/accounts", ...auth, accountsController.getAccounts);
// Per-platform options for the post composer (same handlers as the app's
// /api/connect routes; they scope the account to req.auth.userId).
router.get(
  "/accounts/:accountId/pinterest/boards",
  ...auth,
  connectController.getPinterestBoards,
);
router.get(
  "/accounts/:accountId/tiktok/creator-info",
  ...auth,
  connectController.getTikTokCreatorInfo,
);
router.post("/posts", ...auth, requirePaidPlan, postController.createPost);
router.get("/posts", ...auth, postController.listPosts);
// Analytics — registered before "/posts/:id" so "analytics" isn't an id
router.get(
  "/posts/analytics/summary",
  ...auth,
  analyticsController.getSummary.bind(analyticsController),
);
router.post(
  "/posts/analytics/refresh",
  ...auth,
  analyticsController.refresh.bind(analyticsController),
);
router.get("/posts/:id", ...auth, postController.getPost);
router.post(
  "/posts/:id/publish",
  ...auth,
  requirePaidPlan,
  appPostController.publishPost.bind(appPostController),
);
router.put("/posts/:id", ...auth, requirePaidPlan, postController.updatePost);
router.post(
  "/posts/:id/retry",
  ...auth,
  requirePaidPlan,
  appPostController.retryPost.bind(appPostController),
);
router.delete(
  "/posts/:id",
  ...auth,
  requirePaidPlan,
  postController.deletePost,
);

export default router;
