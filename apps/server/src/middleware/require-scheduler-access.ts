import { Request, Response, NextFunction } from "express";
import prisma from "../lib/db";
import { freeSocialAccounts, hasPaidPlan } from "../lib/plans";

/**
 * Lets the request through for anyone who may use the scheduler: a live
 * paid plan, or the free tier (FREE_SOCIAL_ACCOUNTS > 0). How many accounts
 * they get is enforced separately, when connecting (check-limit) and when
 * publishing (post queue).
 *
 * Must be mounted AFTER `requireAuth` so `req.auth.userId` is available.
 */
export const requireSchedulerAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clerkId = req.auth?.userId;
  if (!clerkId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { plan: true, isActive: true },
  });
  if (!user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!hasPaidPlan(user) && freeSocialAccounts() === 0) {
    return res.status(403).json({
      success: false,
      error: "An active paid plan is required to use the scheduler.",
      code: "PLAN_REQUIRED",
    });
  }

  next();
};
