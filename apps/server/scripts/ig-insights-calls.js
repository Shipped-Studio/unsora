#!/usr/bin/env node
// Makes successful Instagram insights calls so Meta's "API calls" counter registers them.
//
// Usage:
//   node scripts/ig-insights-calls.js                       interactive: asks for what's missing
//   node scripts/ig-insights-calls.js --mode facebook --id <ig user id> [--token <token>]
//   node scripts/ig-insights-calls.js --mode direct   --id <ig user id> [--token <token>]
//   node scripts/ig-insights-calls.js --account <instagram username>   token from the database
//
// Modes:
//   facebook  Instagram via Facebook (Page token, graph.facebook.com)
//             -> counts for instagram_manage_insights
//   direct    Instagram Login (Instagram token, graph.instagram.com)
//             -> counts for instagram_business_manage_insights
//
// --account looks the connected account up in the database (DATABASE_URL from the env or
// apps/server/.env) and uses its stored mode, ID and token. Run it from apps/server.
//
// Values can also come from the env: MODE, IG_USER_ID, TOKEN.
// Prefer omitting --token: you'll be asked for it, so it stays out of shell history.
// The token is never printed. Needs Node 18+ (global fetch).

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const HELP = `Usage:
  node scripts/ig-insights-calls.js [--mode facebook|direct] [--id <ig user id>] [--token <token>]
  node scripts/ig-insights-calls.js --account <instagram username>   (token read from the database)

Anything missing is asked for interactively. Env fallbacks: MODE, IG_USER_ID, TOKEN.`;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") out.help = true;
    else if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=");
      out[key] = inline ?? argv[++i];
    }
  }
  return out;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      // Don't echo what's typed.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}


/** Mode, ID and token of a connected Instagram account, read from the database. */
async function loadAccount(username) {
  if (!process.env.DATABASE_URL) {
    const envFile = path.join(__dirname, "..", ".env");
    const line = fs.existsSync(envFile)
      ? fs.readFileSync(envFile, "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="))
      : null;
    if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim();
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL isn't set (env or apps/server/.env).");
    process.exit(1);
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const wanted = username.replace(/^@/, "");
    const matches = await prisma.socialAccount.findMany({
      where: { provider: "instagram", accountUsername: { equals: wanted, mode: "insensitive" } },
      select: { providerAccountId: true, accessToken: true, scope: true, expiresAt: true },
    });
    if (matches.length !== 1) {
      console.error(
        matches.length
          ? `${matches.length} Instagram accounts match "${wanted}"; can't pick one.`
          : `No connected Instagram account with username "${wanted}".`,
      );
      process.exit(1);
    }
    const [account] = matches;
    if (account.expiresAt && account.expiresAt < new Date()) {
      console.warn(`Warning: the stored token expired on ${account.expiresAt.toISOString()}.`);
    }
    return {
      mode: account.scope === "facebook_login" ? "facebook" : "direct",
      igUserId: account.providerAccountId,
      token: account.accessToken,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return console.log(HELP);

  let mode = args.mode || process.env.MODE;
  let igUserId = args.id || process.env.IG_USER_ID;
  let token = args.token || process.env.TOKEN;

  if (args.account) {
    ({ mode, igUserId, token } = await loadAccount(args.account));
  }

  if (!process.stdin.isTTY && (!mode || !igUserId || !token)) {
    console.error("Missing values and no terminal to ask on.\n\n" + HELP);
    process.exit(1);
  }

  while (mode !== "facebook" && mode !== "direct") {
    mode = (await ask("Mode (facebook = Instagram via Facebook, direct = Instagram Login): ")).toLowerCase();
  }
  if (!igUserId) igUserId = await ask("Instagram account ID: ");
  if (!token) token = await ask("Access token (hidden): ", { hidden: true });
  if (!igUserId || !token) {
    console.error("An Instagram account ID and a token are required.");
    process.exit(1);
  }

  const base =
    mode === "facebook"
      ? "https://graph.facebook.com/v24.0"
      : "https://graph.instagram.com/v24.0";
  const permission =
    mode === "facebook" ? "instagram_manage_insights" : "instagram_business_manage_insights";

  console.log(`\nMode: ${mode}  (counts for ${permission})\n`);

  let failed = 0;
  async function call(label, path, params) {
    const url = new URL(`${base}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("access_token", token);
    let res;
    let body = {};
    try {
      res = await fetch(url);
      body = await res.json().catch(() => ({}));
    } catch (error) {
      console.log(`FAIL ${label}: ${error.message}`);
      failed++;
      return null;
    }
    const ok = res.ok && !body.error;
    console.log(`${ok ? "OK  " : "FAIL"} ${label} (${res.status})${ok ? "" : " " + (body.error?.message ?? "")}`);
    if (!ok) failed++;
    return ok ? body : null;
  }

  await call("account insights (reach)", `${igUserId}/insights`, {
    metric: "reach",
    period: "day",
  });

  const media = await call("latest media", `${igUserId}/media`, { fields: "id", limit: "1" });
  const mediaId = media?.data?.[0]?.id;
  if (!mediaId) {
    console.log("\nNo media found on this account. Publish one post and run again.");
  } else {
    await call("media insights", `${mediaId}/insights`, {
      metric: "views,likes,comments,shares,saved",
    });
  }

  console.log(
    failed
      ? `\n${failed} call(s) failed. Counters only register successful calls.`
      : "\nDone. The API calls counter can take hours to update.",
  );
  process.exit(failed ? 1 : 0);
}

main();
