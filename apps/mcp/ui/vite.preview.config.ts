import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Dev server for the standalone MCP App preview (ui/preview.html). The
 * widgets themselves are plain HTML in ../assets/mcp-ui, imported raw by
 * src/preview.ts — no build step.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    open: "/preview.html",
  },
});
