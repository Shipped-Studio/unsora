import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/db";
import {
  createSupabaseSignedUploadUrl,
  downloadFromStorageUrl,
  isSupabaseStorageConfigured,
  removeSupabaseObjects,
  removeSupabasePrefix,
  uploadBufferToSupabase,
} from "../../lib/supabase-storage";
import {
  fetchGithubSkillMd,
  parseGithubUrl,
  parseSkillMd,
  slugify,
} from "../../lib/skill-source";

const MEDIA_TYPES = new Set(["IMAGE", "VIDEO"]);
const ASPECTS = new Set(["9/16", "1/1", "16/9"]);
const STATUSES = new Set(["DRAFT", "PUBLISHED"]);

const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/** Keep only string entries of an incoming array field. */
const strArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;

const stepsArray = (v: unknown) =>
  Array.isArray(v)
    ? v
        .filter((s) => s && typeof s === "object")
        .map((s: Record<string, unknown>) => ({
          num: str(s.num) ?? "",
          title: str(s.title) ?? "",
          body: str(s.body) ?? "",
        }))
    : undefined;

/** Storage prefix all of a skill's files live under. */
const storagePrefix = (slug: string) => `skills/${slug}`;

const SKILL_INCLUDE = {
  media: { orderBy: { sortOrder: "asc" as const } },
};

function buildData(body: Record<string, unknown>): Prisma.SkillUpdateInput {
  const data: Prisma.SkillUpdateInput = {};

  for (const key of [
    "name",
    "tagline",
    "description",
    "githubUrl",
    "installCommand",
    "ctaHeadline",
    "ctaBody",
  ] as const) {
    const value = str(body[key]);
    if (value !== undefined) data[key] = value;
  }

  const slug = str(body.slug);
  if (slug !== undefined) data.slug = slugify(slug);

  const status = str(body.status)?.toUpperCase();
  if (status && STATUSES.has(status)) data.status = status as "DRAFT" | "PUBLISHED";

  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  const highlights = strArray(body.highlights);
  if (highlights) data.highlights = highlights;
  const examples = strArray(body.examples);
  if (examples) data.examples = examples;
  const requirements = strArray(body.requirements);
  if (requirements) data.requirements = requirements;
  const steps = stepsArray(body.steps);
  if (steps) data.steps = steps;

  return data;
}

const fail = (res: Response, status: number, error: string) =>
  res.status(status).json({ success: false, error });

