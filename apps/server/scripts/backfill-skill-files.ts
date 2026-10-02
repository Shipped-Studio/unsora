/**
 * Backfill: copy each skill's files (SKILL.md + references) from the `dev`
 * storage bucket — where they were first uploaded — into the bucket this
 * environment uses (SUPABASE_STORAGE_BUCKET), and point the Skill rows'
 * skillMdPath/files at them. The landing repo no longer ships static skill
 * files; storage is the only source.
 *
 * Idempotent: skills that already have a skillMdPath are skipped.
 *
 *   npx ts-node scripts/backfill-skill-files.ts
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import {
  getSupabasePublicUrl,
  isSupabaseStorageConfigured,
  uploadBufferToSupabase,
  SUPABASE_STORAGE_BUCKET,
} from "../src/lib/supabase-storage";

const SOURCE_BUCKET = "dev";
const prisma = new PrismaClient();

function sourceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ).storage.from(SOURCE_BUCKET);
}

/** Recursively list object paths under a prefix in the source bucket. */
async function listAll(prefix: string): Promise<string[]> {
  const bucket = sourceClient();
  const out: string[] = [];
  const folders = [prefix.replace(/\/$/, "")];
  while (folders.length) {
    const folder = folders.pop()!;
    const { data, error } = await bucket.list(folder, { limit: 1000 });
    if (error) throw new Error(`list ${folder}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = `${folder}/${entry.name}`;
      if (entry.id) out.push(path);
      else folders.push(path);
    }
  }
  return out;
}

const contentTypeFor = (file: string) =>
  file.endsWith(".md") ? "text/markdown" : "application/octet-stream";

async function main() {
  if (!isSupabaseStorageConfigured()) {
    throw new Error("Supabase storage is not configured in this environment");
  }
  console.log(`copying ${SOURCE_BUCKET} → ${SUPABASE_STORAGE_BUCKET}`);

  const skills = await prisma.skill.findMany();
  for (const skill of skills) {
    if (skill.skillMdPath) {
      console.log(`skip (already has files): ${skill.slug}`);
      continue;
    }

    const objects = await listAll(`skills/${skill.slug}`);
    if (!objects.length) {
      console.log(`skip (nothing in ${SOURCE_BUCKET} bucket): ${skill.slug}`);
      continue;
    }

    const files: { path: string; url: string; relativePath: string }[] = [];
    for (const path of objects) {
      const { data, error } = await sourceClient().download(path);
      if (error || !data) throw new Error(`download ${path}: ${error?.message}`);
      const buffer = Buffer.from(await data.arrayBuffer());

      let url: string;
      try {
        url = await uploadBufferToSupabase(buffer, path, contentTypeFor(path));
      } catch {
        // Already uploaded on a previous run — the bucket forbids overwrite.
        url = getSupabasePublicUrl(path)!;
      }
      files.push({
        path,
        url,
        relativePath: path.replace(`skills/${skill.slug}/`, ""),
      });
    }

    const skillMd = files.find((f) => /(^|\/)SKILL\.md$/i.test(f.relativePath));
    await prisma.skill.update({
      where: { id: skill.id },
      data: { files, skillMdPath: skillMd?.path ?? null },
    });
    console.log(`backfilled: ${skill.slug} (${files.length} files)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
