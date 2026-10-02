"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useAuthFetch } from "./use-auth-fetch";
import { uploadFileToStorage } from "@/lib/storage-client";
import { getCdnUrl } from "@/lib/video-utils";

/**
 * The Library: every finished file a user has (generations of every kind plus
 * uploads), served by `GET /api/library` in one row shape. Used by the Files
 * page, the library picker in Create tools and the post composer, and the
 * agent activity list.
 */

export type LibraryMediaType = "video" | "image" | "audio" | "document";
/** Media types the Library can be filtered by. */
export type LibraryFilterMediaType = "video" | "image" | "audio";

export type LibraryKind =
  | "video"
  | "motion_control"
  | "image"
  | "thumbnail"
  | "influencer"
  | "movie_material"
  | "image_upscale"
  | "music"
  | "voiceover"
  | "voice_change"
  | "avatar"
  | "clip"
  | "video_upscale"
  | "subtitle_removal"
  | "subtitle_export"
  | "upload";

/** "api" when the job was paid for with an API key (REST, or MCP with a key). */
export type LibrarySource = "web" | "api";

export interface LibraryItem {
  /** Row id in the source table. For uploads this is the asset id. */
  id: string;
  kind: LibraryKind;
  mediaType: LibraryMediaType;
  /** Upper case: COMPLETED, FAILED, QUEUED, PROCESSING, ... */
  status: string;
  /** Prompt, script, title or file name, depending on the kind. */
  label: string | null;
  model: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  credits: number;
  source: LibrarySource;
  createdAt: string;
  assetId: string | null;
  width: number | null;
  height: number | null;
  /** Seconds. */
  duration: number | null;
  mimeType: string | null;
  /** Folder of the underlying asset. Null when unfiled. */
  folderId: string | null;
}

export interface LibraryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface LibraryPage {
  items: LibraryItem[];
  pagination: LibraryPagination;
}

export interface LibraryQuery {
  mediaType?: LibraryFilterMediaType;
  kind?: LibraryKind | LibraryKind[];
  source?: LibrarySource;
  /** Completed items only by default. `all` includes queued and failed jobs. */
  status?: "completed" | "all";
  /** A folder id, or "none" for unfiled items. */
  folderId?: string;
  /** Page size, 1 to 100. Defaults to 24. */
  limit?: number;
}

const DEFAULT_LIMIT = 24;

function normalizeQuery(query: LibraryQuery) {
  const kinds = query.kind
    ? (Array.isArray(query.kind) ? query.kind : [query.kind]).slice().sort()
    : [];
  return {
    mediaType: query.mediaType ?? null,
    kind: kinds.length ? kinds.join(",") : null,
    source: query.source ?? null,
    status: query.status ?? "completed",
    folderId: query.folderId ?? null,
    limit: query.limit ?? DEFAULT_LIMIT,
  };
}

export const libraryQueryKeys = {
  all: ["library"] as const,
  infinite: (query: LibraryQuery) =>
    [...libraryQueryKeys.all, "infinite", normalizeQuery(query)] as const,
  page: (query: LibraryQuery, page: number) =>
    [...libraryQueryKeys.all, "page", normalizeQuery(query), page] as const,
  folders: () => [...libraryQueryKeys.all, "folders"] as const,
};

export async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === "string" && body.error) || fallback;
}

export type AuthFetch = ReturnType<typeof useAuthFetch>["authFetch"];

