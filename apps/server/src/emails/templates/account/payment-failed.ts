import {
  accountFooter,
  appUrl,
  button,
  heading,
  layout,
  paragraph,
  strong,
  type RenderedEmail,
} from "../../layout";
import { fmtAmount } from "../../format";

export interface PaymentFailedInput {
  email: string;
  planName: string;
  amountCents: number;
  currency: string;
}

/**
 * Sent on the first failed subscription charge. The server moves the account
 * to the free plan straight away (stripe.controller), so the copy says so.
 */
export function paymentFailedEmail(input: PaymentFailedInput): RenderedEmail {
  const amount = fmtAmount(input.amountCents, input.currency);
  const url = appUrl("/billing");

  const html = layout({
    preheader: `We couldn't charge ${amount} for your ${input.planName} plan.`,
    content: [
      heading("Your payment didn't go through"),
      paragraph(
        `We couldn't charge ${strong(amount)} for your ${strong(input.planName)} plan, so your account is on the free plan for now. Scheduled posts won't publish until your plan is active again.`,
      ),
      paragraph("Update your card or choose a plan again in Billing to pick up where you left off."),
      button("Update billing", url),
    ].join("\n"),
    footer: accountFooter(input.email),
  });

  const text = [
    `We couldn't charge ${amount} for your ${input.planName} plan, so your Unsora account is on the free plan for now. Scheduled posts won't publish until your plan is active again.`,
    "Update your card or choose a plan again in Billing to pick up where you left off.",
    "",
    `Update billing: ${url}`,
  ].join("\n");

  return { subject: "Your Unsora payment didn't go through", html, text };
}
