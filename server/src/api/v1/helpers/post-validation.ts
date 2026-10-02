import { MediaType, PostStatus, PostType } from "@prisma/client";

const POST_TYPES = new Set<string>(Object.values(PostType));
const POST_STATUSES = new Set<string>(Object.values(PostStatus));
const MEDIA_TYPES = new Set<string>([
  ...Object.values(MediaType),
  "THUMBNAIL",
]);

export type PostAccountInput = {
  accountId: string;
  customCaption?: string | null;
  title?: string | null;
};

export type PostMediaInput = {
  type: MediaType;
  url: string;
  order?: number;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  mimeType?: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parsePostType(
  type: unknown,
  options?: { defaultType?: PostType },
): ValidationResult<PostType> {
  const value = type ?? options?.defaultType ?? "VIDEO";
  if (typeof value !== "string" || !POST_TYPES.has(value)) {
    return {
      ok: false,
      error: `Invalid type. Must be one of: ${[...POST_TYPES].join(", ")}`,
    };
  }
  return { ok: true, value: value as PostType };
}

export function parseOptionalPostType(
  type: unknown,
): ValidationResult<PostType | undefined> {
  if (type === undefined || type === "") {
    return { ok: true, value: undefined };
  }
  if (typeof type !== "string" || !POST_TYPES.has(type)) {
    return {
      ok: false,
      error: `Invalid type. Must be one of: ${[...POST_TYPES].join(", ")}`,
    };
  }
  return { ok: true, value: type as PostType };
}

export function parsePostStatusFilter(
  status: unknown,
): ValidationResult<PostStatus | undefined> {
  if (status === undefined || status === "") {
    return { ok: true, value: undefined };
  }
  if (typeof status !== "string" || !POST_STATUSES.has(status)) {
    return {
      ok: false,
      error: `Invalid status. Must be one of: ${[...POST_STATUSES].join(", ")}`,
    };
  }
  return { ok: true, value: status as PostStatus };
}

export function parseAccounts(
  accounts: unknown,
): ValidationResult<PostAccountInput[]> {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return {
      ok: false,
      error: "At least one account must be selected",
    };
  }

  const parsed: PostAccountInput[] = [];
  for (const item of accounts) {
    if (
      !item ||
      typeof item !== "object" ||
      !isNonEmptyString((item as PostAccountInput).accountId)
    ) {
      return {
        ok: false,
        error: "Each account must include a valid accountId",
      };
    }
    const row = item as PostAccountInput;
    parsed.push({
      accountId: row.accountId.trim(),
      customCaption:
        typeof row.customCaption === "string" ? row.customCaption : null,
      title: typeof row.title === "string" ? row.title : null,
    });
  }

  return { ok: true, value: parsed };
}

export function parseMedia(media: unknown): ValidationResult<PostMediaInput[] | undefined> {
  if (media === undefined || media === null) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(media)) {
    return { ok: false, error: "media must be an array" };
  }

  const parsed: PostMediaInput[] = [];
  for (const item of media) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Each media item must be an object" };
    }
    const row = item as PostMediaInput;
    if (!isNonEmptyString(row.url)) {
      return { ok: false, error: "Each media item must include a url" };
    }
    if (typeof row.type !== "string" || !MEDIA_TYPES.has(row.type)) {
      return {
        ok: false,
        error: `Each media item type must be one of: ${[...MEDIA_TYPES].join(", ")}`,
      };
    }
    parsed.push({
      type: row.type as MediaType,
      url: row.url.trim(),
      order: typeof row.order === "number" ? row.order : undefined,
      width: typeof row.width === "number" ? row.width : undefined,
      height: typeof row.height === "number" ? row.height : undefined,
      duration: typeof row.duration === "number" ? row.duration : undefined,
      fileSize: typeof row.fileSize === "number" ? row.fileSize : undefined,
      mimeType: typeof row.mimeType === "string" ? row.mimeType : undefined,
    });
  }

  return { ok: true, value: parsed };
}

export function parseScheduledFor(
  scheduledFor: unknown,
): ValidationResult<Date | null | undefined> {
  if (scheduledFor === undefined) {
    return { ok: true, value: undefined };
  }
  if (scheduledFor === null || scheduledFor === "") {
    return { ok: true, value: null };
  }
  if (typeof scheduledFor !== "string" && typeof scheduledFor !== "number") {
    return { ok: false, error: "scheduledFor must be an ISO 8601 date string" };
  }
  const date = new Date(scheduledFor);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "scheduledFor is not a valid date" };
  }
  return { ok: true, value: date };
}

export function parsePagination(
  pageRaw: unknown,
  limitRaw: unknown,
): ValidationResult<{ page: number; limit: number; skip: number }> {
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const limit = limitRaw === undefined ? 20 : Number(limitRaw);

  if (!Number.isFinite(page) || page < 1 || !Number.isInteger(page)) {
    return { ok: false, error: "page must be a positive integer" };
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 100 || !Number.isInteger(limit)) {
    return { ok: false, error: "limit must be an integer between 1 and 100" };
  }

  return { ok: true, value: { page, limit, skip: (page - 1) * limit } };
}
