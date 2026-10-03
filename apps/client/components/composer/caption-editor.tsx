"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="space-y-2">
      {editable.length > 1 ? (
        <Tabs value={tab} onValueChange={(next) => setTab(next as string)}>
          <TabsList
            aria-label="Caption per account"
            className="max-w-full justify-start overflow-x-auto no-scrollbar"
          >
            <TabsTrigger value="all" className="flex-none">
              All accounts
            </TabsTrigger>
            {editable.map((account) => (
              <TabsTrigger key={account.id} value={account.id} className="flex-none pl-1.5">
                <AccountAvatar account={account} size="xs" />
                <span className="max-w-32 truncate">{accountLabel(account)}</span>
                {state.overrides[account.id] !== undefined ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-info" />
                    <span className="sr-only">(customized)</span>
                  </>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-input bg-card shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {active ? (
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
            <span className="min-w-0 text-sm text-muted-foreground">
              {customized
                ? `Custom caption for ${platformName(active.provider)}`
                : "Uses the caption for all accounts"}
            </span>
            <label className="flex shrink-0 items-center gap-2 text-sm">
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
            "min-h-40 resize-none rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
            active && !customized && "text-muted-foreground",
          )}
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2">
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
    </div>
  );
}
