import crypto from "crypto";
import dns from "dns";
import fs from "fs";
import http from "http";
import https from "https";
import net from "net";
import os from "os";
import path from "path";
import { Transform, type TransformCallback } from "stream";
import { pipeline } from "stream/promises";
import sharp from "sharp";
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";

/**
 * Imports media from somewhere else (a public link, Dropbox, Google Drive,
 * OneDrive) into a temp file, with SSRF protection on every request.
 *
 * - Only http(s), only public IPs. Every DNS answer is checked, and the socket
 *   connects to the address that was checked, so DNS rebinding can't swap it.
 * - At most 3 redirects, each hop re-checked.
 * - 60s to get response headers and at most 60s between body chunks.
 * - Size caps per media type, enforced while streaming.
 * - Content type decided by the file's magic bytes. Anything that isn't an
 *   image, video or audio file is rejected (SVG and HTML included).
 */

export type ImportProvider = "url" | "dropbox" | "google_drive" | "onedrive";
export type MediaCategory = "image" | "video" | "audio";

export const IMPORT_LIMITS: Record<MediaCategory, number> = {
  video: 500 * 1024 * 1024,
  image: 50 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};
const MAX_ANY = Math.max(...Object.values(IMPORT_LIMITS));
const MAX_REDIRECTS = 3;
const HEADER_AND_IDLE_TIMEOUT_MS = 60_000;
const TOTAL_TIMEOUT_MS = 15 * 60_000;
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/** An error whose message is safe to show the user. */
export class ImportError extends Error {}

// ---------------------------------------------------------------------------
// Address checks

// Separate lists: Node checks IPv4 addresses against IPv6 rules too (as
// IPv4-mapped), so one shared list would block every IPv4 address.
const blockListV4 = new net.BlockList();
const blockListV6 = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT, also some cloud metadata
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, including 169.254.169.254 metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockListV4.addSubnet(prefix, bits, "ipv4");
}
for (const [prefix, bits] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32], // Teredo
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique local, includes fd00:ec2::254 metadata
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blockListV6.addSubnet(prefix, bits, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blockListV4.check(address, "ipv4");
  if (family !== 6) return true;
  const lower = address.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d or ::ffff:7f00:1): check the IPv4 part.
  const mapped = /^(?:0{0,4}:){0,5}:?ffff:(.+)$/.exec(lower);
  if (mapped) {
    const tail = mapped[1];
    if (net.isIPv4(tail)) return blockListV4.check(tail, "ipv4");
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      const v4 = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
      return blockListV4.check(v4, "ipv4");
    }
    return true;
  }
  if (/^(?:0{0,4}:){2,6}(?:\d{1,3}\.){3}\d{1,3}$/.test(lower)) return true; // IPv4-compatible
  return blockListV6.check(address, "ipv6");
}

const PRIVATE_ADDRESS_MESSAGE =
  "This link points to a private or local network address.";

/** dns.lookup replacement that refuses private addresses. */
const safeLookup = ((
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number,
  ) => void,
) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) {
      callback(new ImportError("The link's host couldn't be found."), "");
      return;
    }
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      callback(new ImportError(PRIVATE_ADDRESS_MESSAGE), "");
      return;
    }
    if (options?.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}) as unknown as net.LookupFunction;

function hostMatches(host: string, allowed: string[]) {
  const h = host.toLowerCase();
  return allowed.some((rule) =>
    rule.startsWith("*.") ? h.endsWith(rule.slice(1)) : h === rule,
  );
}

function checkUrl(url: URL, allowedHosts?: string[]) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportError("Only http and https links can be imported.");
  }
  if (url.username || url.password) {
    throw new ImportError("Links with a username or password can't be imported.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ImportError("Links on non-standard ports can't be imported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new ImportError(PRIVATE_ADDRESS_MESSAGE);
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new ImportError(PRIVATE_ADDRESS_MESSAGE);
  }
  if (allowedHosts && !hostMatches(host, allowedHosts)) {
    throw new ImportError("The file host isn't allowed for this source.");
  }
}

