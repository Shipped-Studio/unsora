import { Router } from "express";
import { requireAdmin } from "../../middleware/admin";
import overviewRoutes from "./overview.routes";
import usersRoutes from "./users.routes";
import tasksRoutes from "./tasks.routes";
import contentRoutes from "./content.routes";
import analyticsRoutes from "./analytics.routes";
import plansRoutes from "./plans.routes";
import skillsRoutes from "./skills.routes";

const router = Router();

// Every /api/admin/* route is gated behind the admin guard (role === ADMIN
// or email in ADMIN_EMAILS). This is the server-side half of the /admin gate;
// the client also hides the entry point, but this is the real enforcement.
router.use(requireAdmin);

router.use("/overview", overviewRoutes);
router.use("/users", usersRoutes);
router.use("/tasks", tasksRoutes);
router.use("/content", contentRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/plans", plansRoutes);
router.use("/skills", skillsRoutes);

export default router;
