import { Request, Response } from "express";
import prisma from "../../../lib/db";
import { addInfluencerStudioJob } from "../../../queue/influencer-studio.queue";
import { gptImage2, influencerConfig } from "../../../config/models";
import {
  consumeCredits,
  getCreditBalance,
  refundConsumption,
  InsufficientCreditsError,
} from "../../../lib/credits";
import { getApiKeyId, mergeApiContext } from "../../../lib/api-public";
import { withPublicCreate } from "../helpers/public-create";

const CREDIT_COST = gptImage2.credits({ resolution: "2k" });

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

type CreateResult =
  | { ok: false; status: number; body: Record<string, unknown> }
  | { ok: true; body: Record<string, unknown> };

export class PublicInfluencerStudioController {
  create = async (req: Request, res: Response) => {
    try {
      await withPublicCreate(req, res, 200, async () => {
        const result = await this.runCreate(req);
        if (!result.ok) {
          res.status(result.status).json(result.body);
          return null;
        }
        return result.body;
      });
    } catch (error) {
      console.error("Public create influencer studio error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  };

  getAll = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 20, 1),
        100,
      );
      const offset = (page - 1) * limit;

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const where = { userId: user.id, type: "INFLUENCER" as const };

      const [generations, totalCount] = await Promise.all([
        prisma.imageGeneration.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          include: {
            outputAsset: true,
            thumbnailAsset: true,
            referenceAssets: {
              include: { asset: true },
              orderBy: { order: "asc" },
            },
          },
        }),
        prisma.imageGeneration.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return res.json({
        success: true,
        generations,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Get influencer studio generations error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { generationId } = req.params;
      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      await prisma.imageGeneration.delete({
        where: { id: generationId, userId: user.id },
      });

      return res.json({
        success: true,
        message: "Generation deleted successfully",
      });
    } catch (error) {
      console.error("Delete influencer studio generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };

  private async runCreate(req: Request): Promise<CreateResult> {
    const apiKeyId = getApiKeyId(req);
    const {
      prompt,
      aspectRatio = "1:1",
      cameraAngle,
      styleMode,
      age,
      count = 1,
    } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Prompt is required" },
      };
    }

    if (!influencerConfig.validRatios.includes(aspectRatio)) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Invalid aspect ratio" },
      };
    }

    if (cameraAngle && !influencerConfig.cameraAngles.includes(cameraAngle)) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Invalid camera angle" },
      };
    }

    if (styleMode && !influencerConfig.styleModes.includes(styleMode)) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: "Invalid style mode" },
      };
    }

    let ageValue: number | undefined;
    if (age !== undefined && age !== null && age !== "") {
      const n = Number(age);
      if (
        !Number.isInteger(n) ||
        n < influencerConfig.minAge ||
        n > influencerConfig.maxAge
      ) {
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: `Invalid age. Must be an integer between ${influencerConfig.minAge} and ${influencerConfig.maxAge}.`,
          },
        };
      }
      ageValue = n;
    }

    const imageCount = Math.min(
      Math.max(Math.floor(count), 1),
      influencerConfig.maxCount,
    );
    const totalCost = CREDIT_COST * imageCount;

    const user = await resolveUser(req.auth.userId);
    if (!user) {
      return {
        ok: false,
        status: 404,
        body: { success: false, error: "User not found" },
      };
    }

    const balance = await getCreditBalance(user.id);
    if (balance < totalCost) {
      return {
        ok: false,
        status: 402,
        body: {
          success: false,
          error: `Insufficient credits. Need ${totalCost}, have ${balance}`,
          creditsRemaining: balance,
        },
      };
    }

    const generations: { id: string; status: string }[] = [];
    const consumedTxnIds: string[] = [];
    let creditsRemaining: number | undefined;

    for (let i = 0; i < imageCount; i++) {
      const params = mergeApiContext(
        {
          ...(cameraAngle ? { camera_angle: cameraAngle } : {}),
          ...(styleMode ? { style_mode: styleMode } : {}),
          ...(ageValue !== undefined ? { age: ageValue } : {}),
        },
        { apiKeyId },
      );

      const generation = await prisma.imageGeneration.create({
        data: {
          userId: user.id,
          model: gptImage2.dbModel,
          prompt: prompt.trim(),
          ratio: aspectRatio,
          type: "INFLUENCER",
          params,
          creditsUsed: CREDIT_COST,
          status: "QUEUED",
        },
      });

      let creditTransactionId: string;
      try {
        const consumption = await consumeCredits({
          userId: user.id,
          amount: CREDIT_COST,
          reason: "influencer.studio",
          apiKeyId,
          metadata: { generationId: generation.id },
        });
        creditTransactionId = consumption.transactionId;
        consumedTxnIds.push(creditTransactionId);
        creditsRemaining = consumption.balanceAfter;
      } catch (err) {
        await prisma.imageGeneration
          .delete({ where: { id: generation.id } })
          .catch(() => {});
        let lastBalance: number | undefined;
        for (const txn of consumedTxnIds) {
          const refund = await refundConsumption(
            txn,
            "influencer.studio.batch.aborted",
          ).catch(() => undefined);
          if (refund?.balanceAfter !== undefined)
            lastBalance = refund.balanceAfter;
        }
        if (err instanceof InsufficientCreditsError) {
          return {
            ok: false,
            status: 402,
            body: {
              success: false,
              error: err.message,
              creditsRemaining: lastBalance ?? err.available,
            },
          };
        }
        throw err;
      }

      await addInfluencerStudioJob({
        userId: user.id,
        generationId: generation.id,
        creditsUsed: CREDIT_COST,
        creditTransactionId,
        prompt: prompt.trim(),
        aspectRatio,
        cameraAngle,
        styleMode,
        age: ageValue,
      });

      generations.push({ id: generation.id, status: "QUEUED" });
    }

    return {
      ok: true,
      body: {
        success: true,
        generations,
        creditsDeducted: totalCost,
        creditsRemaining,
      },
    };
  }
}
