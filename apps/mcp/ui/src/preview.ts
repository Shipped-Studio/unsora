/**
 * Standalone preview harness — plays the MCP host (Claude/ChatGPT) role so the
 * views can be exercised without running the MCP server or connecting a chat
 * client. Run with: npm run preview
 */
import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
// The widgets are plain HTML served as-is (media gets its kind filled in).
import mediaTemplate from "../../assets/mcp-ui/media-view.html?raw";
import clippingHtml from "../../assets/mcp-ui/clipping-view.html?raw";
import voicesHtml from "../../assets/mcp-ui/voices-view.html?raw";
import accountHtml from "../../assets/mcp-ui/account-view.html?raw";
import accountsHtml from "../../assets/mcp-ui/accounts-view.html?raw";
import postsHtml from "../../assets/mcp-ui/posts-view.html?raw";
import analyticsHtml from "../../assets/mcp-ui/analytics-view.html?raw";
import libraryHtml from "../../assets/mcp-ui/library-view.html?raw";
import composerHtml from "../../assets/mcp-ui/composer-view.html?raw";
import kitCss from "../../assets/mcp-ui/shared/kit.css?raw";
import kitJs from "../../assets/mcp-ui/shared/kit.js?raw";
import * as mock from "./mocks";

type View =
  | "image" | "video" | "audio" | "clipping" | "voices"
  | "account" | "accounts" | "posts" | "analytics" | "library" | "composer";

const KIT_VIEWS: Partial<Record<View, string>> = {
  account: accountHtml,
  accounts: accountsHtml,
  posts: postsHtml,
  analytics: analyticsHtml,
  library: libraryHtml,
  composer: composerHtml,
};

/** Same inlining the server does in loadWidget (src/tools/index.ts). */
function inlineKit(html: string): string {
  return html
    .split("/*@kit.css*/").join(kitCss)
    .split("/*@kit.js*/").join(kitJs)
    .split("__UNSORA_APP_URL__").join("https://app.tryunsora.com");
}

function widgetFor(view: View): string {
  if (view === "clipping") return clippingHtml;
  if (view === "voices") return voicesHtml;
  const kit = KIT_VIEWS[view];
  if (kit) return inlineKit(kit);
  return mediaTemplate.split("__UNSORA_KIND__").join(view);
}

interface Scenario {
  label: string;
  view: View;
  tool: string;
  args: Record<string, unknown>;
  structuredContent: Record<string, unknown>;
  /**
   * Status polls before the job completes. The media widget checks at once,
   * then after 20s and every 30s — so 1 = done on the first check.
   */
  pollsToComplete: number;
  fail?: boolean;
  /** Replies for tools the view calls itself (tool name -> structuredContent). */
  mock?: Record<string, (args: Record<string, unknown>) => unknown>;
  /** Send the tool result as an error. */
  errorResult?: string;
}

/** Tools every scheduler/library view may call. */
const SCHEDULER_MOCKS: Scenario["mock"] = {
  get_post: (a) => mock.getPost(String(a.postId)),
  list_posts: (a) => mock.listPosts(a),
  publish_post: (a) => ({ success: true, message: "Publishing started", data: { postId: a.postId, status: "PUBLISHING", results: [] } }),
  retry_post: (a) => ({ success: true, message: "Retry started", data: { postId: a.postId, status: "PUBLISHING", results: [] } }),
  update_post: (a) => {
    const base = mock.POSTS.find((p) => p.id === a.postId)!;
    const scheduled = a.scheduled_at === null ? null : String(a.scheduled_at);
    return { success: true, data: { ...base, scheduledFor: scheduled, status: scheduled ? "SCHEDULED" : "DRAFT" } };
  },
  delete_post: () => ({ success: true, message: "Post deleted successfully" }),
  get_credits: () => mock.CREDITS,
  get_subscription: () => mock.SUBSCRIPTION,
  get_accounts: () => ({ success: true, data: mock.ACCOUNTS }),
  get_post_analytics: (a) => mock.analytics(Number(a.days) || 30),
  list_generations: (a) => mock.library(String(a.type)),
  list_uploads: () => mock.uploads(),
  delete_generation: () => ({ success: true, message: "Deleted" }),
  pinterest_boards: () => mock.PINTEREST_BOARDS,
  tiktok_creator_info: () => mock.TIKTOK_CREATOR,
  create_post: () => mock.CREATE_POST_RESULT,
  list_voices: () => mock.voiceLibrary(SAMPLE_VOICES),
  delete_voice_clone: () => ({ success: true, message: "Voice clone deleted" }),
};

