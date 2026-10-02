import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/db";
import {
  getSupabasePublicUrl,
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
} from "../lib/supabase-storage";
import { parseSkillMd, slugify } from "../lib/skill-source";

/**
 * Public, unauthenticated skill catalog consumed by the landing site
 * (tryunsora.com/skills). Only PUBLISHED skills are exposed.
 */

const PUBLIC_SELECT = {
  slug: true,
  name: true,
  tagline: true,
  description: true,
  sourceType: true,
  githubUrl: true,
  skillMdPath: true,
  installCommand: true,
  highlights: true,
  steps: true,
  examples: true,
  requirements: true,
  ctaHeadline: true,
  ctaBody: true,
  updatedAt: true,
  media: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      type: true,
      url: true,
      label: true,
      aspect: true,
    },
  },
};

type PublicSkill = { skillMdPath: string | null } & Record<string, unknown>;

/** Resolve the stored SKILL.md path to a downloadable public URL. */
function withDownloadUrl<T extends PublicSkill>(skill: T) {
  const { skillMdPath, ...rest } = skill;
  return {
    ...rest,
    downloadUrl: skillMdPath ? getSupabasePublicUrl(skillMdPath) : null,
  };
}

const uploadStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

const uploadStrArray = (v: unknown): string[] | undefined =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : undefined;

const uploadSteps = (v: unknown) =>
  Array.isArray(v)
    ? v
        .filter((s) => s && typeof s === "object")
        .map((s: Record<string, unknown>) => ({
          num: uploadStr(s.num) ?? "",
          title: uploadStr(s.title) ?? "",
          body: uploadStr(s.body) ?? "",
        }))
    : undefined;

const MEDIA_TYPES = new Set(["IMAGE", "VIDEO"]);
const MEDIA_ASPECTS = new Set(["9/16", "1/1", "16/9"]);

/** Validate an incoming addMedia array into SkillMedia create rows. */
const uploadMedia = (v: unknown) =>
  Array.isArray(v)
    ? v
        .filter((m) => m && typeof m === "object")
        .map((m: Record<string, unknown>) => {
          const aspect = uploadStr(m.aspect);
          return {
            url: uploadStr(m.url) ?? "",
            type: (uploadStr(m.type)?.toUpperCase() ?? "") as "IMAGE" | "VIDEO",
            label: uploadStr(m.label) ?? "",
            aspect: aspect && MEDIA_ASPECTS.has(aspect) ? aspect : "9/16",
          };
        })
        .filter((m) => m.url && MEDIA_TYPES.has(m.type))
    : undefined;

const ADMIN_SKILL_INCLUDE = {
  media: { orderBy: { sortOrder: "asc" as const } },
};

/** Admin lookup — id or slug, any status. */
const findSkillByIdOrSlug = (idOrSlug: string) =>
  prisma.skill.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });

