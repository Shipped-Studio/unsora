import { useAuthFetch } from "../use-auth-fetch";
import { TranscriptionData } from "@/remotion/types";

export interface TranscribeRequest {
  videoUrl: string;
  maxWordsPerChunk?: number;
  filename?: string;
  width?: number;
  height?: number;
  inputLanguage?: string;
  outputLanguage?: string;
}

export interface BatchTranscribeRequest {
  videos: TranscribeRequest[];
}

export interface BatchTranscribeResponse {
  success: boolean;
  data?: {
    results: Array<{
      success: boolean;
      data?: { id: string; taskId: string; status: string; filename?: string };
      error?: string;
      filename?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
    message: string;
  };
  error?: string;
}

export interface TranscribeResponse {
  success: boolean;
  data?: TranscriptionData;
  error?: string;
}

export interface ExportRequest {
  transcriptionId?: string;
  videoUrl: string;
  subtitleChunks: any[];
  style: any;
  duration: number;
  fps?: number;
  width?: number;
  height?: number;
}

export interface ExportResponse {
  success: boolean;
  data?: {
    taskId?: string;
    message?: string;
    creditsUsed?: number;
    creditsRemaining?: number;
    /** Set on 402 responses so the UI can surface the shortfall. */
    creditsRequired?: number;
    creditsAvailable?: number;
  };
  error?: string;
}

export interface ExportJobStatus {
  success: boolean;
  data?: {
    taskId: string;
    progress: number;
    status: "processing" | "completed" | "failed";
    processedOn?: string;
    finishedOn?: string;
    failedReason?: string;
    result?: {
      success: boolean;
      exportId: string;
      videoUrl?: string;
      error?: string;
    };
  };
  error?: string;
}

export function useSubtitleApi() {
  const { authFetch } = useAuthFetch();

  /**
   * Transcribe a video with word-level timestamps
   */
  const createSubtitleRecord = async (
    request: TranscribeRequest,
  ): Promise<TranscribeResponse> => {
    try {
      const response = await authFetch("/api/subtitles/create", {
        method: "POST",
        body: JSON.stringify(request),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Create subtitle record error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create subtitle record",
      };
    }
  };

  /**
   * Get a transcription by ID
   */
  const getTranscription = async (id: string): Promise<TranscribeResponse> => {
    try {
      const response = await authFetch(`/api/subtitles/${id}`, {
        method: "GET",
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get transcription error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get transcription",
      };
    }
  };

  /**
   * Get transcription status by ID
   */
  const getTranscriptionStatus = async (
    id: string,
  ): Promise<{
    success: boolean;
    data?: { id: string; status: string; error?: string; progress: number };
    error?: string;
  }> => {
    try {
      const response = await authFetch(`/api/subtitles/${id}/status`, {
        method: "GET",
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get transcription status error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get transcription status",
      };
    }
  };

  /**
   * Update subtitle chunks with new maxWordsPerChunk
   */
  const updateSubtitleChunks = async (
    id: string,
    maxWordsPerChunk: number,
  ): Promise<TranscribeResponse> => {
    try {
      const response = await authFetch(`/api/subtitles/${id}/chunks`, {
        method: "PUT",
        body: JSON.stringify({ maxWordsPerChunk }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Update chunks error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update chunks",
      };
    }
  };

  /**
   * Get all user transcriptions
   */
  const getUserTranscriptions = async (
    page: number = 1,
    limit: number = 12,
  ): Promise<{
    success: boolean;
    data?: any[];
    pagination?: any;
    error?: string;
  }> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await authFetch(`/api/subtitles?${params}`, {
        method: "GET",
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get user transcriptions error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get transcriptions",
      };
    }
  };

  const createExport = async (
    request: ExportRequest,
  ): Promise<ExportResponse> => {
    try {
      const response = await authFetch("/api/exports", {
        method: "POST",
        body: JSON.stringify(request),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Export error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to queue export job",
      };
    }
  };

  const getExportJobStatus = async (
    taskId: string,
  ): Promise<ExportJobStatus> => {
    try {
      const response = await authFetch(`/api/exports/job/${taskId}`, {
        method: "GET",
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get export job status error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get export job status",
      };
    }
  };

  const getExport = async (
    id: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const response = await authFetch(`/api/exports/${id}`, {
        method: "GET",
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get export error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get export",
      };
    }
  };

  const getTranscriptionById = async (
    id: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const response = await authFetch(`/api/subtitles/${id}`, {
        method: "GET",
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get transcription by id error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get transcription by id",
      };
    }
  };

  const deleteExport = async (
    id: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch(`/api/exports/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Delete export error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete export",
      };
    }
  };

  const getUserExports = async (
    page: number = 1,
    limit: number = 12,
  ): Promise<{
    success: boolean;
    data?: any[];
    pagination?: any;
    error?: string;
  }> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      const response = await authFetch(`/api/exports?${params}`, {
        method: "GET",
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get user exports error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get user exports",
      };
    }
  };

  /**
   * Delete a transcription by ID
   */
  const deleteTranscription = async (
    id: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authFetch(`/api/subtitles/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Delete transcription error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete transcription",
      };
    }
  };

  /**
   * Delete multiple transcriptions (bulk delete)
   */
  const deleteTranscriptions = async (
    ids: string[],
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    try {
      const response = await authFetch(`/api/subtitles/bulk`, {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Delete transcriptions error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete transcriptions",
      };
    }
  };

  /**
   * Create a transcription record without starting processing
   */
  const createTranscription = async (
    request: TranscribeRequest,
  ): Promise<{
    success: boolean;
    data?: { id: string; status: string; filename?: string };
    error?: string;
  }> => {
    try {
      const response = await authFetch("/api/subtitles/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return await response.json();
    } catch (error) {
      console.error("Create transcription error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create transcription",
      };
    }
  };

  /**
   * Start transcription processing for an existing draft record
   */
  const startTranscription = async (
    id: string,
    options?: { language?: string; maxWordsPerChunk?: number },
  ): Promise<{
    success: boolean;
    data?: { id: string; taskId: string; status: string };
    error?: string;
  }> => {
    try {
      const response = await authFetch(`/api/subtitles/${id}/start`, {
        method: "POST",
        body: JSON.stringify(options ?? {}),
      });
      return await response.json();
    } catch (error) {
      console.error("Start transcription error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start transcription",
      };
    }
  };

  const updateTranscription = async (
    id: string,
    data: {
      title?: string;
      subtitleChunks?: any[];
      editorSettings?: object;
      maxWordsPerChunk?: number;
    },
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const response = await authFetch(`/api/subtitles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) {
      console.error("Update transcription error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update transcription",
      };
    }
  };

  return {
    createSubtitleRecord,
    createTranscription,
    startTranscription,
    getTranscription,
    getTranscriptionStatus,
    updateSubtitleChunks,
    updateTranscription,
    getUserTranscriptions,
    createExport,
    getExportJobStatus,
    getExport,
    getTranscriptionById,
    deleteExport,
    getUserExports,
    deleteTranscription,
    deleteTranscriptions,
  };
}
