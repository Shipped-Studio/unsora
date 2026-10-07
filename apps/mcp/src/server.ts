import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnsoraApi } from "./unsora-api.js";
import {
  registerTools,
  type RegisterToolsOptions,
  schedulerWorkflowGuide,
} from "./tools/index.js";

export type UnsoraAuthResolver = (authInfo?: AuthInfo) => UnsoraApi;

export const MCP_INSTRUCTIONS = [
  "Unsora generates images, video, talking-avatar video, music, voiceovers and short clips, upscales images and video, and publishes to the user's connected social accounts. Every generation spends credits from the connected Unsora account.",
  "Create tools start a job and return its generation id(s). In hosts that render the Unsora preview panel, the panel polls and shows the result itself; otherwise follow with the matching wait_for_* tool until the status is COMPLETED or FAILED — the file URL is outputUrl.",
  "Files the user attaches in this chat don't reach Unsora: import them with upload_file (public URL, or base64 for small files) before passing them to a tool.",
  "See the unsora://workflows resource for multi-step workflows.",
].join(" ");

export const SCHEDULER_INSTRUCTIONS = [
  "Unsora Scheduler turns long videos into short clips (AI clipping) and schedules or publishes posts to the user's connected social accounts. Clipping spends credits from the connected Unsora account; posting needs a paid plan.",
  "create_clipping starts a job. In hosts that render the Unsora preview panel, the panel polls and shows the clips itself; otherwise follow with wait_for_clipping until the status is COMPLETED or FAILED.",
  "Files the user attaches in this chat don't reach Unsora: import them with upload_file (public URL, or base64 for small files) before clipping or posting them.",
  "See the unsora://workflows resource for multi-step workflows.",
].join(" ");

/** Tools served at /scheduler: clipping plus everything needed to post. */
const SCHEDULER_TOOLS = new Set([
  // Clipping
  "create_clipping",
  "clipping_status",
  "wait_for_clipping",
  // Accounts and plan
  "get_accounts",
  "pinterest_boards",
  "tiktok_creator_info",
  "get_credits",
  "get_subscription",
  // Posts
  "create_post",
  "compose_post",
  "publish_post",
  "update_post",
  "delete_post",
  "get_post",
  "list_posts",
  "retry_post",
  "get_post_analytics",
  // Media to post
  "upload_file",
  "list_uploads",
  "list_generations",
  "delete_generation",
]);

export type McpProfile = "full" | "scheduler";

interface ProfileConfig extends RegisterToolsOptions {
  name: string;
  title: string;
  instructions: string;
}

function profileConfig(profile: McpProfile): ProfileConfig {
  const name = process.env.MCP_SERVER_NAME || "unsora-mcp";
  if (profile === "scheduler") {
    return {
      name: `${name}-scheduler`,
      title: "Unsora Scheduler",
      instructions: SCHEDULER_INSTRUCTIONS,
      tools: SCHEDULER_TOOLS,
      workflowGuide: schedulerWorkflowGuide,
    };
  }
  return { name, title: "Unsora AI", instructions: MCP_INSTRUCTIONS };
}

export function createMcpServer(
  resolveUnsora: UnsoraAuthResolver,
  profile: McpProfile = "full",
): McpServer {
  const baseUrl =
    process.env.MCP_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  const { name, title, instructions, ...toolOptions } = profileConfig(profile);

  const server = new McpServer(
    {
      name,
      title,
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
    { instructions },
  );

  registerTools(server, resolveUnsora, toolOptions);

  return server;
}
