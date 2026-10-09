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

  /*
   * `icon` is a 24x24 brand glyph path from Simple Icons (CC0,
   * simpleicons.org; LinkedIn from v11.0.0). Platforms without one show
   * `short` as text instead.
   */
  const PLATFORMS = {
    youtube: { label: "YouTube", short: "YT", color: "#e62117", icon: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
    tiktok: { label: "TikTok", short: "TT", color: "#111111", icon: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
    instagram: { label: "Instagram", short: "IG", color: "#d6249f", icon: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" },
    facebook: { label: "Facebook", short: "f", color: "#1877f2", icon: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" },
    linkedin: { label: "LinkedIn", short: "in", color: "#0a66c2", icon: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
    pinterest: { label: "Pinterest", short: "P", color: "#e60023", icon: "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" },
    threads: { label: "Threads", short: "@", color: "#222222", icon: "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" },
    bluesky: { label: "Bluesky", short: "B", color: "#1185fe", icon: "M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026" },
    x: { label: "X", short: "X", color: "#000000", icon: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" },
    google_business: { label: "Google Business", short: "G", color: "#1a73e8" },
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
      role: "img",
      title: meta.label,
      "aria-label": meta.label,
    }, meta.icon ? pfIcon(meta.icon) : meta.short);
  }

  /** Brand glyph as inline SVG (el() builds HTML nodes, so no <svg> there). */
  function pfIcon(d) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    svg.append(p);
    return svg;
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
