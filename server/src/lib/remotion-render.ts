import {
  renderMediaOnLambda,
  getRenderProgress,
} from "@remotion/lambda/client";

export interface RenderVideoRequest {
  videoUrl: string;
  subtitleChunks: any[];
  settings: Record<string, any>;
  duration: number;
  fps?: number;
  width?: number;
  height?: number;
  /**
   * Optional progress callback, invoked with a value between 0 and 1
   * representing the overall Lambda render progress.
   */
  onProgress?: (progress: number) => void | Promise<void>;
}

export async function renderSubtitleVideo(
  request: RenderVideoRequest,
): Promise<string> {
  const {
    videoUrl,
    subtitleChunks,
    settings,
    duration,
    fps = 30,
    width = 1080,
    height = 1920,
    onProgress,
  } = request;

  // Remotion Lambda hard-caps a render at 200 chunks. A fixed
  // framesPerLambda of 40 only covers ~4.4 minutes at 30fps, so scale it
  // with duration (150 chunks leaves headroom under the cap).
  const totalFrames = Math.ceil(duration * fps);
  const framesPerLambda = Math.max(40, Math.ceil(totalFrames / 150));

  try {
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: process.env.REMOTION_AWS_REGION as any,
      functionName: process.env.REMOTION_LAMBDA_FUNCTION_NAME!,
      serveUrl: process.env.REMOTION_SERVE_URL!,
      composition: "SubtitleVideo",
      inputProps: {
        videoUrl,
        subtitleChunks,
        settings,
      },
      codec: "h264",
      maxRetries: 2,
      framesPerLambda,
      privacy: "public",
      outName: `export_${Date.now()}.mp4`,
      overwrite: false,
      forceHeight: height,
      forceWidth: width,
      timeoutInMilliseconds: 240000,
    });

    console.log(`Render started with ID: ${renderId}`);

    let progress = 0;
    let lastStatus;

    while (progress < 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const status = await getRenderProgress({
        renderId,
        bucketName,
        functionName: process.env.REMOTION_LAMBDA_FUNCTION_NAME!,
        region: process.env.REMOTION_AWS_REGION as any,
      });

      lastStatus = status;
      progress = status.overallProgress;
      console.log(`Render progress: ${Math.round(progress * 100)}%`);

      if (onProgress) {
        try {
          await onProgress(progress);
        } catch (cbErr) {
          console.warn("onProgress callback threw:", cbErr);
        }
      }

      if (status.fatalErrorEncountered) {
        throw new Error(
          `Render failed: ${status.errors[0]?.message || "Unknown error"}`,
        );
      }

      if (status.done) {
        console.log(`Render completed! Video URL: ${status.outputFile}`);
        if (!status.outputFile) {
          throw new Error("Render completed but no output file URL returned");
        }
        return status.outputFile as string;
      }
    }

    if (lastStatus?.done && lastStatus?.outputFile) {
      console.log(`Render completed! Video URL: ${lastStatus.outputFile}`);
      return lastStatus.outputFile as string;
    }

    throw new Error("Render completed but no output file found");
  } catch (error) {
    console.error("Error rendering video on Lambda:", error);
    throw error;
  }
}
