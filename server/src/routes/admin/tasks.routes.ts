import { Router } from "express";
import { adminTasksController } from "../../controllers/admin/tasks.controller";
import { adminTaskDetailController } from "../../controllers/admin/task-detail.controller";

const router = Router();

router.get("/", adminTasksController.list.bind(adminTasksController));
router.get(
  "/:kind/:id",
  adminTaskDetailController.get.bind(adminTaskDetailController),
);

export default router;
