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
import { Textarea } from "@/components/ui/textarea";

const MAX_LINKS = 20;

function parseLinks(text: string) {
  const lines = text
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const line of lines) {
    try {
      const url = new URL(line);
      if (url.protocol === "https:" || url.protocol === "http:") valid.push(url.toString());
      else invalid.push(line);
    } catch {
      invalid.push(line);
    }
  }
  return { valid: [...new Set(valid)], invalid };
}

/** Paste one or more public links to image, video or audio files. */
export function ImportLinkDialog({
  open,
  onOpenChange,
  onSubmit,
  max = MAX_LINKS,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (urls: string[]) => void;
  max?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <LinkForm
          max={Math.max(1, Math.min(max, MAX_LINKS))}
          onSubmit={(urls) => {
            onSubmit(urls);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({
  max,
  onSubmit,
}: {
  max: number;
  onSubmit: (urls: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const { valid, invalid } = parseLinks(text);
    if (invalid.length > 0) {
      setError(
        invalid.length === 1
          ? `"${invalid[0].slice(0, 60)}" isn't an http or https link.`
          : `${invalid.length} lines aren't http or https links.`,
      );
      return;
    }
    if (valid.length === 0) {
      setError("Paste at least one link.");
      return;
    }
    if (valid.length > max) {
      setError(`You can import up to ${max} ${max === 1 ? "link" : "links"} at a time.`);
      return;
    }
    onSubmit(valid);
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <DialogHeader>
        <DialogTitle>Import from a link</DialogTitle>
        <DialogDescription>
          Paste a public link to an image, video or audio file. The file is
          copied into your Library.
        </DialogDescription>
      </DialogHeader>

      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="import-links">
          {max === 1 ? "Link" : "Links"}
        </FieldLabel>
        <Textarea
          id="import-links"
          rows={4}
          value={text}
          placeholder="https://example.com/video.mp4"
          aria-invalid={error ? true : undefined}
          className="max-h-48 font-mono text-xs"
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
        />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>
            {max === 1
              ? "Videos up to 500 MB, images and audio up to 50 MB."
              : `One per line, up to ${max}. Videos up to 500 MB, images and audio up to 50 MB.`}
          </FieldDescription>
        )}
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit">Import</Button>
      </DialogFooter>
    </form>
  );
}