// ---------------------------------------------------------------------------
// Requests

interface SafeGetOptions {
  headers?: Record<string, string>;
  /** When set, every hop must be on one of these hosts ("*.example.com" ok). */
  allowedHosts?: string[];
  /** Headers are only sent to the first host, never to redirect targets. */
  signal?: AbortSignal;
}

function requestOnce(
  url: URL,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "user-agent": "UnsoraImporter/1.0 (+https://tryunsora.com)",
          accept: "*/*",
          ...headers,
        },
        lookup: safeLookup,
        signal,
      },
      (res) => resolve(res),
    );
    req.setTimeout(HEADER_AND_IDLE_TIMEOUT_MS, () => {
      req.destroy(new ImportError("The file host took too long to respond."));
    });
    req.on("error", (err) =>
      reject(
        err instanceof ImportError
          ? err
          : signal?.aborted
            ? new ImportError("The import took too long.")
            : new ImportError("Couldn't connect to the file host."),
      ),
    );
  });
}

/** GET with SSRF checks on every hop and at most 3 redirects. */
export async function safeGet(
  rawUrl: string,
  options: SafeGetOptions = {},
): Promise<{ res: http.IncomingMessage; url: URL }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImportError("That isn't a valid link.");
  }
  const firstHost = url.host;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    checkUrl(url, options.allowedHosts);
    const headers = url.host === firstHost ? (options.headers ?? {}) : {};
    const res = await requestOnce(url, headers, options.signal);
    const status = res.statusCode ?? 0;

    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (hop === MAX_REDIRECTS) {
        throw new ImportError("The link redirects too many times.");
      }
      try {
        url = new URL(res.headers.location, url);
      } catch {
        throw new ImportError("The link redirects to an invalid address.");
      }
      continue;
    }
    return { res, url };
  }
  throw new ImportError("The link redirects too many times.");
}

/**
 * Throws ImportError unless `rawUrl` is an http(s) link on a public host,
 * resolving its DNS too. For readers that make their own requests (e.g.
 * mediabunny's ranged UrlSource) and so can't use `safeGet` directly.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImportError("That isn't a valid link.");
  }
  checkUrl(url);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!net.isIP(host)) {
    let addresses: dns.LookupAddress[];
    try {
      addresses = await dns.promises.lookup(host, { all: true, verbatim: true });
    } catch {
      throw new ImportError("The link's host couldn't be found.");
    }
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      throw new ImportError(PRIVATE_ADDRESS_MESSAGE);
    }
  }
  return url;
}

/**
 * GET a public URL into memory with the SSRF checks of `safeGet` (every hop)
 * and a byte cap, for small media the caller needs as a Buffer.
 */
export async function fetchPublicBuffer(
  rawUrl: string,
  maxBytes: number,
  timeoutMs = 2 * 60_000,
): Promise<Buffer> {
  const { res } = await safeGet(rawUrl, { signal: AbortSignal.timeout(timeoutMs) });
  const status = res.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    res.resume();
    throw new ImportError(`The file host returned an error (HTTP ${status}).`);
  }
  const length = Number(res.headers["content-length"] ?? 0);
  if (length > maxBytes) {
    res.resume();
    throw new ImportError(`The file is larger than the ${formatMb(maxBytes)} limit.`);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of res) {
    size += chunk.length;
    if (size > maxBytes) {
      res.destroy();
      throw new ImportError(`The file is larger than the ${formatMb(maxBytes)} limit.`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** GET a small JSON document from a fixed API host. */
export async function fetchJson<T>(
  rawUrl: string,
  options: SafeGetOptions & { errorPrefix: string },
): Promise<T> {
  const { res } = await safeGet(rawUrl, options);
  const status = res.statusCode ?? 0;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of res) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      res.destroy();
      throw new ImportError(`${options.errorPrefix} sent an unexpected response.`);
    }
    chunks.push(chunk as Buffer);
  }
  if (status === 401 || status === 403) {
    throw new ImportError(
      `${options.errorPrefix} refused access. Pick the file again and retry.`,
    );
  }
  if (status === 404) {
    throw new ImportError(`${options.errorPrefix} couldn't find that file.`);
  }
  if (status < 200 || status >= 300) {
    throw new ImportError(`${options.errorPrefix} returned an error (HTTP ${status}).`);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new ImportError(`${options.errorPrefix} sent an unexpected response.`);
  }
}