const SAMPLE_VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
];

const SAMPLE_AUDIO =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

const sampleImage = (seed: string) =>
  `https://picsum.photos/seed/${seed}/1280/720`;

/** Mirrors the /voiceovers/voices catalog (id, description, gender, accent). */
const VOICE_CATALOG: [string, string, string, string][] = [
  ["Aria", "Expressive, husky female voice for social media and storytelling", "female", "american"],
  ["Roger", "Laid-back, resonant male voice for casual conversations", "male", "american"],
  ["Sarah", "Confident, warm young female voice with a professional tone", "female", "american"],
  ["Laura", "Sunny, quirky young female voice for social media", "female", "american"],
  ["Charlie", "Confident, energetic young male voice", "male", "australian"],
  ["George", "Warm, mature male narrator for storytelling", "male", "british"],
  ["Callum", "Gravelly male voice with an intense edge for characters", "male", "american"],
  ["River", "Relaxed, neutral voice for narration and conversation", "neutral", "american"],
  ["Liam", "Energetic, warm young male voice for reels and shorts", "male", "american"],
  ["Charlotte", "Smooth, alluring female voice for characters and narration", "female", "swedish"],
  ["Alice", "Clear, friendly professional female voice for e-learning", "female", "british"],
  ["Matilda", "Upbeat professional female voice with a pleasing alto pitch", "female", "american"],
  ["Will", "Chill, conversational young male voice", "male", "american"],
  ["Jessica", "Playful, trendy young female voice", "female", "american"],
  ["Eric", "Smooth classy male tenor, great for agents and support", "male", "american"],
  ["Chris", "Natural, down-to-earth male voice for everyday content", "male", "american"],
  ["Brian", "Resonant, comforting male voice for narrations and ads", "male", "american"],
  ["Daniel", "Strong, formal male voice for broadcasts and news", "male", "british"],
  ["Lily", "Velvety, confident female voice for news and narration", "female", "british"],
  ["Bill", "Friendly, crisp older male voice for storytelling and ads", "male", "american"],
];

const SAMPLE_VOICES = VOICE_CATALOG.map(([id, description, gender, accent], i) => ({
  id,
  label: id,
  description,
  gender,
  accent,
  // Last entry gets no preview to exercise the unavailable state.
  previewUrl: i === VOICE_CATALOG.length - 1 ? null : SAMPLE_AUDIO,
}));

const kitScenario = (
  label: string,
  view: View,
  tool: string,
  args: Record<string, unknown>,
  structuredContent: Record<string, unknown>,
  extra: Partial<Scenario> = {},
): Scenario => ({ label, view, tool, args, structuredContent, pollsToComplete: 0, mock: SCHEDULER_MOCKS, ...extra });

