"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowsClockwise,
  ArrowsHorizontal,
  ArrowsOutSimple,
  ArrowsVertical,
  Browser,
  CaretRight,
  Check,
  FilmStrip,
  Image as ImageIcon,
  Infinity,
  Layout,
  MagnifyingGlassPlus,
  MusicNotes,
  Palette,
  PencilSimple,
  Plus,
  Scissors,
  Sparkle,
  SpeakerHigh,
  TextT,
  Trash,
  User,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BROLL_LAYOUTS,
  CTA_STYLES,
  TRANSITIONS,
  WIDGET_DEFAULTS,
  WORD_SOUNDS,
  ZOOM_STYLES,
  soundVolume,
  transitionInfo,
  type BrollClip,
  type BrollLayout,
  type ClipLayout,
  type Timeline,
  type TimelineWidget,
  type TransitionId,
  type TransitionSound,
  type ZoomStyle,
} from "@/components/subtitle-editor/caption-style";
import { SoundPlayButton, playSound } from "@/components/subtitle-editor/sound-preview";
import {
  TransitionPlayer,
  TransitionThumbnail,
} from "@/components/subtitle-editor/transition-preview";
import type { ZoomEvent } from "@/components/subtitle-editor/caption-animations";
import {
  ChoiceGroup,
  ChoiceItem,
  SliderField,
  SwitchRow,
} from "@/components/subtitle-editor/editor-fields";
import { DeleteDialog } from "@/components/subtitle-editor/delete-dialog";
import { failureMessage } from "@/components/subtitle-editor/format";
import type {
  BrollMedia,
  BrollOrientation,
  CaptionScene,
  useSubtitleApi,
} from "@/hooks/subtitle/use-subtitle-api";
import { cn } from "@/lib/utils";
import type { SubtitleChunk } from "@/remotion/types";
import { BrollPicker } from "@/components/subtitle-editor/tabs/broll-picker";
import { IconButton } from "@/components/subtitle-editor/icon-button";

type Api = ReturnType<typeof useSubtitleApi>;

const MAX_CLIP_SECONDS = 6;
const ZOOM_SECONDS = 2.5;
// The layouts "Random" picks from, as in Submagic.
const RANDOM_LAYOUTS: ClipLayout[] = ["cover", "split-50-50", "split-35-65"];
const AI_IMAGE_CREDITS = 2;

const TRANSITION_SOUNDS: { value: TransitionSound; label: string }[] = [
  { value: "whoosh-long", label: "Whoosh Long" },
  { value: "whoosh-fire", label: "Whoosh Fire" },
  { value: "paper-slide", label: "Paper Slide" },
  { value: "film-burn", label: "Film Burn" },
  { value: "camera-focus", label: "Camera Focus" },
  { value: "glitch", label: "Glitch" },
  { value: "light-leak", label: "Light Leak" },
];
/** Every sound a scene can play: the word sounds and the transition ones. */
const ALL_SOUNDS: { value: Timeline["sounds"][number]["sound"]; label: string }[] = [
  ...WORD_SOUNDS,
  ...TRANSITION_SOUNDS,
];
const CLIP_LAYOUTS = BROLL_LAYOUTS.filter(
  (l): l is (typeof BROLL_LAYOUTS)[number] & { value: ClipLayout } =>
    l.value !== "template" && l.value !== "random",
).map(({ value, label }) => ({ value, label }));

const newId = () => Math.random().toString(36).slice(2, 10);
const seconds = (n: number) => String(Number(n.toFixed(2)));
const overlaps = (start: number, end: number, a: number, b: number) =>
  start < b && end > a;

/** "By Jane on Pixabay": the credit for a stock clip. Older clips are from Pexels. */
const stockCredit = (vendor: "pixabay" | "pexels", author?: string) => {
  const site = vendor === "pixabay" ? "Pixabay" : "Pexels";
  return author ? `By ${author} on ${site}` : `From ${site}`;
};

/** A clip layout from the project's B-roll default. */
function resolveLayout(layout: BrollLayout | undefined, n: number): ClipLayout {
  if (!layout || layout === "random") return RANDOM_LAYOUTS[n % RANDOM_LAYOUTS.length];
  if (layout === "template") return "cover";
  return layout;
}

interface BrollsTabProps {
  api: Api;
  projectId: string;
  videoUrl: string | null;
  chunks: SubtitleChunk[];
  duration: number;
  orientation: BrollOrientation;
  scenes: CaptionScene[];
  onScenesChange: (scenes: CaptionScene[]) => void;
  timeline: Timeline;
  onTimelineChange: (timeline: Timeline) => void;
  zooms: ZoomEvent[];
  onZoomsChange: (zooms: ZoomEvent[]) => void;
  defaultLayout: BrollLayout | undefined;
  /** Seconds into the video, for shading the playing scene. */
  currentTime: number;
  onAutoZooms: () => Promise<void>;
  onOpenHookTitle: () => void;
  onSeek: (seconds: number) => void;
}

