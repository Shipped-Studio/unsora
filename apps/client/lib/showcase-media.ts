/**
 * Example outputs for the scrolling showcase on empty Create tools. They are
 * served by the marketing site (landing/public on tryunsora.com), so they
 * aren't bundled with the app; keep the paths in sync if files move there.
 */

export interface ShowcaseItem {
  src: string;
  type: "video" | "image";
  /** CSS aspect-ratio, so tiles hold their size before media loads. */
  aspect: "9/16" | "1/1" | "16/9";
}

const BASE = "https://tryunsora.com";

const media = (path: string, type: ShowcaseItem["type"], aspect: ShowcaseItem["aspect"]) => ({
  src: `${BASE}${encodeURI(path)}`,
  type,
  aspect,
});

/** Mixed so neighbouring tiles vary in shape and kind. */
export const SHOWCASE_MEDIA: ShowcaseItem[] = [
  media("/my takes/perfume.mp4", "video", "9/16"),
  media("/my takes/comparison2.mp4", "video", "16/9"),
  media("/home/faces/cafe.webp", "image", "9/16"),
  media("/my takes/doggo.mp4", "video", "1/1"),
  media("/my takes/hf_20260610_114249_4ea6db32-65cd-4354-bd9f-f9d99a6db624.mp4", "video", "9/16"),
  media("/my takes/motion.mp4", "video", "16/9"),
  media("/home/thumb-flow/output.webp", "image", "16/9"),
  media("/my takes/sideviews.mp4", "video", "9/16"),
  media("/my takes/hf_20260612_063442_2aee297e-8534-456f-8301-7cdab12a0a22.mp4", "video", "1/1"),
  media("/my takes/dandalion.mp4", "video", "16/9"),
  media("/home/faces/gym.webp", "image", "9/16"),
  media("/my takes/spray.mp4", "video", "9/16"),
  media("/my takes/eye.mp4", "video", "16/9"),
  media("/my takes/hf_20260610_120858_679e49ba-29fb-454b-91a0-c2fb4df7b262.mp4", "video", "9/16"),
  media("/my takes/square.mp4", "video", "1/1"),
  media("/my takes/ads.mp4", "video", "16/9"),
  media("/home/faces/street.webp", "image", "9/16"),
  media("/my takes/dodo.mp4", "video", "9/16"),
  media("/my takes/hf_20260612_065011_8dc722de-dd62-464a-acbf-a108d643c11f.mp4", "video", "16/9"),
  media("/my takes/hf_20260610_104935_6504c5c0-8d6b-4418-b46d-a27df8d58e92.mp4", "video", "9/16"),
  media("/home/upscale/retreat-after.webp", "image", "16/9"),
  media("/my takes/hf_20260610_103615_0a05b799-3c6b-44a1-a6d7-2a9e04109183.mp4", "video", "1/1"),
  media("/my takes/background change.mp4", "video", "9/16"),
  media("/my takes/spectrum.mp4", "video", "16/9"),
  media("/home/faces/kitchen.webp", "image", "9/16"),
  media("/my takes/hf_20260610_095942_3f357e4b-5eef-4952-8a7b-8bad8ceb1d0f.mp4", "video", "9/16"),
  media("/my takes/comparison.mp4", "video", "16/9"),
  media("/my takes/transitionss.mp4", "video", "9/16"),
  media("/home/thumb-flow/template.webp", "image", "16/9"),
  media("/my takes/hf_20260610_120737_d3dbe168-9d72-4bc2-bba8-609204310d68.mp4", "video", "9/16"),
  media("/my takes/movie materials.mp4", "video", "16/9"),
  media("/home/faces/car.webp", "image", "9/16"),
  media("/my takes/hf_20260612_065222_4ad29012-1bb4-43ba-bd90-13c9f4a47fde.mp4", "video", "16/9"),
  media("/my takes/hf_20260610_120804_39240bf9-e818-4c1d-bc53-3ed897bee439.mp4", "video", "9/16"),
  media("/my takes/transitions.mp4", "video", "16/9"),
  media("/home/faces/bedroom.webp", "image", "9/16"),
  media("/videos/denim.mp4", "video", "16/9"),
  media("/my takes/hf_20260610_110311_77fc391d-68ae-4b9e-b756-86fdf72b6c67.mp4", "video", "9/16"),
];
