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
import { fmtNumber } from "../../format";

export interface LowCreditsInput {
  email: string;
  /** Balance right after the spend that crossed the threshold. */
  balance: number;
}

/** Sent once when a spend takes the balance below the low-credit line. */
export function lowCreditsEmail(input: LowCreditsInput): RenderedEmail {
  const billing = appUrl("/billing");
  const left = fmtNumber(input.balance);

  const html = layout({
    preheader: `You have ${left} credits left.`,
    content: [
      heading("You're running low on credits"),
      paragraph(`You have ${strong(left)} credits left on your account.`),
      paragraph(
        "Generations stop when you run out. Plan credits refresh at the start of your next billing period; to keep going before then, top up or move to a bigger plan from Billing. Scheduling and publishing posts don't use credits.",
      ),
      button("Get more credits", billing),
    ].join("\n"),
    footer: accountFooter(input.email),
  });

  const text = [
    `You have ${left} credits left on your Unsora account.`,
    "Generations stop when you run out. Plan credits refresh at the start of your next billing period; to keep going before then, top up or move to a bigger plan from Billing. Scheduling and publishing posts don't use credits.",
    "",
    `Get more credits: ${billing}`,
  ].join("\n");

  return { subject: `You have ${left} Unsora credits left`, html, text };
}
