import { Router } from "express";
import {
  pricingConfig,
  savePricingConfig,
  validPricing,
} from "../../lib/generation-pricing";

const router = Router();

// GET /api/admin/pricing — the margin and credit value generations are
// priced with, and whether they were saved here or come from env/defaults.
router.get("/", async (_req, res) => {
  try {
    res.json({ success: true, data: await pricingConfig() });
  } catch (error) {
    console.error("Admin pricing load error:", error);
    res.status(500).json({ success: false, error: "Couldn't load pricing" });
  }
});

// PUT /api/admin/pricing { margin, creditUsd } — margin is a fraction (0.2 =
// 20%), creditUsd the dollars one credit is costed at.
router.put("/", async (req, res) => {
  const body = req.body as { margin?: unknown; creditUsd?: unknown };
  const value = { margin: Number(body?.margin), creditUsd: Number(body?.creditUsd) };
  if (!validPricing(value)) {
    return res.status(400).json({
      success: false,
      error: "margin must be 0–10 (0.2 = 20%) and creditUsd between 0.0001 and 10",
    });
  }
  try {
    await savePricingConfig(value, req.auth?.userId);
    res.json({ success: true, data: await pricingConfig() });
  } catch (error) {
    console.error("Admin pricing save error:", error);
    res.status(500).json({
      success: false,
      error:
        "Couldn't save. If this is a new deployment, the app_settings migration may not be applied yet.",
    });
  }
});

export default router;
