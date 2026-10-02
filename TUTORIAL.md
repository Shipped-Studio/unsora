# Working in the Unsora monorepo

This guide covers the day-to-day: how the workspace fits together, how to run and build things with Turborepo, how to manage dependencies, and how to create and use a shared package in `packages/`.

For what each app does and how it is deployed, see the [README](README.md).

## 1. How the repo is put together

Three tools, each with one job:

| Tool | Job | Config |
| --- | --- | --- |
| **pnpm** | Installs dependencies for every app and links workspace packages to each other | [`pnpm-workspace.yaml`](pnpm-workspace.yaml), [`pnpm-lock.yaml`](pnpm-lock.yaml) |
| **Turborepo** | Runs scripts (`build`, `dev`, `typecheck`, `lint`) across apps in the right order, and caches the results | [`turbo.json`](turbo.json) |
| **Node** | Runtime, pinned for local dev, CI and Railway | [`.node-version`](.node-version) |

```
unsora/
├── apps/                 deployable things, never imported by each other
│   ├── client/           @unsora/client   Next.js
│   ├── server/           @unsora/server   Express + Prisma + Trigger.dev
│   ├── mcp/              @unsora/mcp      MCP server
│   └── remotion/         @unsora/remotion Remotion compositions
├── packages/             shared code that apps import (create it when needed)
├── package.json          root scripts + turbo
├── pnpm-workspace.yaml   which folders are workspace packages
├── pnpm-lock.yaml        the only lockfile in the repo
└── turbo.json            task pipeline + caching
```

Rules that keep this working:

- **One lockfile.** Always run `pnpm` from anywhere in the repo, never `npm install` or `yarn`. Any `package-lock.json` inside an app is a mistake and should be deleted.
- **Apps don't import from apps.** Never write `import ... from "../../server/src/..."`. If two apps need the same code, move it into `packages/` (section 5).
- **Each workspace has a unique name** (`@unsora/<name>`), and that name is how you refer to it everywhere: filters, dependencies and imports.

## 2. First-time setup

```bash
corepack enable        # uses the pnpm version pinned in package.json
pnpm install           # installs everything + generates the Prisma client

cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
cp apps/mcp/.env.example    apps/mcp/.env
```

Each app reads its own `.env` from its own folder. There is no root `.env`.

## 3. Running things with Turborepo

### The root scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | `dev` in every app at once |
| `pnpm dev:server` / `dev:client` / `dev:mcp` | `dev` in one app |
| `pnpm dev:trigger` | Trigger.dev dev worker (not through Turbo) |
| `pnpm build` | Builds every app, dependencies first |
| `pnpm typecheck` | `tsc --noEmit` in every app |
| `pnpm lint` | Lints every app that has a `lint` script |

`turbo.json` sets `"ui": "tui"`, so `pnpm dev` opens Turbo's terminal UI: a list of apps on the left and the selected app's logs on the right.

| Key | Does |
| --- | --- |
| `↑` / `↓` (or `j` / `k`) | Switch to another app's logs |
| `i` | Type into the selected app (for example `rs` to restart nodemon) |
| `Ctrl+z` | Stop typing into the app |
| `u` / `d` | Scroll the logs up / down |
| `h` | Hide or show the app list |
| `m` | Show all keybindings |
| `Ctrl+c` | Stop everything |

To get the old interleaved output for one run, use `pnpm turbo run dev --ui=stream`.

Every root script is just `turbo run <task>`. Turbo looks for a script with that name in each workspace's `package.json` and runs it. A workspace without that script is skipped.

### Filtering: choosing which workspaces run

Use `pnpm turbo run <task>` with `--filter` to run something other than the root scripts:

```bash
pnpm turbo run build --filter=@unsora/server          # just the server
pnpm turbo run build --filter=@unsora/server...       # the server AND everything it depends on
pnpm turbo run build --filter=...@unsora/types        # a package AND everything that depends on it
pnpm turbo run typecheck --filter=./apps/*            # by folder
pnpm turbo run typecheck --affected                   # only what changed vs main (what CI does)
```

`...` after the name means "plus its dependencies". `...` before the name means "plus its dependents". You'll mostly need these once shared packages exist.

### Running an app-specific script

Scripts that aren't Turbo tasks (migrations, one-off tools) run through pnpm's filter instead:

