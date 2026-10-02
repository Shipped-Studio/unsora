import type { Request, Response } from "express";
import prisma from "../../lib/db";
import { FEED_KINDS, type FeedKind } from "./_shared";

/** Minimal asset shape selected from every relation. */
const ASSET_SELECT = {
  id: true,
  url: true,
  name: true,
  mimeType: true,
  type: true,
} as const;

interface MediaItem {
  label: string;
  url: string;
  type: string; // IMAGE | VIDEO | AUDIO | DOCUMENT
  mimeType: string;
  name: string;
  thumbnailUrl?: string;
}

type Asset = {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: string;
} | null;

function media(asset: Asset, label: string, thumb?: Asset): MediaItem | null {
  if (!asset) return null;
  return {
    label,
    url: asset.url,
    type: asset.type,
    mimeType: asset.mimeType,
    name: asset.name,
    thumbnailUrl: thumb?.url,
  };
}

interface Detail {
  id: string;
  kind: FeedKind;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  model: string | null;
  credits: number;
  error: string | null;
  text: string | null;
  params: unknown;
  outputs: MediaItem[];
  inputs: MediaItem[];
  meta: { label: string; value: string }[];
}

/**
 * GET /api/admin/tasks/:kind/:id
 *
 * Full detail for a single task — the actual generated media (output +
 * thumbnails), the input media, the prompt/params, and any error. Each
 * generation table has a different shape, so this normalises them to one
 * `Detail` the client renders uniformly.
 */
