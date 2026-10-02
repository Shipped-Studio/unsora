import { Request, Response } from "express";
import prisma from "../lib/db";
import { addInfluencerStudioJob } from "../queue/influencer-studio.queue";
import { gptImage2, influencerConfig } from "../config/models";
import {
  consumeCredits,
  getCreditBalance,
  refundConsumption,
  InsufficientCreditsError,
} from "../lib/credits";

const CREDIT_COST = gptImage2.credits({ resolution: "2k" });

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class InfluencerStudioController {
  async create(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const {
        prompt,
        aspectRatio = "1:1",
        cameraAngle,
        styleMode,
        age,
        count = 1,
      } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Prompt is required" });
      }

      if (!influencerConfig.validRatios.includes(aspectRatio)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid aspect ratio" });
      }

      if (cameraAngle && !influencerConfig.cameraAngles.includes(cameraAngle)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid camera angle" });
      }

      if (styleMode && !influencerConfig.styleModes.includes(styleMode)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid style mode" });
      }

      let ageValue: number | undefined;
      if (age !== undefined && age !== null && age !== "") {
        const n = Number(age);
        if (
          !Number.isInteger(n) ||
          n < influencerConfig.minAge ||
          n > influencerConfig.maxAge
        ) {
          return res.status(400).json({
            success: false,
            error: `Invalid age. Must be an integer between ${influencerConfig.minAge} and ${influencerConfig.maxAge}.`,
          });
        }
        ageValue = n;
      }

      const imageCount = Math.min(
        Math.max(Math.floor(count), 1),
        influencerConfig.maxCount,
      );
      const totalCost = CREDIT_COST * imageCount;

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const balance = await getCreditBalance(user.id);
      if (balance < totalCost) {
        return res.status(402).json({
          success: false,
          error: `Insufficient credits. Need ${totalCost}, have ${balance}`,
          creditsRemaining: balance,
        });
      }

      const generations: { id: string; status: string }[] = [];
      const consumedTxnIds: string[] = [];
      let creditsRemaining: number | undefined;

      for (let i = 0; i < imageCount; i++) {
        const params: Record<string, string | number> = {};
        if (cameraAngle) params.camera_angle = cameraAngle;
        if (styleMode) params.style_mode = styleMode;
        if (ageValue !== undefined) params.age = ageValue;

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
            return res.status(402).json({
              success: false,
              error: err.message,
              creditsRemaining: lastBalance ?? err.available,
            });
          }
          throw err;
        }

        const job = await addInfluencerStudioJob({
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

        generations.push({
          id: generation.id,
          status: "QUEUED",
        });
      }

      return res.json({
        success: true,
        generations,
        creditsDeducted: totalCost,
        creditsRemaining,
      });
    } catch (error) {
      console.error("Create influencer studio generation error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 20, 1),
        100,
      );
      const offset = (page - 1) * limit;

      const user = await resolveUser(clerkUserId);
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
  }

  async refresh(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationId } = req.params;

      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(clerkUserId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const generation = await prisma.imageGeneration.findFirst({
        where: {
          id: generationId,
          userId: user.id,
          type: "INFLUENCER",
        },
        include: {
          outputAsset: true,
          thumbnailAsset: true,
          referenceAssets: {
            include: { asset: true },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      return res.json({ success: true, generation });
    } catch (error) {
      console.error("Refresh influencer studio status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const clerkUserId = req.auth.userId;
      const { generationId } = req.params;

      if (!generationId) {
        return res
          .status(400)
          .json({ success: false, error: "Generation ID is required" });
      }

      const user = await resolveUser(clerkUserId);
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
  }
}