export class SkillsController {
  /**
   * POST /api/v1/skills/upload — admin only (requireApiAdmin in the route).
   *
   * Used by the MCP `upload-skill` tool: takes the raw SKILL.md content plus
   * the full landing page content (tagline, highlights, steps, examples,
   * requirements, CTA copy, install command), stores SKILL.md in the public
   * bucket, and creates the skill (DRAFT by default). The landing catalog
   * doesn't rely on ordering, so no sortOrder is accepted here.
   */
  async upload(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const skillMd = typeof body.skillMd === "string" ? body.skillMd : "";
      if (!skillMd.trim()) {
        return res
          .status(400)
          .json({ success: false, error: "skillMd content is required" });
      }

      const meta = parseSkillMd(skillMd);
      const name = uploadStr(body.name) ?? meta.name;
      if (!name) {
        return res.status(400).json({
          success: false,
          error:
            "name is required (pass it or set it in the SKILL.md frontmatter)",
        });
      }

      let slug = slugify(uploadStr(body.slug) ?? name);
      if (!slug) {
        return res
          .status(400)
          .json({ success: false, error: "slug could not be derived" });
      }
      const existing = await prisma.skill.findUnique({ where: { slug } });
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;

      let skillMdPath: string | null = null;
      if (isSupabaseStorageConfigured()) {
        skillMdPath = `skills/${slug}/SKILL.md`;
        await uploadBufferToSupabase(
          Buffer.from(skillMd, "utf8"),
          skillMdPath,
          "text/markdown",
        );
      }

      const status = uploadStr(body.status)?.toUpperCase();
      const skill = await prisma.skill.create({
        data: {
          slug,
          name,
          tagline: uploadStr(body.tagline) ?? "",
          description: uploadStr(body.description) ?? meta.description ?? "",
          sourceType: "UPLOAD",
          skillMdPath,
          // Register the stored SKILL.md in `files` so the admin dashboard
          // lists it (and can delete it) like any other uploaded file.
          files: skillMdPath
            ? [
                {
                  path: skillMdPath,
                  url: getSupabasePublicUrl(skillMdPath),
                  relativePath: "SKILL.md",
                },
              ]
            : [],
          installCommand: uploadStr(body.installCommand),
          highlights: uploadStrArray(body.highlights) ?? [],
          steps: uploadSteps(body.steps) ?? [],
          examples: uploadStrArray(body.examples) ?? [],
          requirements: uploadStrArray(body.requirements) ?? [],
          ctaHeadline: uploadStr(body.ctaHeadline) ?? "",
          ctaBody: uploadStr(body.ctaBody) ?? "",
          status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          skill: {
            ...skill,
            downloadUrl: skillMdPath ? getSupabasePublicUrl(skillMdPath) : null,
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res
          .status(409)
          .json({ success: false, error: "A skill with this slug already exists" });
      }
      console.error("skill upload failed:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to upload skill" });
    }
  }

  /**
   * GET /api/v1/skills/:idOrSlug — admin only (requireApiAdmin in the route).
   * Full record (any status), including files and media — the MCP `get-skill`
   * tool uses it to inspect a skill before updating.
   */
  async adminGet(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findFirst({
        where: {
          OR: [{ id: req.params.idOrSlug }, { slug: req.params.idOrSlug }],
        },
        include: ADMIN_SKILL_INCLUDE,
      });
      if (!skill) {
        return res
          .status(404)
          .json({ success: false, error: "Skill not found" });
      }
      return res.json({ success: true, data: { skill } });
    } catch (error) {
      console.error("admin skill get failed:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load skill" });
    }
  }

  /**
   * PATCH /api/v1/skills/:idOrSlug — admin only (requireApiAdmin in the
   * route). Partial update from the MCP `update-skill` tool: any page content
   * field, a replacement SKILL.md (stored as a new versioned object — the
   * bucket forbids overwrite), and `addMedia` rows to attach showcase
   * images/videos by URL.
   */
  async adminUpdate(req: Request, res: Response) {
    try {
      const skill = await findSkillByIdOrSlug(req.params.idOrSlug);
      if (!skill) {
        return res
          .status(404)
          .json({ success: false, error: "Skill not found" });
      }

      const body = req.body as Record<string, unknown>;
      const data: Prisma.SkillUpdateInput = {};

      for (const key of [
        "name",
        "tagline",
        "description",
        "installCommand",
        "ctaHeadline",
        "ctaBody",
      ] as const) {
        const value = uploadStr(body[key]);
        if (value !== undefined) data[key] = value;
      }

      const slug = uploadStr(body.slug);
      if (slug !== undefined) data.slug = slugify(slug);

      const status = uploadStr(body.status)?.toUpperCase();
      if (status === "DRAFT" || status === "PUBLISHED") data.status = status;

      const highlights = uploadStrArray(body.highlights);
      if (highlights) data.highlights = highlights;
      const examples = uploadStrArray(body.examples);
      if (examples) data.examples = examples;
      const requirements = uploadStrArray(body.requirements);
      if (requirements) data.requirements = requirements;
      const steps = uploadSteps(body.steps);
      if (steps) data.steps = steps;

      const skillMd = typeof body.skillMd === "string" ? body.skillMd : "";
      if (skillMd.trim() && isSupabaseStorageConfigured()) {
        const path = `skills/${skill.slug}/SKILL-${Date.now()}.md`;
        await uploadBufferToSupabase(
          Buffer.from(skillMd, "utf8"),
          path,
          "text/markdown",
        );
        data.skillMdPath = path;
        data.files = [
          ...((skill.files as Prisma.JsonArray) ?? []),
          { path, url: getSupabasePublicUrl(path), relativePath: "SKILL.md" },
        ] as Prisma.InputJsonValue;
      }

      const media = uploadMedia(body.addMedia);
      if (media?.length) {
        data.media = { create: media };
      }

      const updated = await prisma.skill.update({
        where: { id: skill.id },
        data,
        include: ADMIN_SKILL_INCLUDE,
      });
      return res.json({ success: true, data: { skill: updated } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res.status(409).json({
          success: false,
          error: "A skill with this slug already exists",
        });
      }
      console.error("admin skill update failed:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update skill" });
    }
  }

  /** GET /api/skills */
  async list(_req: Request, res: Response) {
    try {
      const skills = await prisma.skill.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: PUBLIC_SELECT,
      });
      return res.json({
        success: true,
        data: { skills: skills.map(withDownloadUrl) },
      });
    } catch (error) {
      console.error("public skills list failed:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load skills" });
    }
  }

  /** GET /api/skills/:slug */
  async get(req: Request, res: Response) {
    try {
      const skill = await prisma.skill.findFirst({
        where: { slug: req.params.slug, status: "PUBLISHED" },
        select: PUBLIC_SELECT,
      });
      if (!skill) {
        return res
          .status(404)
          .json({ success: false, error: "Skill not found" });
      }
      return res.json({
        success: true,
        data: { skill: withDownloadUrl(skill) },
      });
    } catch (error) {
      console.error("public skills get failed:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load skill" });
    }
  }
}

export const skillsController = new SkillsController();
