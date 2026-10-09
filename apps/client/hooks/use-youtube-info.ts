"use client";

import { useQuery } from "@tanstack/react-query";

export interface YouTubeInfo {
  title: string;
  author: string | null;
}

/**
 * Title and channel of a YouTube video from YouTube's public oEmbed endpoint
 * (no key, CORS enabled). Cached for the session; null while loading or when
 * the video is private or removed, so callers keep their fallback label.
 */
export function useYouTubeInfo(videoId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["youtube-oembed", videoId],
    enabled: Boolean(videoId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async ({ signal }): Promise<YouTubeInfo | null> => {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
        { signal },
      );
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      if (!body || typeof body.title !== "string") return null;
      return {
        title: body.title,
        author: typeof body.author_name === "string" ? body.author_name : null,
      };
    },
  });

  return query.data ?? null;
}
