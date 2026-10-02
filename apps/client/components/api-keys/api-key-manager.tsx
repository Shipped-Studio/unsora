"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowSquareOut, DotsThree, Key, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  PageBody,
  PageHeader,
  PageSection,
} from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { CreateApiKeyDialog } from "@/components/api-keys/create-key-dialog";
import {
  MAX_API_KEYS,
  useApiKeys,
  useRevokeApiKey,
  type ApiKey,
} from "@/components/api-keys/use-api-keys";
import { DOCS_URL } from "@/lib/navigation";

function formatCreated(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMM d, yyyy");
}

function formatLastUsed(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

const TABLE_CLASS = "[&_td]:px-4 [&_th]:px-4";

function KeysTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-muted" aria-hidden>
      <Table className={TABLE_CLASS}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="size-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ApiKeyManager() {
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const keys = useApiKeys();
  const revoke = useRevokeApiKey();

  const handleRevoke = () => {
    if (!revokeTarget) return;
    revoke.mutate(revokeTarget.id, {
      onSuccess: () => {
        toast.success("API key revoked");
        setRevokeTarget(null);
      },
      onError: (error) => {
        toast.error(`Couldn't revoke the key. ${error.message}`);
      },
    });
  };

  let content: React.ReactNode;
  if (keys.isPending) {
    content = <KeysTableSkeleton />;
  } else if (keys.isError) {
    content = (
      <ErrorState
        title="Couldn't load your API keys"
        description={keys.error.message}
        onRetry={() => void keys.refetch()}
      />
    );
  } else if (keys.data.length === 0) {
    content = (
      <EmptyState
        icon={Key}
        title="No API keys yet"
        description="Create a key to call the REST API or to connect Claude Code, Cursor and other MCP clients. Claude and ChatGPT connectors sign in without a key."
        action={{ label: "Create key", onClick: () => setCreateOpen(true) }}
        secondaryAction={{ label: "Set up an agent", href: "/connect-agent" }}
      />
    );
  } else {
    content = (
      <div className="overflow-hidden rounded-xl bg-muted">
        <Table className={TABLE_CLASS}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.data.map((key) => {
              const name = key.name || "Untitled key";
              return (
                <TableRow key={key.id}>
                  <TableCell className="max-w-64 truncate font-medium">
                    {name}
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-xs text-muted-foreground">
                      {key.keyPrefix}
                      <span aria-hidden>••••••••</span>
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatCreated(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatLastUsed(key.lastUsedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${name}`}
                          />
                        }
                      >
                        <DotsThree weight="bold" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setRevokeTarget(key)}
                        >
                          <Trash />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  const count = keys.data?.length ?? 0;

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Create key
          </Button>
        }
      />
      <PageBody width="default" className="space-y-8">
        <PageSection
          title="Your keys"
          description={
            count > 0
              ? `Use a key with the REST API or an MCP client. ${count} of ${MAX_API_KEYS} keys in use.`
              : "Use a key with the REST API or an MCP client. Treat it like a password."
          }
          actions={
            <>
              <Link
                href="/connect-agent"
                className={buttonVariants({ variant: "outline" })}
              >
                Set up an agent
              </Link>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "ghost" })}
              >
                API docs
                <ArrowSquareOut />
              </a>
            </>
          }
        >
          {content}
        </PageSection>
      </PageBody>

      <CreateApiKeyDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.name ? `"${revokeTarget.name}" ` : "This key "}
              stops working right away, along with any agent or app using it.
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoke.isPending}
            >
              {revoke.isPending ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
