import type { ImportSourceItem } from "@/hooks/use-library";
import {
  extensionsFor,
  ONEDRIVE_CLIENT_ID,
  PickerCancelled,
  type PickOptions,
} from "./sources";

/**
 * OneDrive via the File Picker v8, in a popup.
 *
 * Sign-in is the Microsoft identity platform's auth code flow with PKCE for
 * single-page apps (what MSAL does under the hood), done in the same popup
 * the picker then loads into, so only one window opens per pick. Tokens stay
 * in memory for this tab only.
 *
 * After a pick, the browser asks OneDrive for each file's pre-authenticated
 * download URL and hands only that URL to our server. No Microsoft token
 * leaves the browser.
 *
 * - Personal accounts: consumer picker at onedrive.live.com, which needs the
 *   OneDrive.ReadWrite scope.
 * - Work or school accounts: Graph Files.Read to find the user's SharePoint
 *   host, then that host's picker with a SharePoint token.
 */

export type OneDriveAccount = "personal" | "work";

const LOGIN = "https://login.microsoftonline.com";
const REDIRECT_PATH = "/auth/popup.html";
const AUTHORITY: Record<OneDriveAccount, string> = {
  personal: "consumers",
  work: "organizations",
};
const PERSONAL_SCOPE = "OneDrive.ReadWrite";
const GRAPH_FILES_READ = "https://graph.microsoft.com/Files.Read";
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface Session {
  account: OneDriveAccount;
  refreshToken: string | null;
  tokens: Map<string, CachedToken>;
  loginHint?: string;
  /** Work accounts: https://<tenant>-my.sharepoint.com */
  sharePointOrigin?: string;
}

const sessions: Partial<Record<OneDriveAccount, Session>> = {};

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

class TokenError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

function redirectUri() {
  return `${window.location.origin}${REDIRECT_PATH}`;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createPkce() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=")));
  } catch {
    return {};
  }
}

function openPopupWindow(): Window {
  const width = 1080;
  const height = 720;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  const popup = window.open(
    "",
    "unsora-onedrive",
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
  if (!popup) throw new Error("Allow pop-ups for this site, then try again.");
  return popup;
}

/** Sends the popup to Microsoft sign-in and waits for it to come back. */
async function authorizeInPopup(
  popup: Window,
  account: OneDriveAccount,
  scope: string,
  loginHint?: string,
): Promise<{ code: string; verifier: string }> {
  const { verifier, challenge } = await createPkce();
  const state = base64Url(crypto.getRandomValues(new Uint8Array(16)));
  const params = new URLSearchParams({
    client_id: ONEDRIVE_CLIENT_ID,
    response_type: "code",
    response_mode: "query",
    redirect_uri: redirectUri(),
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (loginHint) params.set("login_hint", loginHint);
  else params.set("prompt", "select_account");

  popup.location.href = `${LOGIN}/${AUTHORITY[account]}/oauth2/v2.0/authorize?${params.toString()}`;

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        reject(new PickerCancelled());
        return;
      }
      if (Date.now() - started > SIGN_IN_TIMEOUT_MS) {
        window.clearInterval(timer);
        reject(new Error("Microsoft sign-in timed out. Try again."));
        return;
      }
      let href: string;
      try {
        href = popup.location.href;
      } catch {
        return; // On Microsoft's pages: cross-origin until it redirects back.
      }
      if (!href.startsWith(redirectUri())) return;
      const query = new URL(href).searchParams;
      // An earlier sign-in's redirect can still be showing: wait for ours.
      if (query.get("state") !== state) return;
      window.clearInterval(timer);

      const error = query.get("error");
      if (error) {
        reject(
          error === "access_denied"
            ? new PickerCancelled()
            : new Error(
                query.get("error_description")?.split(/\r?\n/)[0] ||
                  "Microsoft sign-in failed.",
              ),
        );
        return;
      }
      const code = query.get("code");
      if (!code) reject(new Error("Microsoft sign-in failed. Try again."));
      else resolve({ code, verifier });
    }, 250);
  });
}

