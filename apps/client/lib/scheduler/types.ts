import type { PostType, Provider } from "./formats";

export type PostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "PARTIALLY_PUBLISHED"
  | "FAILED";

export type PostSource = "WEB" | "API" | "MCP";

export interface Asset {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  width: number | null;
  height: number | null;
  duration: number | null;
}

export interface PostMedia {
  id: string;
  type: "VIDEO" | "IMAGE" | "THUMBNAIL";
  order: number;
  assetId: string;
  asset: Asset;
}

export interface AccountSummary {
  id: string;
  provider: Provider | string;
  accountName: string | null;
  accountUsername: string | null;
  profilePicture: string | null;
}

export interface PostAccount {
  id: string;
  accountId: string;
  customCaption: string | null;
  title: string | null;
  settings: Record<string, unknown> | null;
  published: boolean;
  publishedAt: string | null;
  publishedPostId: string | null;
  publishedUrl: string | null;
  error: string | null;
  account: AccountSummary;
}

export interface Post {
  id: string;
  type: PostType;
  status: PostStatus;
  source: PostSource;
  mainCaption: string;
  error: string | null;
  scheduledFor: string | null;
  scheduledTimezone: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: PostMedia[];
  postAccounts: PostAccount[];
}

export type AccountHealth = "ok" | "expiring" | "reconnect";

export interface ConnectedAccount extends AccountSummary {
  providerAccountId: string;
  expiresAt: string | null;
  createdAt: string;
  status: AccountHealth;
  statusReason: string | null;
  lastPublishedAt: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
