"use client";

import { useState } from "react";
import {
  CaretDown,
  Cloud,
  CloudArrowDown,
  DropboxLogo,
  GoogleDriveLogo,
  LinkSimple,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ImportSourceItem,
  LibraryFilterMediaType,
} from "@/hooks/use-library";
import { cn } from "@/lib/utils";
import { ImportLinkDialog } from "./import-link-dialog";
import { pickFromDropbox, preloadDropbox } from "./dropbox";
import { pickFromGoogleDrive, preloadGoogleDrive } from "./google-drive";
import { pickFromOneDrive } from "./onedrive";
import {
  CLOUD_SOURCES,
  PickerCancelled,
  type PickOptions,
} from "./sources";

interface ImportMenuProps {
  /** Opens the device file picker. */
  onUploadClick: () => void;
  /** Called with the files picked from a link or a cloud source. */
  onImport: (items: ImportSourceItem[]) => void;
  mediaType?: LibraryFilterMediaType;
  multiple?: boolean;
  max?: number;
  uploading?: boolean;
  uploadLabel?: string;
  /** `default` makes Upload the page's main action. Import stays outline. */
  variant?: "default" | "outline";
  /** Icon-only buttons below `sm`, for page headers. */
  compact?: boolean;
}

function preloadCloudScripts() {
  // Popups must open straight from the click, so fetch scripts when the menu
  // opens rather than on the click itself.
  if (CLOUD_SOURCES.google_drive) void preloadGoogleDrive().catch(() => undefined);
  if (CLOUD_SOURCES.dropbox) void preloadDropbox().catch(() => undefined);
}

/**
 * Upload from the device, plus an Import menu for links and whichever cloud
 * sources are configured.
 */
export function ImportMenu({
  onUploadClick,
  onImport,
  mediaType,
  multiple = true,
  max,
  uploading = false,
  uploadLabel,
  variant = "outline",
  compact = false,
}: ImportMenuProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const pickOptions: PickOptions = { mediaType, multiple, max };

  // Call `pick` synchronously from the click so the popup isn't blocked.
  const run = (label: string, pick: () => Promise<ImportSourceItem[]>) => {
    pick()
      .then((items) => {
        if (items.length > 0) onImport(items);
      })
      .catch((error: unknown) => {
        if (error instanceof PickerCancelled) return;
        toast.error(
          `Couldn't open ${label}. ${error instanceof Error ? error.message : "Try again."}`,
        );
      });
  };

  // Below sm the label turns into screen-reader text and the button squares up
  // to the icon size, so the page title keeps its room.
  const iconOnly = compact ? "max-sm:size-9 max-sm:p-0" : undefined;
  const label = compact ? "max-sm:sr-only" : undefined;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant={variant}
          onClick={onUploadClick}
          disabled={uploading}
          className={iconOnly}
        >
          <UploadSimple />
          <span className={label}>
            {uploadLabel ?? (uploading ? "Uploading…" : "Upload")}
          </span>
        </Button>
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) preloadCloudScripts();
          }}
        >
          <DropdownMenuTrigger
            render={<Button variant="outline" className={iconOnly} />}
          >
            {compact ? <CloudArrowDown className="sm:hidden" /> : null}
            <span className={label}>Import</span>
            <CaretDown className={cn(compact && "max-sm:hidden")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => setLinkOpen(true)}>
              <LinkSimple />
              From a link
            </DropdownMenuItem>
            {CLOUD_SOURCES.google_drive ? (
              <DropdownMenuItem
                onClick={() =>
                  run("Google Drive", () => pickFromGoogleDrive(pickOptions))
                }
              >
                <GoogleDriveLogo />
                Google Drive
              </DropdownMenuItem>
            ) : null}
            {CLOUD_SOURCES.dropbox ? (
              <DropdownMenuItem
                onClick={() => run("Dropbox", () => pickFromDropbox(pickOptions))}
              >
                <DropboxLogo />
                Dropbox
              </DropdownMenuItem>
            ) : null}
            {CLOUD_SOURCES.onedrive ? (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    run("OneDrive", () => pickFromOneDrive("personal", pickOptions))
                  }
                >
                  <Cloud />
                  OneDrive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    run("OneDrive", () => pickFromOneDrive("work", pickOptions))
                  }
                >
                  <Cloud />
                  OneDrive for work or school
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ImportLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        max={multiple ? (max ?? 20) : 1}
        onSubmit={(urls) =>
          onImport(urls.map((url) => ({ provider: "url" as const, url })))
        }
      />
    </>
  );
}
