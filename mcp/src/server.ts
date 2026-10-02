import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnsoraApi } from "./unsora-api.js";
import { registerTools } from "./tools/index.js";

export type UnsoraAuthResolver = (authInfo?: AuthInfo) => UnsoraApi;

export const MCP_INSTRUCTIONS = [
  "Unsora generates images, video, talking-avatar video, music, voiceovers and short clips, upscales images and video, and publishes to the user's connected social accounts. Every generation spends credits from the connected Unsora account.",
  "Create tools start a job and return its generation id(s). In hosts that render the Unsora preview panel, the panel polls and shows the result itself; otherwise follow with the matching wait_for_* tool until the status is COMPLETED or FAILED — the file URL is outputUrl.",
  "Files the user attaches in this chat don't reach Unsora: import them with upload_file (public URL, or base64 for small files) before passing them to a tool.",
  "See the unsora://workflows resource for multi-step workflows.",
].join(" ");

export function createMcpServer(resolveUnsora: UnsoraAuthResolver): McpServer {
  const baseUrl =
    process.env.MCP_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

  const server = new McpServer(
    {
      name: process.env.MCP_SERVER_NAME || "unsora-mcp",
      title: "Unsora AI",
      version: "1.0.0",
      websiteUrl: "https://tryunsora.com",
      icons: [
        {
          src: `${baseUrl}/assets/brand/icon-light.png`,
          mimeType: "image/png",
          sizes: ["524x524"],
          theme: "light",
        },
        {
          src: `${baseUrl}/assets/brand/icon-dark.png`,
          mimeType: "image/png",
          sizes: ["520x520"],
          theme: "dark",
        },
      ],
    },
    { instructions: MCP_INSTRUCTIONS },
  );

  registerTools(server, resolveUnsora);

  return server;
}
