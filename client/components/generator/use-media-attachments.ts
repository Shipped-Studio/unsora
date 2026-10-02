"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFileToStorage } from "@/lib/storage-client";
import { getCdnUrl } from "@/lib/video-utils";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { assetQueryKeys } from "@/hooks/use-all-assets";
import {
  kindFromAccept,
  validateFile,
  type Attachment,
  type UploadField,
} from "./attachments";

/**
 * A file picked from the library. Structural so it accepts both the legacy
 * asset shape (`outputUrl`) and library items (`url`).
 */
export interface PickedLibraryFile {
  mediaType: string;
  url?: string | null;
  outputUrl?: string | null;
  name?: string | null;
  label?: string | null;
  prompt?: string | null;
}

function assetTypeFromMime(mime: string): "IMAGE" | "VIDEO" | "AUDIO" {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "IMAGE";
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Attachment state for a generator form: eager storage uploads with progress,
 * library selections, drag/drop routing, and library registration so every
 * upload is reusable from anywhere.
 */
export function useMediaAttachments(fields: UploadField[]) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [libraryField, setLibraryField] = useState<UploadField | null>(null);

  // Revoke object URLs on unmount.
  const attachmentsRef = useRef<Attachment[]>([]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.objectUrl));
    };
  }, []);

  const patchAttachment = useCallback(
    (id: string, patch: Partial<Attachment>) => {
      setAttachments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
    },
    [],
  );

  /** Save an upload into the library so it's reusable everywhere. */
  const registerAsset = useCallback(
    (file: File, url: string) => {
      authFetch("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          url,
          mimeType: file.type,
          type: assetTypeFromMime(file.type),
          fileSize: file.size,
        }),
      })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: assetQueryKeys.all }),
        )
        .catch(() => {
          // Best effort: the generation only needs the blob URL, so a failed
          // library registration shouldn't interrupt the user.
        });
    },
    [authFetch, queryClient],
  );

  const countFor = useCallback(
    (fieldKey: string) =>
      attachments.filter((a) => a.fieldKey === fieldKey && a.status !== "error")
        .length,
    [attachments],
  );

  const addFiles = useCallback(
    (field: UploadField, incoming: File[]) => {
      const available = field.max - countFor(field.key);
      if (available <= 0) {
        toast.error(`${field.label} takes up to ${plural(field.max, "file")}.`);
        return;
      }
      if (incoming.length > available) {
        toast.error(
          `${field.label}: only ${plural(available, "more file")} fit. The rest weren't added.`,
        );
      }

      const valid: File[] = [];
      for (const file of incoming.slice(0, available)) {
        const err = validateFile(file, field);
        if (err) toast.error(err);
        else valid.push(file);
      }
      if (valid.length === 0) return;

      const pending: Attachment[] = valid.map((file) => ({
        id: crypto.randomUUID(),
        fieldKey: field.key,
        fileName: file.name,
        kind: kindFromAccept(field.accept),
        objectUrl: URL.createObjectURL(file),
        url: null,
        status: "uploading" as const,
        progress: 0,
      }));

      setAttachments((prev) => [...prev, ...pending]);

      pending.forEach((entry, idx) => {
        const file = valid[idx];
        const fail = (message?: string) => {
          patchAttachment(entry.id, { status: "error" });
          toast.error(
            message
              ? `Couldn't upload "${file.name}". ${message}`
              : `Couldn't upload "${file.name}". Try again.`,
          );
        };
        uploadFileToStorage(file, ({ percentage }) =>
          patchAttachment(entry.id, { progress: percentage }),
        )
          .then((result) => {
            if (result.success && result.blobUrl) {
              patchAttachment(entry.id, {
                url: result.blobUrl,
                status: "ready",
                progress: 100,
              });
              registerAsset(file, result.blobUrl);
            } else {
              fail(result.error);
            }
          })
          .catch(() => fail());
      });
    },
    [countFor, patchAttachment, registerAsset],
  );

  /** Attach files picked from the library (already uploaded). */
  const addAssets = useCallback(
    (field: UploadField, picked: PickedLibraryFile[]) => {
      const available = field.max - countFor(field.key);
      const kind = kindFromAccept(field.accept);

      const usable = picked.filter(
        (a) => (a.url || a.outputUrl) && a.mediaType === kind,
      );
      if (usable.length < picked.length) {
        toast.error(`${field.label} only takes ${kind} files.`);
      }
      if (usable.length > available) {
        toast.error(
          `${field.label}: only ${plural(Math.max(0, available), "more file")} fit. The rest weren't added.`,
        );
      }

      const selected = usable.slice(0, Math.max(0, available));
      if (selected.length === 0) return;

      const added: Attachment[] = selected.map((a) => {
        const url = (a.url || a.outputUrl) as string;
        return {
          id: crypto.randomUUID(),
          fieldKey: field.key,
          fileName: a.name || a.label || a.prompt || "Library file",
          kind,
          objectUrl: getCdnUrl(url),
          url,
          status: "ready" as const,
          progress: 100,
        };
      });

      setAttachments((prev) => [...prev, ...added]);
    },
    [countFor],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att) URL.revokeObjectURL(att.objectUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  /** Clear every attachment, or only those in the given fields. */
  const clearAttachments = useCallback((fieldKeys?: string[]) => {
    setAttachments((prev) => {
      const keys = fieldKeys ? new Set(fieldKeys) : null;
      const removed = keys ? prev.filter((a) => keys.has(a.fieldKey)) : prev;
      removed.forEach((a) => URL.revokeObjectURL(a.objectUrl));
      return keys ? prev.filter((a) => !keys.has(a.fieldKey)) : [];
    });
  }, []);

  /** Route loose files (drop, paste, file picker) to the first field with room. */
  const routeFiles = useCallback(
    (files: File[]) => {
      const counts: Record<string, number> = {};
      for (const f of fields) counts[f.key] = countFor(f.key);

      const byField = new Map<UploadField, File[]>();
      for (const file of files) {
        const field = fields.find(
          (f) =>
            file.type.startsWith(`${kindFromAccept(f.accept)}/`) &&
            (counts[f.key] ?? 0) < f.max,
        );
        if (!field) {
          toast.error(`"${file.name}" can't be attached here.`);
          continue;
        }
        counts[field.key] += 1;
        byField.set(field, [...(byField.get(field) ?? []), file]);
      }

      for (const [field, fieldFiles] of byField) {
        addFiles(field, fieldFiles);
      }
    },
    [fields, countFor, addFiles],
  );

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  /** Attachments that belong to the current fields. */
  const visibleAttachments = useMemo(
    () => attachments.filter((a) => fieldKeys.has(a.fieldKey)),
    [attachments, fieldKeys],
  );

  const uploadingCount = useMemo(
    () => visibleAttachments.filter((a) => a.status === "uploading").length,
    [visibleAttachments],
  );

  const fileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of attachments) {
      if (a.status === "error") continue;
      counts[a.fieldKey] = (counts[a.fieldKey] ?? 0) + 1;
    }
    return counts;
  }, [attachments]);

  /** Field key → ready blob URLs, for building the submit payload. */
  const readyUrls = useCallback(() => {
    const urls: Record<string, string[]> = {};
    for (const a of visibleAttachments) {
      if (a.status === "ready" && a.url) {
        (urls[a.fieldKey] ??= []).push(a.url);
      }
    }
    return urls;
  }, [visibleAttachments]);

  return {
    attachments,
    visibleAttachments,
    libraryField,
    setLibraryField,
    addFiles,
    addAssets,
    removeAttachment,
    clearAttachments,
    routeFiles,
    uploadingCount,
    fileCounts,
    readyUrls,
  };
}
