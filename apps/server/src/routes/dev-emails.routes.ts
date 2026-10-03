/**
 * Dev-only email preview (mounted only when NODE_ENV !== "production"):
 *   GET /dev/emails            index of every template, grouped
 *   GET /dev/emails/:id        the rendered HTML, as a recipient sees it
 *   GET /dev/emails/:id?text   the plain-text version
 * Templates render with the sample data in emails/catalog.ts; nothing is sent.
 */
import { Router, type Request, type Response } from "express";
import { EMAIL_CATALOG } from "../emails/catalog";
import { escapeHtml } from "../emails/layout";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const groups = ["Account", "Internal"] as const;
  const sections = groups
    .map((group) => {
      const rows = EMAIL_CATALOG.filter((e) => e.group === group)
        .map((entry) => {
          const { subject } = entry.render();
          return `<tr>
  <td><a href="/dev/emails/${entry.id}">${escapeHtml(entry.id)}</a></td>
  <td>${escapeHtml(subject)}</td>
  <td class="muted">${escapeHtml(entry.trigger)}</td>
  <td><a href="/dev/emails/${entry.id}?text">text</a></td>
</tr>`;
        })
        .join("");
      return `<h2>${group === "Account" ? "To users" : "To the team"}</h2>
<table><thead><tr><th>Template</th><th>Subject</th><th>Sent when</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Unsora emails</title>
<style>
  body { font: 14px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 40px auto; padding: 0 16px; color: #111; }
  h1 { font-size: 22px; } h2 { font-size: 15px; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
  th { color: #71717a; font-weight: 500; }
  .muted { color: #71717a; } a { color: #111; }
</style></head>
<body><h1>Unsora emails</h1>
<p class="muted">Every email the server sends, rendered with sample data from <code>src/emails/catalog.ts</code>. Nothing is sent from this page.</p>
${sections}
</body></html>`);
});

router.get("/:id", (req: Request, res: Response) => {
  const entry = EMAIL_CATALOG.find((e) => e.id === req.params.id);
  if (!entry) return res.status(404).send("Unknown email template");
  const email = entry.render();
  if ("text" in req.query) {
    return res.type("text/plain").send(`Subject: ${email.subject}\n\n${email.text}`);
  }
  return res.type("html").send(email.html);
});

export default router;
