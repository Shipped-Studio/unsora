import { Request, Response } from "express";
import prisma from "../lib/db";
import { getCreditBalance, listActiveGrants } from "../lib/credits";
import { clerkClient } from "@clerk/express";
import { userIsAdmin } from "../lib/is-admin";

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
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const credits = await getCreditBalance(user.id);

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
