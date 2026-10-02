import { Router } from "express";
import { adminSkillsController as c } from "../../controllers/admin/skills.controller";

const router = Router();

router.get("/", c.list.bind(c));
router.post("/", c.create.bind(c));
router.post("/import-github", c.importGithub.bind(c));
router.get("/:id", c.get.bind(c));
router.put("/:id", c.update.bind(c));
router.delete("/:id", c.remove.bind(c));
router.post("/:id/resync", c.resyncGithub.bind(c));
router.post("/:id/upload-url", c.createUploadUrl.bind(c));
router.post("/:id/files", c.registerFiles.bind(c));
router.post("/:id/files/remove", c.removeFile.bind(c));
router.post("/:id/media", c.addMedia.bind(c));
router.patch("/:id/media/:mediaId", c.updateMedia.bind(c));
router.delete("/:id/media/:mediaId", c.removeMedia.bind(c));

export default router;
