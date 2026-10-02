import { useQuery } from "@tanstack/react-query";
import { useAuthFetch } from "./use-auth-fetch";

/**
 * Creator info returned by TikTok's `creator_info/query` endpoint, surfaced via
 * the backend `/api/connect/tiktok/:accountId/creator-info` route.
 *
 * TikTok's Content Sharing Guidelines require us to render the posting UI from
 * this data: show the creator nickname, populate the privacy selector only from
 * `privacy_level_options`, grey out interaction toggles that are disabled, and
 * enforce `max_video_post_duration_sec`.
 */
export interface TikTokCreatorInfo {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
  can_post: boolean;
  can_post_reason?: string;
}

interface CreatorInfoResponse {
  success: boolean;
  data?: TikTokCreatorInfo;
  error?: string;
}

export const tiktokCreatorInfoQueryKeys = {
  all: ["tiktok-creator-info"] as const,
  detail: (accountId: string) =>
    [...tiktokCreatorInfoQueryKeys.all, accountId] as const,
};

export function useTikTokCreatorInfo(accountId: string | undefined) {
  const { authFetch } = useAuthFetch();

  return useQuery({
    queryKey: tiktokCreatorInfoQueryKeys.detail(accountId ?? ""),
    enabled: Boolean(accountId),
    queryFn: async (): Promise<TikTokCreatorInfo> => {
      const response = await authFetch(
        `/api/connect/tiktok/${accountId}/creator-info`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch TikTok creator info");
      }

      const body: CreatorInfoResponse = await response.json();

      if (!body.success || !body.data) {
        throw new Error(body.error || "Failed to fetch TikTok creator info");
      }

      return body.data;
    },
    // Creator info (esp. privacy options / posting eligibility) can change, and
    // the avatar URL has a 2h TTL — keep it reasonably fresh.
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
