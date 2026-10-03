/*
  Shared runtime for the Unsora MCP widgets (MCP Apps, SEP-1865). Inlined into
  each widget at load time (see loadWidget in src/tools/index.ts).

  A small JSON-RPC bridge over postMessage covers the spec methods the widgets
  use: ui/initialize, tools/call, ui/message, ui/open-link, ui/download-file and
  ui/notifications/size-changed. Plus DOM, formatting and platform helpers.
*/
const Kit = (() => {
  "use strict";

  /* ------------------------------ bridge ------------------------------ */

  let nextId = 1;
  const pending = new Map();
  let hostCaps = {};
  const listeners = { input: [], result: [], cancelled: [], teardown: [] };

  function post(msg) { window.parent.postMessage({ jsonrpc: "2.0", ...msg }, "*"); }

  function request(method, params) {
    const id = nextId++;
    post({ id, method, params });
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  function notify(method, params) { post({ method, params }); }

  /** on("input" | "result" | "cancelled" | "teardown", fn) */
  function on(event, fn) { listeners[event].push(fn); }
  function emit(event, value) { for (const fn of listeners[event]) fn(value); }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;

    if (msg.id != null && !msg.method) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message || "Request failed")) : p.resolve(msg.result);
      return;
    }
    if (msg.id != null && msg.method) {
      if (msg.method === "ui/resource-teardown" || msg.method === "ping") {
        if (msg.method === "ui/resource-teardown") emit("teardown");
        post({ id: msg.id, result: {} });
      } else {
        post({ id: msg.id, error: { code: -32601, message: "Method not found" } });
      }
      return;
    }
    const params = msg.params || {};
    switch (msg.method) {
      case "ui/notifications/tool-input": emit("input", params.arguments || {}); break;
      case "ui/notifications/tool-result": emit("result", params); break;
      case "ui/notifications/tool-cancelled": emit("cancelled", params); break;
      case "ui/notifications/host-context-changed": applyHostContext(params); break;
    }
  });

  function applyHostContext(ctx) {
    if (!ctx) return;
    const root = document.documentElement;
    if (ctx.theme) root.dataset.theme = ctx.theme;
    const vars = ctx.styles && ctx.styles.variables;
    if (vars) for (const [k, v] of Object.entries(vars)) if (v) root.style.setProperty(k, v);
  }

  // Report our height so the host sizes the frame exactly (no inner scroll).
  let lastHeight = 0;
  new ResizeObserver(() => {
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height !== lastHeight) {
      lastHeight = height;
      notify("ui/notifications/size-changed", { height });
    }
  }).observe(document.documentElement);

  /** Handshake with the host. Resolves once the host knows we're ready. */
  async function init(name) {
    try {
      const res = await request("ui/initialize", {
        appInfo: { name, version: "1.0.0" },
        appCapabilities: {},
        protocolVersion: "2026-01-26",
      });
      hostCaps = (res && res.hostCapabilities) || {};
      applyHostContext(res && res.hostContext);
    } catch (err) { /* old host: carry on without context */ }
    notify("ui/notifications/initialized", {});
  }

  /**
   * Call a server tool and return its structuredContent. Throws with the
   * tool's own message when it reports an error.
   */
  async function callTool(name, args) {
    const res = await request("tools/call", { name, arguments: args || {} });
    const sc = (res && res.structuredContent) || null;
    if (!res || res.isError) {
      throw new Error((sc && (sc.error || sc.message)) || textOf(res) || "Something went wrong.");
    }
    return sc;
  }

  /** First text block of a tool result, trimmed. */
  function textOf(result) {
    const block = result && Array.isArray(result.content) && result.content.find((c) => c.type === "text");
    if (!block) return "";
    const text = String(block.text);
    // Error results usually carry the API error as JSON: surface its message.
    try {
      const parsed = JSON.parse(text);
      const msg = parsed && (parsed.error && (parsed.error.message || parsed.error)) || parsed.message;
      if (typeof msg === "string") return msg;
    } catch (err) { /* plain text */ }
    return text.slice(0, 300);
  }

  /** Post a user message into the chat; the model drives the follow-up. */
  async function sendPrompt(text) {
    try {
      const res = await request("ui/message", { role: "user", content: [{ type: "text", text }] });
      return !(res && res.isError);
    } catch (err) {
      return false;
    }
  }

  /** Web app base URL, filled in by the server when it serves the widget. */
  const APP_URL = "__UNSORA_APP_URL__";

  /** Open a page of the Unsora web app, e.g. appLink("/billing"). */
  function appLink(path) { return openLink(APP_URL + path); }

  async function openLink(url) {
    try { await request("ui/open-link", { url }); }
    catch (err) { window.open(url, "_blank", "noopener"); }
  }

  async function download(url, name) {
    try {
      if (hostCaps.downloadFile) {
        const res = await request("ui/download-file", {
          contents: [{ type: "resource_link", uri: url, name: name || fileName(url) }],
        });
        if (!res || !res.isError) return;
      }
    } catch (err) { /* fall back to opening the link */ }
    await openLink(url);
  }

  function fileName(url) {
    try { return decodeURIComponent(new URL(url).pathname.split("/").pop()) || "unsora-file"; }
    catch (err) { return "unsora-file"; }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (err) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      area.remove();
      return ok;
    }
  }

  /* -------------------------------- DOM ------------------------------- */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "class") node.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else if (k === "value" || k === "checked" || k === "selected") node[k] = v;
      else if (v === true) node.setAttribute(k, "");
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const child of [].concat(children == null ? [] : children)) {
      if (child != null && child !== false) node.append(child);
    }
    return node;
  }

  /**
   * Re-render helper: `mount(view)` re-runs view() into #root on every
   * `refresh()`. Keeps the focused input (and its caret) across renders.
   */
  const root = document.getElementById("root");
  let viewFn = () => null;

  function mount(view) { viewFn = view; refresh(); }

  function refresh() {
    const active = document.activeElement;
    const key = active && active.dataset && active.dataset.key;
    const caret = key && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
    root.replaceChildren(viewFn() || "");
    if (key) {
      const next = root.querySelector('[data-key="' + CSS.escape(key) + '"]');
      if (next) {
        next.focus();
        if (caret && "setSelectionRange" in next) {
          try { next.setSelectionRange(caret[0], caret[1]); } catch (err) { /* not a text input */ }
        }
      }
    }
  }

  const flashes = {};

  /** Show `label` on the button with this key for two seconds. */
  function flash(key, label) {
    flashes[key] = label;
    refresh();
    setTimeout(() => { delete flashes[key]; refresh(); }, 2000);
  }

  /** button(label, onclick, { key, primary, danger, sm, disabled, title }) */
  function button(label, onclick, opts) {
    const o = opts || {};
    const key = o.key || label;
    const classes = [o.primary && "primary", o.danger && "danger", o.sm && "sm", o.link && "link"].filter(Boolean);
    return el("button", {
      type: "button",
      class: classes.join(" "),
      disabled: !!o.disabled,
      title: o.title || null,
      onclick,
    }, flashes[key] || label);
  }

  function spinnerCard(label, hint) {
    return el("div", { class: "card pending", role: "status" }, [
      el("span", { class: "spinner", "aria-hidden": "true" }),
      el("strong", null, label),
      hint ? el("span", { class: "muted" }, hint) : null,
    ]);
  }

  function errorCard(message, retry) {
    return el("div", { class: "card stack" }, [
      el("div", { class: "error" }, message),
      retry ? el("div", { class: "actions" }, button("Try again", retry)) : null,
    ]);
  }

  /* ----------------------------- formatting --------------------------- */

  function toDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  /** "Tue, Oct 7 · 3:30 PM" (in the viewer's timezone). */
  function fmtDateTime(value) {
    const d = toDate(value);
    if (!d) return "";
    const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return date + " · " + time;
  }

  function fmtDate(value) {
    const d = toDate(value);
    return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  }

  /** "in 3 hours", "2 days ago". */
  function relTime(value) {
    const d = toDate(value);
    if (!d) return "";
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const units = [["year", 31536e6], ["month", 2592e6], ["week", 6048e5], ["day", 864e5], ["hour", 36e5], ["minute", 6e4]];
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    for (const [unit, ms] of units) {
      if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
    }
    return diff >= 0 ? "in a moment" : "just now";
  }

  /** 1234 -> "1.2K". */
  function fmtNum(n) {
    const v = Number(n);
    if (!isFinite(v)) return "0";
    return new Intl.NumberFormat(undefined, { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
  }

  function plural(n, word, many) { return n + " " + (n === 1 ? word : many || word + "s"); }

  function str(v) { return typeof v === "string" && v.trim() ? v : null; }
  function num(v) { const n = Number(v); return v != null && v !== "" && isFinite(n) ? n : null; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }

  /** The payload under `data` when the API wrapped it, else the value itself. */
  function unwrap(v) {
    const o = obj(v);
    return "data" in o && o.data != null ? o.data : v;
  }

  /* ------------------------------ platforms --------------------------- */

  const PLATFORMS = {
    youtube: { label: "YouTube", short: "YT", color: "#e62117" },
    tiktok: { label: "TikTok", short: "TT", color: "#111111" },
    instagram: { label: "Instagram", short: "IG", color: "#d6249f" },
    facebook: { label: "Facebook", short: "f", color: "#1877f2" },
    linkedin: { label: "LinkedIn", short: "in", color: "#0a66c2" },
    pinterest: { label: "Pinterest", short: "P", color: "#e60023" },
    threads: { label: "Threads", short: "@", color: "#222222" },
    bluesky: { label: "Bluesky", short: "B", color: "#1185fe" },
    x: { label: "X", short: "X", color: "#000000" },
  };

  /** Provider string from the API -> platform key ("google" is YouTube). */
  function platformOf(provider) {
    const p = String(provider || "").toLowerCase();
    if (p === "google" || p === "youtube") return "youtube";
    if (p === "twitter") return "x";
    return PLATFORMS[p] ? p : p || "unknown";
  }

  function platformMeta(provider) {
    const key = platformOf(provider);
    return PLATFORMS[key] || { label: provider ? String(provider) : "Account", short: "?", color: "#777777" };
  }

  function pfMark(provider, large) {
    const meta = platformMeta(provider);
    return el("span", {
      class: "pf" + (large ? " lg" : ""),
      style: { background: meta.color },
      title: meta.label,
      "aria-label": meta.label,
    }, meta.short);
  }

  /** Account avatar with its platform mark in the corner. */
  function avatar(account) {
    const name = account.name || account.username || "?";
    const img = account.avatarUrl
      ? el("img", { src: account.avatarUrl, alt: "", loading: "lazy", referrerpolicy: "no-referrer", onerror: (e) => e.target.replaceWith(fallback()) })
      : fallback();
    function fallback() { return el("div", { class: "fallback" }, name.replace(/^@/, "").slice(0, 1).toUpperCase()); }
    return el("div", { class: "avatar" }, [img, pfMark(account.provider)]);
  }

  /** Normalize an account record from /accounts (or a post's target). */
  function readAccount(raw) {
    const a = obj(raw);
    const nested = obj(a.account || a.socialAccount);
    const pick = (...keys) => {
      for (const k of keys) {
        const v = str(a[k]) || str(nested[k]);
        if (v) return v;
      }
      return null;
    };
    return {
      id: pick("id", "accountId", "socialAccountId"),
      provider: pick("provider", "platform", "type"),
      name: pick("accountName", "displayName", "name", "accountUsername", "username", "handle"),
      username: pick("accountUsername", "username", "handle", "login"),
      avatarUrl: pick("avatarUrl", "avatar", "profilePicture", "profileImageUrl", "pictureUrl", "image", "picture"),
    };
  }

  return {
    on, init, request, notify, callTool, textOf, sendPrompt, openLink, appLink, download, copyText, fileName,
    el, mount, refresh, flash, button, spinnerCard, errorCard,
    toDate, fmtDateTime, fmtDate, relTime, fmtNum, plural, str, num, arr, obj, unwrap,
    PLATFORMS, platformOf, platformMeta, pfMark, avatar, readAccount,
    get hostCaps() { return hostCaps; },
  };
})();
