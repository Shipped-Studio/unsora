/**
 * Helpers for importing agent skills from external sources.
 *
 * A "skill" is a folder with a SKILL.md at its root (YAML frontmatter with
 * name/description, then markdown instructions) plus optional reference
 * files. We import them either from a GitHub repo URL or from files the
 * admin uploads directly to the public bucket.
 */

export interface GithubSkillRef {
  owner: string;
  repo: string;
  /** Branch/tag; resolved at fetch time when absent. */
  ref?: string;
  /** Sub-directory within the repo holding SKILL.md, "" for repo root. */
  dir: string;
}

/**
 * Accepts the URL forms people actually paste:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/<branch>[/sub/dir]
 *   https://github.com/owner/repo/blob/<branch>/SKILL.md
 */
export function parseGithubUrl(url: string): GithubSkillRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.hostname !== "github.com") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, rawRepo, kind, ref, ...rest] = parts;
  const repo = rawRepo.replace(/\.git$/, "");

  if ((kind === "tree" || kind === "blob") && ref) {
    let dir = rest.join("/");
    if (kind === "blob") dir = dir.replace(/\/?SKILL\.md$/i, "");
    return { owner, repo, ref, dir };
  }
  return { owner, repo, dir: "" };
}

const RAW_BASE = "https://raw.githubusercontent.com";

/**
 * Fetch SKILL.md from the repo, trying the given ref then HEAD/main/master.
 * Returns the file content plus the ref that worked, so re-syncs and file
 * links stay stable.
 */
export async function fetchGithubSkillMd(source: GithubSkillRef): Promise<{
  content: string;
  ref: string;
} | null> {
  const refs = [...new Set([source.ref, "HEAD", "main", "master"].filter(Boolean))] as string[];
  const dir = source.dir ? `${source.dir}/` : "";

  for (const ref of refs) {
    const url = `${RAW_BASE}/${source.owner}/${source.repo}/${ref}/${dir}SKILL.md`;
    try {
      const res = await fetch(url);
      if (res.ok) return { content: await res.text(), ref };
    } catch {
      // network hiccup — try the next ref
    }
  }
  return null;
}

export interface SkillMdMeta {
  name?: string;
  description?: string;
  /** Markdown after the frontmatter block. */
  body: string;
}

/**
 * Minimal frontmatter reader — SKILL.md frontmatter is flat `key: value`
 * pairs (plus `>-`/`|`-style block scalars for long descriptions), so a
 * YAML dependency isn't warranted.
 */
export function parseSkillMd(content: string): SkillMdMeta {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { body: content };

  const meta: SkillMdMeta = { body: content.slice(match[0].length) };
  const lines = match[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;

    let value = kv[2].trim();
    if (/^[>|][+-]?$/.test(value)) {
      // Block scalar: gather the following more-indented lines.
      const block: string[] = [];
      while (i + 1 < lines.length && /^(\s+\S|\s*$)/.test(lines[i + 1])) {
        block.push(lines[++i].trim());
      }
      value = block.join(" ").trim();
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }

    if (kv[1] === "name") meta.name = value;
    if (kv[1] === "description") meta.description = value;
  }
  return meta;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