// ---------------------------------------------------------------------------
// Content type

const ASF_GUID = Buffer.from("3026b2758e66cf11a6d900aa0062ce6c", "hex");
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Media type from the first bytes of a file, or null when unrecognized. */
export function sniffMime(b: Buffer): string | null {
  const ascii = (start: number, end: number) =>
    b.length >= end ? b.subarray(start, end).toString("latin1") : "";

  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (b.length >= 8 && b.subarray(0, 8).equals(PNG_SIG)) return "image/png";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  if (ascii(0, 4) === "RIFF") {
    const format = ascii(8, 12);
    if (format === "WEBP") return "image/webp";
    if (format === "WAVE") return "audio/wav";
    if (format === "AVI ") return "video/x-msvideo";
    return null;
  }
  if (ascii(0, 4) === "II*\0" || ascii(0, 4) === "MM\0*") return "image/tiff";
  if (
    ascii(0, 2) === "BM" &&
    b.length >= 18 &&
    [12, 40, 52, 56, 64, 108, 124].includes(b.readUInt32LE(14))
  ) {
    return "image/bmp";
  }
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "M4A " || brand === "M4B " || brand === "M4P ") return "audio/mp4";
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("3g")) return "video/3gpp";
    return "video/mp4";
  }
  if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3) {
    return b.subarray(0, 64).includes("webm") ? "video/webm" : "video/x-matroska";
  }
  if (ascii(0, 3) === "FLV") return "video/x-flv";
  if (b.length >= 16 && b.subarray(0, 16).equals(ASF_GUID)) return "video/x-ms-asf";
  if (b.length >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && (b[3] === 0xba || b[3] === 0xb3)) {
    return "video/mpeg";
  }
  if (b.length >= 189 && b[0] === 0x47 && b[188] === 0x47) return "video/mp2t";
  if (ascii(0, 3) === "ID3") return "audio/mpeg";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(0, 4) === "fLaC") return "audio/flac";
  if (ascii(0, 4) === "FORM" && ["AIFF", "AIFC"].includes(ascii(8, 12))) return "audio/aiff";
  if (ascii(0, 5) === "#!AMR") return "audio/amr";
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
    // Frame sync: layer bits 00 are ADTS AAC, anything else MPEG audio.
    return (b[1] & 0x06) === 0 ? "audio/aac" : "audio/mpeg";
  }
  return null;
}

export function categoryOf(mime: string | null | undefined): MediaCategory | null {
  if (!mime) return null;
  const type = mime.split(";")[0].trim().toLowerCase();
  if (type === "image/svg+xml") return null;
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return null;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/avif": "avif",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
  "video/3gpp": "3gp",
  "video/x-flv": "flv",
  "video/x-ms-asf": "wmv",
  "video/mpeg": "mpg",
  "video/mp2t": "ts",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/aiff": "aiff",
  "audio/amr": "amr",
};

export function sanitizeFileName(name: string, mime?: string): string {
  const base = (name.split(/[\\/]/).pop() || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 150);
  const safe = base || "import";
  if (mime && !/\.[A-Za-z0-9]{2,5}$/.test(safe) && EXTENSIONS[mime]) {
    return `${safe}.${EXTENSIONS[mime]}`;
  }
  return safe;
}

/** Storage object key: no spaces or odd characters. */
export function storageKey(userId: string, fileName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(4).toString("hex");
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-100) || "file";
  return `uploads/${userId}/${timestamp}-${rand}-${safe}`;
}

function fileNameFromDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

