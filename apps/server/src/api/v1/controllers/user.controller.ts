import { Request, Response } from "express";
import { UserController } from "../../../controllers/user.controller";
import prisma from "../../../lib/db";
import { handlePublicError, sendError } from "../helpers/public-response";

const userController = new UserController();

export class PublicUserController {
  getCredits = async (req: Request, res: Response) => {
    try {
      return userController.getCredits(req, res);
    } catch (error) {
      return handlePublicError(res, error, "Get credits error:");
    }
  };

  /**
   * GET /user/me: who this API key or OAuth token belongs to. Integrations
   * (Zapier, n8n, Activepieces) use it to label the connection.
   */
  getMe = async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        select: { id: true, email: true },
      });
      if (!user) return sendError(res, 404, "User not found");
      return res.json({ success: true, data: { id: user.id, email: user.email } });
    } catch (error) {
      return handlePublicError(res, error, "Get me error:");
    }
  };

  getSubscription = async (req: Request, res: Response) => {
    try {
      return userController.getSubscription(req, res);
    } catch (error) {
      return handlePublicError(res, error, "Get subscription error:");
    }
  };
}