```bash
pnpm --filter @unsora/server migrate              # prisma migrate dev
pnpm --filter @unsora/server db:generate          # regenerate the Prisma client
pnpm --filter @unsora/server exec prisma studio   # run a binary from that app's deps
pnpm --filter @unsora/mcp preview                 # any script in that package.json
```

Or `cd apps/server && pnpm migrate`, which does the same thing.

### What `turbo.json` controls

```jsonc
"build": {
  "dependsOn": ["^build"],   // build my workspace dependencies first
  "env": ["NEXT_PUBLIC_*"],  // these env vars are part of the cache key
  "outputs": ["dist/**", ".next/**", "!.next/cache/**"]  // what gets cached and restored
},
"typecheck": { "dependsOn": ["^build"] },
"dev": { "cache": false, "persistent": true }
```

- `^` means "in my dependencies". `"dependsOn": ["^build"]` on `build` means that when the server depends on `@unsora/types`, `@unsora/types` builds first.
- `outputs` is what Turbo stores in its cache. If nothing an app depends on has changed, the next `build` prints `cache hit, replaying logs` and restores `dist/` in milliseconds instead of rebuilding.
- `persistent: true` marks long-running tasks (dev servers) so Turbo doesn't wait for them to exit.

### Caching tips

```bash
pnpm turbo run build --force       # ignore the cache, rebuild everything
pnpm turbo run build --dry         # show what would run and why, without running it
```

The local cache lives in `.turbo/` (gitignored). Delete it if the cache ever looks wrong.

Because `envMode` is `loose` and only `NEXT_PUBLIC_*` is listed, changing another env var does **not** invalidate a cached build. That's fine for `tsc` builds that read env at runtime. If a build ever bakes an env var into its output, add the var to that task's `env` list.

## 4. Managing dependencies

Always say which workspace a dependency belongs to:

```bash
pnpm --filter @unsora/server add zod              # runtime dependency of the server
pnpm --filter @unsora/client add -D @types/foo    # dev dependency of the client
pnpm --filter @unsora/mcp remove axios
pnpm add -Dw some-tool                            # root-only tooling (-w = workspace root)
```

Running `pnpm add` inside an app folder also works and adds to that app.

Keep root `package.json` dependencies to repo-wide tooling (turbo, and later maybe prettier). App code must never rely on a package that only the root installs.

After pulling changes that touch any `package.json` or the lockfile, run `pnpm install`.

## 5. Shared packages

### When to make one

Make a package when two or more apps need the **same** code and keeping copies in sync by hand is already causing drift. Good candidates here:

- **`@unsora/remotion-shared`**: the subtitle types and font list currently duplicated between `apps/remotion/src` and `apps/client/remotion`, which have already drifted apart.
- **`@unsora/types`**: request and response types for the `/api/v1` endpoints that the server, the client and the MCP server all use.
- Shared validation schemas (zod), constants and pure helper functions.

Keep framework-specific code out of packages (no Next.js components, Express middleware or Prisma calls) unless every app that imports the package uses that framework.

### Why packages here are compiled

The apps resolve modules in four different ways:

| App | Module system | Resolution |
| --- | --- | --- |
| server | CommonJS, built with `tsc`, runs with `node` | legacy `node` (reads `main`/`types`, ignores `exports`) |
| mcp | ESM, built with `tsc`, runs with `node` | `NodeNext` |
| client | bundled by Next.js | `bundler` |
| remotion | bundled by Remotion's webpack | bundler |

Node can't run `.ts` files, and the server's `tsc` won't compile files from outside its own folder. So a shared package **compiles itself to CommonJS JavaScript plus `.d.ts` type files** in its own `dist/`, and apps import the compiled output. CommonJS is the one format all four can load: the server `require`s it, mcp's ESM `import { x }` gets named exports, and both bundlers handle it.

This template was checked against all three TypeScript apps: type-checking, building, and importing at runtime from the built server (CJS) and mcp (ESM) output.

### Step by step: creating `@unsora/types`

**1. Create the folder**

