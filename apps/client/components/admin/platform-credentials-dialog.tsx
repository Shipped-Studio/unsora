"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useSavePlatformCredentials,
  type AdminCredentialField,
  type AdminPlatform,
} from "@/hooks/admin/use-admin-platforms";

const SOURCE_LABEL: Record<AdminCredentialField["source"], string> = {
  admin: "Set here",
  env: "From Railway",
  missing: "Not set",
};

/**
 * Edit one platform's OAuth credentials. Values are saved encrypted on the
 * server; secrets are write-only, so their fields start empty and only show
 * the last four characters of the current value.
 */
export function PlatformCredentialsDialog({
  platform,
  canSave,
  onOpenChange,
}: {
  platform: AdminPlatform | null;
  canSave: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={platform !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {platform ? (
          <CredentialsForm
            key={platform.id}
            platform={platform}
            canSave={canSave}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CredentialsForm({
  platform,
  canSave,
  onDone,
}: {
  platform: AdminPlatform;
  canSave: boolean;
  onDone: () => void;
}) {
  const save = useSavePlatformCredentials();
  // Only fields the admin typed into are sent; empty means "leave as is".
  const [draft, setDraft] = useState<Record<string, string>>({});

  const changes = Object.fromEntries(
    Object.entries(draft).filter(([, value]) => value.trim() !== ""),
  );
  const hasChanges = Object.keys(changes).length > 0;

  const submit = (values: Record<string, string | null>, message: string) =>
    save.mutate(values, {
      onSuccess: () => {
        toast.success(message);
        setDraft({});
      },
      onError: (err) => toast.error(err.message),
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (hasChanges) submit(changes, `${platform.name} keys saved`);
      }}
      className="contents"
    >
      <DialogHeader>
        <DialogTitle>{platform.name} keys</DialogTitle>
        <DialogDescription>
          Saved encrypted and used everywhere within about 30 seconds. Leave a
          field empty to keep its current value.
        </DialogDescription>
      </DialogHeader>

      {!canSave ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Saving is off: set SETTINGS_ENCRYPTION_KEY on the server first.
        </p>
      ) : null}

      <div className="space-y-4">
        {platform.credentials.map((field) => (
          <Field key={field.name}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor={`cred-${field.name}`}>{field.label}</FieldLabel>
              <Badge variant={field.source === "missing" ? "outline" : "secondary"}>
                {SOURCE_LABEL[field.source]}
              </Badge>
            </div>
            <Input
              id={`cred-${field.name}`}
              type={field.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              disabled={!canSave || save.isPending}
              placeholder={
                field.display ??
                (field.secret ? "Paste a new value" : "Not set")
              }
              value={draft[field.name] ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, [field.name]: event.target.value }))
              }
            />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <code className="truncate">{field.name}</code>
              {field.source === "admin" ? (
                <button
                  type="button"
                  disabled={save.isPending}
                  className="shrink-0 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() =>
                    submit(
                      { [field.name]: null },
                      `${field.label} now comes from Railway`,
                    )
                  }
                >
                  Use Railway value instead
                </button>
              ) : null}
            </div>
          </Field>
        ))}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Close
        </Button>
        <Button type="submit" disabled={!canSave || !hasChanges || save.isPending}>
          {save.isPending ? <Spinner /> : null}
          Save keys
        </Button>
      </DialogFooter>
    </form>
  );
}
