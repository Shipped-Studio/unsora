import { Router } from "express";
import {
  getFeaturedSetting,
  resolvePromotionCode,
  saveFeaturedSetting,
} from "../../lib/promotion";
import { logger } from "../../lib/logger";

const router = Router();

const PROBLEMS: Record<string, string> = {
  not_found: "No promotion code with that name in Stripe. Create it under the coupon first.",
  inactive: "That code or its coupon is switched off in Stripe.",
  expired: "That code has expired.",
  used_up: "That code has no uses left.",
  no_matching_plans: "The coupon covers no plan we sell. Check its products in Stripe.",
};

/** The saved setting plus what it resolves to in Stripe right now. */
async function current() {
  const setting = await getFeaturedSetting();
  if (!setting) return { setting: null, promotion: null, problem: null };
  const { promotion, problem } = await resolvePromotionCode(setting.code, setting.bannerText ?? null);
  return { setting, promotion, problem: problem ? PROBLEMS[problem] : null };
}

// GET /api/admin/promotion — the featured code, and how Stripe sees it.
router.get("/", async (_req, res) => {
  try {
    res.json({ success: true, data: await current() });
  } catch (error) {
    logger.error("Admin promotion load error:", error);
    res.status(500).json({ success: false, error: "Couldn't load the promotion from Stripe" });
  }
});

// PUT /api/admin/promotion { code, enabled, bannerText } — feature a code.
// It must exist and be usable in Stripe. An empty code clears the promotion.
router.put("/", async (req, res) => {
  const body = req.body as { code?: unknown; enabled?: unknown; bannerText?: unknown };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const bannerText = typeof body.bannerText === "string" ? body.bannerText.trim().slice(0, 140) : "";
  try {
    if (!code) {
      await saveFeaturedSetting(null, req.auth?.userId);
      return res.json({ success: true, data: await current() });
    }
    const enabled = body.enabled !== false;
    if (enabled) {
      const { problem } = await resolvePromotionCode(code);
      if (problem) return res.status(400).json({ success: false, error: PROBLEMS[problem] });
    }
    await saveFeaturedSetting({ code, enabled, bannerText: bannerText || null }, req.auth?.userId);
    res.json({ success: true, data: await current() });
  } catch (error) {
    logger.error("Admin promotion save error:", error);
    res.status(500).json({ success: false, error: "Couldn't save the promotion" });
  }
});

export default router;
