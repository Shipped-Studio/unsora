import { Router } from "express";
import { LibraryController } from "../controllers/library.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const libraryController = new LibraryController();

router.get("/", requireAuth, libraryController.list);
router.get("/folders", requireAuth, libraryController.listFolders);
router.post("/folders", requireAuth, libraryController.createFolder);
router.patch("/folders/:id", requireAuth, libraryController.updateFolder);
router.delete("/folders/:id", requireAuth, libraryController.deleteFolder);
router.post("/move", requireAuth, libraryController.move);

export default router;
