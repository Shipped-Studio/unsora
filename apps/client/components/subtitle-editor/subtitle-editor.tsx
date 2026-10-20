"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DownloadSimple,
  Drop,
  FloppyDisk,
  FilmStrip,
  Palette,
  Sparkle,
  PencilSimple,
  Subtitles,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  attachPunctuation,
  resplitChunks,
  sameCaptionCuts,
  type CaptionLayout,
} from "@/components/subtitle-editor/caption-layout";
import {
  CAPTION_PLACEMENT_LIMITS,
  DEFAULT_CAPTION_WIDTH,
  presetLayout,
  presetPlacement,
  timelineDuration,
  EMPTY_TIMELINE,
  type CaptionPlacement,
  type Timeline,
  type TransitionId,
  type ZoomStyle,
} from "@/components/subtitle-editor/caption-style";

// An AI zoom eases back within this long, however long its scene is.
const AUTO_ZOOM_SECONDS = 2.5;
import {
  applyCaptionMarkup,
  replaceLineWords,
} from "@/components/subtitle-editor/chunk-edits";
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
  CaptionsTab,
  TRANSCRIPTION_LANGUAGES,
} from "@/components/subtitle-editor/tabs/edit-subtitles-tab";
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
import { StyleSubtitlesTab } from "@/components/subtitle-editor/tabs/style-subtitles-tab";
import { BrollsTab } from "@/components/subtitle-editor/tabs/brolls-tab";
import {
  AI_TOOL_ICONS,
  AiToolsTab,
  type AiToolRow,
} from "@/components/subtitle-editor/tabs/ai-tools-tab";
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
  AiToolState,
  SubtitleChunk,
  TranscriptionData,
  VideoExportItem,
} from "@/remotion/types";
import type { CaptionScene } from "@/hooks/subtitle/use-subtitle-api";

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

interface StoredSettings {
  selectedPresetId?: string;
  /** The selected preset with any customizations. */
  preset?: SubtitleStylePreset;
  placement?: Partial<CaptionPlacement>;
  /** Projects saved before placement: pixels, measured from the bottom. */
  sizePosition?: { fontSize?: number; xAxis?: number; yAxis?: number; width?: number };
  titleOverlay?: unknown;
  watermarkOverlay?: Partial<WatermarkOverlayConfig>;
  previewStyle?: Partial<PreviewStyleConfig>;
  /** AI scenes, from AI Auto Zooms or the B-rolls tab. */
  scenes?: CaptionScene[];
  timeline?: Partial<Timeline>;
}

const clampTo = (n: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, n));

/** The project's template; older saves get today's version of their look. */
function readPreset(stored: StoredSettings): SubtitleStylePreset {
  const builtIn = SUBTITLE_PRESETS.find((p) => p.id === stored.selectedPresetId);
  const saved =
    stored.preset && stored.preset.id === stored.selectedPresetId
      ? stored.preset
      : undefined;
  if (saved?.position) return saved;
  return builtIn ?? (saved ? { ...SUBTITLE_PRESETS[0], ...saved } : SUBTITLE_PRESETS[0]);
}

function readPlacement(
  stored: StoredSettings,
  preset: SubtitleStylePreset,
  frameWidth: number,
): CaptionPlacement {
  if (stored.placement) {
    return { ...presetPlacement(preset), ...stored.placement };
  }
  const old = stored.sizePosition;
  if (!old) return presetPlacement(preset);
  const limits = CAPTION_PLACEMENT_LIMITS;
  return {
    size: clampTo(((old.fontSize ?? 43) * 540) / frameWidth, limits.size),
    x: clampTo(50 + (old.xAxis ?? 0), limits.x),
    // The old value was the distance of the text's bottom from the frame's.
    y: clampTo(97 - (old.yAxis ?? 20), limits.y),
    width: old.width
      ? clampTo((old.width / frameWidth) * 100, limits.width)
      : DEFAULT_CAPTION_WIDTH,
  };
}

