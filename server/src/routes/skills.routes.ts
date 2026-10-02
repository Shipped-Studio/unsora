import { Router } from "express";
import { skillsController as c } from "../controllers/skills.controller";

// Public, unauthenticated — consumed by the landing site with ISR.
// The admin-only upload endpoint lives in the public API tree instead
// (POST /api/v1/skills/upload, see src/api/v1/routes/index.ts) since it's
// called by the MCP server with API-key auth.
const router = Router();

router.get("/", c.list.bind(c));
router.get("/:slug", c.get.bind(c));

export default router;