export async function fetchLibraryPage(
  authFetch: AuthFetch,
  query: LibraryQuery,
  page: number,
): Promise<LibraryPage> {
  const q = normalizeQuery(query);
  const params = new URLSearchParams({
    page: String(page),
    limit: String(q.limit),
  });
  if (q.mediaType) params.set("mediaType", q.mediaType);
  if (q.kind) params.set("kind", q.kind);
  if (q.source) params.set("source", q.source);
  if (q.status === "all") params.set("status", "all");
  if (q.folderId) params.set("folderId", q.folderId);

  const res = await authFetch(`/api/library?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await readError(res, "Couldn't load your library."));
  }
  const json = await res.json();
  if (!json?.success) {
    throw new Error(json?.error || "Couldn't load your library.");
  }
  return json.data as LibraryPage;
}

/** Paginated Library list with "Load more". */
export function useLibrary(
  query: LibraryQuery = {},
  options: { enabled?: boolean } = {},
) {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  const result = useInfiniteQuery({
    queryKey: libraryQueryKeys.infinite(query),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchLibraryPage(authFetch, query, pageParam),
    getNextPageParam: (last) =>
      last.pagination.hasNextPage ? last.pagination.page + 1 : undefined,
    enabled: !!isSignedIn && (options.enabled ?? true),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const items = result.data?.pages.flatMap((p) => p.items) ?? [];
  const total = result.data?.pages[0]?.pagination.total ?? 0;

  return { ...result, items, total };
}

/** One page of the Library, e.g. the latest few items for a summary list. */
export function useLibraryPage(
  query: LibraryQuery & { page?: number } = {},
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();
  const { page = 1, ...rest } = query;

  return useQuery({
    queryKey: libraryQueryKeys.page(rest, page),
    queryFn: () => fetchLibraryPage(authFetch, rest, page),
    enabled: !!isSignedIn && (options.enabled ?? true),
    staleTime: 30 * 1000,
    refetchInterval: options.refetchInterval ?? false,
  });
}

// ---------------------------------------------------------------------------
// Labels and formatting

export const LIBRARY_KIND_LABELS: Record<LibraryKind, string> = {
  video: "Video",
  motion_control: "Motion control",
  avatar: "Talking avatar",
  clip: "Clip",
  video_upscale: "Upscaled video",
  subtitle_removal: "Subtitles removed",
  subtitle_export: "Captioned video",
  image: "Image",
  thumbnail: "Thumbnail",
  influencer: "AI influencer",
  movie_material: "Movie material",
  image_upscale: "Upscaled image",
  music: "Music",
  voiceover: "Voiceover",
  voice_change: "Voice change",
  upload: "Upload",
};

/** Which kinds can produce each media type, in display order. */
export const LIBRARY_KINDS_BY_MEDIA: Record<
  LibraryFilterMediaType,
  LibraryKind[]
> = {
  video: [
    "video",
    "motion_control",
    "avatar",
    "clip",
    "video_upscale",
    "subtitle_removal",
    "subtitle_export",
    "upload",
  ],
  image: [
    "image",
    "thumbnail",
    "influencer",
    "movie_material",
    "image_upscale",
    "upload",
  ],
  audio: ["music", "voiceover", "voice_change", "upload"],
};

export const LIBRARY_KINDS = Object.keys(LIBRARY_KIND_LABELS) as LibraryKind[];

export function isLibraryKind(value: unknown): value is LibraryKind {
  return typeof value === "string" && value in LIBRARY_KIND_LABELS;
}

export function libraryKindLabel(kind: string) {
  return isLibraryKind(kind) ? LIBRARY_KIND_LABELS[kind] : kind;
}

export const LIBRARY_SOURCE_LABELS: Record<LibrarySource, string> = {
  web: "Web app",
  api: "API and agents",
};

/** The label, or the kind when there's none. */
export function libraryItemTitle(item: LibraryItem) {
  return item.label?.trim() || libraryKindLabel(item.kind);
}

/** What the `label` field holds for this kind. */
export function libraryLabelName(kind: LibraryKind) {
  switch (kind) {
    case "upload":
      return "File name";
    case "voiceover":
    case "avatar":
      return "Script";
    case "clip":
      return "Title";
    case "video_upscale":
    case "subtitle_removal":
      return "Source file";
    default:
      return "Prompt";
  }
}

export function formatLibraryDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function libraryStatusLabel(status: string) {
  const s = status.toUpperCase();
  if (s === "COMPLETED" || s === "SUCCEEDED") return "Completed";
  if (s === "FAILED" || s === "ERROR") return "Failed";
  if (s === "QUEUED" || s === "PENDING") return "Queued";
  if (s === "PROCESSING" || s === "RUNNING" || s === "IN_PROGRESS")
    return "Processing";
  if (s === "CANCELLED" || s === "CANCELED") return "Cancelled";
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

export function isLibraryItemReady(item: LibraryItem) {
  const s = item.status.toUpperCase();
  return (s === "COMPLETED" || s === "SUCCEEDED") && !!item.url;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
};

/** File name for downloads: the upload's name, or kind plus a short id. */
export function libraryDownloadName(item: LibraryItem) {
  if (item.kind === "upload" && item.label) return item.label;
  const fromMime = item.mimeType
    ? MIME_EXTENSIONS[item.mimeType.split(";")[0].trim()]
    : undefined;
  const fromUrl = item.url?.split("?")[0].split("/").pop()?.split(".").pop();
  const ext =
    fromMime ?? (fromUrl && /^[a-z0-9]{2,4}$/i.test(fromUrl) ? fromUrl : "");
  const base = `unsora-${item.kind.replace(/_/g, "-")}-${item.id.slice(0, 8)}`;
  return ext ? `${base}.${ext}` : base;
}

/** A URL that makes storage send the file as an attachment. */
export function libraryDownloadHref(item: LibraryItem) {
  return item.url
    ? getCdnUrl(item.url, { download: libraryDownloadName(item) })
    : null;
}

/** Tool page for making more of a media type. */
export const LIBRARY_TOOL_HREF: Record<LibraryFilterMediaType, string> = {
  video: "/video-generator",
  image: "/image-generator",
  audio: "/music-generator",
};

// ---------------------------------------------------------------------------
// Delete

/** Each kind lives in its own table with its own delete endpoint. */
export function libraryDeletePath(item: LibraryItem): string | null {
  const id = encodeURIComponent(item.id);
  switch (item.kind) {
    case "video":
    case "motion_control":
      return `/api/generations/${id}`;
    case "image":
    case "thumbnail":
    case "influencer":
    case "movie_material":
    case "image_upscale":
      return `/api/image-generations/${id}`;
    case "music":
      return `/api/music-generations/${id}`;
    case "voiceover":
      return `/api/voice-generations/${id}`;
    case "voice_change":
      return `/api/voice-conversions/${id}`;
    case "avatar":
      return `/api/avatar-generations/${id}`;
    case "video_upscale":
    case "subtitle_removal":
      return `/api/videos/${id}`;
    case "subtitle_export":
      return `/api/exports/${id}`;
    case "clip":
      return `/api/clippings/clips/${id}`;
    case "upload":
      return `/api/assets/${id}`;
    default:
      return null;
  }
}

export function useDeleteLibraryItem() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: LibraryItem) => {
      const path = libraryDeletePath(item);
      if (!path) throw new Error("This file can't be deleted here.");
      const res = await authFetch(path, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readError(res, "The server didn't respond."));
      }
      return item;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.all }),
  });
}

/**
 * Deletes many items, four at a time. Items without a delete endpoint are
 * skipped. Never throws: failures are counted.
 */
export function useDeleteLibraryItems() {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: LibraryItem[]) => {
      const deletable = items.filter((item) => libraryDeletePath(item));
      const deleted: LibraryItem[] = [];
      const failed: LibraryItem[] = [];
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, deletable.length) }, async () => {
          while (next < deletable.length) {
            const item = deletable[next++];
            try {
              const res = await authFetch(libraryDeletePath(item) as string, {
                method: "DELETE",
              });
              if (res.ok) deleted.push(item);
              else failed.push(item);
            } catch {
              failed.push(item);
            }
          }
        }),
      );
      return {
        deleted,
        failed,
        skipped: items.length - deletable.length,
      };
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.all }),
  });
}

// ---------------------------------------------------------------------------
// Folders, rename and move

export interface LibraryFolder {
  id: string;
  name: string;
  createdAt: string;
  /** Files in the folder. */
  count: number;
}

export function useLibraryFolders(options: { enabled?: boolean } = {}) {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: libraryQueryKeys.folders(),
    queryFn: async (): Promise<LibraryFolder[]> => {
      const res = await authFetch("/api/library/folders");
      if (!res.ok) {
        throw new Error(await readError(res, "Couldn't load your folders."));
      }
      const json = await res.json();
      return (json.data?.folders ?? []) as LibraryFolder[];
    },
    enabled: !!isSignedIn && (options.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

function useLibraryMutation<TVars, TResult>(
  fn: (authFetch: AuthFetch, vars: TVars) => Promise<TResult>,
) {
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => fn(authFetch, vars),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: libraryQueryKeys.all }),
  });
}

async function sendJson<T>(
  authFetch: AuthFetch,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await authFetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "The server didn't respond."));
  }
  const json = await res.json().catch(() => ({}));
  return (json.data ?? json) as T;
}

export function useCreateLibraryFolder() {
  return useLibraryMutation((authFetch, name: string) =>
    sendJson<LibraryFolder>(authFetch, "/api/library/folders", "POST", { name }),
  );
}

export function useRenameLibraryFolder() {
  return useLibraryMutation(
    (authFetch, vars: { id: string; name: string }) =>
      sendJson<LibraryFolder>(
        authFetch,
        `/api/library/folders/${encodeURIComponent(vars.id)}`,
        "PATCH",
        { name: vars.name },
      ),
  );
}

/** Deletes the folder only. Its files become unfiled. */
export function useDeleteLibraryFolder() {
  return useLibraryMutation((authFetch, id: string) =>
    sendJson<unknown>(
      authFetch,
      `/api/library/folders/${encodeURIComponent(id)}`,
      "DELETE",
    ),
  );
}

/**
 * Moves items into a folder (`folderId: null` unfiles them). Items move by
 * their asset, so ones without an `assetId` are skipped and counted.
 */
export function useMoveLibraryItems() {
  return useLibraryMutation(
    async (
      authFetch,
      vars: { items: LibraryItem[]; folderId: string | null },
    ): Promise<{ moved: number; skipped: number }> => {
      const assetIds = vars.items
        .map((item) => item.assetId)
        .filter((id): id is string => !!id);
      const skipped = vars.items.length - assetIds.length;
      if (assetIds.length === 0) return { moved: 0, skipped };
      const data = await sendJson<{ moved: number }>(
        authFetch,
        "/api/library/move",
        "POST",
        { assetIds, folderId: vars.folderId },
      );
      return { moved: data.moved ?? assetIds.length, skipped };
    },
  );
}

/** Renames an upload (its file name). */
export function useRenameLibraryItem() {
  return useLibraryMutation(
    (authFetch, vars: { item: LibraryItem; name: string }) => {
      if (!vars.item.assetId) {
        return Promise.reject(new Error("This file can't be renamed."));
      }
      return sendJson<unknown>(
        authFetch,
        `/api/assets/${encodeURIComponent(vars.item.assetId)}`,
        "PATCH",
        { name: vars.name },
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Upload and import

export const LIBRARY_UPLOAD_ACCEPT: Record<LibraryFilterMediaType, string> = {
  video: "video/*",
  image: "image/*",
  audio: "audio/*",
};

export function mediaTypeOfFile(file: File): LibraryFilterMediaType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
}

/** Best-effort dimensions and duration, so the composer can check them. */
async function readMediaMetadata(
  file: File,
  mediaType: LibraryFilterMediaType,
): Promise<MediaMetadata> {
  if (typeof window === "undefined") return {};

  if (mediaType === "image") {
    try {
      const bitmap = await createImageBitmap(file);
      const meta = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return meta;
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    const el = document.createElement(mediaType === "video" ? "video" : "audio");
    const src = URL.createObjectURL(file);
    let settled = false;
    const done = (meta: MediaMetadata) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(src);
      el.removeAttribute("src");
      resolve(meta);
    };
    const timer = window.setTimeout(() => done({}), 8000);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = Number.isFinite(el.duration) ? el.duration : undefined;
      if (el instanceof HTMLVideoElement) {
        done({
          width: el.videoWidth || undefined,
          height: el.videoHeight || undefined,
          duration,
        });
      } else {
        done({ duration });
      }
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      done({});
    };
    el.src = src;
  });
}

/**
 * Uploads one file straight to storage with a signed URL and registers it as
 * an upload in the Library. Throws with a readable message on failure.
 */
export async function uploadLibraryFile(
  authFetch: AuthFetch,
  file: File,
  options: {
    folderId?: string | null;
    onProgress?: (percentage: number) => void;
  } = {},
): Promise<LibraryItem> {
  const mediaType = mediaTypeOfFile(file);
  if (!mediaType) {
    throw new Error("Only images, videos and audio files can be uploaded.");
  }

  const [stored, meta] = await Promise.all([
    uploadFileToStorage(file, (p) => options.onProgress?.(p.percentage)),
    readMediaMetadata(file, mediaType),
  ]);
  if (!stored.success || !stored.blobUrl) {
    throw new Error(stored.error || "Storage rejected the file.");
  }

  const res = await authFetch("/api/assets", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      url: stored.blobUrl,
      mimeType: file.type,
      type: mediaType.toUpperCase(),
      fileSize: file.size,
      width: meta.width ? Math.round(meta.width) : undefined,
      height: meta.height ? Math.round(meta.height) : undefined,
      duration: meta.duration,
      folderId: options.folderId ?? undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "The file couldn't be saved."));
  }
  const json = await res.json();
  if (json.item) return json.item as LibraryItem;
  const asset = json.asset;
  return {
    id: asset.id,
    kind: "upload",
    mediaType: String(asset.type).toLowerCase() as LibraryMediaType,
    status: "COMPLETED",
    label: asset.name,
    model: null,
    url: asset.url,
    thumbnailUrl: null,
    credits: 0,
    source: "web",
    createdAt: asset.createdAt,
    assetId: asset.id,
    width: asset.width ?? null,
    height: asset.height ?? null,
    duration: asset.duration ?? null,
    mimeType: asset.mimeType ?? null,
    folderId: asset.folderId ?? null,
  };
}

export type ImportProvider = "url" | "dropbox" | "google_drive" | "onedrive";

/** One file for `POST /api/uploads/import`. Tokens are never stored. */
export interface ImportSourceItem {
  provider: ImportProvider;
  url?: string;
  fileId?: string;
  /** OneDrive only. */
  driveId?: string;
  accessToken?: string;
  name?: string;
  mimeType?: string;
}

export interface ImportResult {
  items: LibraryItem[];
  errors: { index: number; name: string; error: string }[];
}

/** Imports up to 20 files server-side (link, Dropbox, Google Drive, OneDrive). */
export async function importLibraryItems(
  authFetch: AuthFetch,
  items: ImportSourceItem[],
  options: { folderId?: string | null } = {},
): Promise<ImportResult> {
  const res = await authFetch("/api/uploads/import", {
    method: "POST",
    body: JSON.stringify({ items, folderId: options.folderId ?? undefined }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "The import didn't start."));
  }
  const json = await res.json();
  return json.data as ImportResult;
}
