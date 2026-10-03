/**
 * Send real emails (the templates, with sample data) to an inbox, to check
 * Plunk delivery and how they look in Gmail / Outlook / Apple Mail.
 *
 * Usage (from the repo root):
 *   pnpm --filter @unsora/server email:test you@example.com              # every template
 *   pnpm --filter @unsora/server email:test you@example.com welcome      # one template
 *   pnpm --filter @unsora/server email:test list                         # list template ids
 *
 * Templates and sample data: src/emails/catalog.ts. To see them without
 * sending, run the server and open http://localhost:<PORT>/dev/emails.
 */
import { loadEnv } from "../src/lib/load-env";
import { EMAIL_CATALOG } from "../src/emails/catalog";
import { sendRendered } from "../src/emails/send";

loadEnv();

async function main() {
  const [first, which = "all"] = process.argv.slice(2);

  if (!first || first === "list" || which === "list") {
    if (!first) console.log("Usage: email:test you@example.com [id|all|list]\n");
    for (const e of EMAIL_CATALOG) console.log(`${e.id.padEnd(22)} ${e.trigger}`);
    process.exit(first ? 0 : 1);
  }
  const to = first;

  for (const name of ["PLUNK_SECRET_KEY", "PLUNK_FROM_EMAIL"]) {
    if (!process.env[name]) {
      console.error(`✗ ${name} is not set. Aborting.`);
      process.exit(1);
    }
  }

  const entries = which === "all" ? EMAIL_CATALOG : EMAIL_CATALOG.filter((e) => e.id === which);
  if (entries.length === 0) {
    console.error(`✗ No template "${which}". Run with "list" to see ids.`);
    process.exit(1);
  }

  console.log(`Sending ${entries.length} email(s) to ${to} from ${process.env.PLUNK_FROM_EMAIL}\n`);
  let failed = 0;
  for (const entry of entries) {
    const email = entry.render();
    try {
      await sendRendered(to, { ...email, subject: `[test] ${email.subject}` });
      console.log(`✓ ${entry.id}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${entry.id}:`, err instanceof Error ? err.message : err);
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