```
packages/types/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

`pnpm-workspace.yaml` already includes `packages/*`, so nothing else needs registering.

**2. `packages/types/package.json`**

```json
{
  "name": "@unsora/types",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch --preserveWatchOutput",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

- Keep **both** `main`/`types` (for the server's legacy resolution) and `exports` (for everything else).
- **Don't** add `"type": "module"`. The server runs on CommonJS and can't `require` an ESM package on Node 20.
- The `build`, `dev` and `typecheck` script names are what make Turbo pick the package up automatically.

**3. `packages/types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`dist/` is already gitignored at the root.

**4. Write the code**

```ts
// packages/types/src/index.ts
export interface SubtitleWord {
  text: string;
  start: number;
  end: number;
}

export const SUPPORTED_ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;
```

Re-export everything public from `src/index.ts`. Apps should only ever import `@unsora/types`, never `@unsora/types/dist/...` or `@unsora/types/src/...`.

**5. Add it to the apps that need it**

```bash
pnpm --filter @unsora/server add '@unsora/types@workspace:*'
pnpm --filter @unsora/client add '@unsora/types@workspace:*'
pnpm install
```

Keep the quotes. Without them zsh treats `*` as a file glob and fails with `no matches found`.

`workspace:*` tells pnpm to symlink the local package instead of fetching it from npm. The app's `package.json` ends up with `"@unsora/types": "workspace:*"`.

**6. Import it like any other package**

```ts
import { SUPPORTED_ASPECT_RATIOS, type SubtitleWord } from "@unsora/types";
```

This works the same in the server, mcp, client and remotion. Next.js doesn't need `transpilePackages`, because the package is already compiled.

**7. Build it once**

```bash
pnpm turbo run build --filter=@unsora/types
```

After that, `pnpm build`, `pnpm typecheck` and every deploy build it automatically through `"dependsOn": ["^build"]`.

### Developing with a shared package

Apps read the package's compiled `dist/`, so the package has to be rebuilt for apps to see your edits. Run the package's watcher alongside the app:

```bash
pnpm turbo run dev --filter=@unsora/server...   # server dev + tsc --watch in every package it uses
```

The trailing `...` is what pulls the package's `dev` (watch) script in. Plain `pnpm dev` runs every workspace's `dev`, so packages are included automatically.

**When you add the first package**, make two small changes so dev mode works from a clean checkout:

1. In `turbo.json`, have `dev` build dependencies first so `dist/` exists before an app starts:

   ```json
   "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true }
   ```

2. In the root `package.json`, add `...` to the per-app dev scripts so package watchers run too:

   ```json
   "dev:server": "turbo run dev --filter=@unsora/server...",
   "dev:client": "turbo run dev --filter=@unsora/client...",
   "dev:mcp":    "turbo run dev --filter=@unsora/mcp..."
   ```

### Deploys and CI already handle packages

- **Railway** (server, mcp): the build command `turbo run build --filter=@unsora/<app>` builds the app's packages first through `^build`, and the watch patterns already include `/packages/**`.
- **Vercel** (client): `turbo-ignore` redeploys when the client **or any package it depends on** changes.
- **CI**: `--affected` treats an app as changed when a package it depends on changes.

## 6. Adding a new app

1. Create `apps/<name>/` with a `package.json` whose `name` is `@unsora/<name>` and `"private": true`.
2. Give it the standard scripts where they make sense: `dev`, `build`, `typecheck`, `lint`, `start`. Turbo picks them up automatically.
3. If its build output isn't `dist/` or `.next/`, add the folder to `build.outputs` in `turbo.json`.
4. Don't add a lockfile, `.nvmrc` or `packageManager` field inside the app. Those live only at the root.
5. Run `pnpm install`.
6. For Railway, copy an existing `railway.json` and change the filter, start command and watch path.

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot find module '@unsora/x'` | Run `pnpm install`, then `pnpm turbo run build --filter=@unsora/x`. Check the app's `package.json` lists it as `workspace:*`. |
| App doesn't see your edit to a package | The package watcher isn't running. Start dev with `--filter=@unsora/<app>...`, or rebuild the package. |
| `sh: tsc: command not found` in a package | The package's own devDependencies aren't installed yet. Run `pnpm install` from the root. |
| `no matches found: ...workspace:*` | Quote the spec: `'@unsora/x@workspace:*'`. |
| Build output looks stale or wrong | `pnpm turbo run build --force`, or delete `.turbo/`. |
| `ERR_PNPM_OUTDATED_LOCKFILE` in CI | Run `pnpm install` locally and commit `pnpm-lock.yaml`. |
| Prisma client types missing | `pnpm --filter @unsora/server db:generate`. |
| Wrong Node version | Use the version in `.node-version` (`fnm use` / `nvm use 20`). |
