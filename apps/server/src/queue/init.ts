/**
 * trigger.dev loads init.ts at the root of the task directory before any
 * task runs. Global lifecycle hooks live here.
 */
import { tasks } from "@trigger.dev/sdk";
import * as Sentry from "@sentry/node";

// Sentry batches log lines and sends them every few seconds. Flush before a
// run finishes or is checkpointed for a wait, so its last lines aren't lost
// when the process exits or freezes.
const flushSentry = async () => {
  await Sentry.flush(2000);
};

tasks.onComplete(flushSentry);
tasks.onWait(flushSentry);
