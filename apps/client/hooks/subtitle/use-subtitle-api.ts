"use client";

import { useMemo } from "react";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import type {
  EditorSettings,
  SubtitleChunk,
  TranscriptionData,
  VideoExportItem,
} from "@/remotion/types";

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
        options: { language?: string; maxWordsPerChunk?: number } = {},
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
