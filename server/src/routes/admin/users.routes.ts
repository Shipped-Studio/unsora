import { Router } from "express";
import { adminUsersController } from "../../controllers/admin/users.controller";

const router = Router();

router.get("/", adminUsersController.list.bind(adminUsersController));
router.get("/:id", adminUsersController.detail.bind(adminUsersController));
router.patch("/:id", adminUsersController.update.bind(adminUsersController));
router.post(
  "/:id/credits",
  adminUsersController.adjustCredits.bind(adminUsersController),
);

export default router;
