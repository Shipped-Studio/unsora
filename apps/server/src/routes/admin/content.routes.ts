import { Router } from "express";
import { adminContentController } from "../../controllers/admin/content.controller";

const router = Router();

router.get("/", adminContentController.list.bind(adminContentController));

export default router;
