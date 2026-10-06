import { Router } from "express";
import { platformAdminView, savePlatformSwitches } from "../../lib/platforms";
import {
  CredentialsKeyMissingError,
  credentialFieldsView,
  credentialsKeyConfigured,
  savePlatformCredentials,
} from "../../lib/platform-credentials";

const router = Router();

/** Switches, credentials (secrets masked) and whether saving is possible. */
async function fullView() {
  const [view, credentials] = await Promise.all([
    platformAdminView(),
    credentialFieldsView(),
  ]);
  return {
    ...view,
    canSaveCredentials: credentialsKeyConfigured(),
    platforms: view.platforms.map((p) => ({
      ...p,
      credentials: credentials[p.id] ?? [],
    })),
  };
}

// GET /api/admin/platforms — each platform's switch, missing credentials, and
// whether it's live.
router.get("/", async (_req, res) => {
  try {
    res.json({ success: true, data: await fullView() });
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
    res.json({ success: true, data: await fullView() });
  } catch (error) {
    console.error("Admin platforms save error:", error);
    res.status(500).json({
      success: false,
      error:
        "Couldn't save. If this is a new deployment, the app_settings migration may not be applied yet.",
    });
  }
});

// PUT /api/admin/platforms/credentials { values: { NAME: "value" | null } }
// A string saves the value (encrypted); null removes it so the environment's
// value applies again. Only platform credential names are accepted.
router.put("/credentials", async (req, res) => {
  const values = (req.body as { values?: unknown })?.values;
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    !Object.values(values).every((v) => v === null || typeof v === "string")
  ) {
    return res.status(400).json({
      success: false,
      error: "values must map credential names to a string or null",
    });
  }
  try {
    await savePlatformCredentials(
      values as Record<string, string | null>,
      req.auth?.userId,
    );
    res.json({ success: true, data: await fullView() });
  } catch (error) {
    if (error instanceof CredentialsKeyMissingError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof Error && error.message.startsWith("Not a platform credential")) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Admin platform credentials save error:", error);
    res.status(500).json({ success: false, error: "Couldn't save credentials" });
  }
});

export default router;
