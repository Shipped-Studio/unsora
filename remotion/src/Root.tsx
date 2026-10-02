import React from "react";
import { Composition } from "remotion";
import { SubtitleComposition } from "./SubtitleComposition";
import type {
  CompositionProps,
  SubtitleChunk,
  EditorSettings,
  PreviewStyleConfig,
} from "./types";
import { getMediaMetadata } from "./get-media-metadata";

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

// Must stay in sync with getCompositionDimensions in the client
// (client/components/subtitle-editor/tabs/preview-style-tab.tsx).
const getCompositionDimensions = (
  config: PreviewStyleConfig | undefined,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } => {
  switch (config?.aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "original":
    default:
      return { width: even(sourceWidth), height: even(sourceHeight) };
  }
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SubtitleVideo"
        component={SubtitleComposition}
        calculateMetadata={async ({ props }) => {
          const { durationInSeconds, dimensions } = await getMediaMetadata(
            props.videoUrl,
          );

          const { width, height } = getCompositionDimensions(
            props.settings?.previewStyle,
            dimensions?.width ?? 1080,
            dimensions?.height ?? 1920,
          );

          return {
            durationInFrames: Math.floor(durationInSeconds * 30),
            fps: 30,
            width,
            height,
          };
        }}
        defaultProps={{
          videoUrl: "",
          subtitleChunks: [] as SubtitleChunk[],
          settings: {} as EditorSettings,
        }}
      />
    </>
  );
};