const SCENARIOS: Scenario[] = [
  {
    label: "Image — single",
    view: "image",
    tool: "create_image",
    args: {
      prompt: "A snow leopard on a misty ridge at golden hour",
      model: "nano-banana-pro",
      aspectRatio: "16:9",
    },
    structuredContent: {
      generationIds: ["gen_img_1"],
      tool: "image",
      kind: "image",
      mcpTool: "create_image",
      status: "queued",
      aspectRatio: "16:9",
    },
    pollsToComplete: 1,
  },
  {
    label: "Thumbnail — grid ×4",
    view: "image",
    tool: "create_thumbnail",
    args: { prompt: "YouTube thumbnail: AI builds an app", variations: 4 },
    structuredContent: {
      generationIds: ["thumb_1", "thumb_2", "thumb_3", "thumb_4"],
      tool: "thumbnail",
      kind: "image",
      mcpTool: "create_thumbnail",
      status: "queued",
      aspectRatio: "16:9",
    },
    pollsToComplete: 1,
  },
  {
    label: "Image — failure",
    view: "image",
    tool: "create_image",
    args: { prompt: "something that fails", model: "nano-banana-2" },
    structuredContent: {
      generationIds: ["gen_img_fail"],
      tool: "image",
      kind: "image",
      mcpTool: "create_image",
      status: "queued",
    },
    pollsToComplete: 1,
    fail: true,
  },
  {
    label: "Video — renders after 20s",
    view: "video",
    tool: "create_video",
    args: {
      prompt: "Cinematic drone shot over a coastline",
      aspectRatio: "16:9",
      duration: 8,
    },
    structuredContent: {
      generationIds: ["gen_vid_1"],
      tool: "video",
      kind: "video",
      mcpTool: "create_video",
      status: "queued",
      aspectRatio: "16:9",
    },
    pollsToComplete: 2,
  },
  {
    label: "Music — single",
    view: "audio",
    tool: "create_music",
    args: {
      prompt: "r&b, slow, passionate, male vocal",
      lyrics: "[Verse]\nNeon rain falls on the city street\nI hear your voice in the midnight heat",
      model: "auto",
    },
    structuredContent: {
      generationIds: ["gen_music_1"],
      tool: "music",
      kind: "audio",
      mcpTool: "create_music",
      status: "queued",
    },
    pollsToComplete: 1,
  },
  {
    label: "Voices — picker",
    view: "voices",
    tool: "list_voiceover_voices",
    args: {},
    structuredContent: { success: true, voices: SAMPLE_VOICES },
    pollsToComplete: 0,
  },
  {
    label: "Clipping — 3 clips",
    view: "clipping",
    tool: "create_clipping",
    args: {
      videoUrl: "https://www.youtube.com/watch?v=example",
      ratio: "9:16",
      enableCaption: true,
      captionStyle: "classic-yellow",
      limit: 3,
    },
    structuredContent: {
      generationIds: ["clip_job_1"],
      tool: "clipping",
      kind: "clipping",
      mcpTool: "create_clipping",
      status: "queued",
      aspectRatio: "9:16",
    },
    pollsToComplete: 2,
  },
  kitScenario("Composer — images", "composer", "compose_post", {}, mock.COMPOSE_PREFILL),
  kitScenario("Composer — video", "composer", "compose_post", {}, mock.COMPOSE_VIDEO),
  kitScenario("Posts — list", "posts", "list_posts", {}, mock.listPosts({})),
  kitScenario("Post — partly published", "posts", "get_post", { postId: "p_partial" }, { success: true, data: mock.POSTS[3] }),
  kitScenario("Post — publish now (live)", "posts", "create_post", { publishNow: true }, mock.CREATE_POST_RESULT),
  kitScenario("Post — deleted", "posts", "delete_post", { postId: "p_draft" }, { success: true, message: "Post deleted successfully" }),
  kitScenario("Analytics", "analytics", "get_post_analytics", { days: 30 }, mock.analytics(30)),
  kitScenario("Accounts", "accounts", "get_accounts", {}, { success: true, data: mock.ACCOUNTS }),
  kitScenario("Plan & credits", "account", "get_credits", {}, mock.CREDITS),
  kitScenario("Library — images", "library", "list_generations", { type: "image" }, mock.library("image")),
  kitScenario("Library — music", "library", "list_generations", { type: "music" }, mock.library("music")),
  kitScenario("Voices — all + clones", "voices", "list_voices", {}, mock.voiceLibrary(SAMPLE_VOICES)),
  kitScenario("Posts — plan required (error)", "posts", "create_post", {}, {}, { errorResult: "This feature requires an active paid plan." }),
];

const logEl = document.getElementById("log")!;
const scenariosEl = document.getElementById("scenarios")!;
const iframe = document.getElementById("app") as HTMLIFrameElement;

/** Approximation of Claude's host style tokens, for testing both themes. */
function themeVariables(theme: "light" | "dark"): Record<string, string> {
  return theme === "light"
    ? {
        "--color-background-primary": "#FFFFFF",
        "--color-background-secondary": "#F5F4EF",
        "--color-background-tertiary": "#EBEAE4",
        "--color-text-primary": "#1A1A18",
        "--color-text-secondary": "#6B6A66",
        "--color-border-primary": "rgba(0, 0, 0, 0.10)",
        "--color-text-danger": "#B91C1C",
      }
    : {
        "--color-background-primary": "#30302E",
        "--color-background-secondary": "#262624",
        "--color-background-tertiary": "#3B3B39",
        "--color-text-primary": "#EDEDEB",
        "--color-text-secondary": "#A8A7A2",
        "--color-border-primary": "rgba(255, 255, 255, 0.10)",
        "--color-text-danger": "#FF6B6B",
      };
}

