import { Request, Response, NextFunction } from "express";
import { socialAccountLimitFor } from "../lib/plans";
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

  // The limit is set per plan at /admin/pricing.
  const limit = await socialAccountLimitFor(user.plan);

  if (limit === null) {
    return res.status(403).json({
      error:
        "An active paid plan is required to connect social accounts. Please upgrade your plan.",
    });
  }

  // Reconnecting refreshes an existing account's tokens (the OAuth callbacks
  // upsert by provider + providerAccountId), so it doesn't take a new slot.
  // The client passes ?reconnect=<accountId>; it must be the caller's own
  // account on the provider this route connects (/google, /linkedin, ...).
  const reconnectId =
    typeof req.query.reconnect === "string" ? req.query.reconnect : null;
  if (reconnectId) {
    const existing = await prisma.socialAccount.findFirst({
      where: { id: reconnectId, userId: user.id },
      select: { provider: true },
    });
    if (existing && req.path.split("/")[1] === existing.provider) {
      return next();
    }
  }

  if (socialAccounts >= limit) {
    return res.status(403).json({
      error:
        "Social account limit reached for your plan. Please upgrade to a higher plan.",
    });
  }

  next();
};
