"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileToStorage } from "@/lib/storage-client";
import {
  emptyState,
  mediaKey,
  stateFromPost,
  toPayload,
  validate,
  type ComposerState,
  type CoverState,
  type MediaItem,
  type TikTokLimits,
} from "@/lib/scheduler/composer-state";
import type { PostFormat } from "@/lib/scheduler/formats";
import type { ConnectedAccount, Post } from "@/lib/scheduler/types";

/** Reads width, height and duration from a local or remote file. */
export function probeMedia(
  src: string,
  kind: "video" | "image",
): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    if (kind === "image") {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = src;
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    video.onerror = () => resolve({});
    video.src = src;
  });
}

interface UseComposerOptions {
  format: PostFormat;
  timezone: string;
  post?: Post | null;
  accounts: ConnectedAccount[];
}

export function useComposer({ format, timezone, post, accounts }: UseComposerOptions) {
  const [state, setState] = useState<ComposerState>(() =>
    post ? stateFromPost(post, format, timezone) : emptyState(format, timezone),
  );
  const [dirty, setDirty] = useState(false);
  const objectUrls = useRef<string[]>([]);

  // Revoke object URLs when the composer goes away.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const update = useCallback(
    (updater: (prev: ComposerState) => ComposerState, markDirty = true) => {
      setState(updater);
      if (markDirty) setDirty(true);
    },
    [],
  );

  const patchMedia = useCallback((key: string, patch: Partial<MediaItem>) => {
    setState((prev) => ({
      ...prev,
      media: prev.media.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    }));
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], kind: "video" | "image", options: { replace?: boolean } = {}) => {
      const items: { item: MediaItem; file: File }[] = files.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        objectUrls.current.push(previewUrl);
        return {
          file,
          item: {
            key: mediaKey(),
            kind,
            url: null,
            previewUrl,
            status: "uploading",
            progress: 0,
            size: file.size,
            mimeType: file.type,
            name: file.name,
          },
        };
      });

      update((prev) => ({
        ...prev,
        media: options.replace
          ? items.map((i) => i.item)
          : [...prev.media, ...items.map((i) => i.item)],
        cover: options.replace && kind === "video" ? null : prev.cover,
      }));

      await Promise.all(
        items.map(async ({ item, file }) => {
          const meta = await probeMedia(item.previewUrl, kind);
          patchMedia(item.key, meta);
          const result = await uploadFileToStorage(file, (progress) =>
            patchMedia(item.key, { progress: progress.percentage }),
          );
          if (result.success && result.blobUrl) {
            patchMedia(item.key, { url: result.blobUrl, status: "ready", progress: 100 });
          } else {
            patchMedia(item.key, {
              status: "error",
              error: result.error || "Upload failed",
            });
          }
        }),
      );
    },
    [patchMedia, update],
  );

  /** Adds already-hosted files (Library picks, `?media=` links). */
  const addRemote = useCallback(
    async (
      entries: {
        url: string;
        kind: "video" | "image";
        width?: number | null;
        height?: number | null;
        duration?: number | null;
        mimeType?: string | null;
        name?: string | null;
      }[],
      options: { replace?: boolean } = {},
    ) => {
      const items: MediaItem[] = entries.map((entry) => ({
        key: mediaKey(),
        kind: entry.kind,
        url: entry.url,
        previewUrl: entry.url,
        status: "ready",
        progress: 100,
        width: entry.width ?? undefined,
        height: entry.height ?? undefined,
        duration: entry.duration ?? undefined,
        mimeType: entry.mimeType ?? undefined,
        name: entry.name ?? undefined,
      }));
      update((prev) => ({
        ...prev,
        media: options.replace ? items : [...prev.media, ...items],
        cover: options.replace && items[0]?.kind === "video" ? null : prev.cover,
      }));
      // Fill in dimensions the Library didn't have.
      await Promise.all(
        items
          .filter((item) => !item.width || (item.kind === "video" && !item.duration))
          .map(async (item) => patchMedia(item.key, await probeMedia(item.url!, item.kind))),
      );
    },
    [patchMedia, update],
  );

  const removeMedia = useCallback(
    (key: string) =>
      update((prev) => {
        const media = prev.media.filter((m) => m.key !== key);
        return {
          ...prev,
          media,
          cover: media.some((m) => m.kind === "video") ? prev.cover : null,
          coverIndex: Math.min(prev.coverIndex, Math.max(media.length - 1, 0)),
        };
      }),
    [update],
  );

  const reorderMedia = useCallback(
    (from: number, to: number) =>
      update((prev) => {
        const media = [...prev.media];
        const [moved] = media.splice(from, 1);
        media.splice(to, 0, moved);
        return { ...prev, media };
      }),
    [update],
  );

  const setCover = useCallback(
    async (input: { file: File; timestampMs?: number } | null) => {
      if (!input) {
        update((prev) => ({ ...prev, cover: null }));
        return;
      }
      const previewUrl = URL.createObjectURL(input.file);
      objectUrls.current.push(previewUrl);
      const pending: CoverState = {
        url: null,
        previewUrl,
        status: "uploading",
        timestampMs: input.timestampMs,
      };
      update((prev) => ({ ...prev, cover: pending }));
      const result = await uploadFileToStorage(input.file);
      setState((prev) =>
        prev.cover?.previewUrl === previewUrl
          ? {
              ...prev,
              cover: {
                ...pending,
                url: result.success ? result.blobUrl ?? null : null,
                status: result.success ? "ready" : "error",
              },
            }
          : prev,
      );
    },
    [update],
  );

  const toggleAccount = useCallback(
    (accountId: string) =>
      update((prev) => ({
        ...prev,
        accountIds: prev.accountIds.includes(accountId)
          ? prev.accountIds.filter((id) => id !== accountId)
          : [...prev.accountIds, accountId],
      })),
    [update],
  );

  const setFormat = useCallback(
    (next: PostFormat) =>
      update((prev) => {
        const keepVideo = next === "video";
        const keepImages = next === "photos" || next === "slideshow";
        return {
          ...prev,
          format: next,
          media: prev.media.filter((m) =>
            m.kind === "video" ? keepVideo : keepImages,
          ),
          cover: keepVideo ? prev.cover : null,
        };
      }),
    [update],
  );

  const issuesFor = useCallback(
    (
      intent: "draft" | "publish",
      extra: { tiktokLimits?: Record<string, TikTokLimits>; lockedAccountIds?: string[] } = {},
    ) => validate(state, accounts, { intent, ...extra }),
    [accounts, state],
  );

  const payload = useMemo(() => toPayload(state, accounts), [accounts, state]);

  return {
    state,
    update,
    dirty,
    setDirty,
    uploadFiles,
    addRemote,
    removeMedia,
    reorderMedia,
    setCover,
    toggleAccount,
    setFormat,
    issuesFor,
    payload,
  };
}

export type Composer = ReturnType<typeof useComposer>;