export class AdminSkillsController {
  /** GET /api/admin/skills */
  async list(_req: Request, res: Response) {
    try {
      const skills = await prisma.skill.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: { media: { orderBy: { sortOrder: "asc" }, take: 1 }, _count: { select: { media: true } } },
      });
      return res.json({ success: true, data: { skills } });
    } catch (error) {
      console.error("admin skills list failed:", error);
      return fail(res, 500, "Failed to list skills");
    }
  }

  /** GET /api/admin/skills/:id */
  async get(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findUnique({
        where: { id: req.params.id },
        include: SKILL_INCLUDE,
      });
      if (!skill) return fail(res, 404, "Skill not found");
      return res.json({ success: true, data: { skill } });
    } catch (error) {
      console.error("admin skills get failed:", error);
      return fail(res, 500, "Failed to load skill");
    }
  }

  /** POST /api/admin/skills — manual create */
  async create(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const name = str(body.name)?.trim();
      if (!name) return fail(res, 400, "name is required");

      const slug = slugify(str(body.slug) || name);
      if (!slug) return fail(res, 400, "slug could not be derived");

      const data = buildData(body);
      const skill = await prisma.skill.create({
        data: {
          ...(data as Prisma.SkillCreateInput),
          name,
          slug,
          tagline: str(body.tagline) ?? "",
          description: str(body.description) ?? "",
          sourceType: body.sourceType === "GITHUB" ? "GITHUB" : "UPLOAD",
        },
        include: SKILL_INCLUDE,
      });
      return res.status(201).json({ success: true, data: { skill } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return fail(res, 409, "A skill with this slug already exists");
      }
      console.error("admin skills create failed:", error);
      return fail(res, 500, "Failed to create skill");
    }
  }

  /** POST /api/admin/skills/import-github — create a draft from a repo URL */
  async importGithub(req: Request, res: Response) {
    try {
      const githubUrl = str((req.body as Record<string, unknown>).githubUrl);
      if (!githubUrl) return fail(res, 400, "githubUrl is required");

      const source = parseGithubUrl(githubUrl);
      if (!source) return fail(res, 400, "Not a valid github.com repo URL");

      const fetched = await fetchGithubSkillMd(source);
      if (!fetched) {
        return fail(
          res,
          422,
          "Could not find a SKILL.md in that repo (checked HEAD, main and master)",
        );
      }

      const meta = parseSkillMd(fetched.content);
      const name = meta.name ?? source.repo;
      let slug = slugify(name) || slugify(source.repo);
      const existing = await prisma.skill.findUnique({ where: { slug } });
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;

      // Keep a copy of SKILL.md in our bucket so the landing download button
      // doesn't depend on GitHub availability or the repo staying public.
      let skillMdPath: string | null = null;
      if (isSupabaseStorageConfigured()) {
        skillMdPath = `${storagePrefix(slug)}/SKILL.md`;
        await uploadBufferToSupabase(
          Buffer.from(fetched.content, "utf8"),
          skillMdPath,
          "text/markdown",
        );
      }

      const dir = source.dir ? `${source.dir}/` : "";
      const skill = await prisma.skill.create({
        data: {
          slug,
          name,
          tagline: "",
          description: meta.description ?? "",
          sourceType: "GITHUB",
          githubUrl,
          skillMdPath,
          installCommand: `curl -O https://raw.githubusercontent.com/${source.owner}/${source.repo}/${fetched.ref}/${dir}SKILL.md`,
        },
        include: SKILL_INCLUDE,
      });
      return res.status(201).json({ success: true, data: { skill } });
    } catch (error) {
      console.error("admin skills github import failed:", error);
      return fail(res, 500, "Failed to import from GitHub");
    }
  }

  /** POST /api/admin/skills/:id/resync — refetch SKILL.md from GitHub */
  async resyncGithub(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findUnique({ where: { id: req.params.id } });
      if (!skill) return fail(res, 404, "Skill not found");
      if (!skill.githubUrl) return fail(res, 400, "Skill has no GitHub URL");

      const source = parseGithubUrl(skill.githubUrl);
      if (!source) return fail(res, 400, "Stored GitHub URL is not valid");

      const fetched = await fetchGithubSkillMd(source);
      if (!fetched) return fail(res, 422, "Could not fetch SKILL.md from the repo");

      const meta = parseSkillMd(fetched.content);
      let skillMdPath = skill.skillMdPath;
      if (isSupabaseStorageConfigured()) {
        // Re-upload under a versioned name: the bucket forbids overwrite.
        skillMdPath = `${storagePrefix(skill.slug)}/SKILL-${Date.now()}.md`;
        await uploadBufferToSupabase(
          Buffer.from(fetched.content, "utf8"),
          skillMdPath,
          "text/markdown",
        );
      }

      const updated = await prisma.skill.update({
        where: { id: skill.id },
        data: {
          description: meta.description ?? skill.description,
          skillMdPath,
        },
        include: SKILL_INCLUDE,
      });
      return res.json({ success: true, data: { skill: updated } });
    } catch (error) {
      console.error("admin skills resync failed:", error);
      return fail(res, 500, "Failed to re-sync from GitHub");
    }
  }

  /** PUT /api/admin/skills/:id */
  async update(req: Request, res: Response) {
    try {
      const data = buildData(req.body as Record<string, unknown>);
      const skill = await prisma.skill.update({
        where: { id: req.params.id },
        data,
        include: SKILL_INCLUDE,
      });
      return res.json({ success: true, data: { skill } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") return fail(res, 404, "Skill not found");
        if (error.code === "P2002")
          return fail(res, 409, "A skill with this slug already exists");
      }
      console.error("admin skills update failed:", error);
      return fail(res, 500, "Failed to update skill");
    }
  }

  /** DELETE /api/admin/skills/:id */
  async remove(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.delete({ where: { id: req.params.id } });
      if (isSupabaseStorageConfigured()) {
        // Best-effort cleanup; the DB row is already gone.
        removeSupabasePrefix(storagePrefix(skill.slug)).catch((e) =>
          console.error("skill storage cleanup failed:", e),
        );
      }
      return res.json({ success: true });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return fail(res, 404, "Skill not found");
      }
      console.error("admin skills delete failed:", error);
      return fail(res, 500, "Failed to delete skill");
    }
  }

  /**
   * POST /api/admin/skills/:id/upload-url — { relativePath }
   *
   * Mints a signed direct-upload URL under the skill's storage prefix so the
   * browser can upload skill files (SKILL.md, references/…) and media
   * without the bytes passing through this server. `relativePath` keeps the
   * folder structure of the uploaded skill.
   */
  async createUploadUrl(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findUnique({ where: { id: req.params.id } });
      if (!skill) return fail(res, 404, "Skill not found");
      if (!isSupabaseStorageConfigured())
        return fail(res, 500, "Storage is not configured");

      const relativePath = str((req.body as Record<string, unknown>).relativePath);
      if (!relativePath) return fail(res, 400, "relativePath is required");

      // Normalise and refuse anything that escapes the skill's folder.
      const clean = relativePath
        .split("/")
        .filter((part) => part && part !== "." && part !== "..")
        .join("/");
      if (!clean) return fail(res, 400, "relativePath is not valid");

      // The bucket forbids overwrite, so version the object name.
      const path = `${storagePrefix(skill.slug)}/${Date.now().toString(36)}/${clean}`;
      const { signedUrl, token, publicUrl } =
        await createSupabaseSignedUploadUrl(path);

      return res.json({
        success: true,
        data: { uploadUrl: signedUrl, token, publicUrl, path, relativePath: clean },
      });
    } catch (error) {
      console.error("admin skills upload-url failed:", error);
      return fail(res, 500, "Failed to create upload URL");
    }
  }

  /**
   * POST /api/admin/skills/:id/files — { files: [{ path, url, relativePath }] }
   *
   * Registers files the browser just uploaded. When a SKILL.md is among
   * them it becomes the skill's canonical SKILL.md and its frontmatter
   * refreshes name/description.
   */
  async registerFiles(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findUnique({ where: { id: req.params.id } });
      if (!skill) return fail(res, 404, "Skill not found");

      const incoming = (req.body as { files?: unknown }).files;
      if (!Array.isArray(incoming) || incoming.length === 0)
        return fail(res, 400, "files array is required");

      const files = incoming
        .filter((f) => f && typeof f === "object")
        .map((f: Record<string, unknown>) => ({
          path: str(f.path) ?? "",
          url: str(f.url) ?? "",
          relativePath: str(f.relativePath) ?? str(f.path) ?? "",
        }))
        .filter((f) => f.path && f.url);
      if (!files.length) return fail(res, 400, "files entries need path and url");

      const data: Prisma.SkillUpdateInput = {
        files: [
          ...((skill.files as Prisma.JsonArray) ?? []),
          ...files,
        ] as Prisma.InputJsonValue,
      };

      const skillMd = files.find((f) =>
        /(^|\/)SKILL\.md$/i.test(f.relativePath),
      );
      if (skillMd) {
        data.skillMdPath = skillMd.path;
        try {
          const meta = parseSkillMd(
            (await downloadFromStorageUrl(skillMd.url)).toString("utf8"),
          );
          if (meta.name) data.name = meta.name;
          if (meta.description && !skill.description)
            data.description = meta.description;
        } catch (e) {
          console.error("SKILL.md parse after upload failed:", e);
        }
      }

      const updated = await prisma.skill.update({
        where: { id: skill.id },
        data,
        include: SKILL_INCLUDE,
      });
      return res.json({ success: true, data: { skill: updated } });
    } catch (error) {
      console.error("admin skills register files failed:", error);
      return fail(res, 500, "Failed to register files");
    }
  }

  /**
   * POST /api/admin/skills/:id/files/remove — { path }
   *
   * Removes an uploaded file from the skill's `files` list and (best-effort)
   * from storage. When the removed file is the canonical SKILL.md, the
   * skillMdPath pointer is cleared too so the landing download button
   * disappears instead of pointing at a deleted object.
   */
  async removeFile(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findUnique({ where: { id: req.params.id } });
      if (!skill) return fail(res, 404, "Skill not found");

      const path = str((req.body as Record<string, unknown>).path);
      if (!path) return fail(res, 400, "path is required");

      const files = ((skill.files as Prisma.JsonArray) ?? []).filter(
        (f) => f && typeof f === "object",
      ) as { path?: string }[];
      const remaining = files.filter((f) => f.path !== path);
      const isSkillMd = skill.skillMdPath === path;
      if (remaining.length === files.length && !isSkillMd) {
        return fail(res, 404, "File not found on this skill");
      }

      const data: Prisma.SkillUpdateInput = {
        files: remaining as Prisma.InputJsonValue,
      };
      if (isSkillMd) data.skillMdPath = null;

      const updated = await prisma.skill.update({
        where: { id: skill.id },
        data,
        include: SKILL_INCLUDE,
      });

      if (isSupabaseStorageConfigured()) {
        // Best-effort cleanup; the DB no longer references the object.
        removeSupabaseObjects([path]).catch((e) =>
          console.error("skill file storage cleanup failed:", e),
        );
      }

      return res.json({ success: true, data: { skill: updated } });
    } catch (error) {
      console.error("admin skills remove file failed:", error);
      return fail(res, 500, "Failed to remove file");
    }
  }

  /** POST /api/admin/skills/:id/media — { url, type, label?, aspect?, sortOrder? } */
  async addMedia(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findUnique({ where: { id: req.params.id } });
      if (!skill) return fail(res, 404, "Skill not found");

      const body = req.body as Record<string, unknown>;
      const url = str(body.url);
      const type = str(body.type)?.toUpperCase();
      if (!url) return fail(res, 400, "url is required");
      if (!type || !MEDIA_TYPES.has(type))
        return fail(res, 400, "type must be IMAGE or VIDEO");

      const aspect = str(body.aspect);
      const media = await prisma.skillMedia.create({
        data: {
          skillId: skill.id,
          type: type as "IMAGE" | "VIDEO",
          url,
          label: str(body.label) ?? "",
          aspect: aspect && ASPECTS.has(aspect) ? aspect : "9/16",
          sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
        },
      });
      return res.status(201).json({ success: true, data: { media } });
    } catch (error) {
      console.error("admin skills add media failed:", error);
      return fail(res, 500, "Failed to add media");
    }
  }

  /** PATCH /api/admin/skills/:id/media/:mediaId */
  async updateMedia(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const data: Prisma.SkillMediaUpdateInput = {};
      const label = str(body.label);
      if (label !== undefined) data.label = label;
      const aspect = str(body.aspect);
      if (aspect && ASPECTS.has(aspect)) data.aspect = aspect;
      if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

      const media = await prisma.skillMedia.update({
        where: { id: req.params.mediaId, skillId: req.params.id },
        data,
      });
      return res.json({ success: true, data: { media } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return fail(res, 404, "Media not found");
      }
      console.error("admin skills update media failed:", error);
      return fail(res, 500, "Failed to update media");
    }
  }

  /** DELETE /api/admin/skills/:id/media/:mediaId */
  async removeMedia(req: Request, res: Response) {
    try {
      await prisma.skillMedia.delete({
        where: { id: req.params.mediaId, skillId: req.params.id },
      });
      return res.json({ success: true });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return fail(res, 404, "Media not found");
      }
      console.error("admin skills remove media failed:", error);
      return fail(res, 500, "Failed to remove media");
    }
  }
}

export const adminSkillsController = new AdminSkillsController();
