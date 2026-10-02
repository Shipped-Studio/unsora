"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthFetch } from "../use-auth-fetch";
import { useIsAdmin } from "./use-admin-data";
import { uploadToSignedUrl } from "@/lib/storage-client";

/** Mirrors the server Skill model (admin view, all statuses). */
export interface AdminSkillStep {
  num: string;
  title: string;
  body: string;
}

export interface AdminSkillFile {
  path: string;
  url: string;
  relativePath: string;
}

export interface AdminSkillMedia {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  label: string;
  aspect: string;
  sortOrder: number;
}

export interface AdminSkill {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  sourceType: "GITHUB" | "UPLOAD";
  githubUrl: string | null;
  skillMdPath: string | null;
  files: AdminSkillFile[];
  installCommand: string | null;
  highlights: string[];
  steps: AdminSkillStep[];
  examples: string[];
  requirements: string[];
  ctaHeadline: string;
  ctaBody: string;
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
  media: AdminSkillMedia[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminSkillListItem extends AdminSkill {
  _count: { media: number };
}

const qk = {
  list: ["admin", "skills"] as const,
  one: (id: string) => ["admin", "skill", id] as const,
};

function useAdminApi() {
  const { authFetch } = useAuthFetch();
  return useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const res = await authFetch(path, options);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      return json.data as T;
    },
    [authFetch],
  );
}

export function useAdminSkills() {
  const api = useAdminApi();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: qk.list,
    queryFn: () =>
      api<{ skills: AdminSkillListItem[] }>("/api/admin/skills").then(
        (d) => d.skills,
      ),
    enabled: isAdmin,
  });
}

export function useAdminSkill(id: string) {
  const api = useAdminApi();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: qk.one(id),
    queryFn: () =>
      api<{ skill: AdminSkill }>(`/api/admin/skills/${id}`).then(
        (d) => d.skill,
      ),
    enabled: isAdmin && Boolean(id),
  });
}

export function useAdminSkillMutations(id?: string) {
  const api = useAdminApi();
  const qc = useQueryClient();

  const invalidate = (skillId?: string) => {
    qc.invalidateQueries({ queryKey: qk.list });
    if (skillId) qc.invalidateQueries({ queryKey: qk.one(skillId) });
  };

  const create = useMutation({
    mutationFn: (body: Partial<AdminSkill>) =>
      api<{ skill: AdminSkill }>("/api/admin/skills", {
        method: "POST",
        body: JSON.stringify(body),
      }).then((d) => d.skill),
    onSuccess: () => invalidate(),
  });

  const importGithub = useMutation({
    mutationFn: (githubUrl: string) =>
      api<{ skill: AdminSkill }>("/api/admin/skills/import-github", {
        method: "POST",
        body: JSON.stringify({ githubUrl }),
      }).then((d) => d.skill),
    onSuccess: () => invalidate(),
  });

  const update = useMutation({
    mutationFn: (body: Partial<AdminSkill>) =>
      api<{ skill: AdminSkill }>(`/api/admin/skills/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }).then((d) => d.skill),
    onSuccess: (skill) => invalidate(skill.id),
  });

  const remove = useMutation({
    mutationFn: (skillId: string) =>
      api(`/api/admin/skills/${skillId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });

  const resync = useMutation({
    mutationFn: () =>
      api<{ skill: AdminSkill }>(`/api/admin/skills/${id}/resync`, {
        method: "POST",
      }).then((d) => d.skill),
    onSuccess: (skill) => invalidate(skill.id),
  });

  const addMedia = useMutation({
    mutationFn: (body: {
      url: string;
      type: "IMAGE" | "VIDEO";
      label?: string;
      aspect?: string;
      sortOrder?: number;
    }) =>
      api(`/api/admin/skills/${id}/media`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(id),
  });

  const updateMedia = useMutation({
    mutationFn: ({
      mediaId,
      ...body
    }: {
      mediaId: string;
      label?: string;
      aspect?: string;
      sortOrder?: number;
    }) =>
      api(`/api/admin/skills/${id}/media/${mediaId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(id),
  });

  const removeMedia = useMutation({
    mutationFn: (mediaId: string) =>
      api(`/api/admin/skills/${id}/media/${mediaId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(id),
  });

  const removeFile = useMutation({
    mutationFn: (path: string) =>
      api<{ skill: AdminSkill }>(`/api/admin/skills/${id}/files/remove`, {
        method: "POST",
        body: JSON.stringify({ path }),
      }).then((d) => d.skill),
    onSuccess: () => invalidate(id),
  });

  return {
    create,
    importGithub,
    update,
    remove,
    resync,
    addMedia,
    updateMedia,
    removeMedia,
    removeFile,
  };
}

/**
 * Upload files that belong to a skill (SKILL.md, references/…, media)
 * browser → Supabase, via skill-scoped signed URLs, then register them on
 * the skill record. `relativePath` preserves folder structure when the
 * admin drops a whole skill folder.
 */
export function useSkillFileUpload(id: string) {
  const api = useAdminApi();
  const qc = useQueryClient();

  const uploadOne = useCallback(
    async (file: File, relativePath: string) => {
      const signed = await api<{
        uploadUrl: string;
        token: string;
        publicUrl: string;
        path: string;
        relativePath: string;
      }>(`/api/admin/skills/${id}/upload-url`, {
        method: "POST",
        body: JSON.stringify({ relativePath }),
      });

      const result = await uploadToSignedUrl(file, {
        success: true,
        uploadUrl: signed.uploadUrl,
        token: signed.token,
        blobUrl: signed.publicUrl,
        blobName: signed.path,
        uploadMethod: "supabase",
      });
      if (!result.success) throw new Error(result.error || "Upload failed");

      return {
        path: signed.path,
        url: signed.publicUrl,
        relativePath: signed.relativePath,
      };
    },
    [api, id],
  );

  /** Upload skill source files and register them (updates SKILL.md pointer). */
  const uploadSkillFiles = useCallback(
    async (files: { file: File; relativePath: string }[]) => {
      const uploaded = [];
      for (const f of files) {
        uploaded.push(await uploadOne(f.file, f.relativePath));
      }
      await api(`/api/admin/skills/${id}/files`, {
        method: "POST",
        body: JSON.stringify({ files: uploaded }),
      });
      qc.invalidateQueries({ queryKey: qk.one(id) });
      qc.invalidateQueries({ queryKey: qk.list });
      return uploaded;
    },
    [api, id, qc, uploadOne],
  );

  /** Upload an image/video and attach it as showcase media. */
  const uploadMedia = useCallback(
    async (file: File, opts?: { label?: string; aspect?: string }) => {
      const uploaded = await uploadOne(file, `media/${file.name}`);
      await api(`/api/admin/skills/${id}/media`, {
        method: "POST",
        body: JSON.stringify({
          url: uploaded.url,
          type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
          label: opts?.label ?? "",
          aspect: opts?.aspect ?? "9/16",
        }),
      });
      qc.invalidateQueries({ queryKey: qk.one(id) });
      return uploaded;
    },
    [api, id, qc, uploadOne],
  );

  return { uploadSkillFiles, uploadMedia };
}
