"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  TextT,
  Subtitles,
  Drop,
  Palette,
  FloppyDisk,
  PencilSimple,
  CaretLeft,
  FrameCorners,
  DownloadSimple,
} from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { UploadDialog } from "@/components/subtitle-editor/upload-dialog";
import { UploadArea } from "@/components/subtitle-editor/upload-area";
import { VideoPreview } from "@/components/subtitle-editor/video-preview";
import {
  ExportPopover,
  ExportProgressDialog,
} from "@/components/subtitle-editor/export-video";
import { StyleSubtitlesTab } from "@/components/subtitle-editor/tabs/style-subtitles-tab";
import {
  EditSubtitlesTab,
  TRANSCRIPTION_LANGUAGES,
} from "@/components/subtitle-editor/tabs/edit-subtitles-tab";
import { EditTitleTab } from "@/components/subtitle-editor/tabs/edit-title-tab";
import { EditWatermarkTab } from "@/components/subtitle-editor/tabs/edit-watermark-tab";
import {
  WATERMARK_OVERLAY_DEFAULTS,
  type WatermarkOverlayConfig,
} from "@/components/subtitle-editor/tabs/edit-watermark-tab";
import { useTranscriptionData } from "@/hooks/subtitle/use-transcription-data";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import { useExportJob } from "@/hooks/subtitle/use-export-job";
import {
  SUBTITLE_PRESETS,
  type SubtitleStylePreset,
} from "@/components/subtitle-editor/style-presets";
import {
  SIZE_POSITION_DEFAULTS,
  type SizePositionValues,
} from "@/components/subtitle-editor/tabs/style-subtitles-tab";
import {
  TITLE_OVERLAY_DEFAULTS,
  type TitleOverlayConfig,
} from "@/components/subtitle-editor/tabs/edit-title-tab";
import {
  PreviewStyleTab,
  PREVIEW_STYLE_DEFAULTS,
  getCompositionDimensions,
  type PreviewStyleConfig,
} from "@/components/subtitle-editor/tabs/preview-style-tab";
import { ExportsTab } from "@/components/subtitle-editor/tabs/exports-tab";
import { DeleteExportDialog } from "@/components/subtitle-editor/delete-export-dialog";

const TAB_TRIGGER_CLASS =
  "gap-1.5 px-3  focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none";

