import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

/**
 * Server-side Supabase Storage helper.
 *
 * Uses the service-role key, so this must only ever run on the server.
 * The bucket is expected to be **public** (matching the previous Azure setup,
 * where blob URLs are served directly and fetched by social platforms).
 */

const supabaseUrl = process.env.SUPABASE_URL;
// Accepts a new-style secret key (sb_secret_…) or a legacy service_role key.
const secretKey = process.env.SUPABASE_SECRET_KEY;
export const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ?? "media";

let client: SupabaseClient | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(supabaseUrl && secretKey);
}

/**
 * Public URL for an object in the public bucket, without needing a client.
 * Returns null when Supabase storage is not configured.
 */
export function getSupabasePublicUrl(path: string): string | null {
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${path}`;
}

function getClient(): SupabaseClient {
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase storage is not configured");
  }
  if (!client) {
    client = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // We only use Storage, but supabase-js always constructs a RealtimeClient,
      // which needs a WebSocket. Node < 22 has no global WebSocket, so provide
      // the `ws` transport explicitly (harmless on Node 22+ where it's unused).
      realtime: { transport: ws as unknown as typeof WebSocket },
    });
  }
  return client;
}

/**
 * Create a short-lived signed upload URL so the browser can upload directly
 * to the bucket (the file bytes never pass through our server). Returns the
 * full signed URL + token plus the eventual public URL of the object.
 */
export async function createSupabaseSignedUploadUrl(path: string): Promise<{
  signedUrl: string;
  token: string;
  publicUrl: string;
  path: string;
}> {
  const supabase = getClient();
  const { data, error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(
      `Supabase signed upload URL failed: ${error?.message ?? "unknown error"}`,
    );
  }

  const { data: pub } = supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(path);

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: pub.publicUrl,
    path,
  };
}

/**
 * Upload a buffer to the public bucket and return its public URL.
 * `path` is the object key within the bucket (e.g. "uploads/123-video.mp4").
 */
export async function uploadBufferToSupabase(
  buffer: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  const supabase = getClient();
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/** Remove specific objects from the bucket by path. */
export async function removeSupabaseObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const supabase = getClient();
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove(paths);
  if (error) {
    throw new Error(`Supabase remove failed: ${error.message}`);
  }
}

/**
 * Remove every object under a prefix (e.g. "skills/my-skill/"). Used when a
 * skill is deleted so its files don't linger in the public bucket.
 */
export async function removeSupabasePrefix(prefix: string): Promise<void> {
  const supabase = getClient();
  const bucket = supabase.storage.from(SUPABASE_STORAGE_BUCKET);

  // Storage list() is per-folder, so walk the tree breadth-first.
  const folders = [prefix.replace(/\/$/, "")];
  const objects: string[] = [];
  while (folders.length) {
    const folder = folders.pop()!;
    const { data, error } = await bucket.list(folder, { limit: 1000 });
    if (error || !data) continue;
    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      // Folders come back without an id; files have one.
      if (entry.id) objects.push(path);
      else folders.push(path);
    }
  }
  if (objects.length) await bucket.remove(objects);
}

/**
 * Download a file from its storage URL and return the bytes.
 * The bucket is public, so a plain fetch works for Supabase URLs as well as
 * any legacy externally-hosted URLs still stored in the database.
 */
export async function downloadFromStorageUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download from storage URL (${response.status} ${response.statusText})`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}
