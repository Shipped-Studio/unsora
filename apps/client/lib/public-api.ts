/** Shared public API fetch + path constants. Base: NEXT_PUBLIC_API_URL */

export async function publicApiFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export const PUBLIC_VIDEO_API = {
  create: "/api/v1/videos/create",
  list: "/api/v1/videos/all",
  delete: (id: string) => `/api/v1/videos/${id}`,
  status: (id: string) => `/api/v1/video/status/${id}`,
} as const;

export const PUBLIC_IMAGE_API = {
  create: "/api/v1/image-generations/create",
  list: "/api/v1/image-generations/all",
  get: (id: string) => `/api/v1/image-generations/${id}`,
  delete: (id: string) => `/api/v1/image-generations/${id}`,
  status: (id: string) => `/api/v1/image/status/${id}`,
} as const;

export const PUBLIC_THUMBNAIL_API = {
  create: "/api/v1/thumbnails/create",
  list: "/api/v1/thumbnails",
  get: (id: string) => `/api/v1/thumbnails/${id}`,
  delete: (id: string) => `/api/v1/thumbnails/${id}`,
  status: (id: string) => `/api/v1/image/status/${id}`,
} as const;

export const PUBLIC_CLIPPING_API = {
  create: "/api/v1/clippings/create",
  list: "/api/v1/clippings/all",
  get: (id: string) => `/api/v1/clippings/${id}`,
  status: (id: string) => `/api/v1/clippings/status/${id}`,
  delete: (id: string) => `/api/v1/clippings/${id}`,
  deleteClip: (clippingId: string, clipId: string) =>
    `/api/v1/clippings/${clippingId}/clips/${clipId}`,
} as const;

export const PUBLIC_MUSIC_API = {
  create: "/api/v1/music-generations/create",
  list: "/api/v1/music-generations/all",
  get: (id: string) => `/api/v1/music-generations/${id}`,
  delete: (id: string) => `/api/v1/music-generations/${id}`,
  status: (id: string) => `/api/v1/music/status/${id}`,
} as const;

export interface PublicVideoStatusData {
  id: string;
  model: string;
  status: string;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Map public status payload to the shape used by video-generator hooks. */
export function mapPublicStatusToGeneration(data: PublicVideoStatusData) {
  return {
    id: data.id,
    status: data.status,
    error: data.error,
    outputAsset: data.outputUrl ? { id: data.id, url: data.outputUrl } : null,
    thumbnailAsset: data.thumbnailUrl
      ? { id: `${data.id}-thumb`, url: data.thumbnailUrl }
      : null,
  };
}

/** @deprecated Use publicApiFetch from @/lib/public-api */
export const publicVideoFetch = publicApiFetch;
