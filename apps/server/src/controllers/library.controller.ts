import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/db";
import { num, toPositiveInt } from "./admin/_shared";

/**
 * The Library is every finished file a user has: generations of every kind
 * plus uploads, normalised to one row shape so the client can list, filter
 * and attach them to posts without knowing which table they came from.
 *
 * `source` is "api" when the job was paid for with an API key (REST or MCP
 * with a key). MCP connections made over OAuth carry no key and show as web.
 */
const API_KEY_FROM_CREDITS = (idColumn: string, userColumn: string) => `
  EXISTS (
    SELECT 1 FROM credit_transactions ct
    WHERE ct."userId" = ${userColumn}
      AND ct."apiKeyId" IS NOT NULL
      AND ct.metadata->>'generationId' = ${idColumn}
  )`;

const LIBRARY_PARTS = [
  // Video generation and motion control
  `SELECT g.id, CASE WHEN g."functionMode" = 'MOTION_CONTROL' THEN 'motion_control' ELSE 'video' END AS kind,
     'video' AS "mediaType", UPPER(g.status::text) AS status, g.prompt AS label, g.model AS model,
     o.url AS url, t.url AS "thumbnailUrl", COALESCE(g."creditsUsed", 0) AS credits,
     CASE WHEN ${API_KEY_FROM_CREDITS("g.id", 'g."userId"')} THEN 'api' ELSE 'web' END AS source,
     g."createdAt", o.id AS "assetId", o.width, o.height, COALESCE(o.duration, g.duration::float) AS duration, o."mimeType",
     o."folderId" AS "folderId"
   FROM generations g
   LEFT JOIN assets o ON o.id = g."outputAssetId"
   LEFT JOIN assets t ON t.id = g."thumbnailAssetId"
   WHERE g."userId" = $1`,
  // Images, thumbnails, influencer photos, movie materials, image upscales
  `SELECT i.id, CASE i.type::text
       WHEN 'THUMBNAIL' THEN 'thumbnail'
       WHEN 'INFLUENCER' THEN 'influencer'
       WHEN 'MOVIE_MATERIALS' THEN 'movie_material'
       WHEN 'UPSCALE' THEN 'image_upscale'
       ELSE 'image' END,
     'image', UPPER(i.status::text), i.prompt, i.model,
     o.url, COALESCE(t.url, o.url), COALESCE(i."creditsUsed", 0),
     CASE WHEN i.params->'api'->>'apiKeyId' IS NOT NULL THEN 'api' ELSE 'web' END,
     i."createdAt", o.id, o.width, o.height, NULL::float, o."mimeType", o."folderId"
   FROM image_generations i
   LEFT JOIN assets o ON o.id = i."outputAssetId"
   LEFT JOIN assets t ON t.id = i."thumbnailAssetId"
   WHERE i."userId" = $1`,
  `SELECT m.id, 'music', 'audio', UPPER(m.status::text), m.prompt, m.model,
     o.url, NULL, COALESCE(m."creditsUsed", 0),
     CASE WHEN m.params->>'apiKeyId' IS NOT NULL THEN 'api' ELSE 'web' END,
     m."createdAt", o.id, NULL::int, NULL::int, o.duration, o."mimeType", o."folderId"
   FROM music_generations m
   LEFT JOIN assets o ON o.id = m."outputAssetId"
   WHERE m."userId" = $1`,
  `SELECT v.id, 'voiceover', 'audio', UPPER(v.status::text), v.text, v.model,
     o.url, NULL, COALESCE(v."creditsUsed", 0),
     CASE WHEN v.params->>'apiKeyId' IS NOT NULL THEN 'api' ELSE 'web' END,
     v."createdAt", o.id, NULL::int, NULL::int, o.duration, o."mimeType", o."folderId"
   FROM voice_generations v
   LEFT JOIN assets o ON o.id = v."outputAssetId"
   WHERE v."userId" = $1`,
  `SELECT c.id, 'voice_change', 'audio', UPPER(c.status::text), NULL, NULL,
     o.url, NULL, COALESCE(c."creditsUsed", 0), 'web',
     c."createdAt", o.id, NULL::int, NULL::int, o.duration, o."mimeType", o."folderId"
   FROM voice_conversions c
   LEFT JOIN assets o ON o.id = c."outputAssetId"
   WHERE c."userId" = $1`,
  `SELECT a.id, 'avatar', 'video', UPPER(a.status::text), a.transcript, a.model,
     o.url, NULL, COALESCE(a."creditsUsed", 0), 'web',
     a."createdAt", o.id, o.width, o.height, o.duration, o."mimeType", o."folderId"
   FROM avatar_generations a
   LEFT JOIN assets o ON o.id = a."outputAssetId"
   WHERE a."userId" = $1`,
  // Individual clips cut by AI clipping. Credits are charged on the parent job.
  `SELECT clip.id, 'clip', 'video', UPPER(clip.status::text), clip.title, NULL,
     o.url, t.url, 0,
     CASE WHEN job.metadata->'api'->>'apiKeyId' IS NOT NULL THEN 'api' ELSE 'web' END,
     clip."createdAt", o.id, o.width, o.height, COALESCE(o.duration, clip.duration), o."mimeType", o."folderId"
   FROM ai_clipping_clips clip
   JOIN ai_clippings job ON job.id = clip."aiClippingId"
   LEFT JOIN assets o ON o.id = clip."outputAssetId"
   LEFT JOIN assets t ON t.id = clip."thumbnailAssetId"
   WHERE job."userId" = $1`,
  `SELECT p.id, CASE WHEN 'UPSCALING' = ANY(p.operations) THEN 'video_upscale' ELSE 'subtitle_removal' END,
     'video', UPPER(p.status), p."originalName", COALESCE(p."upscaleModel", p."watermarkRemovalModel"),
     o.url, NULL, COALESCE(p."creditsUsed", 0), 'web',
     p."createdAt", o.id, o.width, o.height, o.duration, o."mimeType", o."folderId"
   FROM processed_videos p
   LEFT JOIN assets o ON o.id = p."processedAssetId"
   WHERE p."userId" = $1`,
  `SELECT e.id, 'subtitle_export', 'video', UPPER(e.status), NULL, NULL,
     o.url, NULL, 0, 'web',
     e."createdAt", o.id, o.width, o.height, COALESCE(o.duration, e.duration), o."mimeType", o."folderId"
   FROM video_exports e
   LEFT JOIN assets o ON o.id = e."outputAssetId"
   WHERE e."userId" = $1`,
  `SELECT u.id, 'upload', LOWER(u.type::text), 'COMPLETED', u.name, NULL,
     u.url, NULL, 0, 'web',
     u."createdAt", u.id, u.width, u.height, u.duration, u."mimeType", u."folderId"
   FROM assets u
   WHERE u."userId" = $1 AND u.source = 'UPLOAD'`,
];

