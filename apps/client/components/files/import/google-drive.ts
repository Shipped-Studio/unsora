import type { ImportSourceItem } from "@/hooks/use-library";
import { loadScript } from "./load-script";
import {
  GOOGLE_API_KEY,
  GOOGLE_APP_ID,
  GOOGLE_CLIENT_ID,
  mimeTypesFor,
  PickerCancelled,
  type PickOptions,
} from "./sources";

/**
 * Google Drive via the Google Picker API and a Google Identity Services token
 * client (scope drive.file: the app only gets the files the user picks). The
 * token lives in memory and is sent to our server only to download the
 * picked files. It's never stored.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type?: string; message?: string }) => void;
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface PickerDoc {
  id: string;
  name?: string;
  mimeType?: string;
}

interface PickerData {
  action: string;
  docs?: PickerDoc[];
}

interface PickerBuilder {
  addView(view: unknown): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setCallback(cb: (data: PickerData) => void): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setMaxItems(max: number): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  build(): { setVisible(visible: boolean): void; dispose?: () => void };
}

interface DocsView {
  setIncludeFolders(v: boolean): DocsView;
  setSelectFolderEnabled(v: boolean): DocsView;
  setMimeTypes(types: string): DocsView;
}

interface GoogleNamespace {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }): TokenClient;
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: string) => DocsView;
    ViewId: { DOCS: string };
    Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
    Action: { PICKED: string; CANCEL: string };
  };
}

interface GapiNamespace {
  load(name: string, options: { callback: () => void; onerror: () => void }): void;
}

function googleGlobal() {
  return (window as unknown as { google?: GoogleNamespace }).google;
}

let ready: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Loads both Google scripts and the picker module. Safe to call early. */
export function preloadGoogleDrive(): Promise<void> {
  if (!ready) {
    ready = Promise.all([
      loadScript("https://accounts.google.com/gsi/client"),
      loadScript("https://apis.google.com/js/api.js").then(
        () =>
          new Promise<void>((resolve, reject) => {
            const gapi = (window as unknown as { gapi?: GapiNamespace }).gapi;
            if (!gapi) {
              reject(new Error("Google Drive didn't load."));
              return;
            }
            gapi.load("picker", {
              callback: () => resolve(),
              onerror: () => reject(new Error("Google Drive didn't load.")),
            });
          }),
      ),
    ]).then(() => undefined);
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return Promise.resolve(cachedToken.token);
  }
  const google = googleGlobal();
  if (!google) return Promise.reject(new Error("Google Drive didn't load."));

  return new Promise((resolve, reject) => {
    const onToken = (response: TokenResponse) => {
      if (response.error || !response.access_token) {
        reject(
          response.error === "access_denied"
            ? new PickerCancelled()
            : new Error("Google didn't grant access. Try again."),
        );
        return;
      }
      cachedToken = {
        token: response.access_token,
        expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
      };
      resolve(response.access_token);
    };
    const onError = (error: { type?: string }) => {
      if (error.type === "popup_closed") reject(new PickerCancelled());
      else if (error.type === "popup_failed_to_open")
        reject(new Error("Allow pop-ups for this site, then try again."));
      else reject(new Error("Google sign-in failed. Try again."));
    };

    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        callback: onToken,
        error_callback: onError,
      });
    }
    tokenClient.callback = onToken;
    tokenClient.error_callback = onError;
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

/** Opens Google Drive's picker. Resolves with files to import. */
export async function pickFromGoogleDrive(
  options: PickOptions,
): Promise<ImportSourceItem[]> {
  await preloadGoogleDrive();
  const token = await getToken();
  const google = googleGlobal();
  if (!google) throw new Error("Google Drive didn't load.");

  return new Promise((resolve, reject) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes(mimeTypesFor(options.mediaType).join(","));

    let builder = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setAppId(GOOGLE_APP_ID)
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .setTitle("Choose files to import")
      .setCallback((data) => {
        if (data.action === google.picker.Action.CANCEL) {
          reject(new PickerCancelled());
        } else if (data.action === google.picker.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((doc) => ({
              provider: "google_drive" as const,
              fileId: doc.id,
              accessToken: token,
              name: doc.name,
              mimeType: doc.mimeType,
            })),
          );
        }
      });
    if (options.multiple) {
      builder = builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
      if (options.max && Number.isFinite(options.max)) {
        builder = builder.setMaxItems(Math.min(options.max, 20));
      } else {
        builder = builder.setMaxItems(20);
      }
    }
    builder.build().setVisible(true);
  });
}
