import type { ImportSourceItem } from "@/hooks/use-library";
import { loadScript } from "./load-script";
import {
  DROPBOX_APP_KEY,
  PickerCancelled,
  type PickOptions,
} from "./sources";

/**
 * Dropbox Chooser drop-in. It returns short-lived direct links, which the
 * server downloads with the same SSRF checks as any other link.
 */

interface DropboxFile {
  link: string;
  name: string;
  bytes: number;
  isDir: boolean;
}

interface DropboxChooser {
  choose(options: {
    success: (files: DropboxFile[]) => void;
    cancel?: () => void;
    linkType: "direct" | "preview";
    multiselect: boolean;
    extensions?: string[];
    folderselect?: boolean;
  }): void;
  isBrowserSupported(): boolean;
}

const SCRIPT = "https://www.dropbox.com/static/api/2/dropins.js";

function dropboxGlobal() {
  return (window as unknown as { Dropbox?: DropboxChooser }).Dropbox;
}

/** Loads the Chooser script. Safe to call early. */
export function preloadDropbox(): Promise<void> {
  return loadScript(SCRIPT, { id: "dropboxjs", "data-app-key": DROPBOX_APP_KEY });
}

const GROUPS = { image: "images", video: "video", audio: "audio" } as const;

/**
 * Opens the Chooser. Call from a click handler: the Chooser is a popup, so
 * if the script isn't loaded yet a strict popup blocker may stop it.
 */
export async function pickFromDropbox(
  options: PickOptions,
): Promise<ImportSourceItem[]> {
  if (!dropboxGlobal()) await preloadDropbox();
  const dropbox = dropboxGlobal();
  if (!dropbox) throw new Error("Dropbox didn't load.");
  if (!dropbox.isBrowserSupported()) {
    throw new Error("Dropbox doesn't support this browser.");
  }

  return new Promise((resolve, reject) => {
    dropbox.choose({
      linkType: "direct",
      multiselect: options.multiple,
      folderselect: false,
      extensions: options.mediaType
        ? [GROUPS[options.mediaType]]
        : ["images", "video", "audio"],
      success: (files) => {
        const picked = files
          .filter((f) => !f.isDir)
          .slice(0, options.multiple ? Math.min(options.max ?? 20, 20) : 1);
        resolve(
          picked.map((f) => ({
            provider: "dropbox" as const,
            url: f.link,
            name: f.name,
          })),
        );
      },
      cancel: () => reject(new PickerCancelled()),
    });
  });
}
