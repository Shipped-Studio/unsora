import { cn } from "@/lib/utils";
import {
  Arrow,
  Art,
  Card,
  Line,
  Photo,
  Play,
  Portrait,
  Result,
  Tag,
  Wave,
} from "./art-parts";

/*
 * One small drawn scene per Create tool, keyed by the tool's route. Used on
 * the home gallery, the /create page and each tool's empty state.
 */

function VideoScene() {
  return (
    <>
      <Card className="top-[44%] left-[5%] flex w-[40%] items-center gap-[1cqw] rounded-full px-[3cqw] py-[2.4cqw]">
        <Line className="flex-1" />
        <span className="h-[3.4cqw] w-[0.5cqw] animate-art-blink bg-foreground" />
      </Card>
      <Arrow className="top-[28%] left-[39%] w-[13%]" />
      <Result className="top-[16%] right-[6%] w-[44%] animate-art-float">
        <Photo v={0} className="aspect-video">
          <Play />
          <span className="absolute inset-x-[7%] bottom-[9%] h-[1.1cqw] overflow-hidden rounded-full bg-media-foreground/25">
            <span className="block h-full origin-left animate-art-progress rounded-full bg-brand" />
          </span>
        </Photo>
      </Result>
      <Tag className="top-[9%] right-[3%]">Generated</Tag>
    </>
  );
}

function ImageScene() {
  return (
    <>
      <div className="absolute top-[9%] left-1/2 grid w-[40%] -translate-x-1/2 grid-cols-2 gap-[1.4cqw]">
        {[0, 1, 2, 3].map((v) => (
          <Photo
            key={v}
            v={v}
            className={cn(
              "aspect-square",
              v === 1 && "animate-art-pop ring-[0.5cqw] ring-brand",
            )}
          />
        ))}
      </div>
      <Card className="bottom-[10%] left-[6%] flex w-[34%] flex-col gap-[1.2cqw] p-[2.4cqw]">
        <Line className="w-full" />
        <Line className="w-[65%]" />
      </Card>
      <Tag lime className="top-[12%] right-[8%]">
        4 images
      </Tag>
    </>
  );
}

const CLIP_SEGMENTS = ["left-[10%] w-[15%]", "left-[43%] w-[12%]", "left-[71%] w-[16%]"];

function ClipsScene() {
  return (
    <>
      <Card className="top-[10%] right-[6%] left-[6%] flex h-[17%] items-center px-[2cqw]">
        <Wave bars={40} still className="h-[70%] w-full" barClassName="bg-foreground/20" />
        {CLIP_SEGMENTS.map((pos) => (
          <span
            key={pos}
            className={cn("absolute inset-y-[10%] rounded-[1cqw] bg-brand/35 ring-[0.4cqw] ring-brand", pos)}
          />
        ))}
      </Card>
      {[
        { v: 1, pos: "left-[22%] -rotate-6" },
        { v: 0, pos: "left-[41.5%] animate-art-float" },
        { v: 3, pos: "left-[61%] rotate-6" },
      ].map(({ v, pos }) => (
        <Photo
          key={v}
          v={v}
          className={cn("absolute top-[38%] aspect-[9/16] w-[17%] rounded-[1.8cqw] shadow-sm", pos)}
        >
          <span className="absolute inset-x-[16%] bottom-[12%] h-[2.4cqw] rounded-[0.6cqw] bg-brand" />
        </Photo>
      ))}
    </>
  );
}

function SubtitlesScene() {
  return (
    <>
      <Result className="top-[9%] left-[18%] w-[64%]">
        <Portrait className="aspect-video">
          <span className="absolute inset-x-0 bottom-[11%] flex justify-center gap-[1.2cqw]">
            <span className="h-[3.4cqw] w-[9cqw] rounded-[0.6cqw] bg-media-foreground" />
            <span className="h-[3.4cqw] w-[13cqw] animate-art-pop rounded-[0.6cqw] bg-brand" />
            <span className="h-[3.4cqw] w-[7cqw] rounded-[0.6cqw] bg-media-foreground" />
          </span>
        </Portrait>
      </Result>
      <Wave bars={36} className="absolute top-[76%] right-[20%] left-[20%] h-[11%]" />
      <Tag className="top-[50%] left-[4%]">Transcribe</Tag>
      <Tag lime className="top-[20%] right-[5%]">
        Style
      </Tag>
    </>
  );
}

