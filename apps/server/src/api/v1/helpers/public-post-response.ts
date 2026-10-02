import { PostStatus, PostType } from "@prisma/client";

const PUBLIC_STATUS: Record<PostStatus, string> = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  PARTIALLY_PUBLISHED: "partially_published",
  FAILED: "failed",
};

const PUBLIC_TYPE: Record<PostType, string> = {
  VIDEO: "video",
  IMAGE: "image",
  CAROUSEL: "slideshow",
  TEXT: "text",
};

type PostRow = {
  id: string;
  status: PostStatus;
  type: PostType;
  mainCaption: string;
  scheduledFor: Date | null;
  postAccounts?: { accountId: string }[];
};

export function formatPublicPostSummary(post: PostRow) {
  return {
    id: post.id,
    status: PUBLIC_STATUS[post.status],
    type: PUBLIC_TYPE[post.type],
    caption: post.mainCaption,
    scheduled_at: post.scheduledFor?.toISOString() ?? null,
    accounts: (post.postAccounts ?? []).map((a) => a.accountId),
  };
}
