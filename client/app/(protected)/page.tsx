"use client";

import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Lightning,
  // MusicNotes,
  CalendarBlank,
  Folders,
  Scissors,
  ImagesSquare,
  // UserFocus,
  // Microphone,
  type IconProps,
} from "@phosphor-icons/react";
import cuid from "cuid";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AgentConnectCard } from "@/components/dashboard/agent-connect-card";
import type { ComponentType } from "react";

interface Tool {
  title: string;
  description: string;
  href: string;
  image?: string;
  icon?: ComponentType<IconProps>;
  badge?: string;
}

interface Section {
  title: string;
  description: string;
  /** Tailwind grid-cols-* classes covering sm/md/lg breakpoints. */
  cols: string;
  size: "lg" | "md" | "sm";
  tools: Tool[];
}

const featured: Tool = {
  title: "Video Generation",
  description: "Cinematic AI video from a single prompt — Sora, Veo, Kling.",
  href: "/video-generator",
  image: "/feature-cards/video-generation.png",
  badge: "Flagship",
};

const sections: Section[] = [
  {
    title: "Create",
    description: "Generate video, images, and audio from a prompt.",
    cols: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    size: "md",
    tools: [
      {
        title: "Image Generation",
        description: "Stunning images from text with the latest AI models.",
        href: "/image-generator",
        image: "/feature-cards/image-generation.png",
      },
      {
        title: "Motion Control",
        description:
          "Drive any character with reference video — pro motion capture.",
        href: "/motion-control",
        image: "/feature-cards/motion-control.png",
      },
      {
        title: "AI Influencer Studio",
        description: "One consistent character, infinite on-brand photos.",
        href: "/ai-influencer-studio",
        image: "/feature-cards/ai-influencer-studio.png",
      },
      {
        title: "Movie Materials",
        description: "Shot lists, characters, and scene packs in one click.",
        href: "/movie-materials-generator",
        image: "/feature-cards/movie-materials.png",
      },
      {
        title: "Thumbnail Generator",
        description: "Click-worthy YouTube thumbnails from a prompt or template.",
        href: "/thumbnail-generator",
        icon: ImagesSquare,
      },
      // {
      //   title: "Music Generator",
      //   description:
      //     "Turn lyrics and a style prompt into a full AI-generated song.",
      //   href: "/music-generator",
      //   icon: MusicNotes,
      //   badge: "New",
      // },
      // {
      //   title: "AI Avatar Maker",
      //   description:
      //     "Talking avatar videos from a portrait and script — lip-synced.",
      //   href: "/ai-avatar-maker",
      //   icon: UserFocus,
      //   badge: "New",
      // },
      // {
      //   title: "Voice Generator",
      //   description:
      //     "Natural text-to-speech with expressive AI voices.",
      //   href: "/voice-generator",
      //   icon: Microphone,
      //   badge: "New",
      // },
    ],
  },
  {
    title: "Edit & enhance",
    description: "Fix, upscale, and repurpose footage you already have.",
    cols: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    size: "md",
    tools: [
      {
        title: "Subtitle Editor",
        description:
          "Auto-transcribe, translate, and style subtitles with style.",
        href: `/subtitle-editor/${cuid()}`,
        image: "/feature-cards/subtitle-editor.png",
      },
      {
        title: "Subtitle Remover",
        description: "Erase burned-in subtitles and logos in bulk.",
        href: "/subtitle-remover",
        image: "/feature-cards/subtitle-remover.png",
      },
      {
        title: "AI Clipping",
        description: "Auto-clip long videos into viral-ready short clips.",
        href: "/ai-clipping",
        icon: Scissors,
      },
      {
        title: "Video Upscaler",
        description: "Push videos to 4K or 8K with AI super-resolution.",
        href: "/video-upscaler",
        image: "/feature-cards/video-upscaler.png",
      },
      {
        title: "Image Upscaler",
        description: "Restore and upscale images to print-ready quality.",
        href: "/image-upscaler",
        image: "/feature-cards/image-upscaler.png",
      },
    ],
  },
  {
    title: "Publish & automate",
    description:
      "Schedule everything you make — by hand or straight from your agent.",
    cols: "sm:grid-cols-2 lg:grid-cols-3",
    size: "sm",
    tools: [
      {
        title: "Post Scheduler",
        description:
          "Queue posts across connected accounts — agents can schedule too.",
        href: "/scheduler",
        icon: CalendarBlank,
      },
      {
        title: "Files",
        description: "Every upload and generation, reusable in any tool.",
        href: "/files",
        icon: Folders,
      },
    ],
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function FeatureCard({
  tool,
  size = "md",
  featured = false,
}: {
  tool: Tool;
  size?: "lg" | "md" | "sm";
  featured?: boolean;
}) {
  const padding =
    size === "lg"
      ? "p-2.5 sm:p-3 lg:p-2.5 xl:p-2"
      : "p-2 sm:p-2.5 lg:p-2 xl:p-1.5";
  const titleSize =
    size === "lg"
      ? "text-base sm:text-lg md:text-xl lg:text-lg xl:text-base"
      : "text-sm sm:text-base lg:text-sm";
  const descSize =
    size === "lg"
      ? "text-xs sm:text-sm lg:text-xs"
      : "text-[11px] sm:text-xs lg:text-[11px]";

  return (
    <Link
      href={tool.href}
      className="group block rounded-2xl outline-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        size="sm"
        className={cn(
          padding,
          "h-full gap-2 sm:gap-2.5 lg:gap-1.5 xl:gap-1.5",
          "transition-[box-shadow,ring-color] duration-200 ease-out",
          "hover:shadow-md hover:ring-foreground/20",
          featured && "ring-primary/15 hover:ring-primary/30",
        )}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted lg:aspect-5/3 xl:aspect-2/1">
          {tool.image ? (
            <Image
              src={tool.image}
              alt={tool.title}
              fill
              sizes={
                featured
                  ? "(max-width: 768px) 100vw, (max-width: 1024px) 66vw, 800px"
                  : size === "lg"
                    ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
                    : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
              }
              priority={featured}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : tool.icon ? (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/12 via-primary/6 to-transparent transition-transform duration-500 ease-out group-hover:scale-[1.02]">
              <tool.icon
                className="size-10 text-primary/45 transition-colors duration-200 group-hover:text-primary/65 sm:size-12 lg:size-10 xl:size-9"
                weight="duotone"
              />
            </div>
          ) : null}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
          {tool.badge && (
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm sm:left-3 sm:top-3">
              <Lightning className="size-2.5" weight="fill" />
              {tool.badge}
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-2 px-1.5 pb-1 sm:gap-3 sm:px-2 lg:gap-2 lg:px-1 lg:pb-0.5">
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "font-semibold tracking-tight text-foreground",
                titleSize,
              )}
            >
              {tool.title}
            </h3>
            <p
              className={cn(
                "mt-0.5 line-clamp-2 text-muted-foreground",
                descSize,
              )}
            >
              {tool.description}
            </p>
          </div>
          <span
            aria-hidden
            className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80 text-foreground/70 backdrop-blur-sm transition-[border-color,background-color,color,transform] duration-200 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:size-9 lg:size-7 xl:size-7"
          >
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 border-b border-border/50 pb-3 sm:mb-5 lg:mb-3.5 lg:pb-2.5 xl:mb-3">
      <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg lg:text-base">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm lg:mt-0.5 lg:text-xs">
        {description}
      </p>
    </div>
  );
}

export default function ExplorePage() {
  const { user } = useUser();
  const greeting = getGreeting();
  const firstName = user?.firstName ?? null;

  return (
    <div className="relative flex-1 overflow-auto bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(520px,55vh)] hero-ambient"
      />

      <div className="relative w-full px-5 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-7 xl:px-10 xl:py-8">
        {/* Hero */}
        <header className="mb-6 sm:mb-8 lg:mb-5 xl:mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            Explore
          </p>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
            {greeting}
            {firstName ? (
              <>
                ,{" "}
                <span className="hero-headline-accent">{firstName}</span>
              </>
            ) : null}
            .
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Your AI creative studio — pick a tool below, or{" "}
            <a
              href="#connect-agent"
              className="font-medium text-foreground/80 underline decoration-primary/35 underline-offset-[3px] transition-colors hover:text-foreground hover:decoration-primary/60"
            >
              connect an agent
            </a>{" "}
            to run everything through MCP and the API.
          </p>
        </header>

        {/* Agent hero + flagship tool */}
        <section className="mb-8 grid grid-cols-1 items-stretch gap-4 sm:gap-5 md:grid-cols-12 lg:mb-6 lg:items-start lg:gap-4 xl:mb-7">
          <div className="md:col-span-5">
            <AgentConnectCard />
          </div>
          <div className="md:col-span-7">
            <FeatureCard tool={featured} size="lg" featured />
          </div>
        </section>

        {/* Tool sections */}
        <div className="space-y-9 lg:space-y-7 xl:space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <SectionHeader
                title={section.title}
                description={section.description}
              />
              <div
                className={`grid grid-cols-1 gap-3.5 sm:gap-4 lg:gap-3 xl:gap-2.5 ${section.cols}`}
              >
                {section.tools.map((tool) => (
                  <FeatureCard key={tool.title} tool={tool} size={section.size} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
