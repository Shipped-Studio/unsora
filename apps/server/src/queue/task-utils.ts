import type { RetryOptions } from "@trigger.dev/sdk";

/**
 * Standard retry policy shared by the media-generation tasks. Mirrors the old
 * BullMQ `{ attempts: 3, backoff: { type: "exponential", delay: 10_000 } }`.
 * Per-task `onFailure` hooks (credit refunds, status updates) run only after
 * these attempts are exhausted, exactly like the old `worker.on("failed")`
 * last-attempt guard.
 */
export const STANDARD_RETRY: RetryOptions = {
  maxAttempts: 3,
  factor: 2,
  minTimeoutInMs: 10_000,
  maxTimeoutInMs: 120_000,
  randomize: true,
};

/** Shorter-backoff variant for the lighter video-processing tasks (old delay 5_000). */
export const SHORT_RETRY: RetryOptions = {
  maxAttempts: 3,
  factor: 2,
  minTimeoutInMs: 5_000,
  maxTimeoutInMs: 60_000,
  randomize: true,
};

/**
 * Error text written to a job's DB row when its run is cancelled. Cancelled
 * runs skip `onFailure`, so every task also wires an `onCancel` hook that
 * marks the row terminal and refunds the charge with this message.
 */
export const CANCELLED_ERROR = "Cancelled before completion";