/** Submagic's B-rolls tab: the video as AI scenes, each with its layers. */
export function BrollsTab({
  api,
  projectId,
  videoUrl,
  chunks,
  duration,
  orientation,
  scenes,
  onScenesChange,
  timeline,
  onTimelineChange,
  zooms,
  onZoomsChange,
  defaultLayout,
  currentTime,
  onAutoZooms,
  onOpenHookTitle,
  onSeek,
}: BrollsTabProps) {
  const [isSplitting, setIsSplitting] = useState(false);
  const [mediaFor, setMediaFor] = useState<{ scene: number; kind: "video" | "photo" } | null>(null);
  const [transitionAt, setTransitionAt] = useState<number | null>(null);
  const [outroOpen, setOutroOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);

  const update = (patch: Partial<Timeline>) => onTimelineChange({ ...timeline, ...patch });
  const brollSeconds = timeline.brolls.reduce((n, c) => n + (c.end - c.start), 0);
  const coverage = duration ? Math.round((brollSeconds / duration) * 100) : 0;

  const splitScenes = async () => {
    setIsSplitting(true);
    const result = await api.findScenes(projectId);
    setIsSplitting(false);
    if (!result.success || !result.data) {
      toast.error(failureMessage("split the video into scenes", result.error));
      return;
    }
    onScenesChange(result.data.scenes);
  };

  const addClip = (sceneIndex: number, media: BrollMedia) => {
    const scene = scenes[sceneIndex];
    const end = Math.min(scene.end, scene.start + MAX_CLIP_SECONDS);
    const clip: BrollClip = {
      id: newId(),
      start: scene.start,
      end,
      kind: media.kind,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      vendor: media.vendor,
      sourceUrl: media.sourceUrl,
      author: media.author,
      layout: resolveLayout(defaultLayout, timeline.brolls.length),
    };
    update({
      brolls: [
        ...timeline.brolls.filter((c) => !overlaps(c.start, c.end, scene.start, scene.end)),
        clip,
      ].sort((a, b) => a.start - b.start),
    });
  };

  const addWidget = (sceneIndex: number, kind: TimelineWidget["kind"]) => {
    const scene = scenes[sceneIndex];
    update({
      widgets: [
        ...timeline.widgets,
        {
          id: newId(),
          kind,
          start: scene.start,
          end: Math.min(scene.end, scene.start + 4),
          title: kind === "cta" ? CTA_STYLES[0].text : "Speaker name",
          subtitle: kind === "speaker" ? "Title" : undefined,
          style: kind === "cta" ? "link" : undefined,
          ...WIDGET_DEFAULTS[kind],
        },
      ],
    });
  };

  const toolbar = (
    <Toolbar
      api={api}
      projectId={projectId}
      orientation={orientation}
      scenes={scenes}
      timeline={timeline}
      defaultLayout={defaultLayout}
      onTimelineChange={onTimelineChange}
      onScenesChange={onScenesChange}
      onAutoZooms={onAutoZooms}
      hasZooms={zooms.length > 0}
      onOpenHookTitle={onOpenHookTitle}
      onTrim={() => setTrimOpen(true)}
      onRefresh={splitScenes}
      isRefreshing={isSplitting}
    />
  );
  const trimDialog = (
    <TrimDialog
      open={trimOpen}
      onOpenChange={setTrimOpen}
      duration={duration}
      trim={timeline.trim}
      onApply={(trim) => update({ trim })}
    />
  );

  // The library slides in over the scenes, as in Submagic.
  if (mediaFor && scenes[mediaFor.scene]) {
    return (
      <BrollPicker
        api={api}
        orientation={orientation}
        initialQuery={scenes[mediaFor.scene].brollQuery}
        initialSource={mediaFor.kind === "photo" ? "image" : "video"}
        onBack={() => setMediaFor(null)}
        onPick={(media) => {
          addClip(mediaFor.scene, media);
          setMediaFor(null);
        }}
      />
    );
  }

  // The transition library slides in the same way.
  if (transitionAt !== null && scenes[transitionAt]) {
    const at = scenes[transitionAt].start;
    /** A transition belongs to the cut it starts at, give or take a frame. */
    const isAtCut = (t: { at: number }) => Math.abs(t.at - at) < 0.05;
    return (
      <TransitionPicker
        sceneNumber={transitionAt + 1}
        current={timeline.transitions.find(isAtCut)?.id}
        onBack={() => setTransitionAt(null)}
        onApply={(id) => {
          update({
            transitions: [
              ...timeline.transitions.filter((t) => !isAtCut(t)),
              ...(id === "none" ? [] : [{ at, id }]),
            ],
          });
          setTransitionAt(null);
        }}
      />
    );
  }

  if (!scenes.length) {
    return (
      <div className="space-y-4">
        {toolbar}
        <div className="space-y-3 rounded-xl bg-muted px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Split the video into scenes to add B-rolls, sounds, zooms and transitions.
          </p>
          <Button onClick={splitScenes} disabled={isSplitting || !chunks.length}>
            {isSplitting ? <Spinner /> : <Sparkle />}
            Split into scenes
          </Button>
        </div>
        {trimDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}
      <p className="text-sm text-muted-foreground">
        B-roll covers{" "}
        <span className="font-medium text-foreground tabular-nums">{coverage}%</span> of this
        video
      </p>

      <ol>
        {scenes.map((scene, i) => {
          const clip = timeline.brolls.find((c) => overlaps(c.start, c.end, scene.start, scene.end));
          const sounds = timeline.sounds.filter((s) => s.start >= scene.start && s.start < scene.end);
          const zoom = zooms.find((z) => z.start >= scene.start && z.start < scene.end);
          const widgets = timeline.widgets.filter((w) => overlaps(w.start, w.end, scene.start, scene.end));
          const text = chunks
            .filter((c) => c.start >= scene.start && c.start < scene.end)
            .map((c) => c.text)
            .join(" ");
          const isActive = currentTime >= scene.start && currentTime < scene.end;
          const next = scenes[i + 1];
          const transition = next
            ? timeline.transitions.find((t) => Math.abs(t.at - next.start) < 0.05)
            : undefined;
          return (
            <li key={`${i}-${scene.start}`}>
              <div
                className={cn(
                  "space-y-2 rounded-xl px-3 py-2.5 transition-colors duration-200",
                  isActive ? "bg-muted" : "hover:bg-muted/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSeek(scene.start)}
                  aria-label={`Play from ${seconds(scene.start)} seconds`}
                  className="rounded-md bg-foreground/5 px-1.5 py-px text-xs font-medium tabular-nums text-muted-foreground outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {seconds(scene.start)}–{seconds(scene.end)}s
                </button>
                <p className="text-sm leading-6 text-foreground">
                  {text || scene.keyword}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <LayerChip
                    label="A-roll"
                    thumb={
                      videoUrl ? (
                        <video
                          src={`${videoUrl}#t=${scene.start.toFixed(2)}`}
                          muted
                          playsInline
                          preload="metadata"
                          className="size-full object-cover"
                        />
                      ) : (
                        <User />
                      )
                    }
                  />
                  {clip ? (
                    <BrollChip
                      clip={clip}
                      onLayout={(layout) =>
                        update({
                          brolls: timeline.brolls.map((c) => (c.id === clip.id ? { ...c, layout } : c)),
                        })
                      }
                      onReplace={() => setMediaFor({ scene: i, kind: clip.kind === "image" ? "photo" : "video" })}
                      onDelete={() => update({ brolls: timeline.brolls.filter((c) => c.id !== clip.id) })}
                    />
                  ) : null}
                  {sounds.map((sound) => (
                    <SoundChip
                      key={sound.id}
                      sound={sound}
                      onChange={(next) =>
                        update({ sounds: timeline.sounds.map((x) => (x.id === sound.id ? next : x)) })
                      }
                      onDelete={() => update({ sounds: timeline.sounds.filter((x) => x.id !== sound.id) })}
                    />
                  ))}
                  {zoom ? (
                    <ZoomChip
                      zoom={zoom}
                      onChange={(type) => onZoomsChange(zooms.map((z) => (z === zoom ? { ...z, type } : z)))}
                      onDelete={() => onZoomsChange(zooms.filter((z) => z !== zoom))}
                    />
                  ) : null}
                  {widgets.map((widget) => (
                    <WidgetChip
                      key={widget.id}
                      widget={widget}
                      onChange={(next) =>
                        update({ widgets: timeline.widgets.map((x) => (x.id === widget.id ? next : x)) })
                      }
                      onDelete={() => update({ widgets: timeline.widgets.filter((x) => x.id !== widget.id) })}
                    />
                  ))}
                  <AddMenu
                    onMedia={(kind) => setMediaFor({ scene: i, kind })}
                    onSound={(sound) =>
                      update({
                        sounds: [...timeline.sounds, { id: newId(), start: scene.start, sound }],
                      })
                    }
                    onZoom={(type) =>
                      onZoomsChange(
                        [
                          ...zooms.filter((z) => !(z.start >= scene.start && z.start < scene.end)),
                          { start: scene.start, end: Math.min(scene.end, scene.start + ZOOM_SECONDS), type },
                        ].sort((a, b) => a.start - b.start),
                      )
                    }
                    onWidget={(kind) => addWidget(i, kind)}
                  />
                </div>
              </div>
              {next ? (
                <div className="relative flex h-9 items-center justify-center">
                  <div aria-hidden className="absolute inset-x-4 top-1/2 h-px bg-border" />
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={
                            transition
                              ? `Transition: ${transitionInfo(transition.id).label}`
                              : "Add a transition"
                          }
                          onClick={() => setTransitionAt(i + 1)}
                          className={cn(
                            "relative flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xs outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
                            transition && "border-primary/30 bg-primary/10 text-primary dark:bg-primary/15",
                          )}
                        />
                      }
                    >
                      <Infinity />
                    </TooltipTrigger>
                    <TooltipContent>
                      {transition ? transitionInfo(transition.id).label : "Add a transition"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {timeline.outro ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm">
          <span>
            Outro · <span className="text-muted-foreground">{timeline.outro.title}</span>
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setOutroOpen(true)}>
              <PencilSimple />
              Edit
            </Button>
            <IconButton label="Remove outro" onClick={() => update({ outro: undefined })}>
              <Trash />
            </IconButton>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOutroOpen(true)}>
          <Plus />
          Add outro
        </Button>
      )}

      <OutroDialog
        open={outroOpen}
        onOpenChange={setOutroOpen}
        outro={timeline.outro}
        onSave={(outro) => {
          update({ outro });
          setOutroOpen(false);
        }}
      />
      {trimDialog}
    </div>
  );
}

function Toolbar({
  api,
  projectId,
  orientation,
  scenes,
  timeline,
  defaultLayout,
  onTimelineChange,
  onScenesChange,
  onAutoZooms,
  hasZooms,
  onOpenHookTitle,
  onTrim,
  onRefresh,
  isRefreshing,
}: {
  api: Api;
  projectId: string;
  orientation: BrollOrientation;
  scenes: CaptionScene[];
  timeline: Timeline;
  defaultLayout: BrollLayout | undefined;
  onTimelineChange: (timeline: Timeline) => void;
  onScenesChange: (scenes: CaptionScene[]) => void;
  onAutoZooms: () => Promise<void>;
  hasZooms: boolean;
  onOpenHookTitle: () => void;
  onTrim: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const [zooming, setZooming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5 [&_[data-slot=button]]:h-7 [&_[data-slot=button]]:px-2.5 [&_[data-slot=button]]:text-[13px] [&_[data-slot=button]_svg]:size-3.5">
      <AutoBrollsPopover
        api={api}
        projectId={projectId}
        orientation={orientation}
        scenes={scenes}
        timeline={timeline}
        defaultLayout={defaultLayout}
        onTimelineChange={onTimelineChange}
        onScenesChange={onScenesChange}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={zooming}
        className={cn(hasZooms && "border-primary/30 bg-primary/10 text-primary")}
        onClick={async () => {
          setZooming(true);
          await onAutoZooms();
          setZooming(false);
        }}
      >
        {zooming ? <Spinner /> : <MagnifyingGlassPlus />}
        Auto zooms
        <span className="text-xs tabular-nums text-muted-foreground">✦ 1</span>
      </Button>
      <Button variant="outline" size="sm" onClick={onOpenHookTitle}>
        <TextT />
        Hook title
      </Button>
      <Button variant="outline" size="sm" onClick={onTrim}>
        <Scissors />
        Trim
      </Button>
      <IconButton
        label="Split into scenes again"
        className="ml-auto"
        disabled={isRefreshing}
        onClick={onRefresh}
      >
        {isRefreshing ? <Spinner /> : <ArrowClockwise />}
      </IconButton>
    </div>
  );
}

function AutoBrollsPopover({
  api,
  projectId,
  orientation,
  scenes,
  timeline,
  defaultLayout,
  onTimelineChange,
  onScenesChange,
}: {
  api: Api;
  projectId: string;
  orientation: BrollOrientation;
  scenes: CaptionScene[];
  timeline: Timeline;
  defaultLayout: BrollLayout | undefined;
  onTimelineChange: (timeline: Timeline) => void;
  onScenesChange: (scenes: CaptionScene[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(49);
  const [videoType, setVideoType] = useState<"free" | "premium" | "trendy">("trendy");
  const [transitions, setTransitions] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteAll = () => {
    onTimelineChange({
      ...timeline,
      brolls: [],
      transitions: [],
      sounds: timeline.sounds.filter((s) => !s.id.startsWith("auto-")),
    });
    setConfirmingDelete(false);
  };

  const run = async () => {
    setIsUpdating(true);
    const result = await api.autoBrolls(projectId, {
      percent,
      videoType,
      transitions,
      orientation,
      scenes: scenes.length ? scenes : undefined,
    });
    setIsUpdating(false);
    if (!result.success || !result.data) {
      toast.error(failureMessage("add B-rolls", result.error));
      return;
    }
    const { clips, sounds } = result.data;
    if (!scenes.length) onScenesChange(result.data.scenes);
    onTimelineChange({
      ...timeline,
      brolls: clips.map((clip, n) => ({
        id: newId(),
        start: clip.start,
        end: clip.end,
        kind: clip.media.kind,
        url: clip.media.url,
        thumbnailUrl: clip.media.thumbnailUrl,
        vendor: clip.media.vendor,
        sourceUrl: clip.media.sourceUrl,
        author: clip.media.author,
        layout: resolveLayout(defaultLayout, n),
      })),
      transitions: clips.flatMap((clip) =>
        clip.transition ? [{ at: clip.start, id: clip.transition as TransitionId }] : [],
      ),
      // Sounds Auto B-rolls added before are replaced; the user's stay.
      sounds: [
        ...timeline.sounds.filter((s) => !s.id.startsWith("auto-")),
        ...sounds.map((s) => ({
          id: `auto-${newId()}`,
          start: s.start,
          sound: s.sound as Timeline["sounds"][number]["sound"],
        })),
      ],
    });
    toast.success(`Added ${clips.length} B-rolls`);
    setOpen(false);
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" />}>
        <FilmStrip />
        Auto B-rolls
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Auto B-rolls</PopoverTitle>
        </PopoverHeader>
        <SliderField
          label="Percent of B-rolls"
          unit="%"
          value={percent}
          min={0}
          max={100}
          onChange={setPercent}
        />
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Video type</span>
          <ChoiceGroup
            label="Video type"
            value={videoType}
            onChange={setVideoType}
            className="grid grid-cols-3"
          >
            <ChoiceItem value="free">Free</ChoiceItem>
            <ChoiceItem value="premium">Premium</ChoiceItem>
            <ChoiceItem value="trendy">Trendy</ChoiceItem>
          </ChoiceGroup>
          <p className="text-xs text-muted-foreground">
            {videoType === "trendy"
              ? `AI images, ✦ ${AI_IMAGE_CREDITS} each.`
              : "Stock video from Pixabay, included."}
          </p>
        </div>
        <SwitchRow label="Add transitions" checked={transitions} onCheckedChange={setTransitions} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={!timeline.brolls.length || isUpdating}
            onClick={() => {
              setOpen(false);
              setConfirmingDelete(true);
            }}
          >
            <Trash />
            Remove all
          </Button>
          <Button className="flex-1" disabled={isUpdating} onClick={run}>
            {isUpdating ? <Spinner /> : <Sparkle />}
            {isUpdating ? "Updating…" : "Update"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
    <DeleteDialog
      open={confirmingDelete}
      title="Remove all B-rolls?"
      description="Every B-roll and transition comes off this video, with the sounds Auto B-rolls added. Sounds you added stay."
      isDeleting={false}
      confirmLabel="Remove all"
      onConfirm={deleteAll}
      onCancel={() => setConfirmingDelete(false)}
    />
    </>
  );
}

function AddMenu({
  onMedia,
  onSound,
  onZoom,
  onWidget,
}: {
  onMedia: (kind: "video" | "photo") => void;
  onSound: (sound: Timeline["sounds"][number]["sound"]) => void;
  onZoom: (type: ZoomStyle) => void;
  onWidget: (kind: TimelineWidget["kind"]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Add to this scene"
            className="flex size-9 items-center justify-center rounded-lg border bg-card text-foreground shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-info [&_svg]:size-4"
          />
        }
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Media</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onMedia("video")}>
            <FilmStrip />
            B-roll video
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMedia("photo")}>
            <ImageIcon />
            Image
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Effects</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SpeakerHigh />
              Sound
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 w-56 overflow-y-auto">
              {ALL_SOUNDS.map((sound) => (
                <DropdownMenuItem key={sound.value} onClick={() => onSound(sound.value)}>
                  <SoundPlayButton id={sound.value} label={sound.label} className="-ml-1" />
                  {sound.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <MagnifyingGlassPlus />
              Zoom
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
              {ZOOM_STYLES.filter((z) => z.value !== "none").map((zoom) => (
                <DropdownMenuItem key={zoom.value} onClick={() => onZoom(zoom.value)}>
                  {zoom.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Widgets</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onWidget("speaker")}>
            <User />
            Speaker
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onWidget("cta")}>
            <Browser />
            CTA
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const CHIP_CLASS =
  "inline-flex h-9 items-center gap-2 rounded-lg border bg-card pl-1 pr-2.5 text-[13px] font-medium text-foreground shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-info";
const CHIP_THUMB_CLASS =
  "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-foreground [&_svg]:size-4";

/** A layer on a scene: a thumbnail or icon and its name. */
function LayerChip({ label, thumb }: { label: string; thumb: React.ReactNode }) {
  return (
    <span className={CHIP_CLASS}>
      <span className={CHIP_THUMB_CLASS}>{thumb}</span>
      {label}
    </span>
  );
}

/** A layer chip that opens its settings, as in Submagic's scene cards. */
function ChipMenu({
  label,
  thumb,
  title,
  children,
}: {
  label: string;
  thumb: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger render={<button type="button" className={CHIP_CLASS} />}>
        <span className={CHIP_THUMB_CLASS}>{thumb}</span>
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-72 gap-1 p-2">
        <p className="px-2 pt-1 pb-1.5 text-[13px] text-muted-foreground">{title}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}

const ROW_CLASS =
  "flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[15px] outline-none hover:bg-muted focus-visible:bg-muted data-[popup-open]:bg-muted [&_svg]:size-[18px] [&_svg]:shrink-0";

/** A row that opens a list of choices to its right. */
function ChoiceRow<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
  renderExtra,
}: {
  icon: React.ReactNode;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  renderExtra?: (value: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" className={ROW_CLASS} />}>
        {icon}
        <span className="flex-1">{label}</span>
        <span className="truncate text-muted-foreground">
          {options.find((o) => o.value === value)?.label}
        </span>
        <CaretRight className="text-foreground" />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={12} className="w-60 gap-0 p-1">
        <div className="max-h-80 overflow-y-auto">
          {options.map((option) => (
            <div key={option.value} className="flex items-center">
              <button
                type="button"
                aria-pressed={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <Check
                  className={cn("size-4 shrink-0 text-primary", option.value !== value && "invisible")}
                />
                <span className="truncate">{option.label}</span>
              </button>
              {renderExtra?.(option.value)}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A percentage, typed in place: "Size  70 %". */
function PercentRow({
  icon,
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex h-10 items-center gap-2.5 px-2 text-[15px] [&_svg]:size-[18px] [&_svg]:shrink-0">
      {icon}
      <label htmlFor={id} className="flex-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="w-12 rounded-md bg-transparent text-right tabular-nums outline-none [appearance:textfield] focus:bg-muted [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="-ml-1.5 text-muted-foreground">%</span>
    </div>
  );
}

function DeleteRow({ onDelete }: { onDelete: () => void }) {
  return (
    <Button variant="outline" className="mt-1 w-full" onClick={onDelete}>
      <Trash />
      Delete
    </Button>
  );
}

function BrollChip({
  clip,
  onLayout,
  onReplace,
  onDelete,
}: {
  clip: BrollClip;
  onLayout: (layout: ClipLayout) => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  return (
    <ChipMenu
      label="B-roll"
      title="B-roll"
      thumb={
        clip.thumbnailUrl || clip.kind === "image" ? (
           
          <img src={clip.thumbnailUrl ?? clip.url} alt="" className="size-full object-cover" />
        ) : (
          <FilmStrip />
        )
      }
    >
      <ChoiceRow
        icon={<Layout />}
        label="Layout"
        value={clip.layout}
        options={CLIP_LAYOUTS}
        onChange={onLayout}
      />
      <button type="button" className={ROW_CLASS} onClick={onReplace}>
        <ArrowsClockwise />
        <span className="flex-1">Replace</span>
      </button>
      {(clip.vendor === "pixabay" || clip.vendor === "pexels") && clip.sourceUrl ? (
        <a
          href={clip.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="px-2 py-1 text-xs text-muted-foreground underline"
        >
          {stockCredit(clip.vendor, clip.author)}
        </a>
      ) : null}
      <DeleteRow onDelete={onDelete} />
    </ChipMenu>
  );
}

function SoundChip({
  sound,
  onChange,
  onDelete,
}: {
  sound: Timeline["sounds"][number];
  onChange: (sound: Timeline["sounds"][number]) => void;
  onDelete: () => void;
}) {
  const label = ALL_SOUNDS.find((s) => s.value === sound.sound)?.label ?? sound.sound;
  return (
    <ChipMenu label="Sound" title="Sound" thumb={<SpeakerHigh />}>
      <ChoiceRow
        icon={<MusicNotes />}
        label="Sound"
        value={sound.sound}
        options={ALL_SOUNDS}
        onChange={(value) => {
          onChange({ ...sound, sound: value });
          playSound(value);
        }}
        renderExtra={(value) => (
          <SoundPlayButton id={value} label={ALL_SOUNDS.find((s) => s.value === value)?.label ?? value} />
        )}
      />
      <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
        <SoundPlayButton id={sound.sound} label={label} />
        Play {label}
      </div>
      <PercentRow
        icon={<SpeakerHigh />}
        label="Volume"
        value={(sound.volume ?? soundVolume(sound.sound)) * 100}
        onChange={(volume) => onChange({ ...sound, volume: volume / 100 })}
      />
      <DeleteRow onDelete={onDelete} />
    </ChipMenu>
  );
}

function ZoomChip({
  zoom,
  onChange,
  onDelete,
}: {
  zoom: ZoomEvent;
  onChange: (type: ZoomStyle) => void;
  onDelete: () => void;
}) {
  return (
    <ChipMenu label="Zoom" title="Zoom" thumb={<MagnifyingGlassPlus />}>
      <ChoiceRow
        icon={<MagnifyingGlassPlus />}
        label="Type"
        value={zoom.type}
        options={ZOOM_STYLES.filter((z) => z.value !== "none")}
        onChange={onChange}
      />
      <DeleteRow onDelete={onDelete} />
    </ChipMenu>
  );
}

function WidgetChip({
  widget,
  onChange,
  onDelete,
}: {
  widget: TimelineWidget;
  onChange: (widget: TimelineWidget) => void;
  onDelete: () => void;
}) {
  const defaults = WIDGET_DEFAULTS[widget.kind];
  const isCta = widget.kind === "cta";
  return (
    <ChipMenu
      label={isCta ? "CTA" : "Speaker"}
      title={isCta ? "CTA" : "Speaker"}
      thumb={isCta ? <Browser /> : <User />}
    >
      {isCta ? (
        <ChoiceRow
          icon={<Palette />}
          label="Style"
          value={widget.style ?? "link"}
          options={CTA_STYLES}
          onChange={(style) => {
            // Keep the text unless it's still another style's placeholder.
            const placeholder = CTA_STYLES.some((c) => c.text === widget.title);
            onChange({
              ...widget,
              style,
              title: placeholder ? CTA_STYLES.find((c) => c.value === style)!.text : widget.title,
            });
          }}
        />
      ) : null}
      <div className="space-y-1.5 px-1 py-1">
        <Input
          aria-label={isCta ? "Text" : "Name"}
          value={widget.title}
          maxLength={60}
          onChange={(event) => onChange({ ...widget, title: event.target.value })}
        />
        {isCta ? null : (
          <Input
            aria-label="Title"
            placeholder="Title"
            value={widget.subtitle ?? ""}
            maxLength={80}
            onChange={(event) => onChange({ ...widget, subtitle: event.target.value || undefined })}
          />
        )}
      </div>
      <PercentRow
        icon={<ArrowsOutSimple />}
        label="Size"
        value={widget.size ?? defaults.size}
        min={20}
        max={150}
        onChange={(size) => onChange({ ...widget, size })}
      />
      <PercentRow
        icon={<ArrowsHorizontal />}
        label="Position X"
        value={widget.x ?? defaults.x}
        onChange={(x) => onChange({ ...widget, x })}
      />
      <PercentRow
        icon={<ArrowsVertical />}
        label="Position Y"
        value={widget.y ?? defaults.y}
        onChange={(y) => onChange({ ...widget, y })}
      />
      <DeleteRow onDelete={onDelete} />
    </ChipMenu>
  );
}

/**
 * The transition library. It slides in over the scenes like the B-roll
 * library: hover a tile to preview it, click to pick it, then Apply.
 */
function TransitionPicker({
  sceneNumber,
  current,
  onBack,
  onApply,
}: {
  /** The scene the transition leads into, counting from 1. */
  sceneNumber: number;
  current: TransitionId | undefined;
  onBack: () => void;
  onApply: (id: TransitionId) => void;
}) {
  const [picked, setPicked] = useState<TransitionId>(current ?? "none");
  const [hovered, setHovered] = useState<TransitionId | null>(null);
  const previewing = hovered ?? picked;
  const info = transitionInfo(previewing);

  return (
    <div className="space-y-4 duration-200 animate-in fade-in slide-in-from-right-6">
      <div className="flex items-center gap-3">
        <IconButton variant="outline" label="Back to scenes" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Transition</h2>
          <p className="text-xs text-muted-foreground">Into scene {sceneNumber}</p>
        </div>
        <Button size="sm" onClick={() => onApply(picked)}>
          Apply
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-xl bg-muted p-3">
        <div className="aspect-[9/16] w-36 overflow-hidden rounded-xl bg-black">
          <TransitionPlayer id={previewing} />
        </div>
        <p className="text-sm font-medium">{info.label}</p>
        <p className="text-xs text-muted-foreground">
          {previewing === "none"
            ? "A straight cut"
            : `${info.kind === "overlay" ? "Overlay" : "Motion"} · ${info.frames} frames`}
        </p>
      </div>

      <div
        role="group"
        aria-label="Transitions"
        onPointerLeave={() => setHovered(null)}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {TRANSITIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={picked === t.value}
            onPointerEnter={() => setHovered(t.value)}
            onFocus={() => setHovered(t.value)}
            onClick={() => {
              setPicked(t.value);
              if (t.sound) playSound(t.sound);
            }}
            className={cn(
              "group/tile flex flex-col gap-1.5 rounded-xl border p-1.5 text-left text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              picked === t.value && "border-primary ring-1 ring-primary",
            )}
          >
            <span className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-black">
              <TransitionThumbnail id={t.value} />
            </span>
            <span className="truncate px-0.5 font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OutroDialog({
  open,
  onOpenChange,
  outro,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outro: Timeline["outro"];
  onSave: (outro: NonNullable<Timeline["outro"]>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{outro ? "Edit outro" : "Add outro"}</DialogTitle>
          <DialogDescription>A closing card shown after the video ends.</DialogDescription>
        </DialogHeader>
        {/* The popup unmounts when closed, so each open starts from `outro`. */}
        <OutroForm outro={outro} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}

function OutroForm({
  outro,
  onSave,
}: {
  outro: Timeline["outro"];
  onSave: (outro: NonNullable<Timeline["outro"]>) => void;
}) {
  const titleId = useId();
  const subtitleId = useId();
  const [title, setTitle] = useState(outro?.title ?? "Thanks for watching");
  const [subtitle, setSubtitle] = useState(outro?.subtitle ?? "Follow for more");
  const [duration, setDuration] = useState(outro?.duration ?? 3);
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) onSave({ title: title.trim(), subtitle: subtitle.trim() || undefined, duration });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={titleId}>Title</Label>
        <Input id={titleId} autoFocus value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={subtitleId}>Subtitle</Label>
        <Input id={subtitleId} value={subtitle} maxLength={80} onChange={(e) => setSubtitle(e.target.value)} />
      </div>
      <SliderField label="Duration" unit="s" value={duration} min={1} max={8} step={0.5} onChange={setDuration} />
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={!title.trim()}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function TrimDialog({
  open,
  onOpenChange,
  duration,
  trim,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duration: number;
  trim: Timeline["trim"];
  onApply: (trim: Timeline["trim"]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trim</DialogTitle>
          <DialogDescription>Choose where the exported video starts and ends.</DialogDescription>
        </DialogHeader>
        {/* The popup unmounts when closed, so each open starts from `trim`. */}
        <TrimForm
          duration={duration}
          trim={trim}
          onApply={(next) => {
            onApply(next);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function TrimForm({
  duration,
  trim,
  onApply,
}: {
  duration: number;
  trim: Timeline["trim"];
  onApply: (trim: Timeline["trim"]) => void;
}) {
  const [start, setStart] = useState(trim?.start ?? 0);
  const [end, setEnd] = useState(trim?.end ?? duration);
  const isFull = start <= 0 && end >= duration;
  return (
    <>
      <SliderField
        label="Start"
        unit="s"
        value={Number(start.toFixed(1))}
        min={0}
        max={Math.max(0, end - 1)}
        step={0.1}
        onChange={setStart}
      />
      <SliderField
        label="End"
        unit="s"
        value={Number(end.toFixed(1))}
        min={Math.min(duration, start + 1)}
        max={duration}
        step={0.1}
        onChange={setEnd}
      />
      <DialogFooter>
        <Button
          variant="ghost"
          className="sm:mr-auto"
          disabled={isFull}
          onClick={() => {
            setStart(0);
            setEnd(duration);
          }}
        >
          <ArrowCounterClockwise />
          Reset
        </Button>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button onClick={() => onApply(isFull ? undefined : { start, end })}>Apply</Button>
      </DialogFooter>
    </>
  );
}
