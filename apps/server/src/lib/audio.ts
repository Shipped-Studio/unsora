import axios from "axios";
import fs from "fs";
import { logger } from "./logger";

export async function downloadVideo(url, outputPath) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 60000, // 60 second timeout
    });

    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);

      response.data.pipe(stream);

      stream.on("finish", () => {
        logger.info(`Video downloaded successfully to: ${outputPath}`);
        resolve(outputPath);
      });

      stream.on("error", (error) => {
        logger.error("Stream write error:", error);
        // Clean up partial file on error
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(error);
      });

      response.data.on("error", (error) => {
        logger.error("Download stream error:", error);
        stream.destroy();
        // Clean up partial file on error
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(error);
      });
    });
  } catch (error) {
    logger.error("Error downloading video from URL:", url, error);
    throw new Error(
      `Failed to download video: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

