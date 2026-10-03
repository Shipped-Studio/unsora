/**
 * Every email Unsora sends, as one function per product event.
 *
 *   emails/
 *     index.ts            ← this file: the only import callers need
 *     send.ts             Plunk client, team inboxes, best-effort sending
 *     layout.ts           brand, page shell and building blocks
 *     format.ts           dates, money, numbers, platform names
 *     clerk-profile.ts    name / signup method lookup for email copy
 *     catalog.ts          sample data for every template (dev preview + tests)
 *     templates/account/  emails to users
 *     templates/internal/ notifications to the team
 *
 * Event functions are fire-and-forget safe (`void onNewSignup(...)`): they
 * log failures and never throw, so a mail outage can't break a webhook, a
 * signup, a generation or a publish. With PLUNK_SECRET_KEY unset they do
 * nothing, so local dev and self-hosted installs send no mail by default.
 *
 * To add an email: write a template in templates/, add an event function
 * here, and add a sample to catalog.ts so it shows up in the preview.
 */
import prisma from "../lib/db";
import { fetchClerkProfile, signupMethodFromProviders } from "./clerk-profile";
import { INBOXES, sendSafely } from "./send";
import { welcomeEmail } from "./templates/account/welcome";
import {
  subscriptionStartedEmail,
  type SubscriptionStartedInput,
} from "./templates/account/subscription-started";
import { paymentFailedEmail, type PaymentFailedInput } from "./templates/account/payment-failed";
import { creditsPurchasedEmail } from "./templates/account/credits-purchased";
import { lowCreditsEmail } from "./templates/account/low-credits";
import { postFailedEmail, type PostFailedTarget } from "./templates/account/post-failed";
import { newSignupEmail } from "./templates/internal/new-signup";
import { newSubscriptionEmail } from "./templates/internal/new-subscription";

export { sendEmail, emailConfigured } from "./send";

/** The user's address, or null when the user is gone. */
async function emailForUser(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return user?.email ?? null;
  } catch (err) {
    console.error("[email] user lookup failed:", err);
    return null;
  }
}

// ── Account lifecycle ──────────────────────────────────────────────────────

export interface NewSignupEvent {
  userId: string;
  clerkId: string;
  email: string;
  /** Pass profile fields when known (Clerk webhook payload); else fetched. */
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  /** Raw Clerk external-account providers, e.g. ["oauth_google"]. */
  providers?: string[];
}

/** A new account was created: welcome the user, tell the team. */
export async function onNewSignup(event: NewSignupEvent): Promise<void> {
  const known = event.firstName !== undefined && event.providers !== undefined;
  const profile = known ? null : await fetchClerkProfile(event.clerkId);
  const firstName = event.firstName ?? profile?.firstName ?? null;
  const name =
    [event.firstName, event.lastName].filter(Boolean).join(" ").trim() || profile?.name || null;

  await Promise.all([
    sendSafely("welcome", event.email, () => welcomeEmail({ email: event.email, firstName }), {
      idempotencyKey: `welcome:${event.userId}`,
    }),
    sendSafely(
      "new-signup",
      INBOXES.signups(),
      () =>
        newSignupEmail({
          userId: event.userId,
          clerkId: event.clerkId,
          email: event.email,
          name,
          username: event.username ?? profile?.username ?? null,
          signupMethod: event.providers
            ? signupMethodFromProviders(event.providers)
            : (profile?.signupMethod ?? null),
          signedUpAt: new Date(),
        }),
      { fromName: "Unsora Signups", idempotencyKey: `new-signup:${event.userId}` },
    ),
  ]);
}

export interface SubscriptionStartedEvent extends Omit<SubscriptionStartedInput, "email"> {
  userId: string;
  email: string;
  /** Stripe invoice id: makes webhook retries send once. */
  invoiceId: string;
  amountPaidCents?: number | null;
  currency?: string | null;
  interval?: string | null;
  signupAt?: Date | null;
}

/** A trial, a paid subscription or a plan upgrade started: confirm it, tell the team. */
export async function onSubscriptionStarted(event: SubscriptionStartedEvent): Promise<void> {
  await Promise.all([
    sendSafely("subscription-started", event.email, () => subscriptionStartedEmail(event), {
      idempotencyKey: `subscription-started:${event.invoiceId}`,
    }),
    sendSafely(
      "new-subscription",
      INBOXES.signups(),
      () =>
        newSubscriptionEmail({
          userId: event.userId,
          email: event.email,
          planName: event.planName,
          kind: event.kind,
          amountPaidCents: event.amountPaidCents,
          currency: event.currency,
          interval: event.interval,
          subscribedAt: new Date(),
          signupAt: event.signupAt,
        }),
      { fromName: "Unsora Signups", idempotencyKey: `new-subscription:${event.invoiceId}` },
    ),
  ]);
}

/** A subscription charge failed. Call on the first failed attempt only. */
export function onPaymentFailed(event: PaymentFailedInput & { invoiceId: string }): Promise<void> {
  return sendSafely("payment-failed", event.email, () => paymentFailedEmail(event), {
    idempotencyKey: `payment-failed:${event.invoiceId}`,
  });
}

// ── Credits ────────────────────────────────────────────────────────────────

/** A one-time credit top-up was paid and granted. */
export async function onCreditsPurchased(event: {
  userId: string;
  credits: number;
  amountCents?: number | null;
  currency?: string | null;
  /** Stripe Checkout session id. */
  sessionId: string;
}): Promise<void> {
  const email = await emailForUser(event.userId);
  await sendSafely(
    "credits-purchased",
    email,
    () =>
      creditsPurchasedEmail({
        email: email!,
        credits: event.credits,
        amountCents: event.amountCents,
        currency: event.currency,
        reference: event.sessionId,
        purchasedAt: new Date(),
      }),
    { idempotencyKey: `credits-purchased:${event.sessionId}` },
  );
}

/** Balance below which a spend triggers the low-credit email. */
export function lowCreditsThreshold(): number {
  const fromEnv = Number(process.env.LOW_CREDITS_THRESHOLD);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 100;
}

/**
 * A spend moved the balance from `before` to `after`. Emails the user only
 * when this spend crossed the low-credit line, so it fires once per dip
 * rather than on every generation.
 */
export async function onCreditsSpent(event: {
  userId: string;
  before: number;
  after: number;
}): Promise<void> {
  const line = lowCreditsThreshold();
  if (!(event.before >= line && event.after < line)) return;
  const email = await emailForUser(event.userId);
  await sendSafely("low-credits", email, () =>
    lowCreditsEmail({ email: email!, balance: event.after }),
  );
}

// ── Scheduler ──────────────────────────────────────────────────────────────

/** Publishing finished with at least one failed account. */
export async function onPostPublishFailed(event: {
  userId: string;
  postId: string;
  caption: string;
  targets: PostFailedTarget[];
}): Promise<void> {
  if (!event.targets.some((t) => t.error)) return;
  const email = await emailForUser(event.userId);
  await sendSafely("post-failed", email, () =>
    postFailedEmail({
      email: email!,
      postId: event.postId,
      caption: event.caption,
      targets: event.targets,
    }),
  );
}
