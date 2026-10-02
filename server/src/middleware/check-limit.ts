import { Request, Response, NextFunction } from "express";
import { planLimits } from "../lib/limit";
import prisma from "../lib/db";

export const checkSocialAccountLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = req.auth.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      id: true,
      plan: true,
    },
  });

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const socialAccounts = await prisma.socialAccount.count({
    where: { userId: user.id },
  });

  // Stripe stores the product name with original casing (e.g. "Pro"),
  // but `planLimits` is keyed by lowercase ("basic" | "pro" | "power").
  const planKey = (user.plan ?? "").toLowerCase() as keyof typeof planLimits;
  const limit = planLimits[planKey]?.socialAccounts;

  if (limit === undefined) {
    return res.status(403).json({
      error:
        "An active paid plan is required to connect social accounts. Please upgrade your plan.",
    });
  }

  if (socialAccounts >= limit) {
    return res.status(403).json({
      error:
        "Social account limit reached for your plan. Please upgrade to a higher plan.",
    });
  }

  next();
};
