import { Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import prisma from "../lib/db";
import { userIsAdmin } from "../lib/is-admin";

/**
 * Admin guard.
 *
 * Authorisation order (first match wins):
 *   1. `User.role === "ADMIN"`  ← canonical, what you should be using
 *   2. `ADMIN_EMAILS` env list   ← legacy backward-compat so we don't lock
 *      anyone out before every admin row has been migrated. Remove this
 *      branch once the team is fully on the role column.
 */
/**
 * Admin guard for API-key / OAuth authenticated routes. Must run AFTER an
 * auth middleware that sets `req.auth.userId` (clerkId) — e.g.
 * `publicApiMiddleware` — since `requireAdmin` above only understands Clerk
 * sessions and would 401 API-key callers (like the MCP server).
 */
export async function requireApiAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { email: true, role: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userIsAdmin(user)) {
      return next();
    }

    return res.status(403).json({
      error: "Forbidden: Admin access required",
    });
  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export const requireAdmin = [
  clerkMiddleware({ isSatellite: false, signInUrl: undefined as unknown as string }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = getAuth(req);
      if (!auth?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Expose userId on req.auth for downstream handlers
      (req as Request & { auth: { userId: string } }).auth = { userId: auth.userId };

      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (userIsAdmin(user)) {
        return next();
      }

      return res.status(403).json({
        error: "Forbidden: Admin access required",
      });
    } catch (error) {
      console.error("Admin auth error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
];