function fileNameFromUrl(url: URL): string | null {
  const last = url.pathname.split("/").filter(Boolean).pop();
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

// ---------------------------------------------------------------------------
// Download to a temp file

const HEAD_BYTES = 512;
const UNSUPPORTED_MESSAGE =
  "This file type isn't supported. Import an image, video or audio file.";

/** Counts bytes, captures the head for sniffing, and enforces the cap. */
class GuardStream extends Transform {
  bytes = 0;
  head = Buffer.alloc(0);
  sniffed: string | null = null;
  private limit: number;

  constructor(
    private declaredCategory: MediaCategory | null,
    private onLimit: (limit: number, category: MediaCategory | null) => Error,
  ) {
    super();
    this.limit = declaredCategory ? IMPORT_LIMITS[declaredCategory] : MAX_ANY;
  }

  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback) {
    this.bytes += chunk.length;
    if (this.head.length < HEAD_BYTES) {
      this.head = Buffer.concat([
        this.head,
        chunk.subarray(0, HEAD_BYTES - this.head.length),
      ]);
      this.sniffed = sniffMime(this.head);
      const cat = categoryOf(this.sniffed);
      if (cat) this.limit = IMPORT_LIMITS[cat];
      // Stop early instead of downloading a large file we'll reject anyway.
      if (this.head.length >= HEAD_BYTES && !cat) {
        cb(new ImportError(UNSUPPORTED_MESSAGE));
        return;
      }
    }
    if (this.bytes > this.limit) {
      cb(this.onLimit(this.limit, categoryOf(this.sniffed) ?? this.declaredCategory));
      return;
    }
    cb(null, chunk);
  }

  _flush(cb: TransformCallback) {
    if (!this.sniffed) this.sniffed = sniffMime(this.head);
    cb();
  }
}

function formatMb(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export interface DownloadedFile {
  tempPath: string;
  size: number;
  mimeType: string;
  category: MediaCategory;
  name: string;
}

/**
 * Stream a response body into a temp file. The caller deletes `tempPath`
 * (see `removeTempFile`) whether or not the import succeeds.
 */
export async function downloadToTemp(
  res: http.IncomingMessage,
  finalUrl: URL,
  hints: { name?: string | null; mimeType?: string | null; errorPrefix: string },
): Promise<DownloadedFile> {
  const status = res.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    res.resume();
    if (status === 401 || status === 403) {
      throw new ImportError(`${hints.errorPrefix} refused access to the file.`);
    }
    if (status === 404 || status === 410) {
      throw new ImportError("The file wasn't found. Check the link or pick it again.");
    }
    throw new ImportError(`${hints.errorPrefix} returned an error (HTTP ${status}).`);
  }

  const headerMime = res.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  const declaredMime = (hints.mimeType || headerMime || "").toLowerCase();
  const declaredCategory = categoryOf(declaredMime);
  const length = Number(res.headers["content-length"] ?? 0);
  if (length > 0) {
    const cap = declaredCategory ? IMPORT_LIMITS[declaredCategory] : MAX_ANY;
    if (length > cap) {
      res.resume();
      throw new ImportError(
        `The file is ${formatMb(length)}. The limit for ${declaredCategory ?? "media"} files is ${formatMb(cap)}.`,
      );
    }
  }

  const tempPath = path.join(
    os.tmpdir(),
    `unsora-import-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`,
  );
  const guard = new GuardStream(declaredCategory, (limit, category) =>
    new ImportError(
      `The file is larger than the ${formatMb(limit)} limit for ${category ?? "media"} files.`,
    ),
  );

  try {
    await pipeline(res, guard, fs.createWriteStream(tempPath));
  } catch (err) {
    await removeTempFile(tempPath);
    if (err instanceof ImportError) throw err;
    throw new ImportError("The download was interrupted. Try again.");
  }

  if (guard.bytes === 0) {
    await removeTempFile(tempPath);
    throw new ImportError("The file is empty.");
  }

  const sniffedCategory = categoryOf(guard.sniffed);
  if (!sniffedCategory || !guard.sniffed) {
    await removeTempFile(tempPath);
    throw new ImportError(UNSUPPORTED_MESSAGE);
  }
  // Keep a more specific declared type in the same family (audio/x-m4a etc.).
  const mimeType =
    declaredCategory === sniffedCategory &&
    declaredMime &&
    declaredMime !== "application/octet-stream"
      ? declaredMime
      : guard.sniffed;

  const rawName =
    hints.name ||
    fileNameFromDisposition(res.headers["content-disposition"]) ||
    fileNameFromUrl(finalUrl) ||
    "import";

  return {
    tempPath,
    size: guard.bytes,
    mimeType,
    category: sniffedCategory,
    name: sanitizeFileName(rawName, mimeType),
  };
}

