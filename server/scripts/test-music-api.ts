/**
 * Smoke-test music generation API routes and WaveSpeed input builder.
 * Usage: npm run build && node dist/scripts/test-music-api.js
 * Env: DATABASE_URL, PORT (default 3000)
 */
import dotenv from "dotenv";
import prisma from "../src/lib/db";
import { WavespeedAPI } from "../src/lib/wavespeed-api";
import { generateApiKey } from "../src/lib/api-keys";
import openApiDocument from "../src/docs/openapi";

dotenv.config();

const BASE = `http://localhost:${process.env.PORT || 3000}`;

async function main() {
  let passed = 0;
  let failed = 0;

  const assert = (name: string, ok: boolean, detail?: string) => {
    if (ok) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
      failed++;
    }
  };

  // Unit: WaveSpeed input builder
  const songInput = WavespeedAPI.murekaMusicInput({
    endpoint: "mureka-ai/mureka-v9/generate-song",
    kind: "song",
    lyrics: "[Verse]\nTest lyrics",
    prompt: "pop, upbeat",
    outputFormat: "mp3",
  });
  assert(
    "murekaMusicInput song payload",
    songInput.model === "mureka-ai/mureka-v9/generate-song" &&
      songInput.input.lyrics === "[Verse]\nTest lyrics" &&
      songInput.input.prompt === "pop, upbeat" &&
      songInput.input.output_format === "mp3",
  );

  const bgmInput = WavespeedAPI.murekaMusicInput({
    endpoint: "mureka-ai/mureka-v7.5/generate-bgm",
    kind: "bgm",
    prompt: "cinematic ambient",
    outputFormat: "mp3",
  });
  assert(
    "murekaMusicInput bgm payload",
    bgmInput.model === "mureka-ai/mureka-v7.5/generate-bgm" &&
      bgmInput.input.prompt === "cinematic ambient" &&
      !("lyrics" in bgmInput.input),
  );

  // OpenAPI paths
  const paths = openApiDocument.paths as Record<string, unknown>;
  assert("OpenAPI create path", "/public/music-generations/create" in paths);
  assert("OpenAPI status path", "/public/music/status/{id}" in paths);
  assert("OpenAPI list path", "/public/music-generations/all" in paths);

  // HTTP: unauthenticated
  const noAuth = await fetch(`${BASE}/api/v1/public/music-generations/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lyrics: "test", prompt: "pop" }),
  });
  assert("POST create without auth → 401", noAuth.status === 401, `got ${noAuth.status}`);

  // HTTP: with ephemeral API key
  const user = await prisma.user.findFirst({ select: { id: true, clerkId: true } });
  if (!user) {
    assert("test user exists", false, "no users in database");
  } else {
    const { key, prefix, hash } = generateApiKey();
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: "music-api-smoke-test",
        keyPrefix: prefix,
        keyHash: hash,
      },
    });

    try {
      const authed = await fetch(`${BASE}/api/v1/public/music-generations/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          lyrics: "[Verse]\nSmoke test lyrics for API validation",
          prompt: "pop, upbeat, female vocal",
          model: "auto",
          output_format: "mp3",
        }),
      });
      const body = (await authed.json()) as { success?: boolean; error?: string; generation?: { id: string } };

      if (!process.env.WAVESPEED_API_KEY) {
        assert(
          "POST create without WAVESPEED_API_KEY → 503",
          authed.status === 503,
          `got ${authed.status}: ${body.error ?? JSON.stringify(body)}`,
        );
      } else if (authed.status === 200 && body.success && body.generation?.id) {
        assert("POST create queues job → 200", true);
        const statusRes = await fetch(
          `${BASE}/api/v1/public/music/status/${body.generation.id}`,
          { headers: { Authorization: `Bearer ${key}` } },
        );
        const statusBody = (await statusRes.json()) as { success?: boolean; data?: { status: string } };
        assert(
          "GET status returns generation",
          statusRes.status === 200 && statusBody.success === true && !!statusBody.data?.status,
          `got ${statusRes.status}`,
        );

        const listRes = await fetch(`${BASE}/api/v1/public/music-generations/all?limit=5`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        const listBody = (await listRes.json()) as { success?: boolean; generations?: unknown[] };
        assert(
          "GET list includes generations",
          listRes.status === 200 && listBody.success === true && Array.isArray(listBody.generations),
          `got ${listRes.status}`,
        );
      } else {
        assert(
          "POST create with WAVESPEED_API_KEY",
          false,
          `got ${authed.status}: ${body.error ?? JSON.stringify(body)}`,
        );
      }

      const badModel = await fetch(`${BASE}/api/v1/public/music-generations/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          lyrics: "test",
          prompt: "pop",
          model: "not-a-model",
        }),
      });
      assert("POST invalid model → 400", badModel.status === 400, `got ${badModel.status}`);
    } finally {
      await prisma.apiKey.delete({ where: { id: apiKey.id } }).catch(() => {});
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
