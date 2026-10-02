import { Request, Response } from "express";
import { UserController } from "../../../controllers/user.controller";
import { handlePublicError } from "../helpers/public-response";

const userController = new UserController();

export class PublicUserController {
  getCredits = async (req: Request, res: Response) => {
    try {
      return userController.getCredits(req, res);
    } catch (error) {
      return handlePublicError(res, error, "Get credits error:");
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
