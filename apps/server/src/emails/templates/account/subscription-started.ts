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
  /**
   * Credits the plan itself adds each period. 0 on the account-based plans,
   * whose credits come from top-ups; `credits` is then only what an upgrade
   * carried over from an older plan.
   */
  planCredits?: number;
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
  // Account-based plans include no credits: say what they unlock instead.
  const topUpOnly = input.planCredits === 0;
  const withCredits = input.credits > 0 && !topUpOnly ? `, with ${strong(credits)} credits to use` : "";

  let title: string;
  let lead: string;
  if (input.kind === "trial") {
    const until = input.trialEndsAt ? ` until ${fmtDate(input.trialEndsAt)}` : "";
    title = `Your ${plan} trial has started`;
    lead = `You're on the ${strong(plan)} plan free${until}${withCredits}. You can cancel any time before then from Billing.`;
  } else if (input.kind === "upgraded") {
    title = `You're now on ${plan}`;
    lead = topUpOnly
      ? `Your plan changed to ${strong(plan)}. The ${strong(credits)} credits you had stay with you.`
      : `Your plan changed to ${strong(plan)}. Your credits for this period, including what was left on your old plan, are now ${strong(credits)}.`;
  } else {
    title = `Welcome to ${plan}`;
    lead = `Your ${strong(plan)} subscription is active${withCredits ? `${withCredits} this billing period` : ""}.`;
  }
  const extra = topUpOnly
    ? "Need credits for clipping and creating? Buy a top-up from Billing. They never expire."
    : null;

  const html = layout({
    preheader: input.credits > 0 ? `${title}. ${credits} credits are ready to use.` : `${title}.`,
    content: [
      heading(title),
      paragraph(lead),
      paragraph("Scheduling and publishing to all your connected accounts is unlocked."),
      ...(extra ? [paragraph(extra)] : []),
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
    ...(extra ? [extra] : []),
    "",
    `Create a post: ${url}`,
    `Billing: ${appUrl("/billing")}`,
  ].join("\n");

  return { subject: title, html, text };
}