export async function removeTempFile(tempPath: string) {
  await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Metadata

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
}

async function readMetadata(file: DownloadedFile): Promise<MediaMetadata> {
  if (file.category === "image") {
    const meta = await sharp(file.tempPath, { failOn: "none" }).metadata();
    const rotated = (meta.orientation ?? 1) >= 5;
    return {
      width: (rotated ? meta.height : meta.width) || undefined,
      height: (rotated ? meta.width : meta.height) || undefined,
    };
  }

  // A file-backed Blob: mediabunny only reads the byte ranges it needs.
  const blob = await fs.openAsBlob(file.tempPath);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob as unknown as Blob),
  });
  try {
    const duration = await input.computeDuration();
    const meta: MediaMetadata = {
      duration: Number.isFinite(duration) && duration > 0
        ? Math.round(duration * 100) / 100
        : undefined,
    };
    if (file.category === "video") {
      const track = await input.getPrimaryVideoTrack();
      if (track) {
        meta.width = track.displayWidth || undefined;
        meta.height = track.displayHeight || undefined;
      }
    }
    return meta;
  } finally {
    input.dispose();
  }
}

/** Dimensions and duration when they're cheap to read, otherwise empty. */
export async function probeMetadata(file: DownloadedFile): Promise<MediaMetadata> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      readMetadata(file),
      new Promise<MediaMetadata>((resolve) => {
        timer = setTimeout(() => resolve({}), 20_000);
      }),
    ]);
  } catch {
    return {};
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Providers

export interface ImportRequestItem {
  provider: ImportProvider;
  url?: string;
  fileId?: string;
  /** OneDrive with `fileId`: the drive the item lives on. */
  driveId?: string;
  accessToken?: string;
  name?: string;
  mimeType?: string;
}

const DROPBOX_HOSTS = ["*.dropboxusercontent.com", "www.dropbox.com", "dropbox.com"];
const GOOGLE_HOSTS = ["www.googleapis.com", "*.googleusercontent.com"];
const GRAPH_HOST = "graph.microsoft.com";
const ONEDRIVE_DOWNLOAD_HOSTS = [
  "*.sharepoint.com",
  "*.1drv.com",
  "*.onedrive.com",
  "*.livefilestore.com",
  "*.microsoftpersonalcontent.com",
  "*.svc.ms",
];

const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const ONEDRIVE_ID = /^[A-Za-z0-9!_.-]{1,300}$/;

function requireToken(item: ImportRequestItem) {
  const token = item.accessToken?.trim();
  if (!token || token.length > 8192 || /\s/.test(token)) {
    throw new ImportError("Sign in again and pick the file.");
  }
  return token;
}

/** Downloads one import item into a temp file. Never stores tokens. */
export async function downloadImportItem(
  item: ImportRequestItem,
  signal: AbortSignal,
): Promise<DownloadedFile> {
  switch (item.provider) {
    case "url": {
      if (!item.url) throw new ImportError("Paste a link to import.");
      const { res, url } = await safeGet(item.url, { signal });
      return downloadToTemp(res, url, {
        name: item.name,
        mimeType: null,
        errorPrefix: "The link",
      });
    }

    case "dropbox": {
      if (!item.url) throw new ImportError("Dropbox didn't return a link.");
      let url: URL;
      try {
        url = new URL(item.url);
      } catch {
        throw new ImportError("Dropbox returned an invalid link.");
      }
      if (url.hostname === "www.dropbox.com" || url.hostname === "dropbox.com") {
        url.searchParams.set("dl", "1");
      }
      const { res, url: finalUrl } = await safeGet(url.toString(), {
        allowedHosts: DROPBOX_HOSTS,
        signal,
      });
      return downloadToTemp(res, finalUrl, {
        name: item.name,
        mimeType: null,
        errorPrefix: "Dropbox",
      });
    }

    case "google_drive": {
      const fileId = item.fileId?.trim() ?? "";
      if (!DRIVE_ID.test(fileId)) throw new ImportError("Google Drive sent an invalid file id.");
      const token = requireToken(item);
      const headers = { authorization: `Bearer ${token}` };
      const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;

      const meta = await fetchJson<{ name?: string; mimeType?: string; size?: string }>(
        `${base}?fields=name,mimeType,size&supportsAllDrives=true`,
        { headers, allowedHosts: GOOGLE_HOSTS, signal, errorPrefix: "Google Drive" },
      );
      if (meta.mimeType?.startsWith("application/vnd.google-apps.")) {
        throw new ImportError("Google Docs, Sheets and Slides can't be imported. Pick a media file.");
      }
      const { res, url } = await safeGet(`${base}?alt=media&supportsAllDrives=true`, {
        headers,
        allowedHosts: GOOGLE_HOSTS,
        signal,
      });
      return downloadToTemp(res, url, {
        name: meta.name ?? item.name,
        mimeType: meta.mimeType ?? item.mimeType,
        errorPrefix: "Google Drive",
      });
    }

    case "onedrive": {
      // Preferred: the picker's pre-authenticated download URL, no token.
      if (item.url) {
        const { res, url } = await safeGet(item.url, {
          allowedHosts: ONEDRIVE_DOWNLOAD_HOSTS,
          signal,
        });
        return downloadToTemp(res, url, {
          name: item.name,
          mimeType: item.mimeType,
          errorPrefix: "OneDrive",
        });
      }

      // Otherwise: Microsoft Graph with the user's Files.Read token.
      const fileId = item.fileId?.trim() ?? "";
      const driveId = item.driveId?.trim();
      if (!ONEDRIVE_ID.test(fileId) || (driveId && !ONEDRIVE_ID.test(driveId))) {
        throw new ImportError("OneDrive sent an invalid file id.");
      }
      const token = requireToken(item);
      const itemUrl = driveId
        ? `https://${GRAPH_HOST}/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(fileId)}`
        : `https://${GRAPH_HOST}/v1.0/me/drive/items/${encodeURIComponent(fileId)}`;

      const meta = await fetchJson<{
        name?: string;
        file?: { mimeType?: string };
        "@microsoft.graph.downloadUrl"?: string;
      }>(itemUrl, {
        headers: { authorization: `Bearer ${token}` },
        allowedHosts: [GRAPH_HOST],
        signal,
        errorPrefix: "OneDrive",
      });
      if (!meta.file) throw new ImportError("Pick a file, not a folder.");

      const downloadUrl = meta["@microsoft.graph.downloadUrl"];
      // The download URL is pre-authenticated, so no token goes with it.
      const { res, url } = downloadUrl
        ? await safeGet(downloadUrl, { allowedHosts: ONEDRIVE_DOWNLOAD_HOSTS, signal })
        : await safeGet(`${itemUrl}/content`, {
            headers: { authorization: `Bearer ${token}` },
            allowedHosts: [GRAPH_HOST, ...ONEDRIVE_DOWNLOAD_HOSTS],
            signal,
          });
      return downloadToTemp(res, url, {
        name: meta.name ?? item.name,
        mimeType: meta.file.mimeType ?? item.mimeType,
        errorPrefix: "OneDrive",
      });
    }

    default:
      throw new ImportError("Unknown import source.");
  }
}

/** Abort signal for one item's whole download. */
export function importDeadline() {
  return AbortSignal.timeout(TOTAL_TIMEOUT_MS);
}