function readSettings(project: TranscriptionData) {
  const stored = (project.editorSettings ?? {}) as StoredSettings;
  const previewStyle = { ...PREVIEW_STYLE_DEFAULTS, ...stored.previewStyle };
  const frame = getCompositionDimensions(
    previewStyle,
    project.width ?? 1080,
    project.height ?? 1920,
  );
  const preset = readPreset(stored);
  return {
    preset,
    placement: readPlacement(stored, preset, frame.width),
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
    scenes: Array.isArray(stored.scenes) ? stored.scenes : [],
    timeline: { ...EMPTY_TIMELINE, ...stored.timeline },
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
    layout: CaptionLayout;
  }) => void;
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  onRefreshExports: () => Promise<void>;
  aiTools: Record<string, AiToolState>;
  onRunAiTool: (tool: string) => Promise<{ scenes?: CaptionScene[] } | null>;
  onRemoveAiTool: (tool: string) => Promise<boolean>;
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
  aiTools,
  onRunAiTool,
  onRemoveAiTool,
}: SubtitleEditorProps) {
  const api = useSubtitleApi();
  const queryClient = useQueryClient();
  const deleteExport = useDeleteSubtitleExport();
  const { createProject, isCreating } = useCreateProject({ replace: true });

  const [initial] = useState(() => readSettings(project));
  const [title, setTitle] = useState(() => projectDisplayTitle(project));
  const [preset, setPreset] = useState<SubtitleStylePreset>(initial.preset);
  const [placement, setPlacement] = useState(initial.placement);
  const [titleOverlay, setTitleOverlay] = useState(initial.titleOverlay);
  const [watermarkOverlay, setWatermarkOverlay] = useState(
    initial.watermarkOverlay,
  );
  const [previewStyle, setPreviewStyle] = useState(initial.previewStyle);
  const [language, setLanguage] = useState(() => readLanguage(project.language));

  const [activeTab, setActiveTab] = useState("edit");
  const [activeChunkIndex, setActiveChunkIndex] = useState(-1);
  const [activeWord, setActiveWord] = useState<{ c: number; w: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<VideoExportItem | null>(
    null,
  );
  const seekRef = useRef<SeekFn | null>(null);
  // Set once the user chooses to keep hand-edited lines over a style's cut.
  const [keepLines, setKeepLines] = useState(false);
  const [pendingPreset, setPendingPreset] =
    useState<SubtitleStylePreset | null>(null);
  const currentTimeRef = useRef(0);
  const [captionsView, setCaptionsView] = useState<"captions" | "hook">("captions");
  const [scenes, setScenes] = useState<CaptionScene[]>(initial.scenes);
  const [timeline, setTimeline] = useState<Timeline>(initial.timeline);

  const exportJob = useExportJob({ onSettled: () => void onRefreshExports() });

  const videoUrl = project.videoAsset?.url ?? null;
  const chunks = project.subtitleChunks;
  const exportCount = project.videoExports.length;

  const isTranscribing = status === "pending" || status === "processing";

  /** Older transcripts have no punctuation on their words; it's read from the text. */
  const withPunctuation = (list: SubtitleChunk[]): SubtitleChunk[] => {
    if (list.some((c) => c.words.some((w) => w.punctuation !== undefined))) {
      return list;
    }
    const words = attachPunctuation(
      list.flatMap((c) => c.words),
      project.text ?? "",
    );
    let index = 0;
    return list.map((chunk) => ({
      ...chunk,
      words: chunk.words.map(() => words[index++]),
    }));
  };

  const recut = (list: SubtitleChunk[], layout: CaptionLayout) =>
    resplitChunks(withPunctuation(list), layout);

  /** True when the lines are exactly as `layout` would cut them. */
  const linesUntouched = (layout: CaptionLayout) =>
    sameCaptionCuts(chunks, recut(chunks, layout));

  const changePreset = (next: SubtitleStylePreset) => {
    // A different template brings its own size and position, as in Submagic.
    if (next.id !== preset.id) {
      setPlacement(presetPlacement(next, placement.width));
    }
    const before = presetLayout(preset);
    const after = presetLayout(next);
    const layoutChanged = JSON.stringify(before) !== JSON.stringify(after);
    if (!layoutChanged || keepLines || isTranscribing || !chunks.length) {
      setPreset(next);
      return;
    }
    if (linesUntouched(before)) {
      setPreset(next);
      onChunksChange(recut(chunks, after));
      return;
    }
    setPendingPreset(next);
  };

  /** Re-runs the AI emoji picks; a transcript with no highlights gets those too. */
  const regenerateEmojis = async () => {
    const words = chunks.flatMap((c) => c.words.map((w) => w.word));
    if (!words.length) return;
    const untouched = !keepLines && linesUntouched(presetLayout(preset));
    const result = await api.findCaptionKeywords(project.id, words);
    if (!result.success || !result.data) {
      toast.error(failureMessage("pick emojis", result.error));
      return;
    }
    const hasHighlights = chunks.some((c) => c.words.some((w) => w.keyword));
    const current = chunks.flatMap((c) => c.words);
    const marked = applyCaptionMarkup(chunks, {
      emojis: result.data.emojis,
      keywords: hasHighlights
        ? current.flatMap((w, index) => (w.keyword ? [{ index, level: w.keyword }] : []))
        : result.data.keywords,
    });
    // Solo keywords depend on highlights, so untouched lines are re-cut.
    onChunksChange(
      untouched && !hasHighlights ? recut(marked, presetLayout(preset)) : marked,
    );
    toast.success(`Picked ${result.data.emojis.length} emojis`);
  };

  const optimize = async () => {
    const result = await api.optimizeCaptions(
      project.id,
      chunks.map((c) => c.words.map((w) => w.word)),
    );
    if (!result.success || !result.data) {
      toast.error(failureMessage("optimize the captions", result.error));
      return;
    }
    const before = chunks.map((c) => c.words.map((w) => w.word).join(" "));
    const changed = result.data.lines.filter((line, i) => line.join(" ") !== before[i]).length;
    onChunksChange(replaceLineWords(chunks, result.data.lines));
    toast.success(
      changed
        ? `Fixed ${changed} ${changed === 1 ? "line" : "lines"}`
        : "No mistakes found",
    );
  };

  const translate = async (targetLanguage: string) => {
    const result = await api.translateCaptions(
      project.id,
      targetLanguage,
      chunks.map((c) => c.words.map((w) => w.word).join(" ")),
    );
    if (!result.success || !result.data) {
      toast.error(failureMessage("translate the captions", result.error));
      return false;
    }
    const translated = replaceLineWords(
      chunks,
      result.data.lines.map((line) => line.split(/\s+/)),
    ).map((chunk) => ({
      ...chunk,
      // The highlights and emojis were for the old words.
      words: chunk.words.map((word) => {
        const fresh = { ...word };
        delete fresh.keyword;
        delete fresh.emoji;
        delete fresh.punctuation;
        return fresh;
      }),
    }));
    onChunksChange(recut(translated, presetLayout(preset)));
    toast.success(`Translated to ${targetLanguage}`);
    return true;
  };

  // Whisper's confidence, weighted by how long each segment is.
  const accuracy = (() => {
    const scored = (project.segments ?? []).filter(
      (s) => typeof s.confidence === "number",
    );
    const total = scored.reduce((n, s) => n + (s.end - s.start), 0);
    if (!total) return null;
    return (
      (scored.reduce((n, s) => n + s.confidence! * (s.end - s.start), 0) / total) * 100
    );
  })();

  const handleTimeUpdate = useCallback(
    (time: number) => {
      currentTimeRef.current = time;
      const index = chunks.findIndex((c) => time >= c.start && time < c.end);
      setActiveChunkIndex(index);
      const w = index < 0 ? -1 : chunks[index].words.findIndex((x) => time >= x.start && time < x.end);
      setActiveWord((prev) =>
        w < 0 ? null : prev?.c === index && prev.w === w ? prev : { c: index, w },
      );
    },
    [chunks],
  );

  const handleSeek = useCallback((seconds: number) => {
    seekRef.current?.(seconds);
  }, []);


  const currentSettings = () => ({
    selectedPresetId: preset.id,
    preset,
    placement,
    titleOverlay,
    watermarkOverlay,
    previewStyle,
    scenes,
    timeline,
  });

  /** Saves the project; `quiet` skips the toast. Resolves true when saved. */
  const save = async (quiet = false) => {
    setIsSaving(true);
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
      return false;
    }
    if (!quiet) toast.success("Changes saved");
    void queryClient.invalidateQueries({
      queryKey: subtitleQueryKeys.projects(),
    });
    return true;
  };

  // AI Tools ---------------------------------------------------------------

  const toolState = (tool: string): Pick<AiToolRow, "status" | "note"> => {
    const state = aiTools[tool];
    if (!state) return { status: "inactive" };
    if (state.status === "running") return { status: "running" };
    if (state.status === "failed") return { status: "failed", note: state.error };
    // A pass that changed nothing can be run again.
    return state.snapshot ? { status: "active" } : { status: "inactive", note: state.note };
  };

  /** Video passes work on the saved project, so it's saved first. */
  const runVideoTool = async (tool: string) => {
    if (!(await save(true))) return;
    await onRunAiTool(tool);
  };

  const activateZooms = async () => {
    if (!(await save(true))) return;
    const result = await onRunAiTool("auto-zooms");
    if (!result?.scenes) return;
    setScenes(result.scenes);
    setPreviewStyle({
      ...previewStyle,
      zooms: result.scenes.flatMap((scene) =>
        scene.zoom
          ? [
              {
                start: scene.start,
                end: Math.min(scene.end, scene.start + AUTO_ZOOM_SECONDS),
                type: scene.zoom as ZoomStyle,
              },
            ]
          : [],
      ),
    });
    toast.success(`Added zooms to ${result.scenes.filter((s) => s.zoom).length} scenes`);
  };

  const activateBrolls = async () => {
    if (!(await save(true))) return;
    const result = await api.autoBrolls(project.id, {
      percent: 49,
      videoType: "free",
      transitions: true,
      orientation: frameOrientation,
      scenes: scenes.length ? scenes : undefined,
    });
    if (!result.success || !result.data) {
      toast.error(failureMessage("add B-rolls", result.error));
      return;
    }
    if (!scenes.length) setScenes(result.data.scenes);
    setTimeline({
      ...timeline,
      brolls: result.data.clips.map((clip, n) => ({
        id: `${Date.now()}-${n}`,
        start: clip.start,
        end: clip.end,
        kind: clip.media.kind,
        url: clip.media.url,
        thumbnailUrl: clip.media.thumbnailUrl,
        vendor: clip.media.vendor,
        sourceUrl: clip.media.sourceUrl,
        author: clip.media.author,
        layout: (["cover", "split-50-50", "split-35-65"] as const)[n % 3],
      })),
      transitions: result.data.clips.flatMap((clip) =>
        clip.transition ? [{ at: clip.start, id: clip.transition as TransitionId }] : [],
      ),
    });
    toast.success(`Added ${result.data.clips.length} B-rolls`);
  };

  const activateHook = async () => {
    const hook = await generateHook(titleOverlay.history);
    if (!hook) return;
    setTitleOverlay({
      ...titleOverlay,
      enabled: true,
      text: hook,
      history: [hook, ...titleOverlay.history.filter((h) => h !== hook)].slice(0, 10),
    });
  };

  const hasCaptions = chunks.some((c) => !c.hidden);
  const frame = getCompositionDimensions(
    previewStyle,
    project.width ?? 1080,
    project.height ?? 1920,
  );
  const frameOrientation =
    frame.width === frame.height ? "square" : frame.width > frame.height ? "landscape" : "portrait";
  const toolGroups: { title: string; tools: AiToolRow[] }[] = [
    {
      title: "Hook Them",
      tools: [
        {
          id: "captions",
          name: "AI Captions",
          description: "Auto-generate styled subtitles",
          icon: AI_TOOL_ICONS.captions,
          status: isTranscribing ? "running" : hasCaptions ? "active" : "inactive",
          actions: [
            { label: "Style", onClick: () => setActiveTab("style") },
            { label: "Edit", onClick: () => openCaptions("captions") },
          ],
          onRemove: () => onChunksChange(chunks.map((c) => ({ ...c, hidden: true }))),
          onActivate: () =>
            chunks.length
              ? onChunksChange(chunks.map((c) => ({ ...c, hidden: false })))
              : onStartTranscription({ language, layout: presetLayout(preset) }),
        },
        {
          id: "brolls",
          name: "AI Auto B-rolls",
          description: "Swap moments with relevant footage",
          icon: AI_TOOL_ICONS.brolls,
          status: timeline.brolls.length ? "active" : "inactive",
          actions: [{ label: "Edit", onClick: () => setActiveTab("brolls") }],
          onRemove: () => setTimeline({ ...timeline, brolls: [], transitions: [] }),
          onActivate: activateBrolls,
        },
        {
          id: "auto-zooms",
          name: "AI Auto Zooms",
          description: "Auto-zoom on key moments",
          icon: AI_TOOL_ICONS.zooms,
          credits: 1,
          status: previewStyle.zooms?.length ? "active" : "inactive",
          onActivate: activateZooms,
          onRemove: () => setPreviewStyle({ ...previewStyle, zooms: undefined }),
        },
        {
          id: "hook",
          name: "AI Hook Title",
          description: "Generate an attention-grabbing intro",
          icon: AI_TOOL_ICONS.hook,
          status: titleOverlay.enabled && titleOverlay.text.trim() ? "active" : "inactive",
          actions: [{ label: "Edit", onClick: () => openCaptions("hook") }],
          onRemove: () => setTitleOverlay({ ...titleOverlay, enabled: false, text: "" }),
          onActivate: activateHook,
        },
      ],
    },
    {
      title: "Sound Good",
      tools: [
        {
          id: "clean-audio",
          name: "Clean Audio",
          description: "Make your audio sound professional",
          icon: AI_TOOL_ICONS.cleanAudio,
          credits: 2,
          ...toolState("clean-audio"),
          onActivate: () => runVideoTool("clean-audio"),
          onRemove: () => void onRemoveAiTool("clean-audio"),
        },
        {
          id: "remove-silence",
          name: "Remove Silence",
          description: "Cut pauses to tighten pacing",
          icon: AI_TOOL_ICONS.silence,
          credits: 2,
          ...toolState("remove-silence"),
          onActivate: () => runVideoTool("remove-silence"),
          onRemove: () => void onRemoveAiTool("remove-silence"),
        },
      ],
    },
    {
      title: "Look Good",
      tools: [
        {
          id: "eye-contact",
          name: "Correct Eye Contact",
          description: "Make eyes look at the camera",
          icon: AI_TOOL_ICONS.eyeContact,
          credits: 3,
          status: "unavailable",
        },
        {
          id: "remove-bad-takes",
          name: "Remove Bad Takes",
          description: "Detect and remove repeated takes",
          icon: AI_TOOL_ICONS.badTakes,
          credits: 2,
          ...toolState("remove-bad-takes"),
          onActivate: () => runVideoTool("remove-bad-takes"),
          onRemove: () => void onRemoveAiTool("remove-bad-takes"),
        },
      ],
    },
  ];

  const openCaptions = (view: "captions" | "hook") => {
    setCaptionsView(view);
    setActiveTab("edit");
  };

  const [isTitling, setIsTitling] = useState(false);
  const writeTitle = async () => {
    setIsTitling(true);
    const result = await api.writeProjectTitle(project.id);
    setIsTitling(false);
    if (!result.success || !result.data) {
      toast.error(failureMessage("write a title", result.error));
      return;
    }
    setTitle(result.data.title);
    toast.success("Project renamed");
    void queryClient.invalidateQueries({ queryKey: subtitleQueryKeys.projects() });
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
      duration: timelineDuration(timeline, project.duration ?? 0),
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
              variant="outline"
              size="sm"
              disabled={isTitling || !project.text?.trim()}
              onClick={writeTitle}
            >
              {isTitling ? <Spinner /> : <Sparkle />}
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
            <Button
              variant="outline"
              onClick={() => void save()}
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
              onPresetChange={changePreset}
              placement={placement}
              onPlacementChange={setPlacement}
              previewStyle={previewStyle}
              onPreviewStyleChange={setPreviewStyle}
            />
          </TabsContent>
          <TabsContent value="edit" className={PANEL_CLASS}>
            <CaptionsTab
              hasVideo={Boolean(videoUrl)}
              status={status}
              transcriptionError={transcriptionError}
              chunks={chunks}
              isStarting={isStarting}
              activeChunkIndex={activeChunkIndex}
              activeWord={activeWord}
              language={language}
              onStartTranscription={(options) => {
                setLanguage(options.language);
                setKeepLines(false);
                onStartTranscription({
                  ...options,
                  layout: presetLayout(preset),
                });
              }}
              onChunksChange={onChunksChange}
              onSeek={handleSeek}
              preset={preset}
              placement={placement}
              templates={SUBTITLE_PRESETS.filter((p) => p.group !== "archived")}
              accuracy={accuracy}
              onOptimize={optimize}
              onRegenerateEmojis={regenerateEmojis}
              onTranslate={translate}
              titleOverlay={titleOverlay}
              onTitleOverlayChange={setTitleOverlay}
              onGenerateHook={generateHook}
              canGenerateHook={Boolean(project.text?.trim())}
              getCurrentTime={() => currentTimeRef.current}
              view={captionsView}
              onViewChange={setCaptionsView}
            />
          </TabsContent>
          <TabsContent value="ai" className={PANEL_CLASS}>
            <AiToolsTab groups={toolGroups} />
          </TabsContent>
          <TabsContent value="brolls" className={PANEL_CLASS}>
            <BrollsTab
              api={api}
              projectId={project.id}
              videoUrl={videoUrl}
              chunks={chunks}
              duration={project.duration ?? 0}
              currentTime={chunks[activeChunkIndex]?.start ?? -1}
              orientation={frameOrientation}
              scenes={scenes}
              onScenesChange={setScenes}
              timeline={timeline}
              onTimelineChange={setTimeline}
              zooms={previewStyle.zooms ?? []}
              onZoomsChange={(zooms) =>
                setPreviewStyle({ ...previewStyle, zooms: zooms.length ? zooms : undefined })
              }
              defaultLayout={previewStyle.brollLayout}
              onAutoZooms={activateZooms}
              onOpenHookTitle={() => openCaptions("hook")}
              onSeek={handleSeek}
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
              placement={placement}
              titleOverlay={titleOverlay}
              watermarkOverlay={watermarkOverlay}
              previewStyle={previewStyle}
              timeline={timeline}
              onPlacementChange={setPlacement}
              onTitleOverlayChange={setTitleOverlay}
              onTimelineChange={setTimeline}
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

      <AlertDialog
        open={pendingPreset !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPreset(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-cut the lines for this style?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPreset
                ? `${pendingPreset.name} shows up to ${presetLayout(pendingPreset).wordsPerCaption} ${presetLayout(pendingPreset).wordsPerCaption === 1 ? "word" : "words"} at a time. `
                : ""}
              Re-cutting replaces line breaks and lines you moved or split by
              hand. Your word edits stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (pendingPreset) setPreset(pendingPreset);
                setKeepLines(true);
                setPendingPreset(null);
              }}
            >
              Keep my lines
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPreset) {
                  setPreset(pendingPreset);
                  onChunksChange(recut(chunks, presetLayout(pendingPreset)));
                }
                setPendingPreset(null);
              }}
            >
              Re-cut lines
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
