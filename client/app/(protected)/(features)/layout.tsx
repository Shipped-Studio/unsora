"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import {
  VideoCamera,
  ImageSquare,
  UserFocus,
  SmileySticker,
  PersonSimpleRun,
  FilmStrip,
  ClosedCaptioning,
  FilmReel,
  ArrowsOut,
  Microphone,
  FilmSlate,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";

interface RouteConfig {
  title: string;
  subtitle: string;
  icon?: ComponentType<IconProps>;
}

const routeConfigs: Record<string, RouteConfig> = {
  "/video-generator": {
    title: "Video Generator",
    subtitle: "Generate AI videos with multiple models",
  },
  "/image-generator": {
    title: "Image Generator",
    subtitle: "Create images with advanced AI models",
  },
  "/ai-influencer-studio": {
    title: "AI Influencer Studio",
    subtitle: "Create ultra-realistic influencer photos",
  },
  "/ai-avatar-maker": {
    title: "AI Avatar Maker",
    subtitle: "Create talking avatar videos from a script",
  },
  "/motion-control": {
    title: "Motion Control",
    subtitle: "AI motion capture and transfer",
  },
  "/movie-materials-generator": {
    title: "Movie Generator",
    subtitle: "AI-powered tool",
  },
  "/subtitle-remover": {
    title: "Subtitle Remover",
    subtitle: "Remove watermarks and subtitles in bulk",
  },
  "/video-face-swap": {
    title: "Video Face Swap",
    subtitle: "Swap faces in any video",
  },
  "/video-upscaler": {
    title: "Video Upscaler",
    subtitle: "Enhance videos to 4K/8K quality in bulk",
  },
  "/voice-changer": {
    title: "Voice Changer",
    subtitle: "Transform any recording into one of your cloned voices",
  },
  "/voice-generator": {
    title: "Voice Generator",
    subtitle: "Text-to-speech with built-in or cloned ElevenLabs voices",
  },
  "/directors-cut": {
    title: "Director's Cut",
    subtitle: "Supervise your video generation in a project",
  },
  "/thumbnail-generator": {
    title: "Thumbnail Generator",
    subtitle: "Generate YouTube thumbnails with AI",
  },
  "/thumbnail-generator/templates": {
    title: "Thumbnail Templates",
    subtitle: "Browse our preset templates or create your own custom templates",
  },
  "/image-upscaler": {
    title: "Image Upscaler",
    subtitle: "Enhance images to 4K/8K quality in bulk",
  },
  "/music-generator": {
    title: "Music Generator",
    subtitle: "Generate songs from lyrics and a style prompt",
  },
  "/skin-enhancer": {
    title: "Skin Enhancer",
    subtitle: "AI-powered portrait skin enhancement",
  },
  "/video-extender": {
    title: "Video Extender",
    subtitle: "Extend any video clip with AI",
  },
  "/ai-clipping": {
    title: "AI Clipping",
    subtitle: "Auto-clip long videos into viral short clips",
  },
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const config = routeConfigs[pathname];

  return (
    <>
      {config && (
        <Navbar
          title={config.title}
          subtitle={config.subtitle}
          icon={config.icon}
        />
      )}
      {children}
    </>
  );
}
