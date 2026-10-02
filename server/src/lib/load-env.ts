import dotenv from "dotenv";
import fs from "fs";
import path from "path";

let loaded = false;

/** Load `.env` from the repo root (works inside Trigger.dev temp build dirs). */
export function loadEnv(): void {
  if (loaded) return;

  const seen = new Set<string>();
  const tryPath = (filePath: string) => {
    if (seen.has(filePath) || !fs.existsSync(filePath)) return false;
    seen.add(filePath);
    dotenv.config({ path: filePath, override: false });
    return true;
  };

  if (process.env.UNSORA_ENV_FILE && tryPath(process.env.UNSORA_ENV_FILE)) {
    loaded = true;
    return;
  }

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (tryPath(path.join(dir, ".env"))) {
      loaded = true;
      return;
    }
    if (fs.existsSync(path.join(dir, "trigger.config.ts"))) {
      loaded = true;
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  dotenv.config();
  loaded = true;
}