export default function SubtitleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    transcriptionData,
    isLoading,
    isStarting,
    notFound,
    transcriptionStatus,
    startTranscription,
    handleChunksUpdate,
    handleMaxWordsChange,
    refreshTranscriptionData,
  } = useTranscriptionData(id);
  const { updateTranscription, createTranscription, deleteExport } =
    useSubtitleApi();
  const {
    isExporting,
    exportProgress,
    exportStatus,
    exportedVideoUrl,
    startExport,
    resetExportState,
  } = useExportJob();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [title, setTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<SubtitleStylePreset>(
    SUBTITLE_PRESETS[0],
  );
  const [sizePosition, setSizePosition] = useState<SizePositionValues>(
    SIZE_POSITION_DEFAULTS,
  );
  const [titleOverlay, setTitleOverlay] = useState<TitleOverlayConfig>(
    TITLE_OVERLAY_DEFAULTS,
  );
  const [watermarkOverlay, setWatermarkOverlay] =
    useState<WatermarkOverlayConfig>(WATERMARK_OVERLAY_DEFAULTS);
  const [previewStyle, setPreviewStyle] = useState<PreviewStyleConfig>(
    PREVIEW_STYLE_DEFAULTS,
  );
  const [transcribeLanguage, setTranscribeLanguage] = useState("auto");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const playerSeekRef = useRef<((timeInSeconds: number) => void) | null>(null);
  const currentTimeRef = useRef(0);
  const [activeChunkIndex, setActiveChunkIndex] = useState(-1);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      currentTimeRef.current = time;
      const chunks = transcriptionData?.subtitleChunks ?? [];
      const idx = chunks.findIndex((c) => time >= c.start && time <= c.end);
      setActiveChunkIndex((prev) => (prev !== idx ? idx : prev));
    },
    [transcriptionData?.subtitleChunks],
  );

  const handleSeekTo = useCallback((time: number) => {
    playerSeekRef.current?.(time);
  }, []);

  const videoUrl = transcriptionData?.videoAsset?.url ?? null;
  const isNewProject = notFound && !isCreating;

  useEffect(() => {
    if (isNewProject) {
      setTitle("Untitled Project");
    }
  }, [isNewProject]);

  useEffect(() => {
    if (transcriptionData?.title) {
      setTitle(transcriptionData.title);
    } else if (transcriptionData?.filename) {
      setTitle(transcriptionData.filename);
    }
  }, [transcriptionData?.title, transcriptionData?.filename]);

  useEffect(() => {
    const settings = transcriptionData?.editorSettings as
      | {
          selectedPresetId?: string;
          sizePosition?: SizePositionValues;
          titleOverlay?: TitleOverlayConfig;
          watermarkOverlay?: WatermarkOverlayConfig;
          previewStyle?: PreviewStyleConfig;
        }
      | undefined;
    if (!settings) return;

    if (settings.selectedPresetId) {
      const preset = SUBTITLE_PRESETS.find(
        (p) => p.id === settings.selectedPresetId,
      );
      if (preset) setSelectedPreset(preset);
    }
    if (settings.sizePosition) {
      setSizePosition({ ...SIZE_POSITION_DEFAULTS, ...settings.sizePosition });
    }
    if (settings.titleOverlay) {
      setTitleOverlay({ ...TITLE_OVERLAY_DEFAULTS, ...settings.titleOverlay });
    }
    if (settings.watermarkOverlay) {
      setWatermarkOverlay({
        ...WATERMARK_OVERLAY_DEFAULTS,
        ...settings.watermarkOverlay,
      });
    }
    if (settings.previewStyle) {
      setPreviewStyle({ ...PREVIEW_STYLE_DEFAULTS, ...settings.previewStyle });
    }
  }, [transcriptionData?.editorSettings]);

  // Refresh the project (and its export list) when an export finishes,
  // so the Exports tab shows the new file without a manual reload.
  useEffect(() => {
    if (exportStatus === "completed" || exportStatus === "failed") {
      refreshTranscriptionData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportStatus]);

  const [pendingExportDeleteId, setPendingExportDeleteId] = useState<
    string | null
  >(null);
  const [isDeletingExport, setIsDeletingExport] = useState(false);

  const handleConfirmDeleteExport = useCallback(async () => {
    if (!pendingExportDeleteId) return;
    setIsDeletingExport(true);
    try {
      const result = await deleteExport(pendingExportDeleteId);
      if (result.success) {
        toast.success("Export deleted");
        setPendingExportDeleteId(null);
        await refreshTranscriptionData();
      } else {
        toast.error(result.error || "Failed to delete export");
      }
    } finally {
      setIsDeletingExport(false);
    }
    // deleteExport/refreshTranscriptionData identities change every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingExportDeleteId]);

  // Reflect the stored transcription language in the picker. The column
  // holds either a chosen ISO code ("en") or Whisper's detected full name
  // ("english"); match both, otherwise keep the English default.
  useEffect(() => {
    const stored = transcriptionData?.language?.toLowerCase();
    if (!stored) return;
    const match = TRANSCRIPTION_LANGUAGES.find(
      (l) => l.code === stored || l.label.toLowerCase() === stored,
    );
    if (match && match.code !== "auto") {
      setTranscribeLanguage(match.code);
    }
  }, [transcriptionData?.language]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleVideoUploaded = useCallback(
    async (blobUrl: string, file: File) => {
      setIsCreating(true);
      setUploadOpen(false);
      try {
        const result = await createTranscription({
          videoUrl: blobUrl,
          filename: file.name,
        });
        if (!result.success || !result.data?.id) {
          throw new Error(result.error || "Failed to create project");
        }
        router.replace(`/subtitle-editor/${result.data.id}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create project",
        );
        setIsCreating(false);
      }
    },
    [createTranscription, router],
  );

  const handleOpenMediaSelector = useCallback(() => {
    setUploadOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!transcriptionData?.id) return;
    setIsSaving(true);
    try {
      const result = await updateTranscription(transcriptionData.id, {
        title,
        subtitleChunks: transcriptionData?.subtitleChunks ?? [],
        maxWordsPerChunk: transcriptionData?.maxWordsPerChunk,
        editorSettings: {
          selectedPresetId: selectedPreset.id,
          sizePosition,
          titleOverlay,
          watermarkOverlay,
          previewStyle,
        },
      });
      if (result.success) {
        toast.success("Changes saved");
      } else {
        throw new Error(result.error || "Failed to save");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    title,
    transcriptionData,
    updateTranscription,
    selectedPreset,
    sizePosition,
    titleOverlay,
    watermarkOverlay,
    previewStyle,
  ]);

  const handleExport = useCallback(
    async (fileName: string) => {
      if (!transcriptionData?.id || !transcriptionData.videoAsset?.url) return;

      setExportDialogOpen(true);

      const duration = transcriptionData.duration ?? 0;
      const editorSettings = {
        fileName,
        selectedPresetId: selectedPreset.id,
        preset: selectedPreset,
        sizePosition,
        titleOverlay,
        watermarkOverlay,
        previewStyle,
      };

      // Export canvas mirrors the preview: the chosen aspect ratio applied
      // to the source video's dimensions.
      const exportDimensions = getCompositionDimensions(
        previewStyle,
        transcriptionData.width ?? 1080,
        transcriptionData.height ?? 1920,
      );

      await startExport(
        transcriptionData.id,
        transcriptionData.videoAsset.url,
        transcriptionData.subtitleChunks ?? [],
        editorSettings,
        duration,
        exportDimensions.width,
        exportDimensions.height,
      );
    },
    [
      transcriptionData,
      selectedPreset,
      sizePosition,
      titleOverlay,
      watermarkOverlay,
      previewStyle,
      startExport,
    ],
  );

  if (isLoading || isCreating) {
    return (
      <div className="min-h-[60vh] bg-background p-4 sm:p-5 lg:h-[calc(100vh-64px)]">
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-md" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8">
            <div className="flex gap-2 overflow-x-auto border-b pb-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-32 shrink-0 rounded-md" />
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
          <div className="lg:col-span-4">
            <Skeleton className="aspect-video w-full rounded-xl lg:aspect-9/16" />
          </div>
        </div>
        {isCreating && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Setting up your project...
          </div>
        )}
      </div>
    );
  }

  if (isNewProject) {
    return (
      <div className="flex min-h-[60vh] flex-col p-4 sm:p-5 lg:h-[calc(100vh-64px)]">
        <div className="flex items-center gap-2 py-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <CaretLeft />
          </Button>
          <h1 className="text-lg font-semibold">New Subtitle Project</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Upload a video to get started
              </h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ll set up your project so you can transcribe and style
                subtitles.
              </p>
            </div>
            <UploadArea onVideoUploaded={handleVideoUploaded} padding="lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col bg-background lg:h-svh">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <CaretLeft />
          </Button>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingTitle(false);
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              className="bg-transparent text-lg font-semibold outline-none border-b border-primary"
            />
          ) : (
            <>
              <h1 className="truncate text-base font-semibold sm:text-lg">{title || "Untitled"}</h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <PencilSimple className="size-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Spinner className="size-3.5" />
            ) : (
              <FloppyDisk className="size-3.5" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <ExportPopover
            defaultFileName={title || "Untitled"}
            durationSeconds={transcriptionData?.duration ?? 0}
            onExport={handleExport}
            disabled={isExporting || !transcriptionData?.videoAsset?.url}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <Tabs
          value={activeTab}
          onValueChange={(v) => v && setActiveTab(v as string)}
          className="flex min-h-0 flex-col gap-0 border-b bg-card lg:w-2/3 lg:border-b-0 lg:border-r"
        >
          <div className="overflow-x-auto border-b px-3 pb-0 sm:px-5">
            <TabsList variant="line" className="w-max gap-2">
              <TabsTrigger value="style" className={TAB_TRIGGER_CLASS}>
                <Palette className="size-3.5" />
                Style Subtitles
              </TabsTrigger>
              <TabsTrigger value="edit" className={TAB_TRIGGER_CLASS}>
                <Subtitles className="size-3.5" />
                Edit Subtitles
              </TabsTrigger>
              <TabsTrigger value="title" className={TAB_TRIGGER_CLASS}>
                <TextT className="size-3.5" />
                Edit Title
              </TabsTrigger>
              <TabsTrigger value="watermark" className={TAB_TRIGGER_CLASS}>
                <Drop className="size-3.5" />
                Edit Watermark
              </TabsTrigger>
              <TabsTrigger value="preview-style" className={TAB_TRIGGER_CLASS}>
                <FrameCorners className="size-3.5" />
                Preview Style
              </TabsTrigger>
              <TabsTrigger value="exports" className={TAB_TRIGGER_CLASS}>
                <DownloadSimple className="size-3.5" />
                Exports
                {(transcriptionData?.videoExports?.length ?? 0) > 0 && (
                  <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                    {transcriptionData?.videoExports?.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="style"
            className="flex-1 overflow-y-auto px-3 py-4 sm:px-5"
          >
            <StyleSubtitlesTab
              selectedPresetId={selectedPreset.id}
              onSelectPreset={setSelectedPreset}
              sizePosition={sizePosition}
              onSizePositionChange={setSizePosition}
            />
          </TabsContent>

          <TabsContent
            value="edit"
            className="flex-1 overflow-y-auto px-3 py-4 sm:px-5"
          >
            <EditSubtitlesTab
              videoUrl={videoUrl}
              transcriptionStatus={transcriptionStatus}
              subtitleChunks={transcriptionData?.subtitleChunks ?? []}
              isStarting={isStarting}
              activeChunkIndex={activeChunkIndex}
              language={transcribeLanguage}
              onLanguageChange={setTranscribeLanguage}
              maxWordsPerChunk={transcriptionData?.maxWordsPerChunk ?? 5}
              onMaxWordsChange={handleMaxWordsChange}
              onStartTranscription={() =>
                startTranscription({
                  language: transcribeLanguage,
                  maxWordsPerChunk: transcriptionData?.maxWordsPerChunk ?? 5,
                })
              }
              onChunksUpdate={handleChunksUpdate}
              onSeekTo={handleSeekTo}
            />
          </TabsContent>

          <TabsContent
            value="title"
            className="flex-1 overflow-y-auto px-3 py-4 sm:px-5"
          >
            <EditTitleTab config={titleOverlay} onChange={setTitleOverlay} />
          </TabsContent>

          <TabsContent
            value="watermark"
            className="flex-1 overflow-y-auto px-3 py-4 sm:px-5"
          >
            <EditWatermarkTab
              config={watermarkOverlay}
              onChange={setWatermarkOverlay}
            />
          </TabsContent>

          <TabsContent
            value="preview-style"
            className="flex-1 overflow-y-auto px-3 py-4 sm:px-5"
          >
            <PreviewStyleTab config={previewStyle} onChange={setPreviewStyle} />
          </TabsContent>

          <TabsContent
            value="exports"
            className="flex-1 overflow-y-auto px-3 py-4 sm:px-5"
          >
            <ExportsTab
              exports={transcriptionData?.videoExports ?? []}
              onDelete={setPendingExportDeleteId}
            />
          </TabsContent>
        </Tabs>

        <div className="flex-1 p-3 sm:p-5 lg:overflow-y-auto">
          <VideoPreview
            videoUrl={videoUrl}
            subtitleChunks={transcriptionData?.subtitleChunks ?? []}
            selectedPreset={selectedPreset}
            sizePosition={sizePosition}
            titleOverlay={titleOverlay}
            watermarkOverlay={watermarkOverlay}
            previewStyle={previewStyle}
            onOpenMediaSelector={handleOpenMediaSelector}
            onTimeUpdate={handleTimeUpdate}
            seekRef={playerSeekRef}
          />
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onVideoUploaded={handleVideoUploaded}
      />

      <DeleteExportDialog
        open={pendingExportDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingExport) setPendingExportDeleteId(null);
        }}
        onConfirm={handleConfirmDeleteExport}
        isDeleting={isDeletingExport}
      />

      <ExportProgressDialog
        open={exportDialogOpen}
        onOpenChange={(open) => {
          setExportDialogOpen(open);
          if (!open) resetExportState();
        }}
        progress={exportProgress}
        status={exportStatus}
        exportedVideoUrl={exportedVideoUrl}
      />
    </div>
  );
}
