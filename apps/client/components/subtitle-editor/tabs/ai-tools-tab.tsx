"use client";

import { useState } from "react";
import {
  CheckCircle,
  DotsThree,
  Eye,
  FilmStrip,
  MagnifyingGlassPlus,
  MicrophoneStage,
  Scissors,
  Subtitles,
  TextT,
  Waveform,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ToolStatus = "active" | "inactive" | "running" | "failed" | "unavailable";

export interface AiToolRow {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: ToolStatus;
  /** Credits Activate spends; "Included" when missing. */
  credits?: number;
  /** Shown instead of the description, e.g. why it changed nothing. */
  note?: string;
  /** Buttons shown while the tool is applied, e.g. Style and Edit. */
  actions?: { label: string; onClick: () => void }[];
  onActivate?: () => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
}

export const AI_TOOL_ICONS = {
  captions: Subtitles,
  brolls: FilmStrip,
  zooms: MagnifyingGlassPlus,
  hook: TextT,
  cleanAudio: MicrophoneStage,
  silence: Waveform,
  eyeContact: Eye,
  badTakes: Scissors,
};

/**
 * Submagic's AI Tools tab: automated passes in three groups. Activate runs a
 * pass straight away and spends its credits; a check means it's applied.
 */
export function AiToolsTab({ groups }: { groups: { title: string; tools: AiToolRow[] }[] }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-medium">{group.title}</h2>
          <ul className="space-y-2">
            {group.tools.map((tool) => (
              <ToolItem key={tool.id} tool={tool} />
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        Run Remove Silence, Remove Bad Takes and Clean Audio before styling:
        they change the video&apos;s timing. Then captions and the hook title,
        then B-rolls and zooms.
      </p>
    </div>
  );
}

function ToolItem({ tool }: { tool: AiToolRow }) {
  const [busy, setBusy] = useState(false);
  const Icon = tool.icon;

  const act = async (fn?: () => Promise<void> | void) => {
    if (!fn) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-xl border p-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-5",
          tool.status === "active" && "bg-primary/10 text-primary",
        )}
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {tool.name}
          {tool.status === "active" ? (
            <CheckCircle weight="fill" aria-label="Applied" className="size-4 text-primary" />
          ) : null}
          {tool.status === "failed" ? (
            <WarningCircle weight="fill" aria-label="Failed" className="size-4 text-destructive" />
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">{tool.note ?? tool.description}</p>
      </div>

      {tool.status === "running" ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          Working…
        </span>
      ) : tool.status === "active" ? (
        <div className="flex items-center gap-1">
          {tool.actions?.map((action) => (
            <Button key={action.label} variant="outline" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
          {tool.onRemove ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More for ${tool.name}`}
                    disabled={busy}
                  />
                }
              >
                {busy ? <Spinner /> : <DotsThree />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => act(tool.onRemove)}>
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : tool.status === "unavailable" ? (
        <span className="text-xs text-muted-foreground">Not available yet</span>
      ) : (
        <Button size="sm" disabled={busy} onClick={() => act(tool.onActivate)}>
          {busy ? <Spinner /> : null}
          {tool.status === "failed" ? "Try again" : "Activate"}
          <span className="rounded bg-primary-foreground/20 px-1.5 text-xs tabular-nums">
            {tool.credits ? `✦ ${tool.credits}` : "Included"}
          </span>
        </Button>
      )}
    </li>
  );
}
