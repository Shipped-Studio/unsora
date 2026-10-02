"use client";

import { PlugsConnected, UserCircle } from "@phosphor-icons/react";

interface ConnectionsHeaderProps {
  totalAccounts?: number;
  connectedPlatforms?: number;
  loading?: boolean;
}

export function ConnectionsHeader({
  totalAccounts = 0,
  connectedPlatforms = 0,
  loading,
}: ConnectionsHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="mb-1.5 text-2xl font-bold tracking-tight sm:mb-2 sm:text-3xl">
          Connections
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Connect your social accounts to publish everywhere from one place
        </p>
      </div>

      {!loading && (
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <UserCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold tabular-nums">{totalAccounts}</span>
            <span className="text-muted-foreground">
              account{totalAccounts !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <PlugsConnected className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold tabular-nums">
              {connectedPlatforms}
            </span>
            <span className="text-muted-foreground">
              platform{connectedPlatforms !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
