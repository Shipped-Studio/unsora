"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Key,
  ArrowSquareOut,
  Robot,
  Plugs,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WatchTutorialDialog } from "@/components/dashboard/watch-tutorial-dialog";
import { cn } from "@/lib/utils";

export const MCP_URL = "https://mcp.tryunsora.com/mcp";
export const API_BASE = "https://mvp.tryunsora.com/api/v1";
// Mintlify docs, proxied under the /docs subpath of the marketing site
export const DOCS_URL = "https://tryunsora.com/docs";

const TOOL_CHIPS = [
  "create video",
  "create image",
  "thumbnails",
  "ai influencer",
  "clip long video",
  "schedule posts",
  "check credits",
];

type ClientTab = "claude" | "cursor" | "chatgpt" | "api";

interface TabContent {
  label: string;
  steps: React.ReactNode[];
  snippetLabel: string;
  snippet: string;
}

const TABS: Record<ClientTab, TabContent> = {
  claude: {
    label: "Claude",
    steps: [
      <>
        In claude.ai go to <b>Settings → Connectors → Add custom connector</b>{" "}
        and paste the URL below
      </>,
      <>
        Or add it to Claude Code with the command below — replace{" "}
        <code className="font-mono text-[11px]">uns_live_YOUR_KEY</code> with
        your API key
      </>,
    ],
    snippetLabel: "Claude Code",
    snippet: `claude mcp add --transport http unsora ${MCP_URL} \\
  --header "apiKey: uns_live_YOUR_KEY"`,
  },
  cursor: {
    label: "Cursor",
    steps: [
      <>
        Add this to <code className="font-mono text-[11px]">.cursor/mcp.json</code>{" "}
        (project or global)
      </>,
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
  },
  chatgpt: {
    label: "ChatGPT",
    steps: [
      <>
        In ChatGPT go to <b>Settings → Connectors</b> and add a remote MCP
        server with the URL below
      </>,
      <>
        Use <b>Bearer</b> auth with your Unsora API key
      </>,
    ],
    snippetLabel: "Server URL",
    snippet: MCP_URL,
  },
  api: {
    label: "API",
    steps: [
      <>
        Call the REST API directly — every tool on this page has a public
        endpoint
      </>,
    ],
    snippetLabel: "Try it",
    snippet: `curl ${API_BASE}/user/credits \\
  -H "Authorization: Bearer uns_live_YOUR_KEY"`,
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
        <Check className="size-3.5 text-success" weight="bold" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

export function AgentConnectCard() {
  const [tab, setTab] = useState<ClientTab>("claude");
  const content = TABS[tab];

  return (
    <Card
      id="connect-agent"
      className="relative flex h-full min-h-0 flex-col gap-0 overflow-hidden p-4 sm:p-5 lg:p-3.5 xl:p-3 scroll-mt-6"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-32 rounded-full bg-primary/5 blur-3xl" />

      {/* Header */}
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Robot className="size-3.5" weight="fill" />
          Agent-ready
        </div>
        <h2 className="mt-2.5 text-base font-bold tracking-tight sm:text-lg lg:mt-2 lg:text-base">
          Let your AI agent run the studio
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm lg:mt-0.5 lg:text-xs lg:leading-snug">
          Every tool here is exposed as 17 MCP tools and a REST API. Connect
          once — then ask Claude, Cursor, or ChatGPT to generate, clip, and
          schedule for you.
        </p>
      </div>

      {/* Client tabs */}
      <div className="relative mt-3.5 -mx-1 overflow-x-auto px-1 pb-0.5 lg:mt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full items-center gap-1">
          {(Object.keys(TABS) as ClientTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 lg:px-2.5 lg:py-1 lg:text-[11px]",
                tab === key
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {TABS[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Steps */}
      <ol className="relative mt-3 space-y-1.5 lg:mt-2 lg:space-y-1">
        {content.steps.map((step, i) => (
          <li
            key={`${tab}-${i}`}
            className="flex gap-2 text-xs leading-relaxed text-muted-foreground lg:gap-1.5 lg:text-[11px] lg:leading-snug"
          >
            <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-foreground">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {/* MCP URL row (hidden on the raw API tab) */}
      {tab !== "api" && (
        <div className="relative mt-3 flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 pl-3 pr-1 py-1 lg:mt-2 lg:py-0.5">
          <Plugs className="size-3.5 shrink-0 text-muted-foreground" />
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
            {MCP_URL}
          </code>
          <CopyButton text={MCP_URL} />
        </div>
      )}

      {/* Snippet */}
      {!(tab === "chatgpt") && (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-border/60 bg-muted/30 lg:mt-1.5">
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 pl-3 pr-1 py-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {content.snippetLabel}
            </span>
            <CopyButton text={content.snippet} />
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-foreground lg:p-2 lg:text-[10px] lg:leading-snug">
            {content.snippet}
          </pre>
        </div>
      )}

      {/* What agents can do */}
      <div className="relative mt-3 flex flex-wrap items-center gap-1 lg:mt-2">
        {TOOL_CHIPS.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-border/40 bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground lg:px-1.5 lg:py-px lg:text-[9px]"
          >
            {chip}
          </span>
        ))}
        <span className="px-1 text-[10px] font-medium text-muted-foreground/70">
          +10 more
        </span>
      </div>

      {/* Actions */}
      <div className="relative mt-auto flex flex-wrap items-center gap-2 pt-4 lg:gap-1.5 lg:pt-2.5">
        <Button size="sm" className="rounded-full lg:h-7 lg:px-3 lg:text-xs">
          <Link href="/api-keys" className="flex items-center gap-1.5">
            <Key className="size-3.5" weight="fill" />
            Get your API key
          </Link>
        </Button>
        <WatchTutorialDialog />
        <Button variant="outline" size="sm" className="rounded-full lg:h-7 lg:px-3 lg:text-xs">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5"
          >
            Docs
            <ArrowSquareOut className="size-3.5" />
          </a>
        </Button>
      </div>
    </Card>
  );
}
