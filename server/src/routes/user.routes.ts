import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { ApiKeyController } from "../controllers/api-key.controller";
import { requireAuth, requireAuthOrApiKey } from "../middleware/auth";

const router = Router();
const userController = new UserController();
const apiKeyController = new ApiKeyController();

router.post("/sync", requireAuth, userController.syncUser);
router.get("/profile", requireAuth, userController.getUserProfile);
router.get("/usage", requireAuth, userController.getUsageDetails);
router.patch("/preferences", requireAuth, userController.updatePreferences);
router.get("/credits", requireAuthOrApiKey, userController.getCredits);
router.get("/credit-grants", requireAuth, userController.getCreditGrants);
router.get(
  "/credit-transactions",
  requireAuth,
  userController.getCreditTransactions,
);

router.get("/api-keys", requireAuth, apiKeyController.list);
router.post("/api-keys", requireAuth, apiKeyController.create);
router.delete("/api-keys/:id", requireAuth, apiKeyController.revoke);

export default router;
