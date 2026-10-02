import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/db";

/**
 * Admin CRUD for the `plans` table — subscription tiers, top-up packs, promos.
 *
 * Read paths are open to other places in the app via lib/plans.ts; this
 * controller is the *write* path. Mounted under /api/admin/plans behind
 * requireAdmin middleware.
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

/** Coerce a raw value into a non-negative integer, or null if invalid. */
function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
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

      const plans = await prisma.plan.findMany({
        where,
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { priceCents: "asc" }],
      });

      return res.json({ success: true, data: plans });
    } catch (err) {
      console.error("AdminPlansController.list error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to list plans" });
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
      return res.json({ success: true, data: plan });
    } catch (err) {
      console.error("AdminPlansController.get error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load plan" });
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
   *   trialDays      number?
   *   stripePriceId  string?
   *   stripeProductId string?
   *   sortOrder      number?  (default 0)
   *   isActive       boolean? (default true)
   *   isPopular      boolean? (default false)
   *   metadata       any?
   */
  async create(req: Request, res: Response) {
    try {
      const body = req.body ?? {};

      if (typeof body.key !== "string" || body.key.trim() === "") {
        return res
          .status(400)
          .json({ success: false, error: "`key` is required" });
      }
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return res
          .status(400)
          .json({ success: false, error: "`name` is required" });
      }
      if (!isPlanType(body.type)) {
        return res.status(400).json({
          success: false,
          error: `\`type\` must be one of ${PLAN_TYPES.join(", ")}`,
        });
      }

      const credits = toInt(body.credits);
      const priceCents = toInt(body.priceCents);
      if (credits === null || credits < 0) {
        return res
          .status(400)
          .json({ success: false, error: "`credits` must be >= 0" });
      }
      if (priceCents === null || priceCents < 0) {
        return res
          .status(400)
          .json({ success: false, error: "`priceCents` must be >= 0" });
      }

      let interval: PlanIntervalValue | null = null;
      if (body.interval != null) {
        if (!isPlanInterval(body.interval)) {
          return res.status(400).json({
            success: false,
            error: `\`interval\` must be one of ${PLAN_INTERVALS.join(", ")}`,
          });
        }
        interval = body.interval;
      }
      if (body.type === "SUBSCRIPTION" && !interval) {
        return res.status(400).json({
          success: false,
          error: "SUBSCRIPTION plans require an `interval`",
        });
      }
      if (body.type !== "SUBSCRIPTION" && interval) {
        return res.status(400).json({
          success: false,
          error: "`interval` only applies to SUBSCRIPTION plans",
        });
      }

      const plan = await prisma.plan.create({
        data: {
          key: body.key.trim(),
          name: body.name.trim(),
          description:
            typeof body.description === "string" ? body.description : null,
          type: body.type,
          credits,
          priceCents,
          currency:
            typeof body.currency === "string" ? body.currency : "usd",
          interval,
          trialDays: toInt(body.trialDays),
          stripePriceId:
            typeof body.stripePriceId === "string" && body.stripePriceId
              ? body.stripePriceId
              : null,
          stripeProductId:
            typeof body.stripeProductId === "string" && body.stripeProductId
              ? body.stripeProductId
              : null,
          sortOrder: toInt(body.sortOrder) ?? 0,
          isActive: body.isActive !== false,
          isPopular: body.isPopular === true,
          metadata: body.metadata ?? Prisma.DbNull,
        },
      });

      return res.status(201).json({ success: true, data: plan });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          return res.status(409).json({
            success: false,
            error: "A plan with that key (or stripePriceId) already exists",
          });
        }
      }
      console.error("AdminPlansController.create error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to create plan" });
    }
  }

  /**
   * PATCH /api/admin/plans/:id
   *
   * Partial update — only fields present in the body are touched. The plan
   * `key` and `type` ARE editable but be careful: changing `type` on a row
   * that already has live consumers may cause it to drop out of the billing
   * UI. Prefer creating a new row + setting the old one inactive.
   */
  async update(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const data: Prisma.PlanUpdateInput = {};

      if (body.key !== undefined) {
        if (typeof body.key !== "string" || body.key.trim() === "") {
          return res
            .status(400)
            .json({ success: false, error: "`key` must be a non-empty string" });
        }
        data.key = body.key.trim();
      }
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
          return res
            .status(400)
            .json({ success: false, error: "`name` must be a non-empty string" });
        }
        data.name = body.name.trim();
      }
      if (body.description !== undefined) {
        data.description =
          typeof body.description === "string" ? body.description : null;
      }
      if (body.type !== undefined) {
        if (!isPlanType(body.type)) {
          return res.status(400).json({
            success: false,
            error: `\`type\` must be one of ${PLAN_TYPES.join(", ")}`,
          });
        }
        data.type = body.type;
      }
      if (body.credits !== undefined) {
        const c = toInt(body.credits);
        if (c === null || c < 0) {
          return res
            .status(400)
            .json({ success: false, error: "`credits` must be >= 0" });
        }
        data.credits = c;
      }
      if (body.priceCents !== undefined) {
        const p = toInt(body.priceCents);
        if (p === null || p < 0) {
          return res
            .status(400)
            .json({ success: false, error: "`priceCents` must be >= 0" });
        }
        data.priceCents = p;
      }
      if (body.currency !== undefined) {
        if (typeof body.currency !== "string" || body.currency.trim() === "") {
          return res
            .status(400)
            .json({ success: false, error: "`currency` must be a string" });
        }
        data.currency = body.currency;
      }
      if (body.interval !== undefined) {
        if (body.interval === null) {
          data.interval = null;
        } else if (isPlanInterval(body.interval)) {
          data.interval = body.interval;
        } else {
          return res.status(400).json({
            success: false,
            error: `\`interval\` must be one of ${PLAN_INTERVALS.join(", ")} or null`,
          });
        }
      }
      if (body.trialDays !== undefined) {
        data.trialDays = body.trialDays === null ? null : toInt(body.trialDays);
      }
      if (body.stripePriceId !== undefined) {
        data.stripePriceId =
          typeof body.stripePriceId === "string" && body.stripePriceId
            ? body.stripePriceId
            : null;
      }
      if (body.stripeProductId !== undefined) {
        data.stripeProductId =
          typeof body.stripeProductId === "string" && body.stripeProductId
            ? body.stripeProductId
            : null;
      }
      if (body.sortOrder !== undefined) {
        const so = toInt(body.sortOrder);
        if (so === null) {
          return res
            .status(400)
            .json({ success: false, error: "`sortOrder` must be a number" });
        }
        data.sortOrder = so;
      }
      if (body.isActive !== undefined) data.isActive = !!body.isActive;
      if (body.isPopular !== undefined) data.isPopular = !!body.isPopular;
      if (body.metadata !== undefined) {
        data.metadata = body.metadata ?? Prisma.DbNull;
      }

      const plan = await prisma.plan.update({
        where: { id: req.params.id },
        data,
      });

      return res.json({ success: true, data: plan });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2025") {
          return res
            .status(404)
            .json({ success: false, error: "Plan not found" });
        }
        if (err.code === "P2002") {
          return res.status(409).json({
            success: false,
            error: "A plan with that key (or stripePriceId) already exists",
          });
        }
      }
      console.error("AdminPlansController.update error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update plan" });
    }
  }

  /**
   * DELETE /api/admin/plans/:id
   *
   * Soft delete by default — flips `isActive=false` so the row drops out of
   * the billing UI but is still around for historical reporting (refunds,
   * audits). Pass `?hard=true` to actually remove the row; this fails if
   * any CreditGrant ever referenced it indirectly (we don't FK to plans
   * today, so this is a true delete).
   */
  async remove(req: Request, res: Response) {
    try {
      const hard = req.query.hard === "true";

      if (hard) {
        await prisma.plan.delete({ where: { id: req.params.id } });
        return res.json({ success: true, deleted: true });
      }

      const plan = await prisma.plan.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      return res.json({ success: true, data: plan, deleted: false });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return res
          .status(404)
          .json({ success: false, error: "Plan not found" });
      }
      console.error("AdminPlansController.remove error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to delete plan" });
    }
  }
}
