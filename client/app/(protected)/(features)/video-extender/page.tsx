"use client";

import { VideoExtendForm } from "@/components/video-extender/video-extend-form";

export default function VideoExtenderPage() {
  return (
    <div className="relative flex-1">
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 pb-44 text-center text-muted-foreground">
        <p className="text-sm font-semibold">Upload a video to extend it</p>
        <p className="max-w-[300px] text-xs text-muted-foreground/70">
          Upload a clip, describe how you want to extend it, then choose a model
          and hit Extend Video
        </p>
      </div>
      <VideoExtendForm />
    </div>
  );
}
