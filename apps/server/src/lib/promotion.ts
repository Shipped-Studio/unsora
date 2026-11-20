import type Stripe from "stripe";
import prisma from "./db";
import { getSetting, setSetting } from "./app-settings";
import { stripe } from "./stripe";
import { logger } from "./logger";

/**
 * The featured promotion: one Stripe promotion code the app advertises (a
 * banner, crossed-out prices on the plans it covers) and applies at checkout
 * by itself.
 *
 * The admin picks the code at /admin/pricing; that choice is all we store
 * (app_settings `promotion.featured`). The discount itself lives in Stripe:
 * the coupon's terms, the plans it covers (its products), its end date and
 * how many uses are left are read from there, so the app can't advertise a
 * price Stripe won't charge.
 */

const SETTING = "promotion.featured";
const CACHE_MS = 2 * 60 * 1000;

export interface FeaturedPromotionSetting {
  code: string;
  enabled: boolean;
  /** Optional banner line; a default is written from the discount otherwise. */
  bannerText?: string | null;
}

/** What the app, the landing page and checkout need to know. */
export interface ActivePromotion {
  code: string;
  /** Stripe promotion code id, applied at checkout. Not secret. */
  promotionCodeId: string;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  /** Keys of the plans the coupon covers (from its products). */
  planKeys: string[];
  /** Which kinds of plan those are, for wording and who sees the banner. */
  covers: { scheduler: boolean; aiStudio: boolean; packs: boolean };
  expiresAt: string | null;
  /** Uses left, when the code or coupon has a cap. */
  remaining: number | null;
  bannerText: string | null;
}

/** Why a code can't be featured right now; shown in the admin form. */
export type PromotionProblem =
  | "not_found"
  | "inactive"
  | "expired"
  | "used_up"
  | "no_matching_plans";

type Resolved = { promotion: ActivePromotion | null; problem: PromotionProblem | null };

let cache: { at: number; key: string; value: Resolved } | null = null;

export async function getFeaturedSetting(): Promise<FeaturedPromotionSetting | null> {
  const saved = await getSetting<FeaturedPromotionSetting>(SETTING);
  if (!saved || typeof saved.code !== "string" || !saved.code.trim()) return null;
  return {
    code: saved.code.trim(),
    enabled: saved.enabled !== false,
    bannerText: typeof saved.bannerText === "string" && saved.bannerText.trim() ? saved.bannerText.trim() : null,
  };
}

export async function saveFeaturedSetting(value: FeaturedPromotionSetting | null, updatedBy?: string) {
  await setSetting(SETTING, value ? { ...value, code: value.code.trim().toUpperCase() } : {}, updatedBy);
  cache = null;
}

/** Look a code up in Stripe and turn it into what the app shows, or say why not. */
export async function resolvePromotionCode(code: string, bannerText: string | null = null): Promise<Resolved> {
  // The same code can exist more than once (an old one switched off, a new
  // one live): the live one wins, and any other only explains why not.
  const expand = ["data.coupon.applies_to"];
  const live = await stripe.promotionCodes.list({ code, active: true, limit: 1, expand });
  const promo = live.data[0] ?? (await stripe.promotionCodes.list({ code, limit: 1, expand })).data[0];
  if (!promo) return { promotion: null, problem: "not_found" };

  const coupon = promo.coupon as Stripe.Coupon;
  const now = Math.floor(Date.now() / 1000);
  if (!promo.active || !coupon.valid) return { promotion: null, problem: "inactive" };
  if ((promo.expires_at && promo.expires_at <= now) || (coupon.redeem_by && coupon.redeem_by <= now)) {
    return { promotion: null, problem: "expired" };
  }

  const left = [
    promo.max_redemptions != null ? promo.max_redemptions - promo.times_redeemed : null,
    coupon.max_redemptions != null ? coupon.max_redemptions - coupon.times_redeemed : null,
  ].filter((n): n is number => n !== null);
  const remaining = left.length ? Math.max(0, Math.min(...left)) : null;
  if (remaining === 0) return { promotion: null, problem: "used_up" };

  // The plans it covers: those whose Stripe product the coupon names, or every
  // plan on sale when it names none.
  const products = coupon.applies_to?.products ?? null;
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
      priceCents: { gt: 0 },
      ...(products ? { stripeProductId: { in: products } } : {}),
    },
    select: { key: true, type: true },
  });
  if (!plans.length) return { promotion: null, problem: "no_matching_plans" };

  const expiry = [promo.expires_at, coupon.redeem_by].filter((t): t is number => !!t);
  return {
    problem: null,
    promotion: {
      code: promo.code,
      promotionCodeId: promo.id,
      percentOff: coupon.percent_off ?? null,
      amountOffCents: coupon.amount_off ?? null,
      currency: coupon.currency ?? null,
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months ?? null,
      planKeys: plans.map((p) => p.key),
      covers: {
        scheduler: plans.some((p) => p.type === "SUBSCRIPTION"),
        aiStudio: plans.some((p) => p.type === "CREDIT_SUBSCRIPTION"),
        packs: plans.some((p) => p.type === "TOPUP"),
      },
      expiresAt: expiry.length ? new Date(Math.min(...expiry) * 1000).toISOString() : null,
      remaining,
      bannerText,
    },
  };
}

/**
 * The promotion to advertise and apply right now, or null. Cached for a
 * couple of minutes; a Stripe hiccup reads as "no promotion" rather than an
 * error, so checkout and pages never fail because of it.
 */
export async function activePromotion(): Promise<ActivePromotion | null> {
  const setting = await getFeaturedSetting();
  if (!setting?.enabled) return null;
  const key = JSON.stringify(setting);
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.value.promotion;
  try {
    const value = await resolvePromotionCode(setting.code, setting.bannerText ?? null);
    cache = { at: Date.now(), key, value };
    if (value.problem) logger.info(`[promotion] ${setting.code} not shown: ${value.problem}`);
    return value.promotion;
  } catch (err) {
    logger.warn(`[promotion] couldn't load ${setting.code} from Stripe:`, err);
    return cache?.key === key ? cache.value.promotion : null;
  }
}

/** The promotion code to apply at checkout for `planKey`, if the featured one covers it. */
export async function promotionCodeFor(planKey: string): Promise<string | null> {
  const promo = await activePromotion();
  return promo && promo.planKeys.includes(planKey) ? promo.promotionCodeId : null;
}

/**
 * Checkout settings for `planKey`: the featured code applied, or the code box
 * when there's none. Stripe takes one or the other, not both.
 */
export async function checkoutDiscount(
  planKey: string,
): Promise<Pick<Stripe.Checkout.SessionCreateParams, "discounts" | "allow_promotion_codes">> {
  const promotionCode = await promotionCodeFor(planKey);
  return promotionCode ? { discounts: [{ promotion_code: promotionCode }] } : { allow_promotion_codes: true };
}

/** Public shape: without internal ids. */
export function publicPromotion(promo: ActivePromotion | null) {
  if (!promo) return null;
  const { promotionCodeId: _id, ...rest } = promo;
  return rest;
}

/**
 * Create a Checkout Session, falling back to the code box when Stripe won't
 * take the featured code for this customer (a first-time-only code, say), so
 * the promotion can never stop someone from paying.
 */
export async function createCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create(params);
  } catch (err) {
    if (!params.discounts?.length || (err as { type?: string })?.type !== "StripeInvalidRequestError") throw err;
    logger.warn("[promotion] Stripe refused the featured code at checkout; offering the code box instead:", err);
    const { discounts: _discounts, ...rest } = params;
    return stripe.checkout.sessions.create({ ...rest, allow_promotion_codes: true });
  }
}
