"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/api-keys/copy-button";
import { CreateApiKeyDialog } from "@/components/api-keys/create-key-dialog";
import { API_BASE, DOCS_URL, MCP_URL } from "@/lib/navigation";

const KEY_PLACEHOLDER = "uns_YOUR_KEY";

type ClientId = "claude" | "claude-code" | "cursor" | "chatgpt" | "api";

interface ClientSetup {
  id: ClientId;
  label: string;
  steps: React.ReactNode[];
  code: { label: string; text: string };
  /** Whether the snippet needs an API key (OAuth connectors don't). */
  usesKey: boolean;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border bg-card px-1 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

function Path({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

const CLIENTS: ClientSetup[] = [
  {
    id: "claude",
    label: "Claude",
    usesKey: false,
    steps: [
      <>
        In claude.ai or Claude Desktop, open{" "}
        <Path>Settings → Connectors → Add custom connector</Path>.
      </>,
      <>Name it Unsora and paste the MCP server URL below.</>,
      <>Click Connect and sign in to Unsora. No API key needed.</>,
    ],
    code: { label: "MCP server URL", text: MCP_URL },
  },
  {
    id: "claude-code",
    label: "Claude Code",
    usesKey: true,
    steps: [
      <>Run this command in your terminal, with your API key in place of the placeholder.</>,
      <>
        Start Claude Code and run <Mono>/mcp</Mono> to check that unsora is
        connected.
      </>,
    ],
    code: {
      label: "Terminal",
      text: `claude mcp add --transport http unsora ${MCP_URL} \\\n  --header "apiKey: ${KEY_PLACEHOLDER}"`,
    },
  },
  {
    id: "cursor",
    label: "Cursor",
    usesKey: true,
    steps: [
      <>
        Add this to <Mono>.cursor/mcp.json</Mono> in your project, or to{" "}
        <Mono>~/.cursor/mcp.json</Mono> to use it everywhere.
      </>,
      <>
        Open <Path>Cursor Settings → MCP</Path> and check that unsora is
        enabled. The tools are available in Agent mode.
      </>,
    ],
    code: {
      label: ".cursor/mcp.json",
      text: `{
  "mcpServers": {
    "unsora": {
      "url": "${MCP_URL}",
      "headers": { "apiKey": "${KEY_PLACEHOLDER}" }
    }
  }
}`,
    },
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    usesKey: false,
    steps: [
      <>
        In ChatGPT, open <Path>Settings → Connectors</Path> and create a custom
        connector. You may need to turn on developer mode first.
      </>,
      <>Paste the MCP server URL below and choose OAuth as the authentication.</>,
      <>Sign in to Unsora when ChatGPT asks. No API key needed.</>,
    ],
    code: { label: "MCP server URL", text: MCP_URL },
  },
  {
    id: "api",
    label: "REST API",
    usesKey: true,
    steps: [
      <>
        Send your API key as a Bearer token. This request returns your credit
        balance.
      </>,
      <>
        Every MCP tool has a matching endpoint. The{" "}
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline underline-offset-4"
        >
          API docs
        </a>{" "}
        list them all.
      </>,
    ],
    code: {
      label: "Terminal",
      text: `curl ${API_BASE}/user/credits \\\n  -H "Authorization: Bearer ${KEY_PLACEHOLDER}"`,
    },
  },
];

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium text-foreground tabular-nums">
            {i + 1}
          </span>
          <span className="min-w-0 text-muted-foreground">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** A labelled snippet on a card surface, with the copy button beside the value. */
export function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex w-fit max-w-full items-start gap-2 rounded-lg border bg-card py-1 pr-1 pl-3">
        <pre className="min-w-0 overflow-x-auto py-1.5 font-mono text-xs leading-relaxed text-foreground">
          <code>{code}</code>
        </pre>
        <CopyButton value={code} label={`Copy ${label}`} size="icon-sm" />
      </div>
    </div>
  );
}

const EXAMPLE_PROMPTS = [
  "Make a 10-second vertical video of a coffee pour and schedule it to TikTok tomorrow at 9am.",
  "Cut the three best clips from this video and post one a day to all my accounts.",
  "How did my posts do over the last 30 days?",
];

/** Setup steps for each client, with an inline way to create a key. */
export function ConnectAgentTabs() {
  const [client, setClient] = useState<ClientId>("claude");
  const [createOpen, setCreateOpen] = useState(false);
  // A key created on this page, shown in the snippets until the user hides it.
  const [insertedKey, setInsertedKey] = useState<string | null>(null);

  return (
    <div>
      <Tabs
        value={client}
        onValueChange={(value) => setClient(value as ClientId)}
        className="gap-3"
      >
        {/* Scrolls sideways on narrow screens; the right edge fades to show there's more. */}
        <div className="-mx-1 overflow-x-auto px-1 py-1 max-sm:pr-8 max-sm:mask-r-from-85%">
          <TabsList>
            {CLIENTS.map((c) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="space-y-5 rounded-xl bg-muted p-4 md:p-5">
          {CLIENTS.map((c) => {
            const code = insertedKey
              ? c.code.text.replaceAll(KEY_PLACEHOLDER, insertedKey)
              : c.code.text;
            return (
              <TabsContent key={c.id} value={c.id} className="min-w-0 space-y-4">
                <Steps steps={c.steps} />
                {c.usesKey ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                    {insertedKey ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Your new key is in the snippet. Copy it now: it
                          isn&apos;t shown again after you leave this page.
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInsertedKey(null)}
                        >
                          Hide key
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Replace <Mono>{KEY_PLACEHOLDER}</Mono> with an API key.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCreateOpen(true)}
                        >
                          <Plus />
                          Create API key
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
                <CodeBlock label={c.code.label} code={code} />
              </TabsContent>
            );
          })}

          <div className="space-y-2 border-t border-card pt-4">
            <p className="text-sm font-medium">Then try asking</p>
            <ul className="space-y-1.5">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <li
                  key={prompt}
                  className="flex items-center gap-2 rounded-lg border bg-card py-1 pr-1 pl-3 text-sm"
                >
                  <span className="min-w-0 flex-1 py-1">{prompt}</span>
                  <CopyButton value={prompt} label="Copy prompt" size="icon-sm" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Tabs>

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        createdAction={(key, close) => (
          <Button
            onClick={() => {
              setInsertedKey(key.key);
              close();
            }}
          >
            Insert into snippet
          </Button>
        )}
      />
    </div>
  );
}
