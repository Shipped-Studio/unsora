"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DownloadSimple,
  Drop,
  FloppyDisk,
  FrameCorners,
  Palette,
  PencilSimple,
  Subtitles,
  TextT,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteDialog } from "@/components/subtitle-editor/delete-dialog";
import {
  ExportPopover,
  ExportProgressDialog,
} from "@/components/subtitle-editor/export-video";
import { failureMessage } from "@/components/subtitle-editor/format";
import {
  SUBTITLE_PRESETS,
  type SubtitleStylePreset,
} from "@/components/subtitle-editor/style-presets";
import {
  EditSubtitlesTab,
  TRANSCRIPTION_LANGUAGES,
} from "@/components/subtitle-editor/tabs/edit-subtitles-tab";
import {
  EditTitleTab,
  TITLE_OVERLAY_DEFAULTS,
  type TitleOverlayConfig,
} from "@/components/subtitle-editor/tabs/edit-title-tab";
import {
  EditWatermarkTab,
  WATERMARK_OVERLAY_DEFAULTS,
  type WatermarkOverlayConfig,
} from "@/components/subtitle-editor/tabs/edit-watermark-tab";
import { ExportsTab } from "@/components/subtitle-editor/tabs/exports-tab";
import {
  PREVIEW_STYLE_DEFAULTS,
  PreviewStyleTab,
  getCompositionDimensions,
  type PreviewStyleConfig,
} from "@/components/subtitle-editor/tabs/preview-style-tab";
import {
  SIZE_POSITION_DEFAULTS,
  StyleSubtitlesTab,
  type SizePositionValues,
} from "@/components/subtitle-editor/tabs/style-subtitles-tab";
import { UploadDialog } from "@/components/subtitle-editor/upload-dialog";
import { VideoPreview } from "@/components/subtitle-editor/video-preview";
import { useCreateProject } from "@/hooks/subtitle/use-create-project";
import { useExportJob } from "@/hooks/subtitle/use-export-job";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import {
  subtitleQueryKeys,
  useDeleteSubtitleExport,
} from "@/hooks/subtitle/use-subtitle-queries";
import type { TranscriptionStatus } from "@/hooks/subtitle/use-transcription-data";
import type {
  SubtitleChunk,
  TranscriptionData,
  VideoExportItem,
} from "@/remotion/types";

export const EDITOR_PARENTS = [{ label: "Subtitles", href: "/subtitle-editor" }];

const PANEL_CLASS = "max-w-3xl px-4 py-6 md:px-6";
const PREVIEW_CLASS =
  "border-t p-4 md:p-6 lg:sticky lg:top-[72px] lg:h-[calc(100svh-72px-1rem)] lg:self-start lg:border-t-0 lg:border-l";
const LAYOUT_CLASS =
  "grid grid-cols-1 lg:min-h-[calc(100svh-72px-1rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]";

interface StoredSettings {
  selectedPresetId?: string;
  sizePosition?: Partial<SizePositionValues>;
  titleOverlay?: Partial<TitleOverlayConfig>;
  watermarkOverlay?: Partial<WatermarkOverlayConfig>;
  previewStyle?: Partial<PreviewStyleConfig>;
}

function readSettings(project: TranscriptionData) {
  const stored = (project.editorSettings ?? {}) as StoredSettings;
  return {
    preset:
      SUBTITLE_PRESETS.find((p) => p.id === stored.selectedPresetId) ??
      SUBTITLE_PRESETS[0],
    sizePosition: { ...SIZE_POSITION_DEFAULTS, ...stored.sizePosition },
    titleOverlay: { ...TITLE_OVERLAY_DEFAULTS, ...stored.titleOverlay },
    watermarkOverlay: {
      ...WATERMARK_OVERLAY_DEFAULTS,
      ...stored.watermarkOverlay,
    },
    previewStyle: { ...PREVIEW_STYLE_DEFAULTS, ...stored.previewStyle },
  };
}

/**
 * The column holds either a chosen code ("en") or the detected language's
 * full name ("english").
 */
function readLanguage(stored: string | null | undefined): string {
  const value = stored?.toLowerCase();
  const match = TRANSCRIPTION_LANGUAGES.find(
    (l) => l.code === value || l.label.toLowerCase() === value,
  );
  return match?.code ?? "auto";
}

function projectDisplayTitle(project: TranscriptionData): string {
  return project.title || project.filename || "Untitled project";
}

interface SubtitleEditorProps {
  project: TranscriptionData;
  status: TranscriptionStatus;
  transcriptionError: string | null;
  isStarting: boolean;
  onStartTranscription: (options: {
    language: string;
    maxWordsPerChunk: number;
  }) => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onMaxWordsChange: (value: number) => void;
  onRefreshExports: () => Promise<void>;
}

/**
 * Editor for a loaded project. Style settings are read from the project once
 * on mount; after that this component owns them until Save.
 */
