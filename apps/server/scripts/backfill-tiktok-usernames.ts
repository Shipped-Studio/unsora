/**
 * Backfill: store the TikTok username on accounts connected before the
 * connect flow saved it (user.info.basic has no username). Post URLs are
 * built from it, so without it the fallback link is a bare tiktok.com.
 *
 * Uses the token each user already granted: refreshes it if expired (via
 * ensureValidToken, which saves the new tokens), then reads creator_username
 * from creator_info. Accounts whose access was revoked are reported and left
 * alone; they get the username when the user reconnects.
 *
 * Idempotent: accounts that already have a username are skipped.
 *
 *   npx ts-node scripts/backfill-tiktok-usernames.ts           # dry run
 *   npx ts-node scripts/backfill-tiktok-usernames.ts --write   # save
 */
import { prisma } from "../src/lib/db";
import { ensureValidToken } from "../src/services/token.service";
import { getTikTokCreatorInfo } from "../src/oauth/tiktok";

const WRITE = process.argv.includes("--write");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      provider: "tiktok",
      OR: [{ accountUsername: null }, { accountUsername: "" }],
    },
    select: { id: true, accountName: true },
  });

  console.log(
    `${accounts.length} TikTok account(s) without a username${WRITE ? "" : " (dry run, pass --write to save)"}`,
  );

  let saved = 0;
  const failed: { id: string; reason: string }[] = [];

  for (const account of accounts) {
    try {
      const token = await ensureValidToken(account.id);
      const info = await getTikTokCreatorInfo(token as string);
      const username = info?.creator_username;
      if (!username) {
        failed.push({ id: account.id, reason: "creator_info returned no username" });
        continue;
      }
      if (WRITE) {
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: { accountUsername: username },
        });
      }
      saved++;
      console.log(`${WRITE ? "saved" : "would save"} ${account.id} -> @${username}`);
    } catch (error: any) {
      failed.push({
        id: account.id,
        reason: error?.response?.data?.error_description || error.message,
      });
    }
    // Stay well under TikTok's rate limits.
    await sleep(250);
  }

  console.log(`\n${saved} ${WRITE ? "saved" : "resolvable"}, ${failed.length} failed`);
  for (const f of failed) console.log(`  ${f.id}: ${f.reason}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
