import { Request, Response } from "express";
import prisma from "../lib/db";
import { getCreditBalance, listActiveGrants } from "../lib/credits";
import { clerkClient } from "@clerk/express";
import { userIsAdmin } from "../lib/is-admin";
import { socialAccountLimitFor } from "../lib/plans";
import { isValidTimeZone } from "./schedule.controller";

export class UserController {
  async getUsageDetails(req: Request, res: Response) {
    try {
      const userId = req.auth.userId;

      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
        select: {
          id: true,
          clerkId: true,
          email: true,
          role: true,
          plan: true,
          isActive: true,
          status: true,
          isCancelled: true,
          stripeCurrentPeriodEnd: true,
          timezone: true,
          weekStartsOn: true,
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const [credits, socialAccountCount, socialAccountLimit] = await Promise.all([
        getCreditBalance(user.id),
        prisma.socialAccount.count({ where: { userId: user.id } }),
        socialAccountLimitFor(user.plan),
      ]);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            clerkId: user.clerkId,
            email: user.email,
            role: user.role,
            // Whether this account can reach the /admin dashboard. Computed
            // server-side (role column OR ADMIN_EMAILS) so the client never
            // needs to know the admin allow-list.
            isAdmin: userIsAdmin(user),
            plan: user.plan,
            isActive: user.isActive,
            status: user.status,
            // `isCancelled` is true when the subscription is set to cancel
            // at period end OR has already been deleted. The billing UI uses
            // this together with `isActive` to surface "ending soon" state.
            isCancelled: user.isCancelled,
            stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
          },
          // Kept named `credits` for client backward-compat. Sourced live
          // from the CreditGrant table — there is no cached counter.
          credits,
          preferences: {
            timezone: user.timezone,
            weekStartsOn: user.weekStartsOn,
          },
          limits: {
            socialAccounts: socialAccountLimit ?? 0,
          },
          counts: {
            socialAccounts: socialAccountCount,
          },
        },
      });
    } catch (error) {
      console.error("Usage details fetch error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch usage details",
      });
    }
  }

  /** GET ?page&limit — the user's credit ledger, newest first. */
  async getCreditTransactions(req: Request, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const where = { userId: user.id };

      const [rows, total] = await Promise.all([
        prisma.creditTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            createdAt: true,
            apiKey: { select: { name: true, keyPrefix: true } },
          },
        }),
        prisma.creditTransaction.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          transactions: rows.map((row) => ({
            id: row.id,
            type: row.type,
            amount: row.amount,
            label: creditReasonLabel(row.type, row.reason),
            source: row.apiKey ? "api" : "web",
            apiKeyName: row.apiKey?.name ?? null,
            createdAt: row.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        },
      });
    } catch (error) {
      console.error("Credit transactions fetch error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load credit history" });
    }
  }

  /** PATCH { timezone?, weekStartsOn? } */
  async updatePreferences(req: Request, res: Response) {
    try {
      const { timezone, weekStartsOn } = req.body as {
        timezone?: string | null;
        weekStartsOn?: number;
      };

      const data: { timezone?: string | null; weekStartsOn?: number } = {};
      if (timezone !== undefined) {
        if (timezone !== null && !isValidTimeZone(timezone)) {
          return res
            .status(400)
            .json({ success: false, error: "Unknown timezone." });
        }
        data.timezone = timezone;
      }
      if (weekStartsOn !== undefined) {
        if (weekStartsOn !== 0 && weekStartsOn !== 1) {
          return res.status(400).json({
            success: false,
            error: "Weeks can start on Sunday (0) or Monday (1).",
          });
        }
        data.weekStartsOn = weekStartsOn;
      }

      const user = await prisma.user.update({
        where: { clerkId: req.auth.userId },
        data,
        select: { timezone: true, weekStartsOn: true },
      });

      res.json({ success: true, data: user });
    } catch (error) {
      console.error("Update preferences error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to save preferences" });
    }
  }

  async getUserProfile(req: Request, res: Response) {
    try {
      const userId = req.auth.userId;

      const user = await prisma.user.findFirst({
        where: { clerkId: userId },
        select: {
          id: true,
          clerkId: true,
          email: true,
          plan: true,
          isActive: true,
          status: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const credits = await getCreditBalance(user.id);

      res.json({
        success: true,
        data: { ...user, credits },
      });
    } catch (error) {
      console.error("User profile fetch error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch user profile",
      });
    }
  }

  /**
   * Upserts the currently authenticated Clerk user into the local DB.
   * Call this once after a fresh-database deploy to self-register without
   * waiting for a Clerk webhook to fire.
   */
  async syncUser(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        return res
          .status(400)
          .json({ success: false, error: "No email on Clerk user" });
      }

      const user = await prisma.user.upsert({
        where: { clerkId },
        update: { email },
        create: { clerkId, email },
      });

      return res.json({ success: true, data: { id: user.id, email: user.email } });
    } catch (error) {
      console.error("User sync error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to sync user" });
    }
  }

  /**
   * Simple credits balance endpoint used by the Thumbnail Generator UI and other
   * lightweight consumers that only need `{ credits: number }`.
   */
  async getSubscription(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;

      const user = await prisma.user.findFirst({
        where: { clerkId },
        select: {
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          isActive: true,
          plan: true,
          status: true,
          isCancelled: true,
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      return res.json({
        success: true,
        data: {
          plan: user.plan,
          status: user.status,
          isActive: user.isActive,
          isCancelled: user.isCancelled,
          stripeSubscriptionId: user.stripeSubscriptionId,
          stripeCustomerId: user.stripeCustomerId,
          stripePriceId: user.stripePriceId,
          stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
        },
      });
    } catch (error) {
      console.error("Subscription fetch error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch subscription",
      });
    }
  }

  async getCredits(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const user = await prisma.user.findFirst({
        where: { clerkId },
        select: { id: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const credits = await getCreditBalance(user.id);
      return res.json({ credits });
    } catch (error) {
      console.error("Credits fetch error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch credits" });
    }
  }

  /**
   * Returns the user's credit grants in FIFO consumption order (which is
   * what the billing UI wants to render — "your subscription expires in N
   * days, then your top-up will start being used").
   */
  async getCreditGrants(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const user = await prisma.user.findFirst({
        where: { clerkId },
        select: { id: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const grants = await listActiveGrants(user.id);

      return res.json({
        success: true,
        data: grants.map((g) => ({
          id: g.id,
          source: g.source,
          amount: g.amount,
          used: g.used,
          remaining: g.amount - g.used,
          expiresAt: g.expiresAt,
          createdAt: g.createdAt,
          reason: g.reason,
        })),
      });
    } catch (error) {
      console.error("Credit grants fetch error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch credit grants",
      });
    }
  }
}

const CREDIT_REASON_LABELS: Record<string, string> = {
  "ai.clipping": "Clips",
  "avatar.generation": "Talking avatar",
  "image.generation": "Image",
  "image.upscale": "Image upscale",
  "influencer.studio": "AI influencer",
  "movie.materials": "Movie materials",
  "music.generation": "Music",
  "thumbnail.generation": "Thumbnail",
  "video.export.subtitle": "Subtitle export",
  "video.generation": "Video",
  "video.generation.kling": "Video",
  "video.generation.motion-control": "Motion control",
  "video.generation.seedance": "Video",
  "video.processing": "Subtitle removal",
  "video.upscale": "Video upscale",
  "voice.clone": "Voice clone",
  "voice.conversion": "Voice change",
  "voice.generation": "Voiceover",
  subscription_update: "Plan credits",
  "welcome:auto-grant": "Welcome credits",
};

/** Readable ledger label, e.g. "Video" or "Refund: Image". */
function creditReasonLabel(type: string, reason: string): string {
  const base =
    CREDIT_REASON_LABELS[reason] ??
    (reason.startsWith("admin:")
      ? "Adjustment"
      : reason.startsWith("fraud:")
        ? "Reversal"
        : reason
            .replace(/[._:-]+/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase()));

  if (type === "REFUND") return `Refund: ${base}`;
  if (type === "EXPIRY") return "Expired credits";
  if (type === "GRANT" && !CREDIT_REASON_LABELS[reason]) return "Credits added";
  return base;
}
