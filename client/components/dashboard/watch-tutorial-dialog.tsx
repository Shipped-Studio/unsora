"use client";

import { useEffect, useState } from "react";
import { Check, MonitorPlay, Plugs, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Bump the version suffix to re-show the tutorial to everyone after a big
 * change (new videos, new flow).
 */
const SEEN_KEY = "unsora:agent-tutorial-seen:v1";

const STEPS = [
  {
    videoId: "lU_l3RQRjyw",
    label: "Connect MCP",
    icon: Plugs,
    title: "Connect the Unsora MCP server",
    description:
      "Add the MCP server to Claude so your agent can create videos, images, thumbnails and more.",
  },
  {
    videoId: "jkCLJ_Zc4sE",
    label: "Add the skill",
    icon: Sparkle,
    title: "Add the Unsora skill to Claude",
    description:
      "Install the skill so Claude knows how to run your whole studio end to end.",
  },
] as const;

/**
 * Two-step video tutorial (MCP setup → skill setup). Auto-opens once per
 * browser (localStorage) the first time the dashboard loads; afterwards it's
 * reachable through the "Watch how" button on the agent-connect card. The
 * iframe only mounts for the active step while the dialog is open, so
 * YouTube's player JS never loads on the dashboard itself.
 */
export function WatchTutorialDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      localStorage.setItem(SEEN_KEY, "1");
      setStep(0);
    }
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full lg:h-7 lg:px-3 lg:text-xs"
        onClick={() => setOpen(true)}
      >
        <MonitorPlay className="size-3.5" weight="fill" />
        Watch how
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-5 sm:max-w-3xl">
          <DialogHeader>
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              <MonitorPlay className="size-3.5" weight="fill" />
              2-minute setup
            </div>
            <DialogTitle className="text-lg">
              Let your AI agent run the studio
            </DialogTitle>
            <DialogDescription>
              Two short videos — connect once, then just ask Claude to create.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center gap-3">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={s.videoId} className="flex flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    className="group flex min-w-0 items-center gap-2.5"
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        active && "bg-primary text-primary-foreground shadow-sm",
                        done && "bg-primary/15 text-primary",
                        !active &&
                          !done &&
                          "bg-muted text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {done ? (
                        <Check className="size-3.5" weight="bold" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "truncate text-sm font-medium transition-colors",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span
                      className={cn(
                        "h-px flex-1 rounded-full transition-colors",
                        done ? "bg-primary/40" : "bg-border",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Video */}
          <div className="overflow-hidden rounded-xl border border-border/60 bg-black shadow-sm">
            <iframe
              key={current.videoId}
              src={`https://www.youtube-nocookie.com/embed/${current.videoId}?rel=0`}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="aspect-video w-full"
            />
          </div>

          {/* Step copy */}
          <div className="flex items-start gap-3">
          
            <div className="min-w-0">
              <p className="text-sm font-semibold">{current.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {current.description}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs tabular-nums text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                className="rounded-full"
                onClick={() =>
                  isLast ? handleOpenChange(false) : setStep(step + 1)
                }
              >
                {isLast ? (
                  <>
                    <Check className="size-3.5" weight="bold" />
                    Done
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
