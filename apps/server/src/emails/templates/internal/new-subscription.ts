import {
  detailsTable,
  detailsText,
  heading,
  INTERNAL_FOOTER,
  layout,
  type RenderedEmail,
} from "../../layout";
import { fmtAmount, fmtDateTime } from "../../format";

export interface NewSubscriptionInput {
  userId: string;
  email: string;
  name?: string | null;
  planName: string;
  kind: "trial" | "paid" | "upgraded";
  amountPaidCents?: number | null;
  currency?: string | null;
  interval?: string | null;
  subscribedAt: Date;
  signupAt?: Date | null;
}

const KIND_LABEL = { trial: "Trial started", paid: "New subscription", upgraded: "Plan upgrade" } as const;

/** Team notice when a trial or paid subscription starts. */
export function newSubscriptionEmail(input: NewSubscriptionInput): RenderedEmail {
  const label = KIND_LABEL[input.kind];
  const paid =
    input.amountPaidCents != null && input.currency
      ? `${fmtAmount(input.amountPaidCents, input.currency, true)}${input.interval ? ` / ${input.interval}` : ""}`
      : null;
  const rows: [string, string | null | undefined][] = [
    ["Email", input.email],
    ["Name", input.name],
    ["Plan", input.planName],
    ["Paid", paid],
    ["When", fmtDateTime(input.subscribedAt)],
    ["Signed up", input.signupAt ? fmtDateTime(input.signupAt) : null],
    ["User id", input.userId],
  ];

  const html = layout({
    preheader: `${input.email} · ${input.planName}`,
    content: [heading(label), detailsTable(rows)].join("\n"),
    footer: INTERNAL_FOOTER,
  });

  return {
    subject: `${label}: ${input.planName} · ${input.email}`,
    html,
    text: `${label}\n\n${detailsText(rows)}`,
  };
}
