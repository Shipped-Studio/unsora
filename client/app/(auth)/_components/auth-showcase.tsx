import {
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  YouTubeIcon,
} from "@/components/icons";

const QUEUE = [
  {
    day: "Mon",
    time: "09:00",
    caption: "Behind the scenes of the spring drop",
    format: "Video",
    icons: [InstagramIcon, TikTokIcon],
    agent: false,
  },
  {
    day: "Tue",
    time: "12:30",
    caption: "Three things we learned shipping v2",
    format: "Text",
    icons: [LinkedInIcon],
    agent: true,
  },
  {
    day: "Wed",
    time: "18:00",
    caption: "Studio tour, part one",
    format: "Video",
    icons: [YouTubeIcon],
    agent: false,
  },
  {
    day: "Thu",
    time: "10:15",
    caption: "Five looks from the new collection",
    format: "Slideshow",
    icons: [TikTokIcon, InstagramIcon],
    agent: true,
  },
];

/** A static preview of the queue, shown next to the auth forms. */
export function AuthShowcase() {
  return (
    <div className="flex w-full flex-col justify-center gap-10 px-12 py-16 xl:px-20">
      <div className="max-w-md space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Plan, schedule and publish from one calendar.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Connect Instagram, TikTok, YouTube, LinkedIn and more. Write posts
          yourself, or let Claude create and schedule them through the Unsora
          MCP server.
        </p>
      </div>

      <div
        aria-hidden
        className="max-w-lg overflow-hidden rounded-xl bg-muted shadow-xs"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium text-foreground">Up next</span>
          <span className="text-xs text-muted-foreground">This week</span>
        </div>
        <ul className="divide-y">
          {QUEUE.map((item) => (
            <li key={item.caption} className="flex items-center gap-4 px-4 py-3">
              <div className="w-12 shrink-0 text-xs tabular-nums">
                <p className="font-medium text-foreground">{item.day}</p>
                <p className="text-muted-foreground">{item.time}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{item.caption}</p>
                <p className="text-xs text-muted-foreground">
                  {item.format}
                  {item.agent ? " · Scheduled by your agent" : ""}
                </p>
              </div>
              <div className="flex shrink-0 -space-x-1">
                {item.icons.map((Icon, index) => (
                  <span
                    key={index}
                    className="flex size-6 items-center justify-center rounded-full border bg-background"
                  >
                    <Icon className="size-3 text-foreground" />
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
