"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "@phosphor-icons/react";

const passthroughLoader = ({ src }: { src: string }) => src;

const VIDEOS = [
  {
    id: "lU_l3RQRjyw",
    title: "Connect the MCP server",
    description:
      "Add Unsora as a connector in Claude so it can create and schedule for you.",
  },
  {
    id: "jkCLJ_Zc4sE",
    title: "Add the Unsora skill to Claude",
    description: "Install the skill so Claude knows the steps for each workflow.",
  },
] as const;

/**
 * Click to play. Only the thumbnail loads with the page; YouTube's player
 * loads after the click.
 */
function VideoEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${title}`}
          className="group absolute inset-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <Image
            loader={passthroughLoader}
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-scrim/60 text-media-foreground shadow-xs transition-colors group-hover:bg-scrim/75">
              <Play weight="fill" className="size-5" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

export function SetupVideos() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {VIDEOS.map((video) => (
        <div key={video.id} className="space-y-2">
          <VideoEmbed id={video.id} title={video.title} />
          <div>
            <p className="text-sm font-medium">{video.title}</p>
            <p className="text-sm text-muted-foreground">{video.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
