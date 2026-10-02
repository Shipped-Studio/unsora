import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "./db";

/** Attach API key audit metadata to job params (no webhooks — clients poll status). */
export function mergeApiContext(
  existing: Record<string, unknown> | null | undefined,
  context: { apiKeyId?: string },
): Prisma.InputJsonValue {
  const base = { ...(existing ?? {}) };
  if (!context.apiKeyId) {
    return base as Prisma.InputJsonValue;
  }
  const api: Record<string, unknown> = {
    ...((base.api as Record<string, unknown> | undefined) ?? {}),
    apiKeyId: context.apiKeyId,
  };
  base.api = api;
  return base as Prisma.InputJsonValue;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function getRequestPath(req: Request): string {
  return `${req.baseUrl}${req.path}`;
}

function getIdempotencyKey(req: Request): string | null {
  const raw = req.headers["idempotency-key"];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

export async function replayIdempotentResponse(
  req: Request,
  res: Response,
): Promise<boolean> {
  const apiKeyId = req.auth.apiKeyId;
  const idempotencyKey = getIdempotencyKey(req);
  if (!apiKeyId || !idempotencyKey) return false;

  const record = await prisma.apiIdempotencyRecord.findUnique({
    where: {
      apiKeyId_idempotencyKey: { apiKeyId, idempotencyKey },
    },
  });

  if (!record) return false;
  if (record.expiresAt <= new Date()) {
    await prisma.apiIdempotencyRecord
      .delete({ where: { id: record.id } })
      .catch(() => {});
    return false;
  }

  if (record.method !== req.method || record.path !== getRequestPath(req)) {
    res.status(409).json({
      success: false,
      error: "Idempotency key reused with different request",
      code: "IDEMPOTENCY_CONFLICT",
    });
    return true;
  }

  res.setHeader("Idempotent-Replayed", "true");
  res.status(record.statusCode).json(record.responseBody);
  return true;
}

export async function saveIdempotentResponse(
  req: Request,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  const apiKeyId = req.auth.apiKeyId;
  const idempotencyKey = getIdempotencyKey(req);
  if (!apiKeyId || !idempotencyKey) return;

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

  await prisma.apiIdempotencyRecord.upsert({
    where: {
      apiKeyId_idempotencyKey: { apiKeyId, idempotencyKey },
    },
    create: {
      apiKeyId,
      idempotencyKey,
      method: req.method,
      path: getRequestPath(req),
      statusCode,
      responseBody: responseBody as object,
      expiresAt,
    },
    update: {
      statusCode,
      responseBody: responseBody as object,
      expiresAt,
    },
  });
}

export function getApiKeyId(req: Request): string | undefined {
  return req.auth.apiKeyId;
}

/**
 * Where a public API request came from. The Unsora MCP server sends
 * `X-Unsora-Client: mcp`; everything else on /api/v1 counts as the REST API.
 */
export function resolvePostSource(req: Request): {
  source: "API" | "MCP";
  apiKeyId: string | null;
} {
  const client = req.headers["x-unsora-client"];
  const isMcp = typeof client === "string" && client.toLowerCase() === "mcp";
  return {
    source: isMcp ? "MCP" : "API",
    apiKeyId: req.auth.apiKeyId ?? null,
  };
}
