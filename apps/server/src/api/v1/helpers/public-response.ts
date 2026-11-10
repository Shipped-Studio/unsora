import { Response } from "express";
import { logger } from "../../../lib/logger";

export function sendError(
  res: Response,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return res.status(status).json({ success: false, error, ...extra });
}

export function handlePublicError(
  res: Response,
  error: unknown,
  logLabel: string,
  fallback = "Internal server error",
) {
  logger.error(logLabel, error);
  if (res.headersSent) return;
  return sendError(
    res,
    500,
    error instanceof Error ? error.message : fallback,
  );
}
