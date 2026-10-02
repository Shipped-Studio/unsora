"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AccountAvatar, accountLabel } from "@/components/scheduler/account-avatar";
import type { Composer } from "@/hooks/use-composer";
import {
  PLATFORMS,
  captionLength,
  isProvider,
  platformName,
} from "@/lib/scheduler/formats";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

function Counter({ provider, text }: { provider: string; text: string }) {
  if (!isProvider(provider)) return null;
  const limit = PLATFORMS[provider].captionLimit;
  const used = captionLength(provider, text);
  const over = used > limit;
  const near = !over && used > limit * 0.9;
  return (
    <span
      className={cn(
        "text-xs tabular-nums text-muted-foreground",
        near && "text-warning",
        over && "font-medium text-destructive",
      )}
    >
      {platformName(provider)} {used.toLocaleString()}/{limit.toLocaleString()}
    </span>
  );
}

export function CaptionEditor({
  composer,
  selectedAccounts,
  locked,
}: {
  composer: Composer;
  selectedAccounts: ConnectedAccount[];
  locked: string[];
}) {
  const { state, update } = composer;
  const [tab, setTab] = useState<string>("all");
  const isText = state.format === "text";
  const editable = selectedAccounts.filter((a) => !locked.includes(a.id));
  const active = editable.find((a) => a.id === tab);
  const providers = [...new Set(editable.map((a) => a.provider))];

  const setMain = (caption: string) => update((prev) => ({ ...prev, caption }));
  const setOverride = (accountId: string, value: string | undefined) =>
    update((prev) => {
      const overrides = { ...prev.overrides };
      if (value === undefined) delete overrides[accountId];
      else overrides[accountId] = value;
      return { ...prev, overrides };
    });

  const customized = active ? state.overrides[active.id] !== undefined : false;
  const value = active
    ? customized
      ? state.overrides[active.id]
      : state.caption
    : state.caption;

  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      {editable.length > 1 ? (
        <div
          role="tablist"
          aria-label="Caption per account"
          className="flex gap-1 overflow-x-auto border-b px-2 py-1.5 no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            onClick={() => setTab("all")}
            className={cn(
              "h-7 shrink-0 rounded-md px-2.5 text-sm transition-colors",
              tab === "all"
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All accounts
          </button>
          {editable.map((account) => (
            <button
              key={account.id}
              type="button"
              role="tab"
              aria-selected={tab === account.id}
              onClick={() => setTab(account.id)}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 rounded-md pr-2.5 pl-1 text-sm transition-colors",
                tab === account.id
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <AccountAvatar account={account} size="xs" />
              <span className="max-w-32 truncate">{accountLabel(account)}</span>
              {state.overrides[account.id] !== undefined ? (
                <span className="size-1.5 rounded-full bg-info" aria-label="Customized" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {active ? (
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {customized
              ? `Custom caption for ${platformName(active.provider)}`
              : "Uses the caption for all accounts"}
          </span>
          <label className="flex items-center gap-2 text-sm">
            Customize
            <Switch
              checked={customized}
              onCheckedChange={(checked) =>
                setOverride(active.id, checked ? state.caption : undefined)
              }
            />
          </label>
        </div>
      ) : null}

      <Textarea
        aria-label={isText ? "Post text" : "Caption"}
        placeholder={isText ? "What do you want to say?" : "Write a caption"}
        value={value}
        readOnly={Boolean(active && !customized)}
        onChange={(event) =>
          active ? setOverride(active.id, event.target.value) : setMain(event.target.value)
        }
        className={cn(
          "min-h-40 resize-y rounded-none border-0 px-3 py-3 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent",
          active && !customized && "text-muted-foreground",
        )}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2">
        {active ? (
          <Counter provider={active.provider} text={value} />
        ) : providers.length ? (
          providers.map((provider) => (
            <Counter key={provider} provider={provider} text={state.caption} />
          ))
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {state.caption.length.toLocaleString()} characters
          </span>
        )}
      </div>
    </div>
  );
}
