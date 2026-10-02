import axios from "axios";
import { getYoutubeTranscriptText } from "./supadata";
import {
  THUMB_EXPRESSIONS,
  type THUMB_DEFAULT_PROJECT_CONTEXT,
  type ThumbExpression,
} from "../config/models/thumbnail-generator";

export type ThumbProjectContext = typeof THUMB_DEFAULT_PROJECT_CONTEXT;

export type ThumbnailContext =
  | { type: "youtube"; url: string }
  | { type: "pdf"; url: string };

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
];

const MAX_CONTEXT_CHARS = 8000;
const HIGHLIGHT_SEGMENT_LIMIT = 12;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isYoutubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some((pattern) => pattern.test(url));
}

export function parseExpression(raw: unknown): ThumbExpression {
  if (
    typeof raw === "string" &&
    THUMB_EXPRESSIONS.includes(raw as ThumbExpression)
  ) {
    return raw as ThumbExpression;
  }
  return "auto";
}

export function parseThumbnailContext(raw: unknown): ThumbnailContext | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.length > 1) return null;

  const item = raw[0];
  if (!item || typeof item !== "object") return null;

  const type = (item as { type?: unknown }).type;
  const content =
    typeof (item as { content?: unknown }).content === "string"
      ? (item as { content: string }).content.trim()
      : typeof (item as { label?: unknown }).label === "string"
        ? (item as { label: string }).label.trim()
        : "";

  if (!content) return null;

  if (type === "youtube") {
    if (!isYoutubeUrl(content)) return null;
    return { type: "youtube", url: content };
  }

  if (type === "document") {
    if (!isHttpUrl(content)) return null;
    return { type: "pdf", url: content };
  }

  return null;
}

function transcriptToText(segments: Array<{ text?: string } | string>): string {
  return segments
    .map((segment) =>
      typeof segment === "string" ? segment : (segment.text ?? ""),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function transcriptToHighlights(
  segments: Array<{ text?: string } | string>,
): string[] {
  return segments
    .map((segment) =>
      typeof segment === "string" ? segment : (segment.text ?? ""),
    )
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, HIGHLIGHT_SEGMENT_LIMIT);
}

async function extractPdfTextFromUrl(url: string): Promise<string> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 60_000,
    maxContentLength: 20 * 1024 * 1024,
  });

  // Dynamic import: pdfjs touches browser globals (DOMMatrix) on load, which
  // breaks Trigger.dev's task-indexing step at deploy. Loading it here defers
  // that to runtime, when only text extraction (no canvas rendering) is used.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const doc = await getDocument({ data: response.data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim(),
    );
  }

  return pages.filter(Boolean).join("\n").trim();
}

export async function resolveThumbnailContext(
  context: ThumbnailContext,
): Promise<ThumbProjectContext> {
  if (context.type === "youtube") {
    const segments = await getYoutubeTranscriptText(context.url);
    const description = transcriptToText(segments).slice(0, MAX_CONTEXT_CHARS);
    if (!description) {
      throw new Error("Could not load a transcript for this YouTube video.");
    }

    return {
      description,
      highlights: transcriptToHighlights(segments),
      targetAudience: "YouTube viewers",
    };
  }

  const description = (await extractPdfTextFromUrl(context.url)).slice(
    0,
    MAX_CONTEXT_CHARS,
  );
  if (!description) {
    throw new Error("Could not extract text from the PDF.");
  }

  return {
    description,
    highlights: [],
    targetAudience: "YouTube viewers",
  };
}
