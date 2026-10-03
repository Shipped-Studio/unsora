/**
 * Every template rendered with sample data, for the dev preview
 * (GET /dev/emails) and `pnpm --filter @unsora/server email:test`.
 * Add an entry here whenever a template is added.
 */
import type { RenderedEmail } from "./layout";
import { welcomeEmail } from "./templates/account/welcome";
import { subscriptionStartedEmail } from "./templates/account/subscription-started";
import { paymentFailedEmail } from "./templates/account/payment-failed";
import { creditsPurchasedEmail } from "./templates/account/credits-purchased";
import { lowCreditsEmail } from "./templates/account/low-credits";
import { postFailedEmail } from "./templates/account/post-failed";
import { newSignupEmail } from "./templates/internal/new-signup";
import { newSubscriptionEmail } from "./templates/internal/new-subscription";

export interface CatalogEntry {
  id: string;
  group: "Account" | "Internal";
  /** When it's sent, for the preview index. */
  trigger: string;
  render: () => RenderedEmail;
}

const EMAIL = "alex@example.com";
const DAY = 24 * 60 * 60 * 1000;
const CAPTION =
  "5 prompts that turned our product shots into scroll-stoppers. Save this for your next launch. #ai #marketing";

export const EMAIL_CATALOG: CatalogEntry[] = [
  {
    id: "welcome",
    group: "Account",
    trigger: "Account created (Clerk user.created)",
    render: () => welcomeEmail({ email: EMAIL, firstName: "Alex" }),
  },
  {
    id: "trial-started",
    group: "Account",
    trigger: "Free trial started",
    render: () =>
      subscriptionStartedEmail({
        email: EMAIL,
        planName: "Pro",
        credits: 200,
        kind: "trial",
        trialEndsAt: new Date(Date.now() + 7 * DAY),
      }),
  },
  {
    id: "subscription-active",
    group: "Account",
    trigger: "Paid subscription started",
    render: () => subscriptionStartedEmail({ email: EMAIL, planName: "Pro", credits: 2_000, kind: "paid" }),
  },
  {
    id: "plan-upgraded",
    group: "Account",
    trigger: "Moved to a bigger plan",
    render: () => subscriptionStartedEmail({ email: EMAIL, planName: "Business", credits: 6_450, kind: "upgraded" }),
  },
  {
    id: "payment-failed",
    group: "Account",
    trigger: "First failed subscription charge",
    render: () => paymentFailedEmail({ email: EMAIL, planName: "Pro", amountCents: 2900, currency: "usd" }),
  },
  {
    id: "credits-purchased",
    group: "Account",
    trigger: "Credit top-up paid",
    render: () =>
      creditsPurchasedEmail({
        email: EMAIL,
        credits: 500,
        amountCents: 1000,
        currency: "usd",
        reference: "cs_test_a1B2c3D4e5",
        purchasedAt: new Date(),
      }),
  },
  {
    id: "low-credits",
    group: "Account",
    trigger: "Balance drops below LOW_CREDITS_THRESHOLD",
    render: () => lowCreditsEmail({ email: EMAIL, balance: 84 }),
  },
  {
    id: "post-partly-failed",
    group: "Account",
    trigger: "Post published to some accounts only",
    render: () =>
      postFailedEmail({
        email: EMAIL,
        postId: "cm_post_123",
        caption: CAPTION,
        targets: [
          { accountName: "unsora.ai", provider: "instagram" },
          {
            accountName: "Sadek Creates",
            provider: "tiktok",
            error: "TikTok rejected the video: duration exceeds the account's limit.",
          },
          { accountName: "Unsora Ideas", provider: "pinterest" },
        ],
      }),
  },
  {
    id: "post-failed",
    group: "Account",
    trigger: "Post failed on every account",
    render: () =>
      postFailedEmail({
        email: EMAIL,
        postId: "cm_post_456",
        caption: CAPTION,
        targets: [
          {
            accountName: "unsora.ai",
            provider: "instagram",
            error: "The aspect ratio is not supported (9:16). Use 4:5 to 1.91:1.",
          },
        ],
      }),
  },
  {
    id: "new-signup",
    group: "Internal",
    trigger: "Account created (team inbox)",
    render: () =>
      newSignupEmail({
        userId: "cm_user_123",
        clerkId: "user_abc",
        email: EMAIL,
        name: "Alex Rivera",
        username: "alexr",
        signupMethod: "Google",
        signedUpAt: new Date(),
      }),
  },
  {
    id: "new-subscription",
    group: "Internal",
    trigger: "Trial, subscription or upgrade started (team inbox)",
    render: () =>
      newSubscriptionEmail({
        userId: "cm_user_123",
        email: EMAIL,
        planName: "Pro",
        kind: "paid",
        amountPaidCents: 2900,
        currency: "usd",
        interval: "month",
        subscribedAt: new Date(),
        signupAt: new Date(Date.now() - 7 * DAY),
      }),
  },
];
