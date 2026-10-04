import { Router } from "express";
import { CatalogController } from "../controllers/catalog.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new CatalogController();

router.get("/", requireAuth, controller.list);
router.post("/quote", requireAuth, controller.quote);
router.post("/generate", requireAuth, controller.generate);

export default router;
