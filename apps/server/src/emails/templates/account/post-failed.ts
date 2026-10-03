import {
  accountFooter,
  appUrl,
  button,
  escapeHtml,
  heading,
  layout,
  paragraph,
  quote,
  strong,
  truncate,
  BRAND,
  type RenderedEmail,
} from "../../layout";
import { platformName } from "../../format";

export interface PostFailedTarget {
  accountName: string | null;
  provider: string;
  /** Present when this account failed. */
  error?: string | null;
}

export interface PostFailedInput {
  email: string;
  postId: string;
  caption: string;
  /** Every target account; the ones with `error` failed. */
  targets: PostFailedTarget[];
}

/** One row per account: name and platform, then the error in red if it failed. */
function targetRows(targets: PostFailedTarget[]): string {
  const rows = targets
    .map((t) => {
      const who = `${escapeHtml(t.accountName || platformName(t.provider))} <span style="color:${BRAND.muted};">· ${escapeHtml(platformName(t.provider))}</span>`;
      const state = t.error
        ? `<div style="margin-top:2px;font-size:13px;line-height:1.5;color:${BRAND.danger};">${escapeHtml(truncate(t.error, 300))}</div>`
        : `<div style="margin-top:2px;font-size:13px;color:${BRAND.muted};">Published</div>`;
      return `<tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.text};">${who}${state}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;">${rows}</table>`;
}

/**
 * Sent when publishing ends with at least one failed account: the whole post
 * failed, or it published to some accounts only.
 */
export function postFailedEmail(input: PostFailedInput): RenderedEmail {
  const failed = input.targets.filter((t) => t.error);
  const partial = failed.length < input.targets.length;
  const url = appUrl(`/scheduler/posts/${encodeURIComponent(input.postId)}`);
  const caption = input.caption.trim();

  const title = partial
    ? `Your post didn't publish to ${failed.length === 1 ? "one account" : `${failed.length} accounts`}`
    : "Your post didn't publish";
  const lead = partial
    ? `Your post went out to ${strong(String(input.targets.length - failed.length))} of ${strong(String(input.targets.length))} accounts. The rest failed:`
    : "We couldn't publish your post to any of its accounts:";

  const html = layout({
    preheader: failed[0]?.error ? truncate(failed[0].error, 120) : title,
    content: [
      heading(title),
      caption ? quote(truncate(caption, 280)) : "",
      paragraph(lead),
      targetRows(input.targets),
      paragraph("Fix what the error describes (often reconnecting the account or changing the media), then retry. Accounts that already published are never posted twice."),
      button("Open the post", url),
    ].join("\n"),
    footer: accountFooter(input.email),
  });

  const text = [
    title,
    "",
    caption ? `"${truncate(caption, 280)}"` : "",
    "",
    ...input.targets.map(
      (t) =>
        `- ${t.accountName || platformName(t.provider)} (${platformName(t.provider)}): ${t.error ? `FAILED: ${truncate(t.error, 300)}` : "published"}`,
    ),
    "",
    "Fix what the error describes, then retry. Accounts that already published are never posted twice.",
    `Open the post: ${url}`,
  ].join("\n");

  return { subject: title, html, text };
}
