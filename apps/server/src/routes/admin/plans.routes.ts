import { Router } from "express";
import { AdminPlansController } from "../../controllers/admin-plans.controller";

const router = Router();
const controller = new AdminPlansController();

router.get("/", controller.list.bind(controller));
router.post("/", controller.create.bind(controller));
router.get("/:id", controller.get.bind(controller));
router.put("/:id", controller.update.bind(controller));
router.delete("/:id", controller.remove.bind(controller));

export default router;
