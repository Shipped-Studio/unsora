"use client";

import { useState, useRef } from "react";
import {
  VideoCamera,
  ArrowsOut,
  X,
  CaretDown,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import { BOTTOM_PROMPT_DOCK_CLASS } from "@/lib/layout-classes";
import { toast } from "sonner";

type ModelKey = "lite" | "fast" | "quality";

interface ModelMeta {
  key: ModelKey;
  label: string;
  description: string;
}

const MODELS: ModelMeta[] = [
  {
    key: "lite",
    label: "Lite",
    description: "Fastest generation, lower fidelity — great for quick previews.",
  },
  {
    key: "fast",
    label: "Fast",
    description: "Balanced speed and quality for most use cases.",
  },
  {
    key: "quality",
    label: "Quality",
    description: "Highest fidelity output — slower, best for final cuts.",
  },
];

export function VideoExtendForm() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelKey>("fast");
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentModel = MODELS.find((m) => m.key === model)!;
  const canSubmit = file !== null && prompt.trim().length > 0;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    e.target.value = "";
  }

  function removeFile() {
    setFile(null);
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    toast.success("Video extend job submitted");
    setFile(null);
    setPrompt("");
  }

  return (
    <div className={BOTTOM_PROMPT_DOCK_CLASS}>
      <div className="w-full max-w-3xl rounded-2xl border bg-background/95 shadow-2xl shadow-black/5 backdrop-blur-md pointer-events-auto">
        <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />

        {/* Upload area */}
        <div className="flex items-center gap-3 px-4 pt-4">
          {file ? (
            <div className="group relative flex h-14 items-center gap-2 rounded-lg bg-muted px-3 ring-1 ring-border">
              <VideoCamera
                className="size-4 shrink-0 text-muted-foreground"
                weight="fill"
              />
              <span className="max-w-48 truncate text-xs">{file.name}</span>
              <button
                onClick={removeFile}
                className="ml-1 rounded-full p-0.5 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100"
              >
                <X className="size-3 text-muted-foreground" weight="bold" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed size-24 text-xs font-medium transition-colors",
                "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              <VideoCamera className="size-4" weight="regular" />
              Upload video
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Prompt textarea */}
        <div className="px-4 pt-3">
          <textarea
            placeholder="Describe how you want to extend the video..."
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={submitting}
            className="w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none"
          />
        </div>

        {/* Bottom toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2.5">
          <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
            <DialogTrigger>
              <Button variant="outline" size="sm" disabled={submitting}>
                <ArrowsOut className="size-3.5" weight="regular" />
                <span>{currentModel.label}</span>
                <CaretDown className="size-3 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Select Model</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {MODELS.map((m) => {
                  const isActive = m.key === model;
                  return (
                    <button
                      key={m.key}
                      onClick={() => {
                        setModel(m.key);
                        setModelDialogOpen(false);
                      }}
                      className={cn(
                        "group flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                        isActive
                          ? "border-primary ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/20",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <ArrowsOut className="size-4" weight="fill" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium leading-tight">
                          {m.label}
                        </span>
                        <span className="text-sm leading-snug text-muted-foreground">
                          {m.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>

          <div className="ml-auto flex items-center">
            <GenerateButton
              label="Extend Video"
              disabled={!canSubmit}
              submitting={submitting}
              onClick={handleSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