const LIBRARY_SELECT = LIBRARY_PARTS.join("\n UNION ALL \n");

const MEDIA_TYPES = new Set(["video", "image", "audio"]);
const KINDS = new Set([
  "video",
  "motion_control",
  "image",
  "thumbnail",
  "influencer",
  "movie_material",
  "image_upscale",
  "music",
  "voiceover",
  "voice_change",
  "avatar",
  "clip",
  "video_upscale",
  "subtitle_removal",
  "subtitle_export",
  "upload",
]);

interface LibraryRow {
  id: string;
  kind: string;
  mediaType: string;
  status: string;
  label: string | null;
  model: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  credits: unknown;
  source: string;
  createdAt: Date;
  assetId: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  mimeType: string | null;
  folderId: string | null;
}

/** The Library row for an uploaded asset, as GET /api/library returns it. */
export function uploadAssetToLibraryItem(asset: {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  type: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: Date;
  folderId: string | null;
}) {
  return {
    id: asset.id,
    kind: "upload",
    mediaType: asset.type.toLowerCase(),
    status: "COMPLETED",
    label: asset.name,
    model: null,
    url: asset.url,
    thumbnailUrl: null,
    credits: 0,
    source: "web",
    createdAt: asset.createdAt,
    assetId: asset.id,
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
    mimeType: asset.mimeType,
    folderId: asset.folderId,
  };
}

