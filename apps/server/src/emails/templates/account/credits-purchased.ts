import {
  accountFooter,
  appUrl,
  button,
  detailsTable,
  detailsText,
  heading,
  layout,
  paragraph,
  type RenderedEmail,
} from "../../layout";
import { fmtAmount, fmtDateTime, fmtNumber } from "../../format";

export interface CreditsPurchasedInput {
  email: string;
  credits: number;
  amountCents?: number | null;
  currency?: string | null;
  /** Stripe Checkout session id, shown as the reference. */
  reference: string;
  purchasedAt: Date;
}

/** Receipt for a one-time credit top-up. */
export function creditsPurchasedEmail(input: CreditsPurchasedInput): RenderedEmail {
  const credits = fmtNumber(input.credits);
  const rows: [string, string | null][] = [
    ["Credits", credits],
    [
      "Paid",
      input.amountCents != null && input.currency
        ? fmtAmount(input.amountCents, input.currency, true)
        : null,
    ],
    ["Date", fmtDateTime(input.purchasedAt)],
    ["Reference", input.reference],
  ];
  const url = appUrl("/scheduler/new");

  const html = layout({
    preheader: `${credits} credits were added to your account.`,
    content: [
      heading(`${credits} credits added`),
      paragraph("Thanks for your purchase. Top-up credits never expire and are used after your plan's monthly credits."),
      detailsTable(rows),
      button("Create something", url),
    ].join("\n"),
    footer: accountFooter(input.email),
  });

  const text = [
    `${credits} credits were added to your Unsora account.`,
    "Top-up credits never expire and are used after your plan's monthly credits.",
    "",
    detailsText(rows),
  ].join("\n");

  return { subject: `${credits} Unsora credits added`, html, text };
}
