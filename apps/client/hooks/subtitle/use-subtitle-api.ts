"use client";

import { useMemo } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type {
  EditorSettings,
  SubtitleChunk,
  TranscriptionData,
  VideoExportItem,
} from "@/remotion/types";
import type {
  CaptionLayout,
  KeywordLevel,
} from "@/components/subtitle-editor/caption-style";

/** Every subtitle endpoint answers `{ success, data?, error? }`. */
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** Only on list endpoints. */
  pagination?: PaginationMeta;
  /** HTTP status. 0 when the request never reached the server. */
  status: number;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface TranscriptionListItem {
  id: string;
  /** Not returned by the list endpoint yet; falls back to `filename`. */
  title?: string | null;
  videoUrl?: string | null;
  filename?: string | null;
  language?: string | null;
  duration?: number | null;
  status: string;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportListItem extends VideoExportItem {
  transcription?: {
    id: string;
    filename?: string | null;
    language?: string | null;
  } | null;
}

export interface CreateTranscriptionRequest {
  videoUrl: string;
  filename?: string;
}

export interface UpdateTranscriptionRequest {
  title?: string;
  subtitleChunks?: SubtitleChunk[];
  editorSettings?: EditorSettings;
  maxWordsPerChunk?: number;
}

export interface ExportRequest {
  transcriptionId: string;
  videoUrl: string;
  subtitleChunks: SubtitleChunk[];
  style: EditorSettings;
  duration: number;
  fps: number;
  width: number;
  height: number;
}

/** A caption style the user saved; `style` holds the preset fields. */
export type BrollOrientation = "portrait" | "landscape" | "square";

export interface BrollMedia {
  kind: "video" | "image";
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  vendor: "pexels" | "ai" | "upload";
  sourceUrl?: string;
  author?: string;
}

/** A part of the video by topic, from the AI scene pass. */
export interface CaptionScene {
  start: number;
  end: number;
  keyword: string;
  brollQuery: string;
  zoom: string | null;
}

export interface CaptionMarkup {
  keywords: { index: number; level: KeywordLevel }[];
  emojis: { index: number; emoji: string }[];
}

export interface SavedSubtitlePreset {
  id: string;
  name: string;
  style: Record<string, unknown>;
}

export interface ExportQueued {
  taskId?: string;
  creditsUsed?: number;
  creditsRemaining?: number;
  /** Set on 402 responses. */
  creditsRequired?: number;
  creditsAvailable?: number;
}

export interface ExportJob {
  taskId: string;
  progress: number;
  status: "processing" | "completed" | "failed";
  failedReason?: string;
  result?: {
    success: boolean;
    exportId: string;
    videoUrl?: string;
    error?: string;
  };
}

const NETWORK_ERROR =
  "Couldn't reach the server. Check your connection and try again.";

async function readResult<T>(response: Response): Promise<ApiResult<T>> {
  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: string;
    pagination?: PaginationMeta;
  } | null;

  if (!body) {
    return {
      success: false,
      status: response.status,
      error:
        response.status === 401
          ? "Your session expired. Sign in again."
          : `The server responded with status ${response.status}.`,
    };
  }

  return {
    success: Boolean(body.success),
    data: body.data,
    error: body.error,
    pagination: body.pagination,
    status: response.status,
  };
}

/**
 * Typed calls for the subtitle editor. The returned object is stable for the
 * lifetime of the signed-in session, so its functions are safe to use as
 * effect and callback dependencies.
 */
