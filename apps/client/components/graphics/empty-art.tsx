import { cn } from "@/lib/utils";
import { Art, Card, Line, Photo, PlusDisc, Tag, Wave } from "./art-parts";

/*
 * Drawn scenes for empty scheduler and library screens.
 */

function PostCard({ v, className }: { v: number; className?: string }) {
  return (
    <Card className={cn("flex w-[30%] flex-col gap-[1.4cqw] p-[1.4cqw]", className)}>
      <Photo v={v} className="aspect-video" />
      <Line className="w-full" />
      <Line className="w-[60%]" />
    </Card>
  );
}

/** A dashed, empty post slot with a lime plus. */
function EmptySlot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute rounded-[2cqw] border-[0.4cqw] border-dashed border-foreground/25",
        className,
      )}
    >
      <PlusDisc className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}

function PostsScene() {
  return (
    <>
      <PostCard v={1} className="top-[18%] left-[7%] -rotate-6" />
      <PostCard v={3} className="top-[18%] right-[7%] rotate-6" />
      <EmptySlot className="top-[12%] left-[33%] aspect-[4/5] w-[34%] bg-card/60" />
    </>
  );
}

function DraftsScene() {
  return (
    <>
      <Card className="top-[10%] left-[22%] flex w-[56%] flex-col gap-[2cqw] p-[4cqw]">
        <Line className="w-full" />
        <Line className="w-[85%]" />
        <span className="flex items-center gap-[1cqw]">
          <Line className="w-[45%]" />
          <span className="h-[3.6cqw] w-[0.5cqw] bg-foreground" />
        </span>
      </Card>
      <Tag className="top-[50%] left-[22%]">Draft</Tag>
      <Tag lime className="top-[50%] right-[22%]">
        Schedule later
      </Tag>
    </>
  );
}

function QueueScene() {
  const rows = ["filled", "next", "empty", "empty"] as const;
  return (
    <div className="absolute inset-x-[16%] top-[9%] flex flex-col gap-[2cqw]">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-[2.4cqw]">
          <Line className="w-[10%] shrink-0" />
          {row === "filled" ? (
            <span className="flex h-[10cqw] flex-1 items-center gap-[2cqw] rounded-[1.6cqw] bg-card px-[1.4cqw] shadow-xs">
              <Photo v={0} className="h-[7cqw] w-[11cqw] shrink-0" />
              <Line className="w-[50%]" />
            </span>
          ) : (
            <span
              className={cn(
                "relative h-[10cqw] flex-1 rounded-[1.6cqw] border-[0.4cqw] border-dashed",
                row === "next" ? "border-brand bg-brand/15" : "border-foreground/20",
              )}
            >
              {row === "next" ? (
                <PlusDisc className="top-1/2 left-1/2 size-[6cqw] -translate-x-1/2 -translate-y-1/2" />
              ) : null}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const BARS = [30, 45, 38, 60, 52, 70, 58, 82, 100];

function AnalyticsScene() {
  return (
    <Card className="inset-x-[12%] top-[10%] bottom-[10%] p-[4cqw]">
      <div className="flex h-full items-end gap-[2cqw] border-b-[0.4cqw] border-dashed border-foreground/15">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-t-[1cqw]",
              i === BARS.length - 1 ? "bg-brand" : "bg-foreground/10",
            )}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </Card>
  );
}

function LibraryScene() {
  return (
    <>
      <Photo v={1} className="absolute top-[20%] left-[12%] aspect-square w-[26%] -rotate-6 shadow-sm" />
      <Card className="top-[20%] right-[12%] flex aspect-square w-[26%] rotate-6 items-center p-[3cqw]">
        <Wave bars={14} className="h-[45%] w-full" />
      </Card>
      <Photo v={0} className="absolute top-[12%] left-[35%] aspect-square w-[30%] shadow-sm ring-[0.5cqw] ring-brand">
        <span className="absolute top-1/2 left-1/2 grid size-[7cqw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand">
          <svg viewBox="0 0 10 10" className="size-1/2 translate-x-[8%]">
            <path d="M2.5 1.5 L8.5 5 L2.5 8.5Z" className="fill-brand-foreground" />
          </svg>
        </span>
      </Photo>
    </>
  );
}

const EMPTY_SCENES = {
  posts: PostsScene,
  drafts: DraftsScene,
  queue: QueueScene,
  analytics: AnalyticsScene,
  library: LibraryScene,
} as const;

export type EmptyArtName = keyof typeof EMPTY_SCENES;

export function EmptyArt({ name, className }: { name: EmptyArtName; className?: string }) {
  const Scene = EMPTY_SCENES[name];
  return (
    <Art className={className}>
      <Scene />
    </Art>
  );
}
