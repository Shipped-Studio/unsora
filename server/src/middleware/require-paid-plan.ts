import { Request, Response, NextFunction } from "express";
import prisma from "../lib/db";

/**
 * Blocks the request unless the authenticated user has an active paid plan.
 *
 * A user is considered "paid" when:
 *   - `user.isActive === true` (subscription / trial currently active), AND
 *   - `user.plan` is set and not equal to "free" (case-insensitive).
 *
 * Used to gate the social media scheduler — connecting platforms and
 * creating / publishing posts both require an active subscription.
 *
 * Must be mounted AFTER `requireAuth` so `req.auth.userId` is available.
 */
export const requirePaidPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const clerkId = req.auth?.userId;

  if (!clerkId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      plan: true,
      isActive: true,
    },
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  const planKey = user.plan?.toLowerCase() ?? "free";
  const hasPaidPlan = user.isActive && planKey !== "free";

  if (!hasPaidPlan) {
    return res.status(403).json({
      success: false,
      error: "An active paid plan is required to use the scheduler.",
      code: "PLAN_REQUIRED",
    });
  }

  next();
};
