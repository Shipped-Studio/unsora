import { Router } from "express";
import { MovieMaterialsController } from "../controllers/movie-materials.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new MovieMaterialsController();

router.post("/create", requireAuth, controller.create);
router.get("/all", requireAuth, controller.getAll);
router.get("/refresh/:generationId", requireAuth, controller.refresh);
router.delete("/:generationId", requireAuth, controller.delete);

export default router;
