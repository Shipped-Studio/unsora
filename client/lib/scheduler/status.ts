import type { PostStatus } from "./types";

export const STATUS_META: Record<
  PostStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  PUBLISHING: { label: "Publishing", tone: "info" },
  PUBLISHED: { label: "Published", tone: "success" },
  PARTIALLY_PUBLISHED: { label: "Partly published", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

export const STATUS_TABS: { value: string; label: string; statuses?: PostStatus[] }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled", statuses: ["SCHEDULED", "PUBLISHING"] },
  { value: "drafts", label: "Drafts", statuses: ["DRAFT"] },
  { value: "published", label: "Published", statuses: ["PUBLISHED", "PARTIALLY_PUBLISHED"] },
  { value: "failed", label: "Needs attention", statuses: ["FAILED", "PARTIALLY_PUBLISHED"] },
];

export const canEdit = (status: PostStatus) =>
  status === "DRAFT" ||
  status === "SCHEDULED" ||
  status === "FAILED" ||
  status === "PARTIALLY_PUBLISHED";

export const canDelete = (status: PostStatus) => status !== "PUBLISHING";

export const canRetry = (status: PostStatus) =>
  status === "FAILED" || status === "PARTIALLY_PUBLISHED";

export const canPublishNow = (status: PostStatus) =>
  status === "DRAFT" || status === "SCHEDULED";
