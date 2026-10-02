"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  VideoCamera,
  Image as ImageIcon,
  PersonSimpleRun,
  Sparkle,
  FilmSlate,
  TextT,
  ArrowsOutSimple,
  MagicWand,
} from "@phosphor-icons/react";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { cn } from "@/lib/utils";

interface ShowcaseItem {
  title: string;
  caption: string;
  image: string;
}

const SHOWCASE: ShowcaseItem[] = [
  {
    title: "Video Generation",
    caption: "Cinematic AI video from a single prompt — Sora, Veo, Kling.",
    image: "/feature-cards/video-generation.png",
  },
  {
    title: "Motion Control",
    caption: "Drive any character with reference video — pro motion capture.",
    image: "/feature-cards/motion-control.png",
  },
  {
    title: "AI Influencer Studio",
    caption: "One consistent character, infinite on-brand photos.",
    image: "/feature-cards/ai-influencer-studio.png",
  },
  {
    title: "Image Generation",
    caption: "Stunning images from text with the latest AI models.",
    image: "/feature-cards/image-generation.png",
  },
  {
    title: "Movie Materials",
    caption: "Shot lists, characters, and scene packs in one click.",
    image: "/feature-cards/movie-materials.png",
  },
  {
    title: "Subtitle Editor",
    caption: "Auto-transcribe, translate, and style subtitles with style.",
    image: "/feature-cards/subtitle-editor.png",
  },
  {
    title: "Video Upscaler",
    caption: "Push videos to 4K or 8K with AI super-resolution.",
    image: "/feature-cards/video-upscaler.png",
  },
];

const FEATURE_CHIPS = [
  { label: "Video", icon: VideoCamera },
  { label: "Motion", icon: PersonSimpleRun },
  { label: "Influencers", icon: Sparkle },
  { label: "Images", icon: ImageIcon },
  { label: "Storyboards", icon: FilmSlate },
  { label: "Subtitles", icon: TextT },
  { label: "Upscale", icon: ArrowsOutSimple },
  { label: "Restore", icon: MagicWand },
];

function ShowcaseStack() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SHOWCASE.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative aspect-[16/9] w-full">
      {SHOWCASE.map((item, i) => {
        const offset = (i - index + SHOWCASE.length) % SHOWCASE.length;
        const isFront = offset === 0;
        const isSecond = offset === 1;
        const isThird = offset === 2;

        if (!isFront && !isSecond && !isThird) {
          return (
            <div
              key={item.title}
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0"
            />
          );
        }

        // Stack: front card flat, deeper cards offset down/right and scaled.
        const transform = isFront
          ? "translate3d(0,0,0) scale(1)"
          : isSecond
            ? "translate3d(3%,5%,0) scale(0.95)"
            : "translate3d(6%,10%,0) scale(0.9)";

        const z = isFront ? 30 : isSecond ? 20 : 10;
        const opacity = isFront ? 1 : isSecond ? 0.7 : 0.4;

        return (
          <div
            key={item.title}
            className="absolute inset-0 transition-all duration-700 ease-out"
            style={{ transform, zIndex: z, opacity }}
            aria-hidden={!isFront}
          >
            <div className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl shadow-black/40">
              <Image
                src={item.image}
                alt={item.title}
                fill
                priority={isFront}
                sizes="(max-width: 1024px) 0px, 520px"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {isFront && (
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
                    <Sparkle className="size-3" weight="fill" />
                    Now live
                  </div>
                  <h3 className="mt-2.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-white/80">
                    {item.caption}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background glow — only visible behind the showcase column. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 top-1/4 h-[480px] w-[480px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/4 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute -right-24 top-0 h-[360px] w-[360px] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Showcase panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border/60 px-10 py-10 lg:flex xl:px-14 xl:py-12">
          <Link href="/" className="inline-flex shrink-0">
            <UnsoraLogo variant="full" priority className="h-9" />
          </Link>

          {/* Middle — pitch + showcase */}
          <div className="relative max-w-xl">
            <h1 className="mt-8 text-4xl font-bold leading-[1.05] tracking-tight text-foreground xl:text-5xl">
              The complete{" "}
              <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/50 bg-clip-text text-transparent">
                AI creative studio
              </span>{" "}
              for storytellers.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Generate cinematic video, animate characters, design influencers,
              upscale to 8K, and ship subtitle-perfect content — all from one
              workspace.
            </p>

            <div className="mt-8">
              <ShowcaseStack />
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <main className="relative flex min-h-screen flex-col">
          {/* Mobile brand row */}
          <div className="flex items-center justify-between gap-3 px-6 pt-6 lg:hidden">
            <Link href="/" className="inline-flex">
              <UnsoraLogo variant="full" priority className="h-8" />
            </Link>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              AI Creative Studio
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
            <div
              className={cn(
                "relative w-full max-w-md",
                // Subtle card-like feel on dark backgrounds without
                // boxing in the form on lighter ones.
                "rounded-2xl",
              )}
            >
              {children}
            </div>
          </div>

          {/* Mobile-only mini pitch under the form */}
          <div className="px-6 pb-8 text-center lg:hidden">
            <p className="text-[12px] text-muted-foreground">
              Video · Motion · Influencers · Subtitles · Upscaling — all in one
              workspace.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
