import type { Request, Response } from "express";
import { Prisma, type Plan } from "@prisma/client";
import Stripe from "stripe";
import prisma from "../lib/db";
import {
  planFeatures,
  planMeta,
  planSocialAccounts,
  type PlanMeta,
} from "../lib/plans";
import {
  stripeMode,
  stripeStateOf,
  syncPlanToStripe,
  type PlanStripeState,
} from "../lib/plan-stripe";

/**
 * Admin CRUD for the `plans` table — subscription tiers, top-up packs, promos
 * (including the `trial` row). Mounted under /api/admin/plans behind
 * requireAdmin; /admin/pricing is the UI.
 *
 * Saving a SUBSCRIPTION or TOPUP plan with a price creates or updates its
 * Stripe product and price (lib/plan-stripe.ts) unless the body passes a
 * `stripePriceId` of its own or `syncStripe: false`.
 */

const PLAN_TYPES = ["SUBSCRIPTION", "TOPUP", "PROMO"] as const;
const PLAN_INTERVALS = ["MONTH", "YEAR"] as const;

type PlanTypeValue = (typeof PLAN_TYPES)[number];
type PlanIntervalValue = (typeof PLAN_INTERVALS)[number];

function isPlanType(v: unknown): v is PlanTypeValue {
  return typeof v === "string" && (PLAN_TYPES as readonly string[]).includes(v);
}

function isPlanInterval(v: unknown): v is PlanIntervalValue {
  return (
    typeof v === "string" &&
    (PLAN_INTERVALS as readonly string[]).includes(v)
  );
}

/** Coerce a raw value into an integer, or null if invalid. */
function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

class BadRequest extends Error {}

function bad(message: string): never {
  throw new BadRequest(message);
}

/** `features` as a list of non-empty lines, from an array or a textarea. */
function parseFeatures(v: unknown): string[] {
  const lines = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : bad("`features` must be a list");
  return lines
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Apply the settings that live in `metadata` (features, social accounts)
 * from the body onto `base`. A raw `metadata` object in the body replaces
 * the stored one first, for scripts that manage it wholesale.
 */
function mergeMeta(base: PlanMeta, body: Record<string, unknown>): PlanMeta {
  let meta: PlanMeta = { ...base };
  if (body.metadata !== undefined) {
    meta =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? { ...(body.metadata as PlanMeta) }
        : {};
  }
  if (body.features !== undefined) {
    if (body.features === null) delete meta.features;
    else meta.features = parseFeatures(body.features);
  }
  if (body.socialAccounts !== undefined) {
    if (body.socialAccounts === null || body.socialAccounts === "") {
      delete meta.socialAccounts;
    } else {
      const n = toInt(body.socialAccounts);
      if (n === null || n < 0) bad("`socialAccounts` must be >= 0");
      meta.socialAccounts = n;
    }
  }
  return meta;
}

/** Plan row plus the derived fields the admin UI shows. */
function present(plan: Plan, subscribers: Map<string, number>) {
  return {
    ...plan,
    features: planFeatures(plan),
    socialAccounts: planSocialAccounts(plan),
    previousStripePriceIds: planMeta(plan).previousStripePriceIds ?? [],
    subscribers:
      plan.type === "SUBSCRIPTION"
        ? (subscribers.get(plan.key.toLowerCase()) ?? 0) +
          (plan.name.toLowerCase() !== plan.key.toLowerCase()
            ? (subscribers.get(plan.name.toLowerCase()) ?? 0)
            : 0)
        : null,
  };
}

/** Active subscribers per lowercased `User.plan` value. */
async function subscriberCounts(): Promise<Map<string, number>> {
  const rows = await prisma.user.groupBy({
    by: ["plan"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.plan) continue;
    const k = r.plan.toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + r._count._all);
  }
  return counts;
}

function sendError(res: Response, err: unknown, action: string) {
  if (err instanceof BadRequest) {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "A plan with that key (or Stripe price) already exists",
      });
    }
  }
  if (err instanceof Stripe.errors.StripeError) {
    console.error(`AdminPlansController.${action} Stripe error:`, err.message);
    return res.status(502).json({
      success: false,
      error: `Stripe rejected the change, so nothing was saved: ${err.message}`,
    });
  }
  console.error(`AdminPlansController.${action} error:`, err);
  return res
    .status(500)
    .json({ success: false, error: `Failed to ${action} plan` });
}