export function SubtitleEditor({
  project,
  status,
  transcriptionError,
  isStarting,
  onStartTranscription,
  onChunksChange,
  onMaxWordsChange,
  onRefreshExports,
}: SubtitleEditorProps) {
  const api = useSubtitleApi();
  const queryClient = useQueryClient();
  const deleteExport = useDeleteSubtitleExport();
  const { createProject, isCreating } = useCreateProject({ replace: true });

  const [initial] = useState(() => readSettings(project));
  const [title, setTitle] = useState(() => projectDisplayTitle(project));
  const [preset, setPreset] = useState<SubtitleStylePreset>(initial.preset);
  const [sizePosition, setSizePosition] = useState(initial.sizePosition);
  const [titleOverlay, setTitleOverlay] = useState(initial.titleOverlay);
  const [watermarkOverlay, setWatermarkOverlay] = useState(
    initial.watermarkOverlay,
  );
  const [previewStyle, setPreviewStyle] = useState(initial.previewStyle);
  const [language, setLanguage] = useState(() => readLanguage(project.language));

  const [activeTab, setActiveTab] = useState("edit");
  const [activeChunkIndex, setActiveChunkIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<VideoExportItem | null>(
    null,
  );
  const seekRef = useRef<((seconds: number) => void) | null>(null);

  const exportJob = useExportJob({ onSettled: () => void onRefreshExports() });

  const videoUrl = project.videoAsset?.url ?? null;
  const chunks = project.subtitleChunks;
  const exportCount = project.videoExports.length;

  const handleTimeUpdate = useCallback(
    (time: number) => {
      const index = chunks.findIndex((c) => time >= c.start && time <= c.end);
      setActiveChunkIndex(index);
    },
    [chunks],
  );

  const handleSeek = useCallback((seconds: number) => {
    seekRef.current?.(seconds);
  }, []);

  const currentSettings = () => ({
    selectedPresetId: preset.id,
    sizePosition,
    titleOverlay,
    watermarkOverlay,
    previewStyle,
  });

  const save = async () => {
    setIsSaving(true);
    const isTranscribing = status === "pending" || status === "processing";
    const result = await api.updateTranscription(project.id, {
      title,
      editorSettings: currentSettings(),
      // Don't overwrite the transcript the server is about to write.
      ...(isTranscribing
        ? {}
        : {
            subtitleChunks: chunks,
            maxWordsPerChunk: project.maxWordsPerChunk,
          }),
    });
    setIsSaving(false);
    if (!result.success) {
      toast.error(failureMessage("save your changes", result.error));
      return;
    }
    toast.success("Changes saved");
    void queryClient.invalidateQueries({
      queryKey: subtitleQueryKeys.projects(),
    });
  };

  const rename = async (next: string) => {
    const result = await api.updateTranscription(project.id, { title: next });
    if (!result.success) {
      toast.error(failureMessage("rename the project", result.error));
      return false;
    }
    setTitle(next);
    toast.success("Project renamed");
    void queryClient.invalidateQueries({
      queryKey: subtitleQueryKeys.projects(),
    });
    return true;
  };

  const startExport = async (fileName: string) => {
    if (!videoUrl) return;
    setExportName(fileName);
    setExportOpen(true);
    const { width, height } = getCompositionDimensions(
      previewStyle,
      project.width ?? 1080,
      project.height ?? 1920,
    );
    const queued = await exportJob.startExport({
      transcriptionId: project.id,
      videoUrl,
      subtitleChunks: chunks,
      style: { fileName, preset, ...currentSettings() },
      duration: project.duration ?? 0,
      width,
      height,
    });
    if (queued) void onRefreshExports();
  };

  const confirmDeleteExport = () => {
    if (!pendingDelete) return;
    deleteExport.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success("Export deleted");
        void onRefreshExports();
      },
      onError: (error) =>
        toast.error(failureMessage("delete the export", error)),
    });
  };

  return (
    <>
      <PageHeader
        parents={EDITOR_PARENTS}
        title={title}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Rename project"
              onClick={() => setRenameOpen(true)}
            >
              <PencilSimple />
            </Button>
            <Button
              variant="outline"
              onClick={save}
              disabled={isSaving}
            >
              {isSaving ? <Spinner /> : <FloppyDisk />}
              <span className="sr-only sm:not-sr-only">
                {isSaving ? "Saving…" : "Save"}
              </span>
            </Button>
            <ExportPopover
              defaultFileName={title}
              durationSeconds={project.duration ?? 0}
              onExport={startExport}
              disabled={exportJob.isExporting || !videoUrl}
            />
          </>
        }
      />

      <div className={LAYOUT_CLASS}>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(String(value))}
          className="min-w-0 gap-0"
        >
          <div className="sticky top-14 z-20 border-b bg-background">
            <div className="overflow-x-auto px-4 pt-1 pb-0.5 md:px-6">
              <TabsList variant="line">
                <TabsTrigger value="style">
                  <Palette />
                  Style
                </TabsTrigger>
                <TabsTrigger value="edit">
                  <Subtitles />
                  Edit subtitles
                </TabsTrigger>
                <TabsTrigger value="title">
                  <TextT />
                  Title
                </TabsTrigger>
                <TabsTrigger value="watermark">
                  <Drop />
                  Watermark
                </TabsTrigger>
                <TabsTrigger value="preview-style">
                  <FrameCorners />
                  Preview style
                </TabsTrigger>
                <TabsTrigger value="exports">
                  <DownloadSimple />
                  Exports
                  {exportCount > 0 ? (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {exportCount}
                    </span>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="style" className={PANEL_CLASS}>
            <StyleSubtitlesTab
              selectedPresetId={preset.id}
              onSelectPreset={setPreset}
              sizePosition={sizePosition}
              onSizePositionChange={setSizePosition}
            />
          </TabsContent>
          <TabsContent value="edit" className={PANEL_CLASS}>
            <EditSubtitlesTab
              hasVideo={Boolean(videoUrl)}
              status={status}
              transcriptionError={transcriptionError}
              chunks={chunks}
              isStarting={isStarting}
              activeChunkIndex={activeChunkIndex}
              language={language}
              onLanguageChange={setLanguage}
              maxWordsPerChunk={project.maxWordsPerChunk}
              onMaxWordsChange={onMaxWordsChange}
              onStartTranscription={() =>
                onStartTranscription({
                  language,
                  maxWordsPerChunk: project.maxWordsPerChunk,
                })
              }
              onChunksChange={onChunksChange}
              onSeek={handleSeek}
            />
          </TabsContent>
          <TabsContent value="title" className={PANEL_CLASS}>
            <EditTitleTab config={titleOverlay} onChange={setTitleOverlay} />
          </TabsContent>
          <TabsContent value="watermark" className={PANEL_CLASS}>
            <EditWatermarkTab
              config={watermarkOverlay}
              onChange={setWatermarkOverlay}
            />
          </TabsContent>
          <TabsContent value="preview-style" className={PANEL_CLASS}>
            <PreviewStyleTab config={previewStyle} onChange={setPreviewStyle} />
          </TabsContent>
          <TabsContent value="exports" className={PANEL_CLASS}>
            <ExportsTab
              exports={project.videoExports}
              onDelete={setPendingDelete}
            />
          </TabsContent>
        </Tabs>

        <aside aria-label="Preview" className={PREVIEW_CLASS}>
          <div className="h-[70svh] lg:h-full">
            <VideoPreview
              videoUrl={videoUrl}
              durationSeconds={project.duration ?? 0}
              subtitleChunks={chunks}
              selectedPreset={preset}
              sizePosition={sizePosition}
              titleOverlay={titleOverlay}
              watermarkOverlay={watermarkOverlay}
              previewStyle={previewStyle}
              onUploadVideo={() => setUploadOpen(true)}
              onTimeUpdate={handleTimeUpdate}
              seekRef={seekRef}
            />
          </div>
        </aside>
      </div>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentTitle={title}
        onRename={rename}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onVideoUploaded={createProject}
        isCreating={isCreating}
      />

      <DeleteDialog
        open={pendingDelete !== null}
        title="Delete this export?"
        description="The exported video is deleted for good. The project stays."
        isDeleting={deleteExport.isPending}
        onConfirm={confirmDeleteExport}
        onCancel={() => setPendingDelete(null)}
      />

      <ExportProgressDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onClosed={exportJob.reset}
        status={exportJob.status}
        progress={exportJob.progress}
        error={exportJob.error}
        creditsUsed={exportJob.creditsUsed}
        videoUrl={exportJob.videoUrl}
        fileName={exportName}
      />
    </>
  );
}

