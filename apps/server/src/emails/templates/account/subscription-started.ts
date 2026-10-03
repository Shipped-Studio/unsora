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
import { fmtDate, fmtNumber } from "../../format";

export interface SubscriptionStartedInput {
  email: string;
  planName: string;
  /** Credits granted for this period. */
  credits: number;
  /** trial = free trial began; paid = first paid period; upgraded = moved to a bigger plan. */
  kind: "trial" | "paid" | "upgraded";
  /** When the trial converts to paid (trial only). */
  trialEndsAt?: Date | null;
}

/** Sent when a subscription starts (first invoice of a new subscription). */
export function subscriptionStartedEmail(input: SubscriptionStartedInput): RenderedEmail {
  const plan = input.planName;
  const credits = fmtNumber(input.credits);
  const url = appUrl("/scheduler/new");

  let title: string;
  let lead: string;
  if (input.kind === "trial") {
    const until = input.trialEndsAt ? ` until ${fmtDate(input.trialEndsAt)}` : "";
    title = `Your ${plan} trial has started`;
    lead = `You're on the ${strong(plan)} plan free${until}, with ${strong(credits)} credits to use. You can cancel any time before then from Billing.`;
  } else if (input.kind === "upgraded") {
    title = `You're now on ${plan}`;
    lead = `Your plan changed to ${strong(plan)}. Your credits for this period, including what was left on your old plan, are now ${strong(credits)}.`;
  } else {
    title = `Welcome to ${plan}`;
    lead = `Your ${strong(plan)} subscription is active, with ${strong(credits)} credits for this billing period.`;
  }

  const html = layout({
    preheader: `${title}. ${credits} credits are ready to use.`,
    content: [
      heading(title),
      paragraph(lead),
      paragraph("Scheduling and publishing to all your connected accounts is unlocked."),
      button("Create a post", url),
      paragraph(`Manage your plan any time from <a href="${appUrl("/billing")}" style="color:inherit;">Billing</a>.`, {
        muted: true,
        small: true,
        last: true,
      }),
    ].join("\n"),
    footer: accountFooter(input.email),
  });

  const text = [
    title,
    "",
    lead.replace(/<[^>]+>/g, ""),
    "Scheduling and publishing to all your connected accounts is unlocked.",
    "",
    `Create a post: ${url}`,
    `Billing: ${appUrl("/billing")}`,
  ].join("\n");

  return { subject: title, html, text };
}
