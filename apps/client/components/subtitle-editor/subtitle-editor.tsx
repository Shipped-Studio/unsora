"use client";

import { useState } from "react";
import {
  DownloadSimple,
  Drop,
  FilmStrip,
  FloppyDisk,
  Palette,
  PencilSimple,
  Sparkle,
  Subtitles,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CaptionLayout } from "@/components/subtitle-editor/caption-layout";
import { presetLayout } from "@/components/subtitle-editor/caption-style";
import { CaptionsEditorProvider } from "@/components/subtitle-editor/captions/captions-context";
import { DeleteDialog } from "@/components/subtitle-editor/delete-dialog";
import { readLanguage } from "@/components/subtitle-editor/editor/read-settings";
import { RecutLinesDialog } from "@/components/subtitle-editor/editor/recut-lines-dialog";
import { RenameDialog } from "@/components/subtitle-editor/editor/rename-dialog";
import { useAiTools } from "@/components/subtitle-editor/editor/use-ai-tools";
import { useCaptionTools } from "@/components/subtitle-editor/editor/use-caption-tools";
import { useEditorSettings } from "@/components/subtitle-editor/editor/use-editor-settings";
import { useExports } from "@/components/subtitle-editor/editor/use-exports";
import { usePlayback } from "@/components/subtitle-editor/editor/use-playback";
import { useProjectActions } from "@/components/subtitle-editor/editor/use-project-actions";
import {
  ExportPopover,
  ExportProgressDialog,
} from "@/components/subtitle-editor/export-video";
import { AiToolsTab } from "@/components/subtitle-editor/tabs/ai-tools-tab";
import { BrollsTab } from "@/components/subtitle-editor/tabs/brolls-tab";
import { CaptionsTab } from "@/components/subtitle-editor/tabs/edit-subtitles-tab";
import { HookTitleEditor } from "@/components/subtitle-editor/tabs/edit-title-tab";
import { EditWatermarkTab } from "@/components/subtitle-editor/tabs/edit-watermark-tab";
import { ExportsTab } from "@/components/subtitle-editor/tabs/exports-tab";
import { StyleSubtitlesTab } from "@/components/subtitle-editor/tabs/style-subtitles-tab";
import { UploadDialog } from "@/components/subtitle-editor/upload-dialog";
import { VideoPreview } from "@/components/subtitle-editor/video-preview";
import { useCreateProject } from "@/hooks/subtitle/use-create-project";
import { useSubtitleApi, type CaptionScene } from "@/hooks/subtitle/use-subtitle-api";
import type { TranscriptionStatus } from "@/hooks/subtitle/use-transcription-data";
import { cn } from "@/lib/utils";
import type { AiToolState, SubtitleChunk, TranscriptionData } from "@/remotion/types";

export const EDITOR_PARENTS = [{ label: "Subtitles", href: "/subtitle-editor" }];

/** Editor and preview side by side on large screens; each scrolls on its own. */
const LAYOUT_CLASS =
  "grid grid-cols-1 lg:h-[calc(100svh-5.5rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]";
const CARD_CLASS = "min-h-0 min-w-0 overflow-hidden";
const PANEL_CLASS = "mx-auto w-full max-w-3xl px-4 py-5 md:px-6";
const PREVIEW_CLASS = cn(CARD_CLASS, "border-t p-4 md:p-5 lg:border-t-0 lg:border-l");
/** Vertical menu items; a scrolling row on small screens. */
const NAV_ITEM_CLASS =
  "h-9 flex-none justify-start px-3 after:hidden data-active:bg-muted! data-active:text-foreground max-md:w-auto!";

interface SubtitleEditorProps {
  project: TranscriptionData;
  status: TranscriptionStatus;
  transcriptionError: string | null;
  isStarting: boolean;
  onStartTranscription: (options: { language: string; layout: CaptionLayout }) => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onRefreshExports: () => Promise<void>;
  aiTools: Record<string, AiToolState>;
  onRunAiTool: (tool: string) => Promise<{ scenes?: CaptionScene[] } | null>;
  onRemoveAiTool: (tool: string) => Promise<boolean>;
}

/**
 * Editor for a loaded project: the tabs on the left, the live preview on the
 * right. The logic lives in the `editor/use-*` hooks; this lays out the screen.
 */
