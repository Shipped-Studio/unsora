import { Check, Play, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { cn } from "@/lib/utils";

/** Tinted stand-ins for post media: soft, dark, and distinct from each other. */
const THUMBS = {
  rose: "bg-[linear-gradient(150deg,#5a3442,#22161b)]",
  indigo: "bg-[linear-gradient(150deg,#353d66,#16182a)]",
  teal: "bg-[linear-gradient(150deg,#22504d,#101f1e)]",
  sand: "bg-[linear-gradient(150deg,#5a4a38,#211b15)]",
} as const;

const QUEUE: {
  day: string;
  time: string;
  caption: string;
  providers: string[];
  thumb: keyof typeof THUMBS;
  video?: boolean;
  byAgent?: boolean;
}[] = [
  { day: "Tue", time: "9:00", caption: "Spring drop, behind the scenes", providers: ["instagram", "tiktok", "google"], thumb: "rose", video: true },
  { day: "Wed", time: "18:00", caption: "Studio tour, part one", providers: ["google", "linkedin"], thumb: "indigo", video: true, byAgent: true },
  { day: "Thu", time: "10:15", caption: "New collection, five looks", providers: ["instagram", "threads"], thumb: "teal", byAgent: true },
  { day: "Fri", time: "12:30", caption: "Three tips for better reels", providers: ["tiktok", "x"], thumb: "sand", video: true, byAgent: true },
];

/**
 * The brand stage beside the auth forms: the pitch, then a window of the
 * product running off the panel's edge: a week's queue going out to several
 * platforms, part of it added by an AI agent. Purely decorative, so the mock
 * is hidden from screen readers.
 */
export function AuthShowcase() {
  return (
    <div className="relative flex w-full flex-col overflow-hidden rounded-2xl bg-stage text-stage-foreground ring-1 ring-stage-border">
      {/* A soft light from the top right, so the black isn't flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.07),transparent)]"
      />

      <div className="relative space-y-5 px-10 pt-12 xl:px-14 xl:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-stage-border px-3 py-1 text-xs text-stage-muted">
          <span className="size-1.5 rounded-full bg-stage-foreground" />
          Social scheduler and AI studio
        </span>
        <h2 className="font-display text-4xl leading-[1.04] font-bold tracking-[-0.045em] xl:text-5xl">
          Plan it once.
          <br />
          <span className="text-stage-muted">Post it everywhere.</span>
        </h2>
        <p className="max-w-md text-[15px] leading-relaxed text-stage-muted">
          One calendar for Instagram, TikTok, YouTube, LinkedIn and more. Make posts with AI, or
          let Claude and ChatGPT fill your week.
        </p>
      </div>

      {/* The product, cropped by the panel's right and bottom edges. */}
      <div aria-hidden className="relative mt-12 flex flex-1 flex-col pl-10 xl:pl-14">
        <div className="-mr-px flex-1 rounded-tl-2xl border-t border-l border-stage-border bg-stage-card shadow-[0_-24px_80px_rgb(0_0_0/0.45)]">
          <div className="flex items-center justify-between border-b border-stage-border px-5 py-3.5">
            <span className="text-sm font-medium">This week</span>
            <span className="text-xs text-stage-muted tabular-nums">4 scheduled</span>
          </div>

          {/* The agent's note, part of the window rather than floating over it. */}
          <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl bg-stage-foreground/[0.06] px-3.5 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stage-foreground text-stage">
              <Sparkle className="size-3.5" weight="fill" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-snug">
              <span className="text-stage-muted">Claude · </span>
              Made 3 posts from your shoot and scheduled them.
            </p>
            <Check className="size-4 shrink-0 text-stage-foreground" weight="bold" />
          </div>

          <ul className="px-5 pt-2 pb-8">
            {QUEUE.map((post) => (
              <li
                key={post.caption}
                className="flex items-center gap-4 border-b border-stage-border py-3 last:border-0"
              >
                <span className="w-10 shrink-0 text-xs leading-tight tabular-nums">
                  <span className="block text-stage-muted">{post.day}</span>
                  {post.time}
                </span>
                <span
                  className={cn(
                    "relative flex aspect-4/5 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/10",
                    THUMBS[post.thumb],
                  )}
                >
                  {post.video ? <Play className="size-3 text-white/85" weight="fill" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{post.caption}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {post.providers.map((provider) => (
                      <PlatformIcon key={provider} provider={provider} className="size-3.5" />
                    ))}
                  </span>
                </span>
                {post.byAgent ? (
                  <span className="hidden shrink-0 items-center gap-1 rounded-full border border-stage-border px-2 py-0.5 text-[11px] text-stage-muted xl:inline-flex">
                    <Sparkle className="size-2.5" weight="fill" />
                    By Claude
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
