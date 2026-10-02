import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { resolveUser } from "../helpers/resolve-user";
import { handlePublicError, sendError } from "../helpers/public-response";

export class AccountsController {
  getAccounts = async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      const accounts = await prisma.socialAccount.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          accountName: true,
          accountUsername: true,
          profilePicture: true,
          expiresAt: true,
        },
        orderBy: { accountName: "asc" },
      });

      return res.json({ success: true, data: accounts });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Get accounts error:",
        "Failed to fetch connected accounts",
      );
    }
  };
}
