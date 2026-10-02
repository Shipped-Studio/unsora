"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";
import {
  importLibraryItems,
  libraryQueryKeys,
  mediaTypeOfFile,
  uploadLibraryFile,
  type ImportProvider,
  type ImportSourceItem,
  type LibraryItem,
} from "./use-library";

/**
 * Per-file state for uploads and imports into the Library, so a page or the
 * picker can show what's in flight and what failed.
 */

export type TransferSource = "upload" | ImportProvider;

export interface TransferEntry {
  id: string;
  name: string;
  source: TransferSource;
  status: "queued" | "working" | "done" | "error";
  /** 0 to 100 for uploads. Imports run server-side, so null. */
  progress: number | null;
  error?: string;
}

const CONCURRENCY = 3;
/** Finished entries disappear after this long. Failures stay until dismissed. */
const DONE_TTL_MS = 4000;

const SIZE_LIMITS = {
  video: 500 * 1024 * 1024,
  image: 50 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
} as const;

let nextId = 0;
const newId = () => `transfer-${Date.now()}-${nextId++}`;

async function runLimited<T>(tasks: (() => Promise<T>)[], limit: number) {
  const results: T[] = new Array(tasks.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (index < tasks.length) {
        const current = index++;
        results[current] = await tasks[current]();
      }
    }),
  );
  return results;
}

function importName(item: ImportSourceItem) {
  if (item.name) return item.name;
  if (item.url) {
    try {
      const last = new URL(item.url).pathname.split("/").filter(Boolean).pop();
      if (last) return decodeURIComponent(last);
    } catch {
      // fall through
    }
    return item.url;
  }
  return "File";
}

export function useLibraryTransfers(options: { folderId?: string | null } = {}) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<TransferEntry[]>([]);
  const timers = useRef(new Set<number>());
  const { folderId } = options;

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      pending.clear();
    };
  }, []);

  const patch = useCallback((id: string, update: Partial<TransferEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...update } : e)));
  }, []);

  const finish = useCallback(
    (id: string) => {
      patch(id, { status: "done", progress: 100 });
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }, DONE_TTL_MS);
      timers.current.add(timer);
    },
    [patch],
  );

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: libraryQueryKeys.all }),
    [queryClient],
  );

  /** Uploads files from the device. Resolves with the new Library items. */
  const upload = useCallback(
    async (input: FileList | File[]): Promise<LibraryItem[]> => {
      const files = Array.from(input);
      if (files.length === 0) return [];
      const batch = files.map((file) => ({
        file,
        entry: {
          id: newId(),
          name: file.name,
          source: "upload" as const,
          status: "queued" as const,
          progress: 0,
        } satisfies TransferEntry,
      }));
      setEntries((prev) => [...prev, ...batch.map((b) => b.entry)]);

      const results = await runLimited(
        batch.map(({ file, entry }) => async () => {
          const mediaType = mediaTypeOfFile(file);
          if (!mediaType) {
            patch(entry.id, {
              status: "error",
              error: "Only images, videos and audio files can be uploaded.",
            });
            return null;
          }
          if (file.size > SIZE_LIMITS[mediaType]) {
            patch(entry.id, {
              status: "error",
              error: `Files like this can be up to ${SIZE_LIMITS[mediaType] / 1024 / 1024} MB.`,
            });
            return null;
          }
          patch(entry.id, { status: "working" });
          try {
            const item = await uploadLibraryFile(authFetch, file, {
              folderId,
              onProgress: (progress) => patch(entry.id, { progress }),
            });
            finish(entry.id);
            return item;
          } catch (error) {
            patch(entry.id, {
              status: "error",
              error: error instanceof Error ? error.message : "Upload failed.",
            });
            return null;
          }
        }),
        CONCURRENCY,
      );

      const items = results.filter((i): i is LibraryItem => i !== null);
      if (items.length) await refresh();
      return items;
    },
    [authFetch, finish, folderId, patch, refresh],
  );

  /**
   * Imports files through the server, one request per file so each gets its
   * own status. Resolves with the new Library items.
   */
  const importItems = useCallback(
    async (sources: ImportSourceItem[]): Promise<LibraryItem[]> => {
      if (sources.length === 0) return [];
      const batch = sources.map((source) => ({
        source,
        entry: {
          id: newId(),
          name: importName(source),
          source: source.provider,
          status: "queued" as const,
          progress: null,
        } satisfies TransferEntry,
      }));
      setEntries((prev) => [...prev, ...batch.map((b) => b.entry)]);

      const results = await runLimited(
        batch.map(({ source, entry }) => async () => {
          patch(entry.id, { status: "working" });
          try {
            const result = await importLibraryItems(authFetch, [source], {
              folderId,
            });
            const item = result.items[0];
            if (!item) {
              patch(entry.id, {
                status: "error",
                error: result.errors[0]?.error ?? "The import failed.",
              });
              return null;
            }
            patch(entry.id, { name: item.label ?? entry.name });
            finish(entry.id);
            return item;
          } catch (error) {
            patch(entry.id, {
              status: "error",
              error: error instanceof Error ? error.message : "The import failed.",
            });
            return null;
          }
        }),
        CONCURRENCY,
      );

      const items = results.filter((i): i is LibraryItem => i !== null);
      if (items.length) await refresh();
      return items;
    },
    [authFetch, finish, folderId, patch, refresh],
  );

  const dismiss = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setEntries((prev) =>
      prev.filter((e) => e.status === "queued" || e.status === "working"),
    );
  }, []);

  const busy = entries.some((e) => e.status === "queued" || e.status === "working");

  return { entries, busy, upload, importItems, dismiss, clearFinished };
}
