import { defineConfig } from "@trigger.dev/sdk";
import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import * as Sentry from "@sentry/node";

/**
 * trigger.dev configuration. Replaces the standalone BullMQ worker + node-cron
 * processes. Tasks live in ./src/queue (one task per former queue file) and run
 * on trigger.dev infrastructure; the API only enqueues via `*.trigger()`.
 *
 * Set TRIGGER_PROJECT_REF (from the trigger.dev dashboard) and TRIGGER_SECRET_KEY
 * in the environment. Deploy with `npx trigger.dev@latest deploy`.
 */
export default defineConfig({
  project: "proj_opcrvedpyakjcvelbdfl",
  // Match the API's Node version (.node-version). The default "node" runtime
  // is Node 21, which can't load undici 8 (via the Bluesky OAuth client).
  runtime: "node-24",
  dirs: ["./src/queue"],
  // Native deps the tasks rely on inside the deployed container:
  //  - prismaExtension: runs `prisma generate` at build so @prisma/client works
  //  - ffmpeg: provides the ffmpeg binary for fluent-ffmpeg (video/subtitle tasks)
  //  - puppeteer: installs Chromium for puppeteer-service (video-process scraping)
  build: {
    // sharp 0.35 ships only an `exports` map. Auto-detection links its dist/
    // folder into the dev worker, so Node can't load it (trigger.dev#4511);
    // listing it explicitly links the package root instead.
    external: ["sharp"],
    extensions: [
      prismaExtension({ mode: "legacy", schema: "prisma/schema.prisma" }),
      ffmpeg(),
      puppeteer(),
    ],
  },
  // Compute-time cap per run. Long provider polls use `wait.for`, which suspends
  // the run and does NOT count against this — so 1h of actual compute is ample.
  maxDuration: 3600,
  retries: {
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 10_000,
      maxTimeoutInMs: 60_000,
      randomize: true,
    },
  },
  // Initialize Sentry once per worker boot on the trigger.dev side.
  init: async () => {
    await import("./src/monitor/instrument");
    // Platform credentials saved in /admin (lib/platform-credentials.ts).
    const { startPlatformCredentialSync } = await import(
      "./src/lib/platform-credentials"
    );
    await startPlatformCredentialSync().catch((err) =>
      console.error("[platform-credentials] worker load failed:", err),
    );
  },
  // Global failure hook — fires after a run exhausts all retries. Mirrors the
  // old attachWorkerErrorHandlers() Sentry reporting for every queue.
  onFailure: async ({ payload, error, ctx }) => {
    Sentry.withScope((scope) => {
      scope.setTag("queue", ctx.task.id);
      scope.setTag("runId", ctx.run.id);
      const userId = (payload as { userId?: string } | undefined)?.userId;
      if (userId) scope.setUser({ id: userId });
      Sentry.captureException(error);
    });
    await Sentry.flush(2000);
  },
});
