import type { ClipboardEvent, ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";

export type AttachmentKind = "image" | "video" | "audio";

/** A declarative upload slot shared by all generator forms. */
export interface UploadField {
  key: string;
  label: string;
  accept: "image/*" | "video/*" | "audio/*";
  max: number;
  icon: ComponentType<IconProps>;
}

export interface Attachment {
  id: string;
  fieldKey: string;
  fileName: string;
  kind: AttachmentKind;
  /** Preview source: an object URL for local files, a CDN URL for library files. */
  objectUrl: string;
  /** Set once storage returns the blob URL; library files have it immediately. */
  url: string | null;
  status: "uploading" | "ready" | "error";
  progress: number;
}

export const MAX_BYTES: Record<AttachmentKind, number> = {
  image: 20 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};

export function kindFromAccept(accept: UploadField["accept"]): AttachmentKind {
  return accept.split("/")[0] as AttachmentKind;
}

export function validateFile(file: File, field: UploadField): string | null {
  const kind = kindFromAccept(field.accept);
  if (!file.type.startsWith(`${kind}/`))
    return `"${file.name}" isn't ${kind === "image" ? "an" : "a"} ${kind}.`;
  if (file.size > MAX_BYTES[kind])
    return `"${file.name}" is over the ${MAX_BYTES[kind] / 1024 / 1024} MB limit for ${kind} files.`;
  return null;
}

/** Files from a paste event, or an empty list when only text was pasted. */
export function filesFromClipboard(event: ClipboardEvent): File[] {
  return Array.from(event.clipboardData.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}
