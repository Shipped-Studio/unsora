import { toast } from "sonner";
import type { TransitionId, ZoomStyle } from "@/components/subtitle-editor/caption-style";
import type { EditorSettings } from "@/components/subtitle-editor/editor/use-editor-settings";
import { failureMessage } from "@/components/subtitle-editor/format";
import { AI_TOOL_ICONS, type AiToolRow } from "@/components/subtitle-editor/tabs/ai-tools-tab";
import { useSubtitleApi, type CaptionScene } from "@/hooks/subtitle/use-subtitle-api";
import type { AiToolState, SubtitleChunk, TranscriptionData } from "@/remotion/types";

/** An AI zoom eases back within this long, however long its scene is. */
const AUTO_ZOOM_SECONDS = 2.5;

/** B-roll layouts the AI picks cycle through, for variety. */
const AUTO_BROLL_LAYOUTS = ["cover", "split-50-50", "split-35-65"] as const;

export type AiToolGroup = { title: string; tools: AiToolRow[] };

/**
 * The AI tools tab: each tool's row, and what turning it on or off does.
 *
 * Tools of two kinds:
 * - Editor tools (captions, B-rolls, zooms, hook) change settings here.
 * - Video tools (clean audio, remove silence, bad takes) process the saved
 *   project on the server, so the project is saved first.
 */
