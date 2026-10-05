import { cn } from "@/lib/utils";

/*
 * Building blocks for the drawn scenes in tool-art.tsx and empty-art.tsx.
 * Everything is sized in container units (cqw) of the <Art> canvas, so a
 * scene looks the same on a 180px gallery card and a 360px empty state.
 * Colours come from tokens only: white cards, the black media stage and the
 * lime brand accent.
 */

/** 16:10 canvas every scene is drawn on. Decorative, hidden from readers. */
export function Art({
  motion = "always",
  className,
  children,
}: {
  /** "hover" pauses the animation until the surrounding `.group` is hovered. */
  motion?: "always" | "hover";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      data-art-motion={motion}
      className={cn(
        "@container relative aspect-[16/10] w-full overflow-hidden select-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A grey text line placeholder. */
export function Line({ className }: { className?: string }) {
  return <span className={cn("block h-[1.6cqw] rounded-full bg-foreground/12", className)} />;
}

/** Small uppercase label chip, like the tags on the landing's demos. */
export function Tag({
  lime,
  className,
  children,
}: {
  lime?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "absolute rounded-full px-[2.2cqw] py-[1cqw] text-[2.8cqw] leading-none font-semibold tracking-wide whitespace-nowrap uppercase shadow-xs",
        lime ? "bg-brand text-brand-foreground" : "bg-card text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

const PHOTOS = [
  {
    sun: [112, 34, 13],
    back: "M0 70 Q40 40 80 62 T160 52 V100 H0Z",
    front: "M0 84 Q50 62 100 80 T160 74 V100 H0Z",
  },
  {
    sun: [40, 30, 11],
    back: "M0 60 L40 36 L70 58 L105 30 L160 64 V100 H0Z",
    front: "M0 82 Q60 70 160 86 V100 H0Z",
  },
  {
    sun: [80, 60, 18],
    back: "M0 64 H160 V100 H0Z",
    front: "M0 80 Q80 72 160 82 V100 H0Z",
  },
  {
    sun: [128, 24, 9],
    back: "M0 74 Q30 50 60 70 Q95 40 130 66 Q148 58 160 62 V100 H0Z",
    front: "M0 88 Q70 76 160 90 V100 H0Z",
  },
] as const;

/** A landscape "photo" on the media stage: lime sun over two hills. */
export function Photo({
  v = 0,
  className,
  children,
}: {
  v?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const p = PHOTOS[v % PHOTOS.length];
  return (
    <div className={cn("relative overflow-hidden rounded-[1.4cqw] bg-media", className)}>
      <svg
        viewBox="0 0 160 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        <circle cx={p.sun[0]} cy={p.sun[1]} r={p.sun[2]} className="fill-brand" />
        <path d={p.back} className="fill-media-foreground/15" />
        <path d={p.front} className="fill-media-foreground/30" />
      </svg>
      {children}
    </div>
  );
}

/** A person on the media stage. `lime` gives them lime hair, the "same character" mark. */
export function Portrait({
  lime,
  className,
  children,
}: {
  lime?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[1.4cqw] bg-media", className)}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-0 size-full"
      >
        <path d="M14 100 Q16 66 50 63 Q84 66 86 100Z" className="fill-media-foreground/25" />
        <circle cx="50" cy="40" r="17" className="fill-media-foreground/40" />
        {lime ? (
          <path
            d="M32 42 Q30 20 50 19 Q70 20 68 42 Q66 31 50 30 Q36 31 32 42Z"
            className="fill-brand"
          />
        ) : null}
      </svg>
      {children}
    </div>
  );
}

const WAVE = [
  3, 5, 8, 6, 10, 14, 9, 6, 12, 18, 13, 8, 5, 9, 15, 20, 14, 9, 6, 11, 16, 12, 7, 4, 8, 13,
  10, 6, 4, 7, 5, 3, 6, 9, 12, 8, 5, 7, 4, 3,
];

/** Audio bars that bounce while the scene moves. */
export function Wave({
  bars = 24,
  barClassName = "bg-foreground/25",
  still,
  className,
}: {
  bars?: number;
  barClassName?: string;
  still?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center justify-between gap-[0.5cqw]", className)}>
      {WAVE.slice(0, bars).map((h, i) => (
        <span
          key={i}
          className={cn("w-[0.8cqw] rounded-full", !still && "animate-art-eq", barClassName)}
          style={{ height: `${(h / 20) * 100}%`, animationDelay: `${(i % 7) * -0.13}s` }}
        />
      ))}
    </span>
  );
}

/** Lime play button. */
export function Play({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "absolute top-1/2 left-1/2 grid size-[7cqw] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand",
        className,
      )}
    >
      <svg viewBox="0 0 10 10" className="size-1/2 translate-x-[8%]">
        <path d="M2.5 1.5 L8.5 5 L2.5 8.5Z" className="fill-brand-foreground" />
      </svg>
    </span>
  );
}

/** Hand-drawn style arrow, pointing right (or down). */
export function Arrow({ down, className }: { down?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 24"
      fill="none"
      className={cn("absolute stroke-foreground/35", down && "rotate-90", className)}
    >
      <path d="M3 18 Q20 2 36 12" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M29 7.5 L36.5 12 L29.5 16.5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** White card frame with the lime "result" ring. */
export function Result({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute rounded-[2.2cqw] bg-card p-[1.1cqw] shadow-sm ring-[0.5cqw] ring-brand",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Plain white card. */
export function Card({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("absolute rounded-[2cqw] bg-card shadow-xs", className)}>{children}</div>
  );
}

/** A plus sign drawn from two bars (no icon font), on a lime disc. */
export function PlusDisc({ className }: { className?: string }) {
  return (
    <span className={cn("absolute grid size-[7cqw] place-items-center rounded-full bg-brand", className)}>
      <span className="absolute h-[0.7cqw] w-[3cqw] rounded-full bg-brand-foreground" />
      <span className="absolute h-[3cqw] w-[0.7cqw] rounded-full bg-brand-foreground" />
    </span>
  );
}
