/**
 * Shared look for every Unsora email: brand tokens, the page shell and small
 * building blocks (heading, paragraph, button, details table).
 *
 * Email-client rules this file follows (Gmail, Outlook, Apple Mail):
 *   - table layout only, no flexbox/grid;
 *   - every style inline, since Gmail strips <style> blocks;
 *   - absolute https links only;
 *   - no images needed to understand the email (clients block them).
 */

/** Neutral palette, matching the app. */
export const BRAND = {
  text: "#111111",
  body: "#3f3f46",
  muted: "#71717a",
  faint: "#a1a1aa",
  border: "#e4e4e7",
  page: "#f4f4f5",
  card: "#ffffff",
  button: "#111111",
  buttonText: "#ffffff",
  danger: "#b91c1c",
  font: "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

/**
 * One rendered email. Plunk builds its own plain-text part from the HTML;
 * `text` is kept for the dev preview and tests.
 */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute link into the web app, e.g. appUrl("/billing"). */
export function appUrl(path = "/"): string {
  const base = (process.env.CLIENT_URL ?? "https://app.tryunsora.com").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:600;color:${BRAND.text};">${escapeHtml(text)}</h1>`;
}

/** A paragraph. `html` is trusted markup: escape user values before passing. */
export function paragraph(
  html: string,
  opts: { muted?: boolean; small?: boolean; last?: boolean } = {},
): string {
  const size = opts.small ? 13 : 15;
  const color = opts.muted ? BRAND.muted : BRAND.body;
  const margin = opts.last ? 0 : 14;
  return `<p style="margin:0 0 ${margin}px;font-size:${size}px;line-height:1.6;color:${color};">${html}</p>`;
}

/** Bold inline value, escaped. */
export function strong(text: string): string {
  return `<strong style="color:${BRAND.text};">${escapeHtml(text)}</strong>`;
}

/** Call-to-action button (table-wrapped so Outlook renders it). */
export function button(label: string, href: string): string {
  const url = escapeHtml(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
  <tr>
    <td style="border-radius:10px;background-color:${BRAND.button};">
      <a href="${url}" style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:600;color:${BRAND.buttonText};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/** Bulleted list of plain-text items. */
export function list(items: string[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:0 10px 8px 0;vertical-align:top;color:${BRAND.muted};font-size:15px;line-height:1.6;">&bull;</td><td style="padding:0 0 8px;font-size:15px;line-height:1.6;color:${BRAND.body};">${escapeHtml(item)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">${rows}</table>`;
}

/** Label/value rows. Empty values show an em dash. */
export function detailsTable(rows: [string, string | null | undefined][]): string {
  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:${BRAND.muted};white-space:nowrap;vertical-align:top;font-size:14px;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${BRAND.text};font-size:14px;">${value ? escapeHtml(value) : "&mdash;"}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14px;">${body}</table>`;
}

/** Plain-text version of detailsTable. */
export function detailsText(rows: [string, string | null | undefined][]): string {
  return rows.map(([label, value]) => `${label}: ${value || "-"}`).join("\n");
}

/** Quoted block of user-written text (captions), escaped. */
export function quote(text: string): string {
  return `<div style="margin:0 0 14px;padding:12px 14px;border-left:3px solid ${BRAND.border};background-color:${BRAND.page};font-size:14px;line-height:1.6;color:${BRAND.text};white-space:pre-wrap;">${escapeHtml(text)}</div>`;
}

/** Text cut to `max` characters with an ellipsis. */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The page shell: wordmark, white card with `content`, footer note.
 * `preheader` is the grey preview line inboxes show after the subject.
 */
export function layout(opts: { preheader: string; content: string; footer: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.page};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.page};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
            <tr>
              <td style="padding:0 8px 18px;font-family:${BRAND.font};">
                <img src="${appUrl("/brand/icon-tile-180.png")}" width="26" height="26" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:7px;margin-right:8px;" /><span style="vertical-align:middle;font-size:19px;font-weight:700;letter-spacing:-0.02em;color:${BRAND.text};">Unsora</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;padding:32px 32px 28px;font-family:${BRAND.font};">
                ${opts.content}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 8px 0;font-family:${BRAND.font};">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.faint};">${opts.footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Standard footer for account emails sent to a user. */
export function accountFooter(email: string): string {
  return `You're receiving this because you have an Unsora account (${escapeHtml(email)}). Questions? Just reply to this email.`;
}

/** Footer for internal notifications to the team. */
export const INTERNAL_FOOTER = "Internal notification from the Unsora server.";
