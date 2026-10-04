import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const YT_ID_RE = /^[\w-]{11}$/;

export function getYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const u = new URL(withProtocol);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && YT_ID_RE.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (u.pathname === "/watch" || u.pathname === "/watch/") {
        const v = u.searchParams.get("v");
        return v && YT_ID_RE.test(v) ? v : null;
      }
      const embed = u.pathname.match(/^\/embed\/([\w-]{11})/);
      if (embed?.[1]) return embed[1];
      const shorts = u.pathname.match(/^\/shorts\/([\w-]{11})/);
      if (shorts?.[1]) return shorts[1];
      const live = u.pathname.match(/^\/live\/([\w-]{11})/);
      if (live?.[1]) return live[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function looksLikeDirectVideoUrl(s: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}