function ThumbnailScene() {
  return (
    <>
      <Card className="top-[16%] left-[14%] aspect-video w-[58%] -rotate-6 bg-card/70" />
      <div className="absolute top-[13%] left-[24%] w-[60%] rotate-2 rounded-[2.2cqw] bg-card p-[1.1cqw] shadow-sm">
        <div className="relative aspect-video overflow-hidden rounded-[1.4cqw] bg-media">
          <div className="absolute top-[18%] left-[7%] flex w-[50%] flex-col gap-[1.4cqw]">
            <span className="h-[4cqw] w-full rounded-[0.6cqw] bg-media-foreground" />
            <span className="h-[4cqw] w-[82%] rounded-[0.6cqw] bg-brand" />
            <span className="h-[4cqw] w-[58%] rounded-[0.6cqw] bg-media-foreground" />
          </div>
          <Portrait lime className="absolute inset-y-0 right-0 w-[44%] rounded-none bg-transparent" />
        </div>
      </div>
      <Tag lime className="top-[7%] right-[10%] rotate-6 animate-art-pop">
        New
      </Tag>
      <Tag className="bottom-[12%] left-[10%]">Template</Tag>
    </>
  );
}

function VoiceScene() {
  return (
    <>
      <Card className="top-[11%] right-[14%] left-[14%] flex flex-col gap-[1.8cqw] p-[3cqw]">
        <Line className="w-full" />
        <span className="flex items-center gap-[1.2cqw]">
          <Line className="w-[28%]" />
          <span className="h-[2.4cqw] w-[30%] rounded-full bg-brand" />
          <Line className="flex-1" />
        </span>
        <Line className="w-[58%]" />
      </Card>
      <div className="absolute top-[60%] right-[20%] left-[20%] flex h-[19%] items-center gap-[2cqw] rounded-full bg-foreground px-[2cqw]">
        <span className="relative size-[8cqw] shrink-0">
          <Play className="size-full" />
        </span>
        <Wave bars={22} className="h-[60%] flex-1" barClassName="bg-background/70" />
      </div>
    </>
  );
}

const EQ = [40, 70, 55, 90, 65, 100, 50, 80, 60, 35];

function MusicScene() {
  return (
    <>
      <div className="absolute top-[13%] left-[23%] aspect-square w-[34%] animate-art-spin rounded-full bg-media">
        <span className="absolute inset-[12%] rounded-full border-[0.3cqw] border-media-foreground/15" />
        <span className="absolute inset-[24%] rounded-full border-[0.3cqw] border-media-foreground/15" />
        <span className="absolute inset-[34%] rounded-full bg-brand" />
        <span className="absolute inset-[47%] rounded-full bg-media" />
      </div>
      <Photo v={2} className="absolute top-[13%] left-[8%] aspect-square w-[34%] rounded-[2cqw] shadow-sm" />
      <div className="absolute top-[18%] right-[8%] flex h-[34%] w-[34%] items-end gap-[1cqw]">
        {EQ.map((h, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 origin-bottom animate-art-eq rounded-t-[0.6cqw]",
              i === 5 ? "bg-brand" : "bg-foreground/80",
            )}
            style={{ height: `${h}%`, animationDelay: `${(i % 5) * -0.17}s` }}
          />
        ))}
      </div>
      <div className="absolute top-[60%] right-[8%] flex w-[34%] flex-col gap-[1.4cqw]">
        <Line className="w-full" />
        <Line className="w-[70%]" />
      </div>
    </>
  );
}

function AvatarScene() {
  return (
    <>
      <div className="absolute top-[8%] left-[26%] w-[30%] rounded-[2.2cqw] bg-card p-[1.1cqw] shadow-sm">
        <Portrait className="aspect-[4/5]">
          <Wave
            bars={16}
            className="absolute inset-x-[12%] bottom-[7%] h-[12%]"
            barClassName="bg-brand"
          />
        </Portrait>
      </div>
      <Card className="top-[14%] right-[8%] flex w-[30%] flex-col gap-[1.4cqw] rounded-bl-none p-[2.4cqw]">
        <Line className="w-full" />
        <Line className="w-[80%]" />
        <Line className="w-[50%]" />
      </Card>
      <Tag className="top-[62%] left-[6%]">Script</Tag>
      <Tag lime className="top-[62%] right-[12%]">
        Speaking
      </Tag>
    </>
  );
}

function InfluencerScene() {
  const polaroid = "absolute rounded-[1.6cqw] bg-card p-[1cqw] pb-[3.4cqw] shadow-sm";
  return (
    <>
      <div className={cn(polaroid, "top-[17%] left-[11%] w-[22%] -rotate-6")}>
        <Portrait lime className="aspect-[4/5]" />
      </div>
      <div className={cn(polaroid, "top-[17%] right-[11%] w-[22%] rotate-6")}>
        <Portrait lime className="aspect-[4/5]" />
      </div>
      <div className={cn(polaroid, "top-[7%] left-[36%] w-[28%] animate-art-float ring-[0.5cqw] ring-brand")}>
        <Portrait lime className="aspect-[4/5]" />
      </div>
      <Tag className="bottom-[9%] left-1/2 -translate-x-1/2">Same character</Tag>
    </>
  );
}