let currentTheme: "light" | "dark" = "dark";

function hostContext() {
  return {
    theme: currentTheme,
    displayMode: "inline" as const,
    availableDisplayModes: ["inline", "fullscreen"] as ("inline" | "fullscreen")[],
    styles: { variables: themeVariables(currentTheme) },
  };
}

function log(line: string) {
  const time = new Date().toLocaleTimeString();
  logEl.innerHTML += `\n<b>${time}</b>  ${line}`;
  logEl.scrollTop = logEl.scrollHeight;
}

let bridge: AppBridge | null = null;
let pollCounts: Record<string, number> = {};
let active: Scenario | null = null;
let recreateSeq = 0;

/** Mirrors the server's <kind>_status reply: { id, tool, kind, status, url, error, title, text }. */
function statusFor(
  tool: string,
  id: string,
  scenario: Scenario,
): Record<string, unknown> {
  const base = { id, tool, kind: scenario.view, title: null, text: null };
  const count = (pollCounts[id] = (pollCounts[id] ?? 0) + 1);
  if (count < scenario.pollsToComplete) {
    return { ...base, status: "processing", url: null, error: null };
  }
  if (scenario.fail) {
    return {
      ...base,
      status: "failed",
      url: null,
      error: "Mock failure: content flagged by NSFW checker",
    };
  }
  const url =
    scenario.view === "video"
      ? SAMPLE_VIDEOS[Math.abs(hash(id)) % SAMPLE_VIDEOS.length]
      : scenario.view === "audio"
        ? SAMPLE_AUDIO
        : sampleImage(id);
  return { ...base, status: "completed", url, error: null };
}

/** Mirrors the server's clipping_status reply; one clip lands before the rest. */
function clippingStatusFor(id: string, scenario: Scenario) {
  const count = (pollCounts[id] = (pollCounts[id] ?? 0) + 1);
  const clips = SAMPLE_VIDEOS.map((url, i) => ({
    title: `Viral moment #${i + 1}`,
    url,
    thumbnailUrl: sampleImage(`${id}-clip-${i}`),
    duration: 24 + i * 11,
  }));
  const base = { id, tool: "clipping", kind: "clipping", error: null };
  if (count < scenario.pollsToComplete) {
    return { ...base, status: "processing", clips: clips.slice(0, 1) };
  }
  return { ...base, status: "completed", clips };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

async function mockCallTool(params: {
  name: string;
  arguments?: Record<string, unknown>;
}) {
  const scenario = active!;
  const args = params.arguments ?? {};
  log(`🔧 tools/call <b>${params.name}</b> ${JSON.stringify(args)}`);

  const handler = scenario.mock?.[params.name];
  if (handler) {
    const sc = handler(args) as Record<string, unknown>;
    return { content: [{ type: "text", text: JSON.stringify(sc) }], structuredContent: sc };
  }

  if (
    params.name === "image_status" ||
    params.name === "video_status" ||
    params.name === "audio_status"
  ) {
    const sc = statusFor(String(args.tool), String(args.id), scenario);
    return { content: [{ type: "text", text: "" }], structuredContent: sc };
  }
  if (params.name === "clipping_status") {
    const sc = clippingStatusFor(String(args.id), scenario);
    return { content: [{ type: "text", text: "" }], structuredContent: sc };
  }
  if (params.name === "list_voiceover_voices") {
    return {
      content: [{ type: "text", text: "" }],
      structuredContent: { success: true, voices: SAMPLE_VOICES },
    };
  }
  // Recreate path: any create tool returns fresh job ids.
  recreateSeq += 1;
  pollCounts = {};
  const fresh = structuredCloneWithNewIds(scenario.structuredContent, recreateSeq);
  return { content: [{ type: "text", text: "" }], structuredContent: fresh };
}

function structuredCloneWithNewIds(
  sc: Record<string, unknown>,
  seq: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...sc };
  if (Array.isArray(sc.generationIds)) {
    out.generationIds = sc.generationIds.map((id) => `${id}_re${seq}`);
  }
  return out;
}

