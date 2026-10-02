"use client";

import { useRef, useState } from "react";
import { YoutubeLogo, FileDoc, FileArrowUp } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";
import { toast } from "sonner";
import { uploadFileToStorage } from "@/lib/storage-client";

export interface ContextItem {
  id: string;
  type: "youtube" | "document";
  /** Short display label. */
  label: string;
  /** YouTube URL, .txt body, or the storage URL of a PDF. */
  content?: string;
  thumbnail?: string;
}

type DocFileState = {
  name: string;
  content: string;
  kind: "txt" | "pdf";
  uploading?: boolean;
  progress?: number;
};

function isSupportedDocument(file: File): boolean {
  const ext = file.name.match(/\.(txt|pdf)$/i);
  if (ext) return true;
  return file.type === "text/plain" || file.type === "application/pdf";
}

function documentKind(file: File): "txt" | "pdf" | null {
  if (file.type === "application/pdf" || file.name.match(/\.pdf$/i)) return "pdf";
  if (file.type === "text/plain" || file.name.match(/\.txt$/i)) return "txt";
  return null;
}

function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function getYoutubeThumbnail(url: string): string | null {
  const id = extractYoutubeVideoId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

interface AddContextModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: ContextItem) => void;
}

export function AddContextModal({
  open,
  onOpenChange,
  onAdd,
}: AddContextModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<DocFileState | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState("youtube");

  const youtubeThumbnail = youtubeUrl
    ? getYoutubeThumbnail(youtubeUrl.trim())
    : null;

  const handleCreateYoutube = () => {
    const url = youtubeUrl.trim();
    if (!url) return;
    const id = extractYoutubeVideoId(url);
    if (!id) {
      setYoutubeError("That isn't a YouTube video link.");
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      type: "youtube",
      label: url,
      content: url,
      thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    });
    setYoutubeUrl("");
    setYoutubeError(null);
    onOpenChange(false);
  };

  const handleYoutubeChange = (v: string) => {
    setYoutubeUrl(v);
    if (youtubeError) setYoutubeError(null);
  };

  const handleDocumentFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!isSupportedDocument(file)) {
      setDocError("Choose a .txt or .pdf file.");
      return;
    }

    const kind = documentKind(file);
    if (!kind) {
      setDocError("Choose a .txt or .pdf file.");
      return;
    }
    setDocError(null);

    if (kind === "txt") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        setDocFile({ name: file.name, content: text, kind: "txt" });
      };
      reader.readAsText(file);
      return;
    }

    setDocFile({
      name: file.name,
      content: "",
      kind: "pdf",
      uploading: true,
      progress: 0,
    });

    try {
      const result = await uploadFileToStorage(file, ({ percentage }) => {
        setDocFile((prev) =>
          prev?.name === file.name ? { ...prev, progress: percentage } : prev,
        );
      });

      if (!result.success || !result.blobUrl) {
        setDocFile(null);
        toast.error(
          `Couldn't upload "${file.name}". ${result.error ?? "Try again."}`,
        );
        return;
      }

      setDocFile({
        name: file.name,
        content: result.blobUrl,
        kind: "pdf",
        uploading: false,
        progress: 100,
      });
    } catch {
      setDocFile(null);
      toast.error(`Couldn't upload "${file.name}". Try again.`);
    }
  };

  const handleCreateDocument = () => {
    if (!docFile || docFile.uploading || !docFile.content) return;
    onAdd({
      id: crypto.randomUUID(),
      type: "document",
      label: docFile.name,
      content: docFile.content,
    });
    setDocFile(null);
    onOpenChange(false);
  };

  const canAddYoutube = !!youtubeUrl.trim();
  const canAddDocument =
    !!docFile && !docFile.uploading && !!docFile.content.trim();

  const canAdd = tab === "youtube" ? canAddYoutube : canAddDocument;
  const addHandler =
    tab === "youtube" ? handleCreateYoutube : handleCreateDocument;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add context</DialogTitle>
          <DialogDescription>
            Give the thumbnail a topic: a YouTube video, or a .txt or .pdf
            document.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="youtube" value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="youtube">
              <YoutubeLogo className="size-4" weight="fill" />
              YouTube
            </TabsTrigger>
            <TabsTrigger value="document">
              <FileDoc className="size-4" />
              Document
            </TabsTrigger>
          </TabsList>

          <TabsContent value="youtube">
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="yt-url-input">YouTube URL</Label>
                <Input
                  id="yt-url-input"
                  autoFocus
                  placeholder="https://youtu.be/dQw4w9WgXcQ"
                  value={youtubeUrl}
                  onChange={(e) => handleYoutubeChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateYoutube()}
                  aria-invalid={!!youtubeError}
                  aria-describedby={youtubeError ? "yt-url-error" : undefined}
                />
                {youtubeError && (
                  <p id="yt-url-error" className="text-xs text-destructive">
                    {youtubeError}
                  </p>
                )}
              </div>

              {youtubeThumbnail && !youtubeError && (
                <div className="relative w-40 aspect-video overflow-hidden rounded-xl">
                  <Image
                    src={youtubeThumbnail}
                    alt="YouTube thumbnail preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="document">
            <div className="space-y-3 pt-2">
              <input
                ref={docInputRef}
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                className="hidden"
                onChange={(e) => void handleDocumentFileChange(e)}
              />

              {!docFile ? (
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-10 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <FileArrowUp className="size-5" />
                  </span>
                  <span className="text-center">
                    <span className="block text-sm font-medium text-foreground">
                      Choose a document
                    </span>
                    <span className="block text-xs">TXT or PDF</span>
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
                  <FileDoc className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {docFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {docFile.uploading ? (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Spinner className="size-3" />
                          Uploading {docFile.progress ?? 0}%
                        </span>
                      ) : docFile.kind === "txt" ? (
                        `${docFile.content.length.toLocaleString()} characters`
                      ) : (
                        "PDF uploaded"
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setDocFile(null)}
                    disabled={docFile.uploading}
                  >
                    Remove
                  </Button>
                </div>
              )}

              {docError && (
                <p className="text-xs text-destructive">{docError}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          {tab === "document" && (
            <Button
              variant="outline"
              onClick={() => docInputRef.current?.click()}
              disabled={docFile?.uploading}
            >
              {docFile ? "Change file" : "Choose file"}
            </Button>
          )}
          <Button onClick={addHandler} disabled={!canAdd}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