export function useSubtitleApi() {
  const { authFetch } = useAuthFetch();

  return useMemo(() => {
    async function request<T>(
      path: string,
      init?: RequestInit,
    ): Promise<ApiResult<T>> {
      try {
        const response = await authFetch(path, init);
        return await readResult<T>(response);
      } catch {
        return { success: false, status: 0, error: NETWORK_ERROR };
      }
    }

    const pageQuery = (page: number, limit: number) =>
      new URLSearchParams({ page: String(page), limit: String(limit) });

    return {
      /** Creates a draft project for an uploaded video. */
      createTranscription: (body: CreateTranscriptionRequest) =>
        request<{ id: string; status: string; filename?: string }>(
          "/api/subtitles/create",
          { method: "POST", body: JSON.stringify(body) },
        ),

      /** Queues transcription for a draft project. */
      startTranscription: (
        id: string,
        options: { language?: string; layout?: CaptionLayout } = {},
      ) =>
        request<{ id: string; taskId: string; status: string }>(
          `/api/subtitles/${id}/start`,
          { method: "POST", body: JSON.stringify(options) },
        ),

      getTranscription: (id: string) =>
        request<TranscriptionData>(`/api/subtitles/${id}`),

      updateTranscription: (id: string, body: UpdateTranscriptionRequest) =>
        request<TranscriptionData>(`/api/subtitles/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }),

      /** Writes a hook title from the transcript; accent words come in *asterisks*. */
      generateHookTitle: (id: string, previousHooks: string[]) =>
        request<{ hook: string }>(`/api/subtitles/${id}/hook-title`, {
          method: "POST",
          body: JSON.stringify({ previousHooks }),
        }),

      /** Stock B-roll from Pexels. */
      searchBroll: (
        query: string,
        type: "video" | "photo",
        orientation: BrollOrientation,
        tier: "trendy" | "free" | "premium" = "free",
      ) =>
        request<BrollMedia[]>(
          `/api/subtitles/broll/search?${new URLSearchParams({ q: query, type, orientation, tier })}`,
        ),

      /** One AI B-roll image. Costs credits. */
      generateBrollImage: (prompt: string, orientation: BrollOrientation) =>
        request<{ media: BrollMedia; creditsUsed: number }>("/api/subtitles/broll/image", {
          method: "POST",
          body: JSON.stringify({ prompt, orientation }),
        }),

      /** Plans B-roll for about `percent` of the video. AI images cost credits. */
      autoBrolls: (
        id: string,
        body: {
          percent: number;
          videoType: "free" | "premium" | "trendy";
          transitions: boolean;
          orientation: BrollOrientation;
          scenes?: CaptionScene[];
        },
      ) =>
        request<{
          clips: { start: number; end: number; media: BrollMedia; transition?: string }[];
          sounds: { start: number; sound: string }[];
          scenes: CaptionScene[];
          creditsUsed: number;
        }>(`/api/subtitles/${id}/brolls/auto`, { method: "POST", body: JSON.stringify(body) }),

      /** Names the project from its transcript and saves the name. */
      writeProjectTitle: (id: string) =>
        request<{ title: string }>(`/api/subtitles/${id}/project-title`, { method: "POST" }),

      /** Splits the video into scenes by topic. */
      findScenes: (id: string) =>
        request<{ scenes: CaptionScene[] }>(`/api/subtitles/${id}/scenes`, { method: "POST" }),

      /** Runs an AI Tools pass. Costs credits; auto-zooms returns the scenes. */
      runAiTool: (id: string, tool: string) =>
        request<{ status?: string; scenes?: CaptionScene[]; creditsUsed: number }>(
          `/api/subtitles/${id}/ai-tools/${tool}`,
          { method: "POST" },
        ),

      /** Undoes an AI Tools pass. */
      removeAiTool: (id: string, tool: string) =>
        request<{ restored: boolean }>(`/api/subtitles/${id}/ai-tools/${tool}/remove`, {
          method: "POST",
        }),

      /** Translates caption lines into a language. Costs credits. */
      translateCaptions: (id: string, language: string, lines: string[]) =>
        request<{ lines: string[]; creditsUsed: number }>(
          `/api/subtitles/${id}/translate`,
          { method: "POST", body: JSON.stringify({ language, lines }) },
        ),

      /** Fixes speech recognition mistakes; one word list per line. */
      optimizeCaptions: (id: string, lines: string[][]) =>
        request<{ lines: string[][] }>(`/api/subtitles/${id}/optimize`, {
          method: "POST",
          body: JSON.stringify({ lines }),
        }),

      /** Marks keywords and emojis on the words, by their index. */
      findCaptionKeywords: (id: string, words: string[]) =>
        request<CaptionMarkup>(`/api/subtitles/${id}/keywords`, {
          method: "POST",
          body: JSON.stringify({ words }),
        }),

      listSubtitlePresets: () =>
        request<SavedSubtitlePreset[]>("/api/subtitles/presets"),

      createSubtitlePreset: (name: string, style: Record<string, unknown>) =>
        request<SavedSubtitlePreset>("/api/subtitles/presets", {
          method: "POST",
          body: JSON.stringify({ name, style }),
        }),

      deleteSubtitlePreset: (id: string) =>
        request<unknown>(`/api/subtitles/presets/${id}`, { method: "DELETE" }),

      deleteTranscription: (id: string) =>
        request<unknown>(`/api/subtitles/${id}`, { method: "DELETE" }),

      getUserTranscriptions: (page: number, limit: number) =>
        request<TranscriptionListItem[]>(
          `/api/subtitles?${pageQuery(page, limit)}`,
        ),

      createExport: (body: ExportRequest) =>
        request<ExportQueued>("/api/exports", {
          method: "POST",
          body: JSON.stringify(body),
        }),

      getExportJobStatus: (taskId: string) =>
        request<ExportJob>(`/api/exports/job/${taskId}`),

      getUserExports: (page: number, limit: number) =>
        request<ExportListItem[]>(`/api/exports?${pageQuery(page, limit)}`),

      deleteExport: (id: string) =>
        request<unknown>(`/api/exports/${id}`, { method: "DELETE" }),
    };
  }, [authFetch]);
}
