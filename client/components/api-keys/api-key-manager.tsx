"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretUpDown,
  Clock,
  Copy,
  Key,
  MagnifyingGlass,
  Plus,
  Shield,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

type SortField = "name" | "lastUsedAt" | "createdAt";
type SortDir = "asc" | "desc";

export const DOCS_URL = "https://tryunsora.com/docs";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isWithinLastWeek(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return date >= weekAgo;
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-left text-[11px] font-semibold tracking-wide transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <CaretUpDown className="size-3.5" />
    </button>
  );
}

export function ApiKeyManager() {
  const { authFetch } = useAuthFetch();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchKeys = useCallback(async () => {
    try {
      const res = await authFetch("/api/user/api-keys");
      if (!res.ok) throw new Error("Failed to load API keys");
      const json = await res.json();
      setKeys(json.data ?? []);
    } catch {
      toast.error("Failed to load API keys");
    }
  }, [authFetch]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchKeys();
      setLoading(false);
    })();
  }, [fetchKeys]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchKeys();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const active = keys.filter((k) => !k.revokedAt);
    const revoked = keys.filter((k) => k.revokedAt);
    const usedThisWeek = active.filter((k) => isWithinLastWeek(k.lastUsedAt));
    return {
      total: keys.length,
      active: active.length,
      usedThisWeek: usedThisWeek.length,
      revoked: revoked.length,
    };
  }, [keys]);

  const activeKeys = useMemo(() => {
    const filtered = keys.filter((k) => {
      if (k.revokedAt) return false;
      if (!search.trim()) return true;
      return k.name.toLowerCase().includes(search.trim().toLowerCase());
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        const aVal = a[sortField] ? new Date(a[sortField]!).getTime() : 0;
        const bVal = b[sortField] ? new Date(b[sortField]!).getTime() : 0;
        cmp = aVal - bVal;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [keys, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Enter a name for this key");
      return;
    }

    setCreating(true);
    try {
      const res = await authFetch("/api/user/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create API key");
      }

      setCreatedKey(json.data.key);
      setNewKeyName("");
      await fetchKeys();
      toast.success("API key created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create API key",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;

    setRevokingId(revokeTarget.id);
    try {
      const res = await authFetch(`/api/user/api-keys/${revokeTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to revoke API key");
      }

      toast.success("API key revoked");
      setRevokeTarget(null);
      await fetchKeys();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke API key",
      );
    } finally {
      setRevokingId(null);
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setCreatedKey(null);
    setNewKeyName("");
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className=" px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">API Key Manager</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage secure integration access for Personal
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" weight="bold" />
                New API Key
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Spinner className="size-4" />
                ) : (
                  <ArrowClockwise className="size-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"></div>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              API docs
              <ArrowSquareOut className="size-4" />
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3  px-5 py-4 sm:grid-cols-4 sm:px-6">
          <StatCard label="TOTAL" value={stats.total} />
          <StatCard
            label="ACTIVE"
            value={stats.active}
            icon={<Shield className="size-4 text-success" weight="fill" />}
          />
          <StatCard
            label="USED THIS WEEK"
            value={stats.usedThisWeek}
            icon={<Clock className="size-4 text-muted-foreground" />}
          />
          <StatCard label="REVOKED" value={stats.revoked} />
        </div>

        {/* Search + table */}
        <div className="px-5 py-4 sm:px-6">
          <div className="relative mb-4">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by key name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-5 flex size-24 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary/10" />
                <div className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Key className="size-7" weight="fill" />
                </div>
              </div>
              <h2 className="text-lg font-semibold">No API keys yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create your first API key to integrate with external services
              </p>
              <Button className="mt-5" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" weight="bold" />
                New API Key
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className=" bg-muted/30">
                    <th className="px-4 py-3 text-left">
                      <SortHeader
                        label="API KEY"
                        active={sortField === "name"}
                        onClick={() => toggleSort("name")}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader
                        label="LAST USED"
                        active={sortField === "lastUsedAt"}
                        onClick={() => toggleSort("lastUsedAt")}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader
                        label="CREATED"
                        active={sortField === "createdAt"}
                        onClick={() => toggleSort("createdAt")}
                      />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                        ACTIONS
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map((key) => (
                    <tr key={key.id} className=" last:-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{key.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {key.keyPrefix}…
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(key.lastUsedAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevokeTarget(key)}
                          disabled={revokingId === key.id}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash className="size-4" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && closeCreateDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdKey ? "Save your API key" : "Create API key"}
            </DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Copy this key now. You won't be able to see it again."
                : "Give this key a name so you can identify it later."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="flex gap-2">
              <Input
                readOnly
                value={createdKey}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyKey(createdKey)}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                placeholder="Production server"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={closeCreateDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Cancel
                </Button>
                <Button onClick={() => void handleCreate()} disabled={creating}>
                  {creating ? <Spinner /> : "Create"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget
                ? `"${revokeTarget.name}" will stop working immediately.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRevoke()}
              disabled={!!revokingId}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