function RenameDialog({
  open,
  onOpenChange,
  currentTitle,
  onRename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  onRename: (title: string) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
        </DialogHeader>
        {/* Mounted per opening, so the field starts from the current title. */}
        <RenameForm
          currentTitle={currentTitle}
          onRename={async (next) => {
            if (await onRename(next)) onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  currentTitle,
  onRename,
}: {
  currentTitle: string;
  onRename: (title: string) => Promise<void>;
}) {
  const inputId = useId();
  const [value, setValue] = useState(currentTitle);
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = value.trim();

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!trimmed || trimmed === currentTitle) return;
        setIsSaving(true);
        await onRename(trimmed);
        setIsSaving(false);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={inputId}>Name</Label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          maxLength={120}
        />
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          disabled={isSaving || !trimmed || trimmed === currentTitle}
        >
          {isSaving ? <Spinner /> : null}
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Placeholder shaped like the editor while the project loads. */
export function SubtitleEditorSkeleton() {
  return (
    <div className={LAYOUT_CLASS} aria-busy>
      <div className="min-w-0">
        <div className="flex gap-4 border-b px-4 py-2.5 md:px-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-20" />
          ))}
        </div>
        <div className={`${PANEL_CLASS} space-y-3`}>
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className={PREVIEW_CLASS}>
        <div className="flex h-[70svh] flex-col gap-3 lg:h-full">
          <Skeleton className="mx-auto min-h-0 w-full max-w-sm flex-1 rounded-lg" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}