async function resolveUserId(clerkId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  return user?.id ?? null;
}

const FOLDER_NAME_MAX = 60;
const MAX_FOLDERS = 200;
const MAX_MOVE = 500;

function cleanFolderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > FOLDER_NAME_MAX) return null;
  return name;
}

/** A folder owned by this user, or null. */
export async function findUserFolder(userId: string, folderId: unknown) {
  if (typeof folderId !== "string" || !folderId || folderId.length > 64) {
    return null;
  }
  return prisma.assetFolder.findFirst({
    where: { id: folderId, userId },
    select: { id: true, name: true, createdAt: true },
  });
}

async function nameTaken(userId: string, name: string, exceptId?: string) {
  const existing = await prisma.assetFolder.findFirst({
    where: {
      userId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

export class LibraryController {
  /**
   * GET /api/library
   *   ?mediaType=video|image|audio  &kind=<kind>[,<kind>]  &source=web|api
   *   &status=completed|all  &folderId=<id>|none  &page  &limit
   */
  list = async (req: Request, res: Response) => {
    try {
      const userId = await resolveUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const page = toPositiveInt(req.query.page, 1, 10_000);
      const limit = toPositiveInt(req.query.limit, 24, 100);

      const params: unknown[] = [userId];
      const filters: string[] = [];

      const mediaType = String(req.query.mediaType ?? "");
      if (MEDIA_TYPES.has(mediaType)) {
        params.push(mediaType);
        filters.push(`"mediaType" = $${params.length}`);
      }

      const kinds = String(req.query.kind ?? "")
        .split(",")
        .filter((k) => KINDS.has(k));
      if (kinds.length) {
        params.push(kinds);
        filters.push(`kind = ANY($${params.length}::text[])`);
      }

      const source = String(req.query.source ?? "");
      if (source === "web" || source === "api") {
        params.push(source);
        filters.push(`source = $${params.length}`);
      }

      const folderId = String(req.query.folderId ?? "");
      if (folderId === "none") {
        filters.push(`"folderId" IS NULL`);
      } else if (folderId && folderId.length <= 64) {
        params.push(folderId);
        filters.push(`"folderId" = $${params.length}`);
      }

      if (req.query.status !== "all") {
        filters.push(`status = 'COMPLETED' AND url IS NOT NULL`);
      }

      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      params.push(limit, (page - 1) * limit);
      const limitIndex = params.length - 1;
      const offsetIndex = params.length;

      const [rows, totals] = await Promise.all([
        prisma.$queryRawUnsafe<LibraryRow[]>(
          `WITH library AS (${LIBRARY_SELECT})
           SELECT * FROM library ${where}
           ORDER BY "createdAt" DESC
           LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
          ...params,
        ),
        prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `WITH library AS (${LIBRARY_SELECT})
           SELECT COUNT(*)::bigint AS count FROM library ${where}`,
          ...params.slice(0, -2),
        ),
      ]);

      const total = num(totals[0]?.count);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return res.json({
        success: true,
        data: {
          items: rows.map((row) => ({
            ...row,
            status: row.status === "SUCCEEDED" ? "COMPLETED" : row.status,
            credits: num(row.credits),
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error("Library query error:", error.code, error.message);
      } else {
        console.error("Library query error:", error);
      }
      return res
        .status(500)
        .json({ success: false, error: "Failed to load your library" });
    }
  };

  /**
   * GET /api/library/folders
   * → { folders: [{ id, name, createdAt, count }] }, sorted by name.
   */
  listFolders = async (req: Request, res: Response) => {
    try {
      const userId = await resolveUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const folders = await prisma.assetFolder.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { assets: true } },
        },
      });

      return res.json({
        success: true,
        data: {
          folders: folders.map((f) => ({
            id: f.id,
            name: f.name,
            createdAt: f.createdAt,
            count: f._count.assets,
          })),
        },
      });
    } catch (error) {
      console.error("List folders error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load your folders" });
    }
  };

  /** POST /api/library/folders { name } → the new folder. */
  createFolder = async (req: Request, res: Response) => {
    try {
      const userId = await resolveUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const name = cleanFolderName(req.body?.name);
      if (!name) {
        return res.status(400).json({
          success: false,
          error: `Folder names need 1 to ${FOLDER_NAME_MAX} characters.`,
        });
      }

      const count = await prisma.assetFolder.count({ where: { userId } });
      if (count >= MAX_FOLDERS) {
        return res.status(400).json({
          success: false,
          error: `You can have up to ${MAX_FOLDERS} folders.`,
        });
      }
      if (await nameTaken(userId, name)) {
        return res.status(409).json({
          success: false,
          error: "A folder with that name already exists.",
        });
      }

      const folder = await prisma.assetFolder.create({
        data: { userId, name },
        select: { id: true, name: true, createdAt: true },
      });

      return res.status(201).json({
        success: true,
        data: { ...folder, count: 0 },
      });
    } catch (error) {
      console.error("Create folder error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to create the folder" });
    }
  };

  /** PATCH /api/library/folders/:id { name } → the renamed folder. */
  updateFolder = async (req: Request, res: Response) => {
    try {
      const userId = await resolveUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const folder = await findUserFolder(userId, req.params.id);
      if (!folder) {
        return res
          .status(404)
          .json({ success: false, error: "Folder not found" });
      }

      const name = cleanFolderName(req.body?.name);
      if (!name) {
        return res.status(400).json({
          success: false,
          error: `Folder names need 1 to ${FOLDER_NAME_MAX} characters.`,
        });
      }
      if (await nameTaken(userId, name, folder.id)) {
        return res.status(409).json({
          success: false,
          error: "A folder with that name already exists.",
        });
      }

      const updated = await prisma.assetFolder.update({
        where: { id: folder.id },
        data: { name },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { assets: true } },
        },
      });

      return res.json({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          createdAt: updated.createdAt,
          count: updated._count.assets,
        },
      });
    } catch (error) {
      console.error("Update folder error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to rename the folder" });
    }
  };

  /**
   * DELETE /api/library/folders/:id
   * Deletes the folder only. Its files become unfiled (FK is SET NULL).
   */
  deleteFolder = async (req: Request, res: Response) => {
    try {
      const userId = await resolveUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const folder = await findUserFolder(userId, req.params.id);
      if (!folder) {
        return res
          .status(404)
          .json({ success: false, error: "Folder not found" });
      }

      await prisma.assetFolder.delete({ where: { id: folder.id } });
      return res.json({ success: true, message: "Folder deleted" });
    } catch (error) {
      console.error("Delete folder error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to delete the folder" });
    }
  };

  /**
   * POST /api/library/move { assetIds: string[], folderId: string | null }
   * Moves assets (uploads, or a generation's output asset via its `assetId`)
   * into a folder, or out of every folder with `folderId: null`.
   * → { moved }. Ids that aren't the caller's are ignored.
   */
  move = async (req: Request, res: Response) => {
    try {
      const userId = await resolveUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const { assetIds, folderId } = (req.body ?? {}) as {
        assetIds?: unknown;
        folderId?: unknown;
      };

      if (
        !Array.isArray(assetIds) ||
        assetIds.length === 0 ||
        assetIds.length > MAX_MOVE ||
        !assetIds.every((id) => typeof id === "string" && id.length <= 64)
      ) {
        return res.status(400).json({
          success: false,
          error: `assetIds must be a list of 1 to ${MAX_MOVE} ids.`,
        });
      }

      let targetId: string | null = null;
      if (folderId !== null && folderId !== undefined) {
        const folder = await findUserFolder(userId, folderId);
        if (!folder) {
          return res
            .status(404)
            .json({ success: false, error: "Folder not found" });
        }
        targetId = folder.id;
      }

      const result = await prisma.asset.updateMany({
        where: { userId, id: { in: [...new Set(assetIds as string[])] } },
        data: { folderId: targetId },
      });

      return res.json({ success: true, data: { moved: result.count } });
    } catch (error) {
      console.error("Move assets error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to move the files" });
    }
  };
}
