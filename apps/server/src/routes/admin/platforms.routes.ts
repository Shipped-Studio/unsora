import { Router } from "express";
import { platformAdminView, savePlatformSwitches } from "../../lib/platforms";

const router = Router();

// GET /api/admin/platforms — each platform's switch, missing credentials, and
// whether it's live.
router.get("/", async (_req, res) => {
  try {
    res.json({ success: true, data: await platformAdminView() });
  } catch (error) {
    console.error("Admin platforms load error:", error);
    res.status(500).json({ success: false, error: "Couldn't load platforms" });
  }
});

// PUT /api/admin/platforms { enabled: string[] } — the switched-on platforms.
router.put("/", async (req, res) => {
  const enabled = (req.body as { enabled?: unknown })?.enabled;
  if (!Array.isArray(enabled) || !enabled.every((p) => typeof p === "string")) {
    return res
      .status(400)
      .json({ success: false, error: "enabled must be a list of platform keys" });
  }
  try {
    await savePlatformSwitches(enabled, req.auth?.userId);
    res.json({ success: true, data: await platformAdminView() });
  } catch (error) {
    console.error("Admin platforms save error:", error);
    res.status(500).json({
      success: false,
      error:
        "Couldn't save. If this is a new deployment, the app_settings migration may not be applied yet.",
    });
  }
});

export default router;
