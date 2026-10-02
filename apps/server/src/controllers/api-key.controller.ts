import { Request, Response } from "express";
import { MAX_API_KEYS_PER_USER, mirrorUnkeyKey } from "../lib/api-keys";
import {
  createUnkeyKey,
  listUnkeyKeys,
  revokeUnkeyKey,
} from "../lib/unkey";
import prisma from "../lib/db";

/**
 * API keys for the public `/api/v1` surface are managed by Unkey. Each key is
 * linked to its owner via `externalId = clerkId`, so we filter/scope every
 * operation to the authenticated user's clerkId (`req.auth.userId`).
 */
export class ApiKeyController {
  async list(req: Request, res: Response) {
    try {
      const keys = await listUnkeyKeys(req.auth.userId);

      const data = keys.map((k) => ({
        id: k.keyId,
        name: k.name ?? null,
        keyPrefix: k.start,
        lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : null,
        revokedAt: null,
        createdAt: new Date(k.createdAt),
      }));

      return res.json({ success: true, data });
    } catch (error) {
      console.error("API key list error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to list API keys" });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Name is required" });
      }

      const trimmedName = name.trim().slice(0, 64);

      const existing = await listUnkeyKeys(req.auth.userId);
      const activeCount = existing.filter((k) => k.enabled).length;
      if (activeCount >= MAX_API_KEYS_PER_USER) {
        return res.status(400).json({
          success: false,
          error: `Maximum of ${MAX_API_KEYS_PER_USER} active API keys allowed`,
          code: "API_KEY_LIMIT",
        });
      }

      const { key, keyId } = await createUnkeyKey({
        clerkId: req.auth.userId,
        name: trimmedName,
      });

      // Mirror the key into the local api_keys table so attribution FKs
      // (credit transactions, idempotency records) resolve from the first
      // request. If this fails, the auth middleware re-mirrors on first use.
      try {
        const user = await prisma.user.findUnique({
          where: { clerkId: req.auth.userId },
          select: { id: true },
        });
        if (user) {
          await mirrorUnkeyKey({
            keyId,
            userId: user.id,
            name: trimmedName,
            keyPrefix: key.slice(0, 12),
          });
        }
      } catch (err) {
        console.error("API key mirror error:", err);
      }

      return res.status(201).json({
        success: true,
        data: {
          id: keyId,
          name: trimmedName,
          keyPrefix: key.slice(0, 12),
          createdAt: new Date(),
          key,
        },
      });
    } catch (error) {
      console.error("API key create error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to create API key" });
    }
  }

  async revoke(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Scope to the caller: only keys owned by this user are returned here.
      const keys = await listUnkeyKeys(req.auth.userId);
      const owned = keys.find((k) => k.keyId === id);
      if (!owned) {
        return res
          .status(404)
          .json({ success: false, error: "API key not found" });
      }

      await revokeUnkeyKey(id);

      return res.json({ success: true, message: "API key revoked" });
    } catch (error) {
      console.error("API key revoke error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to revoke API key" });
    }
  }
}
