"use client";

import { useState } from "react";
import { Translate } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TRANSLATE_ITEMS } from "@/components/subtitle-editor/captions/languages";

const TRANSLATE_CREDITS = 1;

/** The Translate button and dialog. Stays open, and locked, while translating. */
export function TranslateDialog({
  onTranslate,
}: {
  /** Resolves true once translated. */
  onTranslate: (language: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(TRANSLATE_ITEMS[2].value);
  const [isTranslating, setIsTranslating] = useState(false);

  const translate = async () => {
    setIsTranslating(true);
    const done = await onTranslate(language);
    setIsTranslating(false);
    if (done) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isTranslating && setOpen(next)}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Translate />
        Translate
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Translate captions</DialogTitle>
          <DialogDescription>
            Every line is rewritten in the language you pick. Highlights and
            emojis are cleared, since they were for the old words.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">Language</span>
            <div className="w-56">
              <Select
                items={TRANSLATE_ITEMS}
                value={language}
                onValueChange={(next) => {
                  if (typeof next === "string") setLanguage(next);
                }}
              >
                <SelectTrigger aria-label="Language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSLATE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={isTranslating} />}>
            Cancel
          </DialogClose>
          <Button disabled={isTranslating} onClick={translate}>
            {isTranslating ? <Spinner /> : null}
            {isTranslating ? "Translating…" : "Translate"}
            <span className="rounded bg-primary-foreground/20 px-1.5 text-xs tabular-nums">
              ✦ {TRANSLATE_CREDITS}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