export function SubtitleEditor({
  project,
  status,
  transcriptionError,
  isStarting,
  onStartTranscription,
  onChunksChange,
  onRefreshExports,
  aiTools,
  onRunAiTool,
  onRemoveAiTool,
}: SubtitleEditorProps) {
  const chunks = project.subtitleChunks;
  const videoUrl = project.videoAsset?.url ?? null;
  const isTranscribing = status === "pending" || status === "processing";
  const hasTranscript = Boolean(project.text?.trim());

  const api = useSubtitleApi();
  const { createProject, isCreating } = useCreateProject({ replace: true });
  const settings = useEditorSettings(project);
  const playback = usePlayback(chunks);
  const actions = useProjectActions({ project, chunks, settings, isTranscribing });
  const exports = useExports({ project, chunks, settings, onRefreshExports });
  const captionTools = useCaptionTools({
    project,
    chunks,
    onChunksChange,
    settings,
    isTranscribing,
  });

  const [language, setLanguage] = useState(() => readLanguage(project.language));
  const [activeTab, setActiveTab] = useState("edit");
  /** The Captions tab shows the transcript, or the hook title editor. */
  const [captionsView, setCaptionsView] = useState<"captions" | "hook">("captions");
  const [renameOpen, setRenameOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const openCaptions = (view: "captions" | "hook") => {
    setCaptionsView(view);
    setActiveTab("edit");
  };

  /** Transcribes in `nextLanguage`, cutting lines for the current template. */
  const startTranscription = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    captionTools.forgetKeepLines();
    onStartTranscription({ language: nextLanguage, layout: presetLayout(settings.preset) });
  };

  const aiToolsTab = useAiTools({
    project,
    chunks,
    onChunksChange,
    settings,
    isTranscribing,
    aiTools,
    onRunAiTool,
    onRemoveAiTool,
    save: actions.save,
    generateHook: actions.generateHook,
    onStartTranscription: () => startTranscription(language),
    onOpenTab: setActiveTab,
    onOpenCaptions: openCaptions,
  });

  return (
    <>
      <PageHeader
        parents={EDITOR_PARENTS}
        title={actions.title}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={actions.isTitling || !hasTranscript}
              onClick={actions.writeTitle}
            >
              {actions.isTitling ? <Spinner /> : <Sparkle />}
              AI title
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Rename project"
              onClick={() => setRenameOpen(true)}
            >
              <PencilSimple />
            </Button>
            <Button variant="outline" onClick={() => void actions.save()} disabled={actions.isSaving}>
              {actions.isSaving ? <Spinner /> : <FloppyDisk />}
              <span className="sr-only sm:not-sr-only">
                {actions.isSaving ? "Saving…" : "Save"}
              </span>
            </Button>
            <ExportPopover
              defaultFileName={actions.title}
              durationSeconds={project.duration ?? 0}
              onExport={exports.start}
              disabled={exports.job.isExporting || !videoUrl}
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
              Captions
            </TabsTrigger>
            <TabsTrigger value="ai" className={NAV_ITEM_CLASS}>
              <Sparkle />
              AI Tools
            </TabsTrigger>
            <TabsTrigger value="brolls" className={NAV_ITEM_CLASS}>
              <FilmStrip />
              B-rolls
            </TabsTrigger>
            <TabsTrigger value="watermark" className={NAV_ITEM_CLASS}>
              <Drop />
              Watermark
            </TabsTrigger>
            <TabsTrigger value="exports" className={NAV_ITEM_CLASS}>
              <DownloadSimple />
              Exports
              {project.videoExports.length > 0 ? (
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {project.videoExports.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="style" className={PANEL_CLASS}>
              <StyleSubtitlesTab
                preset={settings.preset}
                onPresetChange={captionTools.changePreset}
                placement={settings.placement}
                onPlacementChange={settings.setPlacement}
                previewStyle={settings.previewStyle}
                onPreviewStyleChange={settings.setPreviewStyle}
              />
            </TabsContent>

            <TabsContent value="edit" className={PANEL_CLASS}>
              {captionsView === "hook" ? (
                <HookTitleEditor
                  config={settings.titleOverlay}
                  onChange={settings.setTitleOverlay}
                  onGenerate={actions.generateHook}
                  canGenerate={hasTranscript}
                  getCurrentTime={playback.getCurrentTime}
                  onBack={() => setCaptionsView("captions")}
                />
              ) : (
                <CaptionsEditorProvider
                  chunks={chunks}
                  onChunksChange={onChunksChange}
                  onSeek={playback.seek}
                  preset={settings.preset}
                  placement={settings.placement}
                >
                  <CaptionsTab
                    hasVideo={Boolean(videoUrl)}
                    status={status}
                    transcriptionError={transcriptionError}
                    isStarting={isStarting}
                    activeLineIndex={playback.activeLineIndex}
                    activeWord={playback.activeWord}
                    language={language}
                    onStartTranscription={(options) => startTranscription(options.language)}
                    accuracy={captionTools.accuracy}
                    busy={captionTools.busy}
                    onOptimize={captionTools.optimize}
                    onRegenerateEmojis={captionTools.regenerateEmojis}
                    onTranslate={captionTools.translate}
                    onOpenHookTitle={() => setCaptionsView("hook")}
                  />
                </CaptionsEditorProvider>
              )}
            </TabsContent>

            <TabsContent value="ai" className={PANEL_CLASS}>
              <AiToolsTab groups={aiToolsTab.groups} />
            </TabsContent>

            <TabsContent value="brolls" className={PANEL_CLASS}>
              <BrollsTab
                api={api}
                projectId={project.id}
                videoUrl={videoUrl}
                chunks={chunks}
                duration={project.duration ?? 0}
                currentTime={chunks[playback.activeLineIndex]?.start ?? -1}
                orientation={settings.orientation}
                scenes={settings.scenes}
                onScenesChange={settings.setScenes}
                timeline={settings.timeline}
                onTimelineChange={settings.setTimeline}
                zooms={settings.previewStyle.zooms ?? []}
                onZoomsChange={(zooms) =>
                  settings.setPreviewStyle({
                    ...settings.previewStyle,
                    zooms: zooms.length ? zooms : undefined,
                  })
                }
                defaultLayout={settings.previewStyle.brollLayout}
                onAutoZooms={aiToolsTab.activateZooms}
                onOpenHookTitle={() => openCaptions("hook")}
                onSeek={playback.seek}
              />
            </TabsContent>

            <TabsContent value="watermark" className={PANEL_CLASS}>
              <EditWatermarkTab
                config={settings.watermarkOverlay}
                onChange={settings.setWatermarkOverlay}
              />
            </TabsContent>

            <TabsContent value="exports" className={PANEL_CLASS}>
              <ExportsTab exports={project.videoExports} onDelete={exports.setPendingDelete} />
            </TabsContent>
          </div>
        </Tabs>

        <aside aria-label="Preview" className={PREVIEW_CLASS}>
          <div className="h-[70svh] lg:h-full">
            <VideoPreview
              videoUrl={videoUrl}
              durationSeconds={project.duration ?? 0}
              subtitleChunks={chunks}
              selectedPreset={settings.preset}
              placement={settings.placement}
              titleOverlay={settings.titleOverlay}
              watermarkOverlay={settings.watermarkOverlay}
              previewStyle={settings.previewStyle}
              timeline={settings.timeline}
              onPlacementChange={settings.setPlacement}
              onTitleOverlayChange={settings.setTitleOverlay}
              onTimelineChange={settings.setTimeline}
              onPreviewStyleChange={settings.setPreviewStyle}
              onUploadVideo={() => setUploadOpen(true)}
              onTimeUpdate={playback.onTimeUpdate}
              seekRef={playback.seekRef}
            />
          </div>
        </aside>
      </div>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentTitle={actions.title}
        onRename={actions.rename}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onVideoUploaded={createProject}
        isCreating={isCreating}
      />

      <DeleteDialog
        open={exports.pendingDelete !== null}
        title="Delete this export?"
        description="The exported video is deleted for good. The project stays."
        isDeleting={exports.isDeleting}
        onConfirm={exports.confirmDelete}
        onCancel={() => exports.setPendingDelete(null)}
      />

      <RecutLinesDialog
        preset={captionTools.pendingRecut.preset}
        onRecut={captionTools.pendingRecut.recut}
        onKeepLines={captionTools.pendingRecut.keepLines}
        onCancel={captionTools.pendingRecut.cancel}
      />

      <ExportProgressDialog
        open={exports.progressOpen}
        onOpenChange={exports.setProgressOpen}
        onClosed={exports.job.reset}
        status={exports.job.status}
        progress={exports.job.progress}
        error={exports.job.error}
        creditsUsed={exports.job.creditsUsed}
        videoUrl={exports.job.videoUrl}
        fileName={exports.fileName}
      />
    </>
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
