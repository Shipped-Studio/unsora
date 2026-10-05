import { Check, Play, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { PlatformIcon } from "@/components/scheduler/platform-icon";

const PLATFORMS = [
  { provider: "instagram", name: "Instagram", when: "Tue 9:00" },
  { provider: "tiktok", name: "TikTok", when: "Tue 9:00" },
  { provider: "google", name: "YouTube", when: "Tue 12:30" },
] as const;

const UP_NEXT = [
  { day: "Wed", time: "18:00", caption: "Studio tour, part one", providers: ["google"] },
  { day: "Thu", time: "10:15", caption: "New collection, five looks", providers: ["tiktok", "instagram"] },
] as const;

/**
 * The brand stage beside the auth forms: a dark panel (in both themes) with
 * a mock of the product, a post going out to several platforms and an agent
 * scheduling for you. Purely decorative, so it is hidden from screen readers.
 */
export function AuthShowcase() {
  return (
    <div className="relative flex w-full flex-col justify-between gap-12 overflow-hidden rounded-2xl bg-stage px-10 py-10 text-stage-foreground ring-1 ring-stage-border xl:px-14 xl:py-12">
      {/* Soft brand glow in the corner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 -right-48 size-128 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative max-w-md space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-stage-border px-3 py-1 text-xs text-stage-muted">
          <span className="size-1.5 rounded-full bg-brand" />
          Social scheduler and AI studio
        </span>
        <h2 className="font-display text-3xl leading-[1.08] font-bold tracking-[-0.04em] xl:text-4xl">
          Create it once.
          <br />
          <span className="text-stage-muted">Post it everywhere.</span>
        </h2>
        <p className="text-sm leading-relaxed text-stage-muted">
          Plan and publish to Instagram, TikTok, YouTube, LinkedIn and more from one calendar,
          or let Claude and ChatGPT make and schedule posts for you.
        </p>
      </div>

      <div aria-hidden className="relative">
        <div className="w-full max-w-lg">
          <div className="relative">
          {/* The post being scheduled. */}
          <div className="rounded-2xl border border-stage-border bg-stage-card p-4 shadow-xl">
            <div className="flex gap-4">
              <div className="relative flex aspect-4/5 w-28 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand via-chart-2 to-stage">
                <span className="flex size-8 items-center justify-center rounded-full bg-stage/60 text-stage-foreground backdrop-blur-sm">
                  <Play className="size-3.5" weight="fill" />
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-3 py-1">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Spring drop, behind the scenes</p>
                  <p className="text-xs leading-relaxed text-stage-muted">
                    Three weeks of sketches, samples and one very long shoot day.
                  </p>
                </div>
                <ul className="space-y-2">
                  {PLATFORMS.map((p) => (
                    <li key={p.provider} className="flex items-center gap-2 text-xs">
                      <PlatformIcon provider={p.provider} className="size-4" />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-stage-muted tabular-nums">{p.when}</span>
                      <Check className="size-3.5 text-brand" weight="bold" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* The agent, floating over the corner of the card. */}
          <div className="absolute -right-4 -bottom-20 w-64 rounded-2xl border border-stage-border bg-stage-card p-3.5 shadow-xl xl:-right-12">
            <div className="flex items-center gap-2 text-xs text-stage-muted">
              <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <Sparkle className="size-3" weight="fill" />
              </span>
              Claude, via Unsora
            </div>
            <p className="mt-2 text-xs leading-relaxed">
              Made 3 short videos and added them to your queue for next week.
            </p>
          </div>
          </div>

          {/* What's next in the queue. */}
          <ul className="mt-20 max-w-[60%] space-y-1.5">
            {UP_NEXT.map((item) => (
              <li
                key={item.caption}
                className="flex items-center gap-3 rounded-xl border border-stage-border px-3 py-2.5 text-xs"
              >
                <span className="w-16 shrink-0 text-stage-muted tabular-nums">
                  {item.day} {item.time}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.caption}</span>
                <span className="flex shrink-0 -space-x-1">
                  {item.providers.map((provider) => (
                    <PlatformIcon key={provider} provider={provider} className="size-4" />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
