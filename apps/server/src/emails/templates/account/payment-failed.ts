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
  /** Which subscription failed. Defaults to the scheduler plan. */
  product?: "scheduler" | "credits";
}

/**
 * Sent on the first failed subscription charge. Stripe keeps retrying, and
 * the subscription stays until the retries run out: a scheduler plan can't
 * post meanwhile (requirePaidPlan), and Monthly credits don't renew until an
 * invoice is paid (credit-subscription.service).
 */
export function paymentFailedEmail(input: PaymentFailedInput): RenderedEmail {
  const amount = fmtAmount(input.amountCents, input.currency);
  const url = appUrl("/billing");
  const credits = input.product === "credits";
  const what = credits
    ? `your ${input.planName} monthly credits`
    : `your ${input.planName} plan`;
  const effect = credits
    ? "Your monthly credits won't renew until it goes through. Credits already in your account still work."
    : "Posting is paused until it goes through. Your plan, accounts and scheduled posts are kept.";

  const html = layout({
    preheader: `We couldn't charge ${amount} for ${what}.`,
    content: [
      heading("Your payment didn't go through"),
      paragraph(`We couldn't charge ${strong(amount)} for ${what}. ${effect}`),
      paragraph("We'll retry the charge automatically. Update your card in Billing to fix it now."),
      button("Update card", url),
    ].join("\n"),
    footer: accountFooter(input.email),
  });

  const text = [
    `We couldn't charge ${amount} for ${what}. ${effect}`,
    "We'll retry the charge automatically. Update your card in Billing to fix it now.",
    "",
    `Update card: ${url}`,
  ].join("\n");

  return { subject: "Your Unsora payment didn't go through", html, text };
}
