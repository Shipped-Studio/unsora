"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFileToStorage } from "@/lib/storage-client";
import { getCdnUrl } from "@/lib/video-utils";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { assetQueryKeys, type UnifiedAsset } from "@/hooks/use-all-assets";
import {
  kindFromAccept,
  validateFile,
  type Attachment,
  type UploadField,
} from "./attachments";

function assetTypeFromMime(mime: string): "IMAGE" | "VIDEO" | "AUDIO" {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "IMAGE";
}

/**
 * Attachment state for a generator form: eager storage uploads with progress,
 * asset-library selections, drag/drop routing, and library registration so
 * every upload is reusable from anywhere.
 */
export function useMediaAttachments(fields: UploadField[]) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [libraryField, setLibraryField] = useState<UploadField | null>(null);

  // Cleanup object URLs on unmount
  const attachmentsRef = useRef<Attachment[]>([]);
  attachmentsRef.current = attachments;
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

  /** Save an upload into the asset library so it's reusable everywhere. */
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
          // Library registration is best-effort; the generation itself
          // only needs the blob URL.
        });
    },
    [authFetch, queryClient],
  );

  const addFiles = useCallback(
    (field: UploadField, incoming: File[]) => {
      const existing = attachments.filter(
        (a) => a.fieldKey === field.key,
      ).length;
      const available = field.max - existing;
      if (available <= 0) {
        toast.error(
          `${field.label}: you can attach up to ${field.max} file${field.max === 1 ? "" : "s"}.`,
        );
        return;
      }
      if (incoming.length > available) {
        toast.error(
          `${field.label}: only ${available} more file${available === 1 ? "" : "s"} can be added (max ${field.max}).`,
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
              patchAttachment(entry.id, { status: "error" });
              toast.error(`Failed to upload "${file.name}".`);
            }
          })
          .catch(() => {
            patchAttachment(entry.id, { status: "error" });
            toast.error(`Failed to upload "${file.name}".`);
          });
      });
    },
    [attachments, patchAttachment, registerAsset],
  );

  /** Attach already-uploaded assets picked from the media library. */
  const addAssets = useCallback(
    (field: UploadField, assets: UnifiedAsset[]) => {
      const existing = attachments.filter(
        (a) => a.fieldKey === field.key,
      ).length;
      const available = field.max - existing;
      const kind = kindFromAccept(field.accept);

      const usable = assets.filter((a) => a.outputUrl && a.mediaType === kind);
      if (usable.length < assets.length) {
        toast.error(`${field.label}: some selected items aren't ${kind}s.`);
      }
      if (usable.length > available) {
        toast.error(
          `${field.label}: only ${available} more file${available === 1 ? "" : "s"} can be added (max ${field.max}).`,
        );
      }

      const selected = usable.slice(0, Math.max(0, available));
      if (selected.length === 0) return;

      const newAtts: Attachment[] = selected.map((a) => ({
        id: crypto.randomUUID(),
        fieldKey: field.key,
        fileName: a.name || a.prompt || "Library asset",
        kind,
        objectUrl: getCdnUrl(a.outputUrl!),
        url: a.outputUrl!,
        status: "ready" as const,
        progress: 100,
      }));

      setAttachments((prev) => [...prev, ...newAtts]);
    },
    [attachments],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att) URL.revokeObjectURL(att.objectUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.objectUrl));
      return [];
    });
  }, []);

  /** Route loose files (drop/paste) to the first field that accepts them. */
  const routeFiles = useCallback(
    (files: File[]) => {
      const counts: Record<string, number> = {};
      for (const f of fields) {
        counts[f.key] = attachments.filter(
          (a) => a.fieldKey === f.key,
        ).length;
      }

      const byField = new Map<UploadField, File[]>();
      for (const file of files) {
        const field = fields.find(
          (f) =>
            file.type.startsWith(`${kindFromAccept(f.accept)}/`) &&
            (counts[f.key] ?? 0) < f.max,
        );
        if (!field) {
          toast.error(`No available slot for "${file.name}".`);
          continue;
        }
        counts[field.key] += 1;
        byField.set(field, [...(byField.get(field) ?? []), file]);
      }

      for (const [field, fieldFiles] of byField) {
        addFiles(field, fieldFiles);
      }
    },
    [fields, attachments, addFiles],
  );

  const uploadingCount = useMemo(
    () => attachments.filter((a) => a.status === "uploading").length,
    [attachments],
  );

  const fileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of attachments) {
      if (a.status === "error") continue;
      counts[a.fieldKey] = (counts[a.fieldKey] ?? 0) + 1;
    }
    return counts;
  }, [attachments]);

  /** Upload field key → ready blob URLs, for building the submit payload. */
  const readyUrls = useCallback(() => {
    const urls: Record<string, string[]> = {};
    for (const a of attachments) {
      if (a.status === "ready" && a.url) {
        (urls[a.fieldKey] ??= []).push(a.url);
      }
    }
    return urls;
  }, [attachments]);

  return {
    attachments,
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