function Figure({ className, lime }: { className?: string; lime?: boolean }) {
  const stroke = lime ? "stroke-brand" : "stroke-media-foreground/60";
  const joint = lime ? "fill-brand" : "fill-media-foreground/60";
  return (
    <svg viewBox="0 0 60 80" fill="none" className={cn("absolute inset-0 size-full", className)}>
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={stroke}>
        <path d="M30 22 L30 46" />
        <path d="M30 27 L19 36 L12 27" />
        <path d="M30 27 L41 34 L49 42" />
        <path d="M30 46 L22 61 L17 73" />
        <path d="M30 46 L39 60 L46 71" />
      </g>
      <circle cx="30" cy="14" r="6" className={joint} />
      {[
        [19, 36],
        [41, 34],
        [22, 61],
        [39, 60],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" className={joint} />
      ))}
    </svg>
  );
}

function MotionScene() {
  return (
    <>
      <div className="absolute top-[12%] left-[13%] aspect-[3/4] w-[25%] overflow-hidden rounded-[1.8cqw] bg-media shadow-sm">
        <Figure className="inset-[10%] size-[80%]" />
      </div>
      <Arrow className="top-[34%] left-[42%] w-[16%]" />
      <Result className="top-[12%] right-[13%] w-[25%]">
        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.4cqw] bg-media">
          <Figure lime className="inset-[10%] size-[80%] animate-art-float" />
        </div>
      </Result>
      <Tag className="top-[76%] left-[13%]">Reference</Tag>
      <Tag lime className="top-[76%] right-[13%]">
        Your character
      </Tag>
    </>
  );
}

