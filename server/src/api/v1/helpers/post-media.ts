import { MediaType } from "@prisma/client";
import { createAsset } from "../../../lib/asset-utils";
import { PostMediaInput } from "./post-validation";

export async function buildMediaCreateData(
  userId: string,
  media: PostMediaInput[],
) {
  const mediaAssets = await Promise.all(
    media.map(async (m, index) => {
      const asset = await createAsset({
        userId,
        url: m.url,
        name: m.mimeType || "Post media",
        mimeType: m.mimeType,
        type: m.type === "VIDEO" ? "VIDEO" : "IMAGE",
        source: "UPLOAD",
        width: m.width,
        height: m.height,
        duration: m.duration,
        fileSize: m.fileSize !== undefined ? BigInt(m.fileSize) : undefined,
      });
      return {
        type: m.type as MediaType,
        assetId: asset.id,
        order: m.order ?? index,
      };
    }),
  );
  return mediaAssets;
}