async function requestToken(
  account: OneDriveAccount,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(`${LOGIN}/${AUTHORITY[account]}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: ONEDRIVE_CLIENT_ID, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new TokenError(
      json.error_description?.split(/\r?\n/)[0] || "Microsoft sign-in failed.",
      json.error,
    );
  }
  return json;
}

function remember(session: Session, scope: string, response: TokenResponse) {
  if (response.refresh_token) session.refreshToken = response.refresh_token;
  const token = response.access_token as string;
  session.tokens.set(scope, {
    token,
    expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
  });
  if (response.id_token && !session.loginHint) {
    const claims = decodeJwt(response.id_token);
    const hint = claims.preferred_username ?? claims.email;
    if (typeof hint === "string") session.loginHint = hint;
  }
  return token;
}

async function redeemCode(
  session: Session,
  scope: string,
  grant: { code: string; verifier: string },
) {
  const response = await requestToken(session.account, {
    grant_type: "authorization_code",
    code: grant.code,
    code_verifier: grant.verifier,
    redirect_uri: redirectUri(),
    scope,
  });
  return remember(session, scope, response);
}

/**
 * A token for `scope`: cached, then refreshed silently, then (when a popup is
 * available) interactively.
 */
async function tokenFor(
  session: Session,
  scope: string,
  popup?: Window,
): Promise<string> {
  const cached = session.tokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  if (session.refreshToken) {
    try {
      const response = await requestToken(session.account, {
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
        scope: `${scope} offline_access`,
      });
      return remember(session, scope, response);
    } catch (error) {
      if (!popup) throw error;
    }
  }
  if (!popup || popup.closed) {
    throw new Error("Sign in to OneDrive again.");
  }
  const grant = await authorizeInPopup(
    popup,
    session.account,
    `${scope} offline_access openid profile`,
    session.loginHint,
  );
  return redeemCode(session, scope, grant);
}

async function signIn(account: OneDriveAccount, popup: Window): Promise<Session> {
  const existing = sessions[account];
  if (existing?.refreshToken) return existing;

  const session: Session = { account, refreshToken: null, tokens: new Map() };
  const firstScope = account === "personal" ? PERSONAL_SCOPE : GRAPH_FILES_READ;
  const grant = await authorizeInPopup(
    popup,
    account,
    `${firstScope} offline_access openid profile`,
  );
  await redeemCode(session, firstScope, grant);
  sessions[account] = session;
  return session;
}

async function sharePointOrigin(session: Session, popup: Window) {
  if (session.sharePointOrigin) return session.sharePointOrigin;
  const graphToken = await tokenFor(session, GRAPH_FILES_READ, popup);
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me/drive?$select=webUrl",
    { headers: { Authorization: `Bearer ${graphToken}` } },
  );
  const json = (await res.json().catch(() => ({}))) as { webUrl?: string };
  if (!res.ok || !json.webUrl) {
    throw new Error("Couldn't find your OneDrive. Check that your account has one.");
  }
  session.sharePointOrigin = new URL(json.webUrl).origin;
  return session.sharePointOrigin;
}

function scopeForResource(session: Session, resource?: string) {
  if (session.account === "personal" || !resource) return PERSONAL_SCOPE;
  return `${new URL(resource).origin}/.default`;
}

/** Loads the picker into the popup with a form POST, as v8 requires. */
function loadPicker(popup: Window, url: string, token: string) {
  const doc = popup.document;
  doc.title = "OneDrive";
  const form = doc.createElement("form");
  form.method = "POST";
  form.action = url;
  const input = doc.createElement("input");
  input.type = "hidden";
  input.name = "access_token";
  input.value = token;
  form.appendChild(input);
  doc.body.appendChild(form);
  form.submit();
}

interface PickedItem {
  id: string;
  parentReference?: { driveId?: string };
  "@sharePoint.endpoint"?: string;
}

interface PickerCommand {
  command: string;
  resource?: string;
  items?: PickedItem[];
}

interface PortMessage {
  type: string;
  id?: string;
  data?: PickerCommand;
}

async function resolvePicked(
  session: Session,
  items: PickedItem[],
  options: PickOptions,
): Promise<ImportSourceItem[]> {
  const limit = options.multiple ? Math.min(options.max ?? 20, 20) : 1;
  const results: ImportSourceItem[] = [];
  for (const item of items.slice(0, limit)) {
    const endpoint =
      item["@sharePoint.endpoint"] ??
      (session.account === "personal" ? "https://api.onedrive.com/v1.0" : undefined);
    const driveId = item.parentReference?.driveId;
    if (!endpoint || !driveId || !endpoint.startsWith("https://")) {
      throw new Error("OneDrive didn't return the file details. Try again.");
    }
    const token = await tokenFor(
      session,
      session.account === "personal"
        ? PERSONAL_SCOPE
        : `${new URL(endpoint).origin}/.default`,
    );
    const res = await fetch(
      `${endpoint}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(item.id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const meta = (await res.json().catch(() => ({}))) as {
      name?: string;
      file?: { mimeType?: string };
      "@content.downloadUrl"?: string;
      "@microsoft.graph.downloadUrl"?: string;
    };
    const downloadUrl =
      meta["@content.downloadUrl"] ?? meta["@microsoft.graph.downloadUrl"];
    if (!res.ok || !meta.file || !downloadUrl) {
      throw new Error("OneDrive didn't return a download link. Try again.");
    }
    results.push({
      provider: "onedrive",
      url: downloadUrl,
      name: meta.name,
      mimeType: meta.file.mimeType,
    });
  }
  return results;
}

/**
 * Signs in if needed and opens the OneDrive picker. Must be called directly
 * from a click handler: the popup opens before anything is awaited.
 */
export async function pickFromOneDrive(
  account: OneDriveAccount,
  options: PickOptions,
): Promise<ImportSourceItem[]> {
  const popup = openPopupWindow();
  try {
    const session = await signIn(account, popup);

    let pickerUrl: string;
    let initialToken: string;
    if (account === "personal") {
      pickerUrl = "https://onedrive.live.com/picker";
      initialToken = await tokenFor(session, PERSONAL_SCOPE, popup);
    } else {
      const origin = await sharePointOrigin(session, popup);
      pickerUrl = `${origin}/_layouts/15/FilePicker.aspx`;
      initialToken = await tokenFor(session, `${origin}/.default`, popup);
    }

    const channelId = base64Url(crypto.getRandomValues(new Uint8Array(12)));
    const pickerOptions = {
      sdk: "8.0",
      entry: { oneDrive: { files: {} } },
      authentication: {},
      messaging: { origin: window.location.origin, channelId },
      selection: { mode: options.multiple ? "multiple" : "single" },
      typesAndSources: {
        mode: "files",
        filters: extensionsFor(options.mediaType),
        pivots: { oneDrive: true, recent: true },
      },
    };
    const query = new URLSearchParams({ filePicker: JSON.stringify(pickerOptions) });
    if (popup.closed) throw new PickerCancelled();
    loadPicker(popup, `${pickerUrl}?${query.toString()}`, initialToken);

    return await new Promise<ImportSourceItem[]>((resolve, reject) => {
      let port: MessagePort | null = null;

      const cleanup = () => {
        window.clearInterval(closedTimer);
        window.removeEventListener("message", onWindowMessage);
        port?.removeEventListener("message", onPortMessage);
        port?.close();
      };

      const closedTimer = window.setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new PickerCancelled());
        }
      }, 500);

      const reply = (id: string | undefined, data: unknown) =>
        port?.postMessage({ type: "result", id, data });

      const onPortMessage = async (event: MessageEvent<PortMessage>) => {
        const message = event.data;
        if (message?.type !== "command" || !message.data) return;
        port?.postMessage({ type: "acknowledge", id: message.id });
        const command = message.data;

        switch (command.command) {
          case "authenticate": {
            try {
              const token = await tokenFor(
                session,
                scopeForResource(session, command.resource),
              );
              reply(message.id, { result: "token", token });
            } catch (error) {
              reply(message.id, {
                result: "error",
                error: {
                  code: "unableToObtainToken",
                  message: error instanceof Error ? error.message : "No token",
                },
              });
            }
            break;
          }
          case "close":
            cleanup();
            popup.close();
            reject(new PickerCancelled());
            break;
          case "pick": {
            reply(message.id, { result: "success" });
            cleanup();
            popup.close();
            try {
              resolve(await resolvePicked(session, command.items ?? [], options));
            } catch (error) {
              reject(error);
            }
            break;
          }
          default:
            reply(message.id, {
              result: "error",
              error: { code: "unsupportedCommand", message: command.command },
              isExpected: true,
            });
        }
      };

      const onWindowMessage = (event: MessageEvent) => {
        if (event.source !== popup) return;
        const message = event.data as { type?: string; channelId?: string };
        if (message?.type === "initialize" && message.channelId === channelId) {
          port = event.ports[0] ?? null;
          if (!port) return;
          port.addEventListener("message", onPortMessage);
          port.start();
          port.postMessage({ type: "activate" });
        }
      };

      window.addEventListener("message", onWindowMessage);
    });
  } catch (error) {
    if (!popup.closed) popup.close();
    if (error instanceof TokenError) {
      // A stale session: forget it so the next try signs in fresh.
      delete sessions[account];
    }
    throw error;
  }
}