async function loadScenario(scenario: Scenario) {
  active = scenario;
  pollCounts = {};

  if (bridge) {
    try {
      await bridge.close();
    } catch {
      /* previous bridge may already be gone */
    }
    bridge = null;
  }

  const html = widgetFor(scenario.view);

  const b = new AppBridge(
    null,
    { name: "unsora-preview-host", version: "1.0.0" },
    {
      openLinks: {},
      downloadFile: {},
      serverTools: {},
      logging: {},
      message: { text: {} },
    },
    { hostContext: hostContext() },
  );
  bridge = b;

  b.oncalltool = mockCallTool as never;
  b.onmessage = async ({ content }) => {
    const text = (content as Array<{ type: string; text?: string }>)
      .map((c) => (c.type === "text" ? c.text : `[${c.type}]`))
      .join(" ");
    log(`💬 sendMessage → "<i>${text}</i>" (in a real host this becomes a chat message)`);
    return {};
  };
  b.onopenlink = async ({ url }) => {
    log(`🔗 openLink → ${url}`);
    window.open(url, "_blank", "noopener");
    return {};
  };
  b.ondownloadfile = async ({ contents }) => {
    log(`⬇ downloadFile → ${JSON.stringify(contents)}`);
    return {};
  };
  b.onrequestdisplaymode = async ({ mode }) => {
    log(`🖥 requestDisplayMode → <b>${mode}</b> (granted)`);
    // Simulate Claude's fullscreen modal by pinning the iframe over the page.
    if (mode === "fullscreen") {
      iframe.style.position = "fixed";
      iframe.style.inset = "0";
      iframe.style.zIndex = "100";
      iframe.style.height = "100vh";
      iframe.style.borderRadius = "0";
      iframe.style.background = "#131416";
    } else {
      iframe.removeAttribute("style");
    }
    void b.setHostContext({ ...hostContext(), displayMode: mode });
    return { mode };
  };
  b.onloggingmessage = async (params) => {
    log(`📋 app log: ${JSON.stringify(params)}`);
  };
  let initialized = false;
  b.oninitialized = () => {
    initialized = true;
    log(`✅ view initialized — sending tool input + result`);
    void b.sendToolInput({ arguments: scenario.args });
    if (scenario.errorResult) {
      void b.sendToolResult({ content: [{ type: "text", text: scenario.errorResult }], isError: true });
      return;
    }
    void b.sendToolResult({
      content: [{ type: "text", text: JSON.stringify(scenario.structuredContent) }],
      structuredContent: scenario.structuredContent,
    });
  };

  // The view sends ui/initialize the moment its script runs, which happens
  // BEFORE the iframe load event. Set srcdoc and connect the bridge in the
  // same task: the new document can't execute until this task yields, and
  // contentWindow is a stable WindowProxy, so the listener is guaranteed to
  // be attached first.
  iframe.srcdoc = html;
  const transport = new PostMessageTransport(
    iframe.contentWindow!,
    iframe.contentWindow!,
  );
  await b.connect(transport);
  log(`▶ loaded <b>${scenario.label}</b> (${scenario.view})`);

  window.setTimeout(() => {
    if (!initialized && active === scenario && bridge === b) {
      log(
        `⚠ no ui/initialize after 5s — handshake stuck. Check the browser console ` +
          `for errors inside the iframe, then re-click the scenario.`,
      );
    }
  }, 5000);
}

for (const scenario of SCENARIOS) {
  const btn = document.createElement("button");
  btn.textContent = scenario.label;
  btn.addEventListener("click", () => {
    for (const el of scenariosEl.querySelectorAll("button.scenario")) {
      el.classList.remove("active");
    }
    btn.classList.add("active", "scenario");
    logEl.innerHTML = "";
    void loadScenario(scenario);
  });
  btn.classList.add("scenario");
  scenariosEl.appendChild(btn);
}

// Light/dark toggle — pushes new host tokens to the running view.
const themeBtn = document.createElement("button");
themeBtn.textContent = "🌙 Dark";
themeBtn.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  themeBtn.textContent = currentTheme === "dark" ? "🌙 Dark" : "☀️ Light";
  document.body.classList.toggle("light", currentTheme === "light");
  log(`🎨 theme → ${currentTheme} (host tokens updated)`);
  void bridge?.setHostContext(hostContext());
});
scenariosEl.appendChild(themeBtn);