export class AdminPlansController {
  /**
   * GET /api/admin/plans
   *
   * Optional filters:
   *   ?type=SUBSCRIPTION|TOPUP|PROMO
   *   ?active=true|false   (default: include both)
   */
  async list(req: Request, res: Response) {
    try {
      const where: Prisma.PlanWhereInput = {};

      const type = req.query.type;
      if (typeof type === "string" && isPlanType(type)) {
        where.type = type;
      }

      const active = req.query.active;
      if (active === "true") where.isActive = true;
      else if (active === "false") where.isActive = false;

      const [plans, subscribers] = await Promise.all([
        prisma.plan.findMany({
          where,
          orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { priceCents: "asc" }],
        }),
        subscriberCounts(),
      ]);

      return res.json({
        success: true,
        data: plans.map((p) => present(p, subscribers)),
        stripeMode: stripeMode(),
      });
    } catch (err) {
      return sendError(res, err, "list");
    }
  }

  /** GET /api/admin/plans/:id */
  async get(req: Request, res: Response) {
    try {
      const plan = await prisma.plan.findUnique({
        where: { id: req.params.id },
      });
      if (!plan) {
        return res
          .status(404)
          .json({ success: false, error: "Plan not found" });
      }
      return res.json({
        success: true,
        data: present(plan, await subscriberCounts()),
      });
    } catch (err) {
      return sendError(res, err, "load");
    }
  }

  /**
   * POST /api/admin/plans
   *
   * Body (JSON):
   *   key            string  required, unique
   *   name           string  required
   *   type           SUBSCRIPTION | TOPUP | PROMO   required
   *   credits        number  required, >= 0
   *   priceCents     number  required, >= 0
   *   description    string?
   *   currency       string?  (default "usd")
   *   interval       MONTH | YEAR    (only for SUBSCRIPTION)
   *   trialDays      number?  (read from the `trial` row only)
   *   features       string[] | string (one per line)?
   *   socialAccounts number?  (SUBSCRIPTION)
   *   stripePriceId  string?  (skips creating a Stripe price)
   *   syncStripe     boolean? (default true)
   *   sortOrder      number?  (default 0)
   *   isActive       boolean? (default true)
   *   isPopular      boolean? (default false)
   *   metadata       object?
   */
  async create(req: Request, res: Response) {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (typeof body.key !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(body.key.trim())) {
        bad("`key` is required: lowercase letters, numbers, - and _");
      }
      if (typeof body.name !== "string" || body.name.trim() === "") {
        bad("`name` is required");
      }
      if (!isPlanType(body.type)) {
        bad(`\`type\` must be one of ${PLAN_TYPES.join(", ")}`);
      }

      const credits = toInt(body.credits);
      const priceCents = toInt(body.priceCents);
      if (credits === null || credits < 0) bad("`credits` must be >= 0");
      if (priceCents === null || priceCents < 0) bad("`priceCents` must be >= 0");

      let interval: PlanIntervalValue | null = null;
      if (body.interval != null) {
        if (!isPlanInterval(body.interval)) {
          bad(`\`interval\` must be one of ${PLAN_INTERVALS.join(", ")}`);
        }
        interval = body.interval;
      }
      if (body.type === "SUBSCRIPTION" && !interval) {
        bad("SUBSCRIPTION plans require an `interval`");
      }
      if (body.type !== "SUBSCRIPTION" && interval) {
        bad("`interval` only applies to SUBSCRIPTION plans");
      }

      const key = body.key.trim();
      // Checked up front so a duplicate doesn't leave an orphan Stripe product.
      if (await prisma.plan.findUnique({ where: { key }, select: { id: true } })) {
        return res.status(409).json({
          success: false,
          error: "A plan with that key already exists",
        });
      }

      const manualPriceId =
        typeof body.stripePriceId === "string" && body.stripePriceId.trim()
          ? body.stripePriceId.trim()
          : null;

      let state: PlanStripeState = {
        key,
        name: body.name.trim(),
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : null,
        type: body.type,
        priceCents,
        currency:
          typeof body.currency === "string" && body.currency.trim()
            ? body.currency.trim().toLowerCase()
            : "usd",
        interval,
        stripePriceId: manualPriceId,
        stripeProductId:
          typeof body.stripeProductId === "string" && body.stripeProductId
            ? body.stripeProductId
            : null,
        metadata: mergeMeta({}, body),
      };

      if (body.syncStripe !== false) {
        state = { ...state, ...(await syncPlanToStripe(null, state, !!manualPriceId)) };
      }

      const plan = await prisma.plan.create({
        data: {
          key: state.key,
          name: state.name,
          description: state.description,
          type: state.type,
          credits,
          priceCents: state.priceCents,
          currency: state.currency,
          interval: state.interval,
          trialDays: toInt(body.trialDays),
          stripePriceId: state.stripePriceId,
          stripeProductId: state.stripeProductId,
          sortOrder: toInt(body.sortOrder) ?? 0,
          isActive: body.isActive !== false,
          isPopular: body.isPopular === true,
          metadata: Object.keys(state.metadata).length
            ? (state.metadata as Prisma.InputJsonObject)
            : Prisma.DbNull,
        },
      });

      return res
        .status(201)
        .json({ success: true, data: present(plan, await subscriberCounts()) });
    } catch (err) {
      return sendError(res, err, "create");
    }
  }

  /**
   * PUT /api/admin/plans/:id
   *
   * Partial update — only fields present in the body are touched. A new
   * price, currency or interval on a sellable plan creates a new Stripe
   * price; current subscribers keep theirs (see lib/plan-stripe.ts).
   * Changing `type` on a plan with live consumers drops it out of the
   * billing UI — prefer a new plan and switching the old one off.
   */
  async update(req: Request, res: Response) {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const before = await prisma.plan.findUnique({ where: { id: req.params.id } });
      if (!before) {
        return res.status(404).json({ success: false, error: "Plan not found" });
      }

      const next = stripeStateOf(before);
      const data: Prisma.PlanUpdateInput = {};

      if (body.key !== undefined) {
        if (typeof body.key !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(body.key.trim())) {
          bad("`key` must be lowercase letters, numbers, - and _");
        }
        next.key = data.key = body.key.trim();
      }
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
          bad("`name` must be a non-empty string");
        }
        next.name = data.name = body.name.trim();
      }
      if (body.description !== undefined) {
        next.description = data.description =
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : null;
      }
      if (body.type !== undefined) {
        if (!isPlanType(body.type)) {
          bad(`\`type\` must be one of ${PLAN_TYPES.join(", ")}`);
        }
        next.type = data.type = body.type;
      }
      if (body.credits !== undefined) {
        const c = toInt(body.credits);
        if (c === null || c < 0) bad("`credits` must be >= 0");
        data.credits = c;
      }
      if (body.priceCents !== undefined) {
        const p = toInt(body.priceCents);
        if (p === null || p < 0) bad("`priceCents` must be >= 0");
        next.priceCents = data.priceCents = p;
      }
      if (body.currency !== undefined) {
        if (typeof body.currency !== "string" || body.currency.trim() === "") {
          bad("`currency` must be a string");
        }
        next.currency = data.currency = body.currency.trim().toLowerCase();
      }
      if (body.interval !== undefined) {
        if (body.interval === null) {
          next.interval = data.interval = null;
        } else if (isPlanInterval(body.interval)) {
          next.interval = data.interval = body.interval;
        } else {
          bad(`\`interval\` must be one of ${PLAN_INTERVALS.join(", ")} or null`);
        }
      }
      if (next.type === "SUBSCRIPTION" && !next.interval) {
        bad("SUBSCRIPTION plans require an `interval`");
      }
      if (next.type !== "SUBSCRIPTION" && next.interval) {
        bad("`interval` only applies to SUBSCRIPTION plans");
      }
      if (body.trialDays !== undefined) {
        const t = body.trialDays === null || body.trialDays === "" ? null : toInt(body.trialDays);
        if (t !== null && (t < 0 || t > 730)) bad("`trialDays` must be 0–730");
        data.trialDays = t;
      }

      let manualPriceId = false;
      if (body.stripePriceId !== undefined) {
        const id =
          typeof body.stripePriceId === "string" && body.stripePriceId.trim()
            ? body.stripePriceId.trim()
            : null;
        manualPriceId = !!id && id !== before.stripePriceId;
        next.stripePriceId = id;
      }
      if (body.stripeProductId !== undefined) {
        next.stripeProductId =
          typeof body.stripeProductId === "string" && body.stripeProductId
            ? body.stripeProductId
            : null;
      }
      if (body.sortOrder !== undefined) {
        const so = toInt(body.sortOrder);
        if (so === null) bad("`sortOrder` must be a number");
        data.sortOrder = so;
      }
      if (body.isActive !== undefined) data.isActive = !!body.isActive;
      if (body.isPopular !== undefined) data.isPopular = !!body.isPopular;

      next.metadata = mergeMeta(next.metadata, body);

      const synced =
        body.syncStripe !== false
          ? await syncPlanToStripe(before, next, manualPriceId)
          : next;

      data.stripePriceId = synced.stripePriceId;
      data.stripeProductId = synced.stripeProductId;
      data.metadata = Object.keys(synced.metadata).length
        ? (synced.metadata as Prisma.InputJsonObject)
        : Prisma.DbNull;

      const plan = await prisma.plan.update({
        where: { id: before.id },
        data,
      });

      // Subscribers' `User.plan` holds the Stripe product name, which now
      // follows the plan name; move them along so limits keep resolving.
      if (plan.type === "SUBSCRIPTION" && before.name !== plan.name) {
        await prisma.user.updateMany({
          where: { plan: { equals: before.name, mode: "insensitive" } },
          data: { plan: plan.name },
        });
      }

      return res.json({
        success: true,
        data: present(plan, await subscriberCounts()),
      });
    } catch (err) {
      return sendError(res, err, "update");
    }
  }

  /**
   * DELETE /api/admin/plans/:id
   *
   * Soft delete by default — flips `isActive=false` so the row drops out of
   * the billing UI but is still around for historical reporting (refunds,
   * audits). Pass `?hard=true` to actually remove the row; refused while the
   * plan has active subscribers, whose renewals still resolve through it.
   */
  async remove(req: Request, res: Response) {
    try {
      const hard = req.query.hard === "true";

      if (hard) {
        const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
        if (!plan) {
          return res.status(404).json({ success: false, error: "Plan not found" });
        }
        const { subscribers } = present(plan, await subscriberCounts());
        if (subscribers) {
          return res.status(409).json({
            success: false,
            error: `${subscribers} active subscriber(s) are on this plan. Switch it off instead.`,
          });
        }
        await prisma.plan.delete({ where: { id: plan.id } });
        return res.json({ success: true, deleted: true });
      }

      const plan = await prisma.plan.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      return res.json({ success: true, data: plan, deleted: false });
    } catch (err) {
      return sendError(res, err, "delete");
    }
  }
}
