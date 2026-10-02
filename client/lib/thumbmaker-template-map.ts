import type { ThumbnailTemplate } from "@/fake";

export type ThumbnailTemplateJson = {
  id: string;
  creator: string;
  video_link: string;
  title: string;
  image: string;
  tags: string[];
};

export function jsonTemplateToThumbnailTemplate(
  t: ThumbnailTemplateJson,
): ThumbnailTemplate {
  return {
    id: t.id,
    src: t.image,
    title: t.title?.trim() || "Untitled",
    creator: t.creator?.trim() || "Unknown",
    tags: t.tags ?? [],
    category: "preset",
  };
}
