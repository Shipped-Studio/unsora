import ffmpegLib from "fluent-ffmpeg";

/**
 * Shared fluent-ffmpeg instance.
 *
 * ffmpeg is only available inside Trigger.dev workers: the `ffmpeg()` build
 * extension in trigger.config.ts installs the binaries in the deployed
 * container and sets FFMPEG_PATH / FFPROBE_PATH. All ffmpeg-dependent code
 * runs in those workers (src/queue tasks), not in the Express API.
 */
if (process.env.FFMPEG_PATH) {
  ffmpegLib.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpegLib.setFfprobePath(process.env.FFPROBE_PATH);
}

export const ffmpeg = ffmpegLib;
export default ffmpegLib;

