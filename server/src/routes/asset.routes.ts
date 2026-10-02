import { Router } from "express";
import { AssetController } from "../controllers/asset.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new AssetController();

router.get("/browse", requireAuth, controller.browse.bind(controller));
router.get("/all", requireAuth, controller.getAll.bind(controller));
router.post("/", requireAuth, controller.create.bind(controller));
router.delete("/:id", requireAuth, controller.delete.bind(controller));

export default router;
