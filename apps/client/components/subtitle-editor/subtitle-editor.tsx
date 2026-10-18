"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DownloadSimple,
  Drop,
  FloppyDisk,
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
import { EditTitleTab } from "@/components/subtitle-editor/tabs/edit-title-tab";
import { normalizeTitleOverlay } from "@/components/subtitle-editor/title-overlay";
import {
  EditWatermarkTab,
  WATERMARK_OVERLAY_DEFAULTS,
  type WatermarkOverlayConfig,
} from "@/components/subtitle-editor/tabs/edit-watermark-tab";
import { ExportsTab } from "@/components/subtitle-editor/tabs/exports-tab";
import {
  PREVIEW_STYLE_DEFAULTS,
  getCompositionDimensions,
  type PreviewStyleConfig,
} from "@/components/subtitle-editor/tabs/preview-style-tab";
import {
  SIZE_POSITION_DEFAULTS,
  StyleSubtitlesTab,
  type SizePositionValues,
} from "@/components/subtitle-editor/tabs/style-subtitles-tab";
import { UploadDialog } from "@/components/subtitle-editor/upload-dialog";
import {
  VideoPreview,
  type SeekFn,
} from "@/components/subtitle-editor/video-preview";
import { useCreateProject } from "@/hooks/subtitle/use-create-project";
import { useExportJob } from "@/hooks/subtitle/use-export-job";
import { useSubtitleApi } from "@/hooks/subtitle/use-subtitle-api";
import {
  subtitleQueryKeys,
  useDeleteSubtitleExport,
} from "@/hooks/subtitle/use-subtitle-queries";
import type { TranscriptionStatus } from "@/hooks/subtitle/use-transcription-data";
import { cn } from "@/lib/utils";
import type {
  SubtitleChunk,
  TranscriptionData,
  VideoExportItem,
} from "@/remotion/types";

export const EDITOR_PARENTS = [{ label: "Subtitles", href: "/subtitle-editor" }];

/** Two cards side by side on large screens; each scrolls on its own. */
const LAYOUT_CLASS =
  "grid grid-cols-1 gap-4 p-4 md:p-6 lg:h-[calc(100svh-5.5rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]";
const CARD_CLASS = "min-h-0 min-w-0 overflow-hidden rounded-2xl border bg-card";
const PANEL_CLASS = "mx-auto w-full max-w-3xl px-4 py-5 md:px-6";
const PREVIEW_CLASS = cn(CARD_CLASS, "p-4 md:p-5");
/** Vertical menu items; a scrolling row on small screens. */
const NAV_ITEM_CLASS =
  "h-9 flex-none justify-start px-3 after:hidden data-active:bg-muted! data-active:text-foreground max-md:w-auto!";

interface StoredSettings {
  selectedPresetId?: string;
  /** The selected preset with any customizations. */
  preset?: SubtitleStylePreset;
  sizePosition?: Partial<SizePositionValues>;
  titleOverlay?: unknown;
  watermarkOverlay?: Partial<WatermarkOverlayConfig>;
  previewStyle?: Partial<PreviewStyleConfig>;
}

function readSettings(project: TranscriptionData) {
  const stored = (project.editorSettings ?? {}) as StoredSettings;
  const previewStyle = { ...PREVIEW_STYLE_DEFAULTS, ...stored.previewStyle };
  return {
    preset:
      stored.preset && stored.preset.id === stored.selectedPresetId
        ? stored.preset
        : (SUBTITLE_PRESETS.find((p) => p.id === stored.selectedPresetId) ??
          SUBTITLE_PRESETS[0]),
    sizePosition: { ...SIZE_POSITION_DEFAULTS, ...stored.sizePosition },
    titleOverlay: normalizeTitleOverlay(
      stored.titleOverlay,
      getCompositionDimensions(
        previewStyle,
        project.width ?? 1080,
        project.height ?? 1920,
      ),
    ),
    watermarkOverlay: {
      ...WATERMARK_OVERLAY_DEFAULTS,
      ...stored.watermarkOverlay,
    },
    previewStyle,
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
  onStartTranscription: (options: { language: string }) => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
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
  const seekRef = useRef<SeekFn | null>(null);

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

  const handlePlayFrom = useCallback((seconds: number) => {
    seekRef.current?.(seconds, { preview: true });
  }, []);

  const currentSettings = () => ({
    selectedPresetId: preset.id,
    preset,
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
        : { subtitleChunks: chunks }),
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

  const generateHook = async (previousHooks: string[]) => {
    const result = await api.generateHookTitle(project.id, previousHooks);
    if (!result.success || !result.data) {
      toast.error(failureMessage("write a hook", result.error));
      return null;
    }
    return result.data.hook;
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
      style: { fileName, ...currentSettings() },
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
          orientation="vertical"
          value={activeTab}
          onValueChange={(value) => setActiveTab(String(value))}
          className={cn(CARD_CLASS, "flex-col gap-0 md:flex-row")}
        >
          <TabsList
            variant="line"
            aria-label="Editor sections"
            className="h-auto! w-full shrink-0 justify-start overflow-x-auto border-b p-2 max-md:flex-row! md:w-48 md:items-stretch md:border-r md:border-b-0 md:p-3"
          >
            <TabsTrigger value="style" className={NAV_ITEM_CLASS}>
              <Palette />
              Style
            </TabsTrigger>
            <TabsTrigger value="edit" className={NAV_ITEM_CLASS}>
              <Subtitles />
              Subtitles
            </TabsTrigger>
            <TabsTrigger value="title" className={NAV_ITEM_CLASS}>
              <TextT />
              Hook title
            </TabsTrigger>
            <TabsTrigger value="watermark" className={NAV_ITEM_CLASS}>
              <Drop />
              Watermark
            </TabsTrigger>
            <TabsTrigger value="exports" className={NAV_ITEM_CLASS}>
              <DownloadSimple />
              Exports
              {exportCount > 0 ? (
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {exportCount}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="style" className={PANEL_CLASS}>
            <StyleSubtitlesTab
              preset={preset}
              onPresetChange={setPreset}
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
              onStartTranscription={(options) => {
                setLanguage(options.language);
                onStartTranscription(options);
              }}
              onChunksChange={onChunksChange}
              onSeek={handleSeek}
              onPlayFrom={handlePlayFrom}
            />
          </TabsContent>
          <TabsContent value="title" className={PANEL_CLASS}>
            <EditTitleTab
              config={titleOverlay}
              onChange={setTitleOverlay}
              onGenerate={generateHook}
              canGenerate={Boolean(project.text?.trim())}
            />
          </TabsContent>
          <TabsContent value="watermark" className={PANEL_CLASS}>
            <EditWatermarkTab
              config={watermarkOverlay}
              onChange={setWatermarkOverlay}
            />
          </TabsContent>
          <TabsContent value="exports" className={PANEL_CLASS}>
            <ExportsTab
              exports={project.videoExports}
              onDelete={setPendingDelete}
            />
          </TabsContent>
          </div>
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
              onSizePositionChange={setSizePosition}
              onTitleOverlayChange={setTitleOverlay}
              onPreviewStyleChange={setPreviewStyle}
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
      <div className={cn(CARD_CLASS, "flex flex-col md:flex-row")}>
        <div className="flex shrink-0 gap-2 border-b p-2 md:w-48 md:flex-col md:border-r md:border-b-0 md:p-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24 md:w-full" />
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
