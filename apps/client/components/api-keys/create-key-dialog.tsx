"use client";

import { useState } from "react";
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/api-keys/copy-button";
import {
  ApiKeyError,
  MAX_API_KEYS,
  useCreateApiKey,
  type CreatedApiKey,
} from "@/components/api-keys/use-api-keys";

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the key exists. */
  onCreated?: (key: CreatedApiKey) => void;
  /**
   * Extra action shown after the key is created, next to "Done". `close`
   * closes the dialog.
   */
  createdAction?: (key: CreatedApiKey, close: () => void) => React.ReactNode;
}

/**
 * Name a new API key, then show the full secret once. Used by the API keys
 * page and the Agents page.
 */
export function CreateApiKeyDialog(props: CreateApiKeyDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      // Closing by accident would lose the key, so only buttons and Esc close it.
      disablePointerDismissal
    >
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so each open starts fresh. */}
        <CreateKeyBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CreateKeyBody({
  onOpenChange,
  onCreated,
  createdAction,
}: CreateApiKeyDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const createKey = useCreateApiKey();
  const close = () => onOpenChange(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for this key.");
      return;
    }
    setError(null);
    createKey.mutate(trimmed, {
      onSuccess: (key) => {
        setCreated(key);
        onCreated?.(key);
      },
      onError: (err) => {
        setError(
          err instanceof ApiKeyError && err.code === "API_KEY_LIMIT"
            ? `You already have ${MAX_API_KEYS} active keys. Revoke one you no longer use, then try again.`
            : `Couldn't create the key. ${err.message}`,
        );
      },
    });
  };

  if (created) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Copy your API key</DialogTitle>
          <DialogDescription>
            This is the only time the full key is shown. Store it somewhere
            safe, like a password manager. Anyone with it can spend your
            credits and post to your accounts.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="new-api-key">{created.name}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="new-api-key"
              readOnly
              value={created.key}
              className="font-mono text-base md:text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <CopyButton
              value={created.key}
              label="Copy key"
              variant="outline"
              size="icon"
            />
          </div>
        </Field>

        <DialogFooter>
          {createdAction ? createdAction(created, close) : null}
          <Button variant={createdAction ? "outline" : "default"} onClick={close}>
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>Create API key</DialogTitle>
        <DialogDescription>
          Keys work with the REST API and the MCP server.
        </DialogDescription>
      </DialogHeader>

      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
        <Input
          id="api-key-name"
          placeholder="Claude Code on my laptop"
          value={name}
          maxLength={64}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
        />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>So you can tell your keys apart later.</FieldDescription>
        )}
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={createKey.isPending}>
          {createKey.isPending ? "Creating…" : "Create API key"}
        </Button>
      </DialogFooter>
    </form>
  );
}
