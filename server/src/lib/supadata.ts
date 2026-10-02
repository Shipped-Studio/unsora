import dotenv from "dotenv";
import { Supadata } from "@supadata/js";

dotenv.config();

const supadata = new Supadata({
  apiKey: process.env.SUPADATA_API_KEY as string,
});

const extractVideoIdFromUrl = (url: string): string | null => {
  const urlObj = new URL(url);
  if (urlObj.hostname === "youtu.be") {
    return urlObj.pathname.slice(1);
  } else if (urlObj.hostname.includes("youtube.com")) {
    return urlObj.searchParams.get("v");
  }
  return null;
};

export const getYoutubeTranscriptText = async (
  youtubeUrl: string
): Promise<any> => {
  const videoId = extractVideoIdFromUrl(youtubeUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  const transcriptResponse = await supadata.youtube.transcript({
    videoId: videoId,
  });

  if (!Array.isArray(transcriptResponse.content)) {
    throw new Error("Unexpected transcript response format");
  }

  return transcriptResponse.content;
};
