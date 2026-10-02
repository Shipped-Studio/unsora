"use client";

import { useState } from "react";
import {
  DotsThree,
  Folder,
  FolderSimpleDashed,
  FolderSimplePlus,
  Folders,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useRenameLibraryFolder,
  type LibraryFolder,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";

/** "all" (every file), "none" (unfiled) or a folder id. */
export type FolderFilter = string;

export function folderFilterLabel(
  filter: FolderFilter,
  folders: LibraryFolder[] | undefined,
) {
  if (filter === "all") return "All files";
  if (filter === "none") return "Unfiled";
  return folders?.find((f) => f.id === filter)?.name ?? "Folder";
}

// ---------------------------------------------------------------------------
// Create and rename

export function FolderNameDialog({
  open,
  onOpenChange,
  folder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rename this folder. Omit to create a new one. */
  folder?: LibraryFolder | null;
  onSaved?: (folder: LibraryFolder) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <FolderNameForm
          folder={folder}
          onDone={(saved) => {
            onSaved?.(saved);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FolderNameForm({
  folder,
  onDone,
}: {
  folder?: LibraryFolder | null;
  onDone: (folder: LibraryFolder) => void;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateLibraryFolder();
  const rename = useRenameLibraryFolder();
  const pending = create.isPending || rename.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      setError("Enter a folder name.");
      return;
    }
    const onError = (err: Error) => setError(err.message);
    if (folder) {
      rename.mutate(
        { id: folder.id, name: trimmed },
        {
          onSuccess: (saved) => {
            toast.success("Folder renamed");
            onDone(saved);
          },
          onError,
        },
      );
    } else {
      create.mutate(trimmed, {
        onSuccess: (saved) => {
          toast.success("Folder created");
          onDone(saved);
        },
        onError,
      });
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle>
        <DialogDescription>
          {folder
            ? "Files in the folder stay where they are."
            : "Group files for a campaign, a client or a series."}
        </DialogDescription>
      </DialogHeader>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="folder-name">Name</FieldLabel>
        <Input
          id="folder-name"
          value={name}
          maxLength={60}
          placeholder="Spring launch"
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : folder ? "Rename" : "Create folder"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete

export function DeleteFolderDialog({
  folder,
  onOpenChange,
  onDeleted,
}: {
  folder: LibraryFolder | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (folder: LibraryFolder) => void;
}) {
  const remove = useDeleteLibraryFolder();
  // Keep the name on screen while the dialog closes.
  const [last, setLast] = useState(folder);
  if (folder && folder !== last) setLast(folder);
  const shown = folder ?? last;

  return (
    <AlertDialog
      open={folder !== null}
      onOpenChange={(open) => {
        if (!remove.isPending) onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
          <AlertDialogDescription>
            {shown ? `"${shown.name}" will be deleted. ` : null}
            {shown && shown.count > 0
              ? `Its ${shown.count} ${shown.count === 1 ? "file stays" : "files stay"} in your Library as unfiled.`
              : "No files are deleted."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (!folder) return;
              remove.mutate(folder.id, {
                onSuccess: () => {
                  toast.success("Folder deleted");
                  onDeleted?.(folder);
                  onOpenChange(false);
                },
                onError: (error) =>
                  toast.error(`Couldn't delete the folder. ${error.message}`),
              });
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete folder"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Rail (desktop) and Select (mobile, picker)

function RailButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Folder;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}

/** Folder list with create, rename and delete. */
export function LibraryFolderRail({
  value,
  onChange,
}: {
  value: FolderFilter;
  onChange: (value: FolderFilter) => void;
}) {
  const folders = useLibraryFolders();
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<LibraryFolder | null>(null);
  const [deleting, setDeleting] = useState<LibraryFolder | null>(null);

  return (
    <nav aria-label="Folders" className="space-y-1">
      <div className="flex items-center justify-between pb-1 pl-2">
        <h2 className="text-sm font-medium">Folders</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New folder"
          onClick={() => setCreateOpen(true)}
        >
          <FolderSimplePlus />
        </Button>
      </div>
      <RailButton
        active={value === "all"}
        onClick={() => onChange("all")}
        icon={Folders}
        label="All files"
      />
      <RailButton
        active={value === "none"}
        onClick={() => onChange("none")}
        icon={FolderSimpleDashed}
        label="Unfiled"
      />

      {folders.isPending ? (
        <div className="space-y-1 pt-1" aria-hidden>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
        </div>
      ) : folders.isError ? (
        <div className="space-y-1 px-2 pt-1">
          <p className="text-xs text-muted-foreground">Couldn&apos;t load folders.</p>
          <Button variant="link" size="xs" className="px-0" onClick={() => void folders.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        folders.data.map((folder) => (
          <div key={folder.id} className="group/folder relative">
            <RailButton
              active={value === folder.id}
              onClick={() => onChange(folder.id)}
              icon={Folder}
              label={folder.name}
              count={folder.count}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Options for ${folder.name}`}
                    className="absolute top-1 right-1 bg-muted opacity-0 group-hover/folder:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  />
                }
              >
                <DotsThree weight="bold" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setRenaming(folder)}>
                  <PencilSimple />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleting(folder)}
                >
                  <Trash />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))
      )}

      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(folder) => onChange(folder.id)}
      />
      <FolderNameDialog
        key={renaming?.id ?? "rename"}
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        folder={renaming}
      />
      <DeleteFolderDialog
        folder={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onDeleted={(folder) => {
          if (value === folder.id) onChange("all");
        }}
      />
    </nav>
  );
}

/** Compact folder filter for small screens and the picker. */
export function LibraryFolderSelect({
  value,
  onChange,
  className,
}: {
  value: FolderFilter;
  onChange: (value: FolderFilter) => void;
  className?: string;
}) {
  const folders = useLibraryFolders();
  const items: Record<string, string> = { all: "All files", none: "Unfiled" };
  for (const folder of folders.data ?? []) items[folder.id] = folder.name;
  // Keep a deep-linked folder readable before the list loads.
  if (!(value in items)) items[value] = "Folder";

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => onChange((next as string | null) ?? "all")}
    >
      <SelectTrigger size="sm" className={cn("min-w-36", className)} aria-label="Folder">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All files</SelectItem>
        <SelectItem value="none">Unfiled</SelectItem>
        {folders.data && folders.data.length > 0 ? <SelectSeparator /> : null}
        {(folders.data ?? []).map((folder) => (
          <SelectItem key={folder.id} value={folder.id}>
            {folder.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Folder Select plus folder actions, for screens without the rail. */
export function LibraryFolderBar({
  value,
  onChange,
}: {
  value: FolderFilter;
  onChange: (value: FolderFilter) => void;
}) {
  const folders = useLibraryFolders();
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<LibraryFolder | null>(null);
  const [deleting, setDeleting] = useState<LibraryFolder | null>(null);
  const current = folders.data?.find((f) => f.id === value) ?? null;

  return (
    <div className="flex items-center gap-1">
      <LibraryFolderSelect value={value} onChange={onChange} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Folder actions" />}
        >
          <DotsThree weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <FolderSimplePlus />
            New folder
          </DropdownMenuItem>
          {current ? (
            <>
              <DropdownMenuItem onClick={() => setRenaming(current)}>
                <PencilSimple />
                Rename folder
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleting(current)}
              >
                <Trash />
                Delete folder
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(folder) => onChange(folder.id)}
      />
      <FolderNameDialog
        key={renaming?.id ?? "rename"}
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        folder={renaming}
      />
      <DeleteFolderDialog
        folder={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onDeleted={(folder) => {
          if (value === folder.id) onChange("all");
        }}
      />
    </div>
  );
}

/**
 * "Move to" menu: Unfiled, every folder, or a new folder. `onMove` gets the
 * target folder id (null for Unfiled) and its name.
 */
export function MoveToFolderMenu({
  onMove,
  disabled,
  currentFolderId,
  size = "sm",
}: {
  onMove: (folderId: string | null, folderName: string) => void;
  disabled?: boolean;
  /** The items' current folder, left out of the list. */
  currentFolderId?: string | null;
  size?: "sm" | "default";
}) {
  const folders = useLibraryFolders();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size={size} disabled={disabled} />}
        >
          <Folder />
          Move to
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-52">
          {currentFolderId !== null ? (
            <DropdownMenuItem onClick={() => onMove(null, "Unfiled")}>
              <FolderSimpleDashed />
              Unfiled
            </DropdownMenuItem>
          ) : null}
          {(folders.data ?? [])
            .filter((folder) => folder.id !== currentFolderId)
            .map((folder) => (
              <DropdownMenuItem
                key={folder.id}
                onClick={() => onMove(folder.id, folder.name)}
              >
                <Folder />
                <span className="truncate">{folder.name}</span>
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <FolderSimplePlus />
            New folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(folder) => onMove(folder.id, folder.name)}
      />
    </>
  );
}
