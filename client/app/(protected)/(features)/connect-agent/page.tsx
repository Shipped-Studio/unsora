"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  ChatCircleText,
  Check,
  Copy,
  Key,
  Plugs,
  Robot,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WatchTutorialDialog } from "@/components/dashboard/watch-tutorial-dialog";
import {
  API_BASE,
  DOCS_URL,
  MCP_URL,
} from "@/components/dashboard/agent-connect-card";
import { cn } from "@/lib/utils";

const CAPABILITIES = [
  "Generate videos (Sora, Veo, Kling, Seedance)",
  "Generate images & thumbnails",
  "AI influencer videos",
  "Clip long videos into shorts",
  "Voiceovers & music",
  "Schedule posts to all connected accounts",
  "Retry failed posts",
  "Check credits & subscription",
];

const EXAMPLE_PROMPTS = [
  "Create a 15-second vertical teaser for my new product and schedule it to TikTok and Instagram tomorrow at 9am.",
  "Clip the 3 best moments from this video and post them to all my accounts, one per day.",
  "Make a YouTube thumbnail for this video, then publish the video at 6pm with that thumbnail.",
  "How many credits do I have left this month?",
];

type ClientTab = "claude" | "claudeCode" | "cursor" | "chatgpt" | "api";

interface TabContent {
  label: string;
  steps: React.ReactNode[];
  snippetLabel?: string;
  snippet?: string;
  showMcpUrl: boolean;
}

const TABS: Record<ClientTab, TabContent> = {
  claude: {
    label: "Claude",
    steps: [
      <>
        In claude.ai, open <b>Settings → Connectors → Add custom connector</b>
      </>,
      <>Paste the MCP server URL below and save</>,
      <>
        When asked for authentication, use your Unsora API key (starts with{" "}
        <code className="font-mono text-xs">uns_live_</code>)
      </>,
    ],
    showMcpUrl: true,
  },
  claudeCode: {
    label: "Claude Code",
    steps: [
      <>
        Run the command below in your terminal — replace{" "}
        <code className="font-mono text-xs">uns_live_YOUR_KEY</code> with your
        API key
      </>,
      <>
        Then ask Claude Code to <i>&quot;create a video with Unsora&quot;</i> —
        the tools appear automatically
      </>,
    ],
    snippetLabel: "Terminal",
    snippet: `claude mcp add --transport http unsora ${MCP_URL} \\
  --header "apiKey: uns_live_YOUR_KEY"`,
    showMcpUrl: false,
  },
  cursor: {
    label: "Cursor",
    steps: [
      <>
        Add this to{" "}
        <code className="font-mono text-xs">.cursor/mcp.json</code> (in your
        project, or globally in <code className="font-mono text-xs">~/.cursor</code>)
      </>,
      <>Restart Cursor and the Unsora tools show up in Agent mode</>,
    ],
    snippetLabel: ".cursor/mcp.json",
    snippet: `{
  "mcpServers": {
    "unsora": {
      "url": "${MCP_URL}",
      "headers": { "apiKey": "uns_live_YOUR_KEY" }
    }
  }
}`,
    showMcpUrl: false,
  },
  chatgpt: {
    label: "ChatGPT",
    steps: [
      <>
        In ChatGPT, open <b>Settings → Connectors</b> and add a remote MCP
        server with the URL below
      </>,
      <>
        Choose <b>Bearer</b> authentication and paste your Unsora API key
      </>,
    ],
    showMcpUrl: true,
  },
  api: {
    label: "REST API",
    steps: [
      <>
        Prefer plain HTTP? Every tool is also a public REST endpoint — same API
        key, sent as a Bearer token
      </>,
      <>
        Full reference, request/response schemas, and examples live in the{" "}
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline underline-offset-4"
        >
          API docs
        </a>
      </>,
    ],
    snippetLabel: "Try it",
    snippet: `curl ${API_BASE}/user/credits \\
  -H "Authorization: Bearer uns_live_YOUR_KEY"`,
    showMcpUrl: false,
  },
};

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <Check className="size-4 text-success" weight="bold" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
      {n}
    </span>
  );
}

export default function ConnectAgentPage() {
  const [tab, setTab] = useState<ClientTab>("claude");
  const content = TABS[tab];

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Robot className="size-3.5" weight="fill" />
          Agent-ready
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Connect an agent
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Every Unsora tool is exposed over MCP and a REST API. Connect once —
          then ask Claude, Cursor, or ChatGPT to generate, clip, and schedule
          content for you.
        </p>
      </div>

      {/* Step 1: API key */}
      <Card className="mb-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <StepNumber n={1} />
            <div>
              <h2 className="text-base font-semibold">Get your API key</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keys start with{" "}
                <code className="font-mono text-xs">uns_live_</code> and carry
                your credits — treat them like a password.
              </p>
            </div>
          </div>
          <Button className="rounded-full">
            <Link href="/api-keys" className="flex items-center gap-1.5">
              <Key className="size-4" weight="fill" />
              Manage API keys
            </Link>
          </Button>
        </div>
      </Card>

      {/* Step 2: client setup */}
      <Card className="mb-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <StepNumber n={2} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Connect your client</h2>

            {/* Tabs */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {(Object.keys(TABS) as ClientTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
                    tab === key
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {TABS[key].label}
                </button>
              ))}
            </div>

            {/* Steps */}
            <ol className="mt-4 space-y-2">
              {content.steps.map((step, i) => (
                <li
                  key={`${tab}-${i}`}
                  className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {/* MCP URL */}
            {content.showMcpUrl && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 py-1.5 pl-3 pr-1">
                <Plugs className="size-4 shrink-0 text-muted-foreground" />
                <code className="min-w-0 flex-1 truncate font-mono text-sm">
                  {MCP_URL}
                </code>
                <CopyButton text={MCP_URL} />
              </div>
            )}

            {/* Snippet */}
            {content.snippet && (
              <div className="mt-4 overflow-hidden rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between border-b bg-muted/20 py-1 pl-3 pr-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {content.snippetLabel}
                  </span>
                  <CopyButton text={content.snippet} />
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
                  {content.snippet}
                </pre>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Step 3: try it */}
      <Card className="mb-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <StepNumber n={3} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Ask your agent</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Once connected, try prompts like these:
            </p>
            <ul className="mt-3 space-y-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li
                  key={prompt}
                  className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
                >
                  <ChatCircleText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">{prompt}</span>
                  <CopyButton text={prompt} className="-my-1 -mr-1" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Capabilities */}
      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-semibold">What agents can do</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CAPABILITIES.map((capability) => (
            <span
              key={capability}
              className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {capability}
            </span>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <WatchTutorialDialog />
          <Button variant="outline" size="sm" className="rounded-full">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5"
            >
              API Docs
              <ArrowSquareOut className="size-3.5" />
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
