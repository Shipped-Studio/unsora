// Copy one Supabase Storage bucket from the old project to the new one.
//
// Re-runnable: objects already in the new bucket with the same size are
// skipped, so run it once ahead of time (bulk copy, no downtime) and again
// during the cutover (only what was uploaded since).
//
//   cd apps/server
//   OLD_SUPABASE_URL=https://<old-ref>.supabase.co OLD_SUPABASE_SECRET_KEY=sb_secret_... \
//   NEW_SUPABASE_URL=https://<new-ref>.supabase.co NEW_SUPABASE_SECRET_KEY=sb_secret_... \
//   BUCKET=media node scripts/migrate-supabase/copy-storage.mjs [--dry-run]
//
// The new project's upload size limit (Storage > Settings) must be at least
// as large as the biggest file, or those uploads fail and are reported.

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const env = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
};

const BUCKET = process.env.BUCKET ?? "media";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const DRY_RUN = process.argv.includes("--dry-run");

const client = (url, key) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });

const oldStorage = client(env("OLD_SUPABASE_URL"), env("OLD_SUPABASE_SECRET_KEY")).storage.from(BUCKET);
const newStorage = client(env("NEW_SUPABASE_URL"), env("NEW_SUPABASE_SECRET_KEY")).storage.from(BUCKET);

/** Every object under `prefix`, as { path, size, mimetype, cacheControl }. */
async function listAll(storage, prefix = "") {
  const files = [];
  const folders = [prefix];
  while (folders.length) {
    const folder = folders.pop();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(folder, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`list "${folder}": ${error.message}`);
      for (const entry of data) {
        const path = folder ? `${folder}/${entry.name}` : entry.name;
        // Folders come back without an id; files have one.
        if (entry.id) {
          files.push({
            path,
            size: entry.metadata?.size ?? null,
            mimetype: entry.metadata?.mimetype,
            cacheControl: entry.metadata?.cacheControl,
          });
        } else {
          folders.push(path);
        }
      }
      if (data.length < 1000) break;
    }
  }
  return files;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function copyOne(file) {
  const { data, error } = await oldStorage.download(file.path);
  if (error) throw new Error(`download: ${error.message}`);
  const { error: uploadError } = await newStorage.upload(file.path, data, {
    contentType: file.mimetype || data.type || "application/octet-stream",
    cacheControl: (file.cacheControl || "max-age=3600").replace(/^max-age=/, ""),
    upsert: true,
  });
  if (uploadError) throw new Error(`upload: ${uploadError.message}`);
}

async function main() {
  console.log(`Listing "${BUCKET}" in both projects...`);
  const [source, target] = await Promise.all([listAll(oldStorage), listAll(newStorage)]);
  const existing = new Map(target.map((f) => [f.path, f.size]));
  const todo = source.filter((f) => existing.get(f.path) !== f.size);
  const totalBytes = todo.reduce((sum, f) => sum + (f.size ?? 0), 0);

  console.log(
    `Old: ${source.length} objects. New: ${target.length}. To copy: ${todo.length} (${mb(totalBytes)}).`,
  );
  if (DRY_RUN || todo.length === 0) return;

  let done = 0;
  let copiedBytes = 0;
  const failed = [];
  const queue = [...todo];
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      try {
        await copyOne(file);
        copiedBytes += file.size ?? 0;
      } catch (err) {
        failed.push({ path: file.path, error: err.message });
      }
      done += 1;
      if (done % 25 === 0 || done === todo.length) {
        console.log(`  ${done}/${todo.length} (${mb(copiedBytes)} of ${mb(totalBytes)})`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (failed.length) {
    console.error(`\n${failed.length} failed:`);
    for (const f of failed) console.error(`  ${f.path}: ${f.error}`);
    process.exit(1);
  }
  console.log("Done. Run again to confirm 0 left to copy.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
