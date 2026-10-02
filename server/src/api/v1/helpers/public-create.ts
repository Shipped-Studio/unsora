import { Request, Response } from "express";
import {
  replayIdempotentResponse,
  saveIdempotentResponse,
} from "../../../lib/api-public";

export async function withPublicCreate(
  req: Request,
  res: Response,
  statusCode: number,
  handler: () => Promise<Record<string, unknown> | null>,
): Promise<void> {
  if (await replayIdempotentResponse(req, res)) return;

  const body = await handler();
  if (body === null) return;

  await saveIdempotentResponse(req, statusCode, body);
  res.status(statusCode).json(body);
}