export class AdminTaskDetailController {
  async get(req: Request, res: Response) {
    try {
      const kind = String(req.params.kind) as FeedKind;
      const { id } = req.params;
      if (!(FEED_KINDS as readonly string[]).includes(kind)) {
        return res.status(400).json({ success: false, error: "Unknown task kind" });
      }

      const detail = await this.load(kind, id);
      if (!detail) {
        return res.status(404).json({ success: false, error: "Task not found" });
      }
      // Drop null media entries.
      detail.outputs = detail.outputs.filter(Boolean);
      detail.inputs = detail.inputs.filter(Boolean);
      return res.json({ success: true, data: detail });
    } catch (error) {
      console.error("[admin] task detail error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load task" });
    }
  }

  private m(...items: (MediaItem | null)[]): MediaItem[] {
    return items.filter((x): x is MediaItem => x !== null);
  }

  private meta(pairs: [string, unknown][]): { label: string; value: string }[] {
    return pairs
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([label, v]) => ({ label, value: String(v) }));
  }

  private async load(kind: FeedKind, id: string): Promise<Detail | null> {
    switch (kind) {
      case "video": {
        const r = await prisma.generation.findUnique({
          where: { id },
          include: {
            outputAsset: { select: ASSET_SELECT },
            thumbnailAsset: { select: ASSET_SELECT },
            imageAsset: { select: ASSET_SELECT },
            endImageAsset: { select: ASSET_SELECT },
            inputAssets: { include: { asset: { select: ASSET_SELECT } } },
          },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: r.model,
          credits: r.creditsUsed,
          error: r.error,
          text: r.prompt,
          params: r.metadata,
          outputs: this.m(media(r.outputAsset, "Output", r.thumbnailAsset)),
          inputs: this.m(
            media(r.imageAsset, "Start frame"),
            media(r.endImageAsset, "End frame"),
            ...r.inputAssets.map((ia) => media(ia.asset, ia.role)),
          ),
          meta: this.meta([
            ["Mode", r.functionMode],
            ["Ratio", r.ratio],
            ["Duration", `${r.duration}s`],
            ["Resolution", r.resolution],
          ]),
        };
      }
      case "image": {
        const r = await prisma.imageGeneration.findUnique({
          where: { id },
          include: {
            outputAsset: { select: ASSET_SELECT },
            thumbnailAsset: { select: ASSET_SELECT },
            inputAsset: { select: ASSET_SELECT },
            referenceAssets: { include: { asset: { select: ASSET_SELECT } } },
          },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: r.model,
          credits: r.creditsUsed,
          error: r.error,
          text: r.prompt,
          params: r.params,
          outputs: this.m(media(r.outputAsset, "Output", r.thumbnailAsset)),
          inputs: this.m(
            media(r.inputAsset, "Input"),
            ...r.referenceAssets.map((ra) => media(ra.asset, "Reference")),
          ),
          meta: this.meta([
            ["Type", r.type],
            ["Ratio", r.ratio],
            ["Resolution", r.resolution],
          ]),
        };
      }
      case "music": {
        const r = await prisma.musicGeneration.findUnique({
          where: { id },
          include: { outputAsset: { select: ASSET_SELECT } },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: r.model,
          credits: r.creditsUsed,
          error: r.error,
          text: r.lyrics || r.prompt,
          params: r.params,
          outputs: this.m(media(r.outputAsset, "Track")),
          inputs: [],
          meta: this.meta([
            ["Prompt", r.prompt],
            ["Format", r.outputFormat],
          ]),
        };
      }
      case "avatar": {
        const r = await prisma.avatarGeneration.findUnique({
          where: { id },
          include: {
            outputAsset: { select: ASSET_SELECT },
            imageAsset: { select: ASSET_SELECT },
            audioAsset: { select: ASSET_SELECT },
          },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: r.model,
          credits: r.creditsUsed,
          error: r.error,
          text: r.transcript,
          params: r.params,
          outputs: this.m(media(r.outputAsset, "Output")),
          inputs: this.m(
            media(r.imageAsset, "Portrait"),
            media(r.audioAsset, "Audio"),
          ),
          meta: this.meta([
            ["Emotion", r.emotion],
            ["Voice", r.voiceId],
            ["Resolution", r.resolution],
          ]),
        };
      }
      case "voice": {
        const r = await prisma.voiceGeneration.findUnique({
          where: { id },
          include: { outputAsset: { select: ASSET_SELECT } },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: r.model,
          credits: r.creditsUsed,
          error: r.error,
          text: r.text,
          params: r.params,
          outputs: this.m(media(r.outputAsset, "Audio")),
          inputs: [],
          meta: this.meta([
            ["Voice", r.voiceId],
            ["Emotion", r.emotion],
            ["Speed", r.speed],
          ]),
        };
      }
      case "voice_conversion": {
        const r = await prisma.voiceConversion.findUnique({
          where: { id },
          include: {
            outputAsset: { select: ASSET_SELECT },
            sourceAsset: { select: ASSET_SELECT },
          },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: r.voiceId,
          credits: r.creditsUsed,
          error: r.error,
          text: null,
          params: r.params,
          outputs: this.m(media(r.outputAsset, "Converted")),
          inputs: this.m(media(r.sourceAsset, "Source")),
          meta: this.meta([["Format", r.outputFormat]]),
        };
      }
      case "clipping": {
        const r = await prisma.aIClipping.findUnique({
          where: { id },
          include: {
            sourceAsset: { select: ASSET_SELECT },
            clips: {
              orderBy: { order: "asc" },
              include: {
                outputAsset: { select: ASSET_SELECT },
                thumbnailAsset: { select: ASSET_SELECT },
              },
            },
          },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: null,
          credits: r.creditsUsed,
          error: r.error,
          text: null,
          params: r.config,
          outputs: this.m(
            ...r.clips.map((c, i) =>
              media(c.outputAsset, c.title || `Clip ${i + 1}`, c.thumbnailAsset),
            ),
          ),
          inputs: this.m(media(r.sourceAsset, "Source video")),
          meta: this.meta([["Clips", r.clips.length]]),
        };
      }
      case "video_processing": {
        const r = await prisma.processedVideo.findUnique({
          where: { id },
          include: {
            originalAsset: { select: ASSET_SELECT },
            processedAsset: { select: ASSET_SELECT },
          },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: r.upscaleModel,
          credits: r.creditsUsed,
          error: r.error,
          text: r.originalName,
          params: r.metadata,
          outputs: this.m(media(r.processedAsset, "Processed")),
          inputs: this.m(media(r.originalAsset, "Original")),
          meta: this.meta([
            ["Operations", (r.operations || []).join(", ")],
            ["Resolution", r.resolution],
          ]),
        };
      }
      case "transcription": {
        const r = await prisma.transcription.findUnique({
          where: { id },
          include: { videoAsset: { select: ASSET_SELECT } },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          model: null,
          credits: 0,
          error: r.error,
          text: r.text,
          params: r.metadata,
          outputs: [],
          inputs: this.m(media(r.videoAsset, "Video")),
          meta: this.meta([
            ["Title", r.title],
            ["Language", r.language],
            ["Duration", `${Math.round(r.duration)}s`],
          ]),
        };
      }
      case "video_export": {
        const r = await prisma.videoExport.findUnique({
          where: { id },
          include: {
            outputAsset: { select: ASSET_SELECT },
            sourceAsset: { select: ASSET_SELECT },
          },
        });
        if (!r) return null;
        return {
          id: r.id,
          kind,
          status: r.status,
          createdAt: r.createdAt,
          model: null,
          credits: 0,
          error: r.error,
          text: null,
          params: r.settings,
          outputs: this.m(media(r.outputAsset, "Export")),
          inputs: this.m(media(r.sourceAsset, "Source")),
          meta: this.meta([
            ["Duration", `${Math.round(r.duration)}s`],
            ["FPS", r.fps],
          ]),
        };
      }
      default:
        return null;
    }
  }
}

export const adminTaskDetailController = new AdminTaskDetailController();