export function useAiTools({
  project,
  chunks,
  onChunksChange,
  settings,
  isTranscribing,
  aiTools,
  onRunAiTool,
  onRemoveAiTool,
  save,
  generateHook,
  onStartTranscription,
  onOpenTab,
  onOpenCaptions,
}: {
  project: TranscriptionData;
  chunks: SubtitleChunk[];
  onChunksChange: (chunks: SubtitleChunk[]) => void;
  settings: EditorSettings;
  isTranscribing: boolean;
  /** Each video tool's state, by tool id. */
  aiTools: Record<string, AiToolState>;
  onRunAiTool: (tool: string) => Promise<{ scenes?: CaptionScene[] } | null>;
  onRemoveAiTool: (tool: string) => Promise<boolean>;
  save: (quiet?: boolean) => Promise<boolean>;
  generateHook: (previousHooks: string[]) => Promise<string | null>;
  onStartTranscription: () => void;
  onOpenTab: (tab: string) => void;
  onOpenCaptions: (view: "captions" | "hook") => void;
}) {
  const api = useSubtitleApi();
  const {
    scenes,
    setScenes,
    timeline,
    setTimeline,
    previewStyle,
    setPreviewStyle,
    titleOverlay,
    setTitleOverlay,
  } = settings;

  /** A video tool's row status, from its server-side state. */
  const videoToolState = (tool: string): Pick<AiToolRow, "status" | "note"> => {
    const state = aiTools[tool];
    if (!state) return { status: "inactive" };
    if (state.status === "running") return { status: "running" };
    if (state.status === "failed") return { status: "failed", note: state.error };
    // A pass that changed nothing can be run again.
    return state.snapshot ? { status: "active" } : { status: "inactive", note: state.note };
  };

  /** The row fields every video tool shares. */
  const videoTool = (tool: string) => ({
    ...videoToolState(tool),
    onActivate: async () => {
      if (!(await save(true))) return;
      await onRunAiTool(tool);
    },
    onRemove: () => onRemoveAiTool(tool),
    confirmRemove: {
      title: "Undo this pass?",
      description:
        "The video goes back to how it was before. Running it again costs credits again.",
    },
  });

  /** Zooms on each scene's key moment; scenes are found by the server. */
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

  /** Fills about half the video with matching stock footage and transitions. */
  const activateBrolls = async () => {
    if (!(await save(true))) return;
    const result = await api.autoBrolls(project.id, {
      percent: 49,
      videoType: "free",
      transitions: true,
      orientation: settings.orientation,
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
        layout: AUTO_BROLL_LAYOUTS[n % AUTO_BROLL_LAYOUTS.length],
      })),
      transitions: result.data.clips.flatMap((clip) =>
        clip.transition ? [{ at: clip.start, id: clip.transition as TransitionId }] : [],
      ),
    });
    toast.success(`Added ${result.data.clips.length} B-rolls`);
  };

  /** Writes a hook title and turns the title overlay on. */
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

  const groups: AiToolGroup[] = [
    {
      title: "Hook them",
      tools: [
        {
          id: "captions",
          name: "AI captions",
          description: "Auto-generate styled subtitles",
          icon: AI_TOOL_ICONS.captions,
          status: isTranscribing ? "running" : hasCaptions ? "active" : "inactive",
          actions: [
            { label: "Style", onClick: () => onOpenTab("style") },
            { label: "Edit", onClick: () => onOpenCaptions("captions") },
          ],
          // Off hides the lines rather than deleting them; on shows them again.
          onRemove: () => onChunksChange(chunks.map((c) => ({ ...c, hidden: true }))),
          onActivate: () =>
            chunks.length
              ? onChunksChange(chunks.map((c) => ({ ...c, hidden: false })))
              : onStartTranscription(),
        },
        {
          id: "brolls",
          name: "AI auto B-rolls",
          description: "Swap moments with relevant footage",
          icon: AI_TOOL_ICONS.brolls,
          status: timeline.brolls.length ? "active" : "inactive",
          actions: [{ label: "Edit", onClick: () => onOpenTab("brolls") }],
          onRemove: () => setTimeline({ ...timeline, brolls: [], transitions: [] }),
          confirmRemove: {
            title: "Remove all B-rolls?",
            description: `${timeline.brolls.length === 1 ? "The B-roll" : `All ${timeline.brolls.length} B-rolls`} and every transition come off this video. Getting them back means running Auto B-rolls again.`,
          },
          onActivate: activateBrolls,
        },
        {
          id: "auto-zooms",
          name: "AI auto zooms",
          description: "Auto-zoom on key moments",
          icon: AI_TOOL_ICONS.zooms,
          credits: 1,
          status: previewStyle.zooms?.length ? "active" : "inactive",
          onActivate: activateZooms,
          onRemove: () => setPreviewStyle({ ...previewStyle, zooms: undefined }),
          confirmRemove: {
            title: "Remove all zooms?",
            description:
              "Every zoom comes off this video, including ones you added by hand. Running AI auto zooms again costs credits.",
          },
        },
        {
          id: "hook",
          name: "AI hook title",
          description: "Generate an attention-grabbing intro",
          icon: AI_TOOL_ICONS.hook,
          status: titleOverlay.enabled && titleOverlay.text.trim() ? "active" : "inactive",
          actions: [{ label: "Edit", onClick: () => onOpenCaptions("hook") }],
          onRemove: () => setTitleOverlay({ ...titleOverlay, enabled: false, text: "" }),
          onActivate: activateHook,
        },
      ],
    },
    {
      title: "Sound good",
      tools: [
        {
          id: "clean-audio",
          name: "Clean audio",
          description: "Make your audio sound professional",
          icon: AI_TOOL_ICONS.cleanAudio,
          credits: 2,
          ...videoTool("clean-audio"),
        },
        {
          id: "remove-silence",
          name: "Remove silence",
          description: "Cut pauses to tighten pacing",
          icon: AI_TOOL_ICONS.silence,
          credits: 2,
          ...videoTool("remove-silence"),
        },
      ],
    },
    {
      title: "Look good",
      tools: [
        {
          id: "eye-contact",
          name: "Correct eye contact",
          description: "Make eyes look at the camera",
          icon: AI_TOOL_ICONS.eyeContact,
          credits: 3,
          status: "unavailable",
        },
        {
          id: "remove-bad-takes",
          name: "Remove bad takes",
          description: "Detect and remove repeated takes",
          icon: AI_TOOL_ICONS.badTakes,
          credits: 2,
          ...videoTool("remove-bad-takes"),
        },
      ],
    },
  ];

  return { groups, activateZooms };
}
