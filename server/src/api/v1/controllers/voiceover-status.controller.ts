import { Request, Response } from "express";
import prisma from "../../../lib/db";

async function resolveUser(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true },
  });
}

export class PublicVoiceoverStatusController {
  getStatus = async (req: Request, res: Response) => {
    try {
      const { id: generationId } = req.params;

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

      // Voice-changer (speech-to-speech) jobs share this endpoint — their
      // output is a voice track too.
      const generation =
        (await prisma.voiceGeneration.findFirst({
          where: { id: generationId, userId: user.id },
          include: { outputAsset: true },
        })) ??
        (await prisma.voiceConversion.findFirst({
          where: { id: generationId, userId: user.id },
          include: { outputAsset: true },
        }));

      if (!generation) {
        return res
          .status(404)
          .json({ success: false, error: "Generation not found" });
      }

      const isCompleted = generation.status === "COMPLETED";

      return res.json({
        success: true,
        data: {
          id: generation.id,
          status: generation.status,
          voiceId: generation.voiceId,
          outputUrl: generation.outputAsset?.url ?? null,
          error: generation.error,
          createdAt: generation.createdAt.toISOString(),
          updatedAt: generation.updatedAt.toISOString(),
          completedAt: isCompleted ? generation.updatedAt.toISOString() : null,
        },
      });
    } catch (error) {
      console.error("Get voiceover status error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  };
}