function MovieScene() {
  return (
    <>
      <div className="absolute top-[14%] right-[5%] left-[5%] rounded-[1.6cqw] bg-foreground px-[2cqw] py-[3.2cqw]">
        {["top-[0.9cqw]", "bottom-[0.9cqw]"].map((edge) => (
          <span key={edge} className={cn("absolute inset-x-[2cqw] flex justify-between", edge)}>
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="h-[1.3cqw] w-[2cqw] rounded-[0.3cqw] bg-background/35" />
            ))}
          </span>
        ))}
        <div className="grid grid-cols-3 gap-[1.6cqw]">
          <Portrait lime className="aspect-video" />
          <Photo v={1} className="aspect-video" />
          <Photo v={2} className="aspect-video" />
        </div>
      </div>
      <div className="absolute top-[64%] right-[5%] left-[5%] grid grid-cols-3 justify-items-center">
        {["Character", "Location", "Shot"].map((label, i) => (
          <span
            key={label}
            className={cn(
              "rounded-full px-[2.2cqw] py-[1cqw] text-[2.8cqw] leading-none font-semibold tracking-wide uppercase shadow-xs",
              i === 0 ? "bg-brand text-brand-foreground" : "bg-card text-foreground",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

const MOSAIC = [
  "bg-foreground/20", "bg-foreground/35", "bg-brand/70", "bg-foreground/25", "bg-foreground/15",
  "bg-foreground/30", "bg-brand/50", "bg-foreground/40", "bg-foreground/20", "bg-foreground/30",
  "bg-foreground/15", "bg-foreground/25", "bg-foreground/45", "bg-foreground/35", "bg-foreground/20",
  "bg-foreground/40", "bg-foreground/50", "bg-foreground/30", "bg-foreground/55", "bg-foreground/35",
  "bg-foreground/55", "bg-foreground/45", "bg-foreground/60", "bg-foreground/50", "bg-foreground/45",
];

/** Corner brackets around the sharp result. */
function Brackets() {
  const corner = "absolute size-[5cqw] border-brand";
  return (
    <>
      <span className={cn(corner, "-top-[1.6cqw] -left-[1.6cqw] rounded-tl-[1.4cqw] border-t-[0.7cqw] border-l-[0.7cqw]")} />
      <span className={cn(corner, "-top-[1.6cqw] -right-[1.6cqw] rounded-tr-[1.4cqw] border-t-[0.7cqw] border-r-[0.7cqw]")} />
      <span className={cn(corner, "-bottom-[1.6cqw] -left-[1.6cqw] rounded-bl-[1.4cqw] border-b-[0.7cqw] border-l-[0.7cqw]")} />
      <span className={cn(corner, "-right-[1.6cqw] -bottom-[1.6cqw] rounded-br-[1.4cqw] border-r-[0.7cqw] border-b-[0.7cqw]")} />
    </>
  );
}

function UpscaleScene({ video }: { video?: boolean }) {
  return (
    <>
      <div
        className={cn(
          "absolute top-[30%] left-[9%] grid grid-cols-5 overflow-hidden rounded-[1cqw]",
          video ? "aspect-video w-[26%]" : "aspect-square w-[20%]",
        )}
      >
        {MOSAIC.map((cell, i) => (
          <span key={i} className={cell} />
        ))}
      </div>
      <Arrow className="top-[33%] left-[35%] w-[13%]" />
      <div
        className={cn(
          "absolute right-[9%] animate-art-pop",
          video ? "top-[22%] w-[42%]" : "top-[12%] w-[36%]",
        )}
      >
        <Photo v={video ? 0 : 3} className={video ? "aspect-video" : "aspect-square"}>
          {video ? <Play /> : null}
        </Photo>
        <Brackets />
      </div>
      <Tag lime className="right-[6%] bottom-[9%]">
        {video ? "4K" : "4× sharper"}
      </Tag>
    </>
  );
}

function RemoveSubtitlesScene() {
  return (
    <>
      <Result className="top-[11%] left-[16%] w-[68%]">
        <Photo v={2} className="aspect-video">
          <span className="absolute inset-0 animate-art-wipe">
            <span className="absolute inset-x-0 bottom-[22%] flex justify-center gap-[1.2cqw]">
              <span className="h-[3.4cqw] w-[12cqw] rounded-[0.6cqw] bg-media-foreground" />
              <span className="h-[3.4cqw] w-[16cqw] rounded-[0.6cqw] bg-media-foreground" />
            </span>
            <span className="absolute inset-x-0 bottom-[9%] flex justify-center gap-[1.2cqw]">
              <span className="h-[3.4cqw] w-[18cqw] rounded-[0.6cqw] bg-media-foreground" />
              <span className="h-[3.4cqw] w-[8cqw] rounded-[0.6cqw] bg-media-foreground" />
            </span>
          </span>
          <span className="absolute inset-y-0 w-[0.7cqw] animate-art-scan rounded-full bg-brand" />
        </Photo>
      </Result>
      <Tag lime className="right-[8%] bottom-[10%]">
        Text removed
      </Tag>
    </>
  );
}

function VoiceChangerScene() {
  return (
    <>
      <Card className="top-[12%] right-[18%] left-[18%] flex h-[19%] items-center gap-[2cqw] rounded-full px-[2.4cqw]">
        <span className="size-[8cqw] shrink-0 rounded-full bg-foreground/15" />
        <Wave bars={24} still className="h-[55%] flex-1" />
      </Card>
      <Arrow down className="top-[34%] left-[45%] w-[10%]" />
      <div className="absolute top-[58%] right-[18%] left-[18%] flex h-[19%] items-center gap-[2cqw] rounded-full bg-brand px-[2.4cqw] shadow-sm">
        <span className="size-[8cqw] shrink-0 rounded-full bg-brand-foreground/80" />
        <Wave bars={24} className="h-[55%] flex-1" barClassName="bg-brand-foreground/70" />
      </div>
    </>
  );
}

const SCENES: Record<string, () => React.ReactNode> = {
  "/video-generator": VideoScene,
  "/image-generator": ImageScene,
  "/ai-clipping": ClipsScene,
  "/subtitle-editor": SubtitlesScene,
  "/thumbnail-generator": ThumbnailScene,
  "/voice-generator": VoiceScene,
  "/voice-changer": VoiceChangerScene,
  "/music-generator": MusicScene,
  "/ai-avatar-maker": AvatarScene,
  "/ai-influencer-studio": InfluencerScene,
  "/motion-control": MotionScene,
  "/movie-materials-generator": MovieScene,
  "/image-upscaler": () => <UpscaleScene />,
  "/video-upscaler": () => <UpscaleScene video />,
  "/subtitle-remover": RemoveSubtitlesScene,
};

export function hasToolArt(href: string) {
  return href in SCENES;
}

/** The drawn scene for a Create tool, or nothing if the route has none. */
export function ToolArt({
  href,
  motion,
  className,
}: {
  href: string;
  motion?: "always" | "hover";
  className?: string;
}) {
  const Scene = SCENES[href];
  if (!Scene) return null;
  return (
    <Art motion={motion} className={className}>
      <Scene />
    </Art>
  );
}
