import {
  accountFooter,
  appUrl,
  button,
  heading,
  layout,
  list,
  paragraph,
  type RenderedEmail,
} from "../../layout";

export interface WelcomeInput {
  email: string;
  /** First name if known; the greeting falls back to "Hi there". */
  firstName?: string | null;
}

const IDEAS = [
  "Connect YouTube, TikTok, Instagram and your other accounts",
  "Schedule a post to every platform at once from one composer",
  "Generate images, video, music and voiceovers to post",
  "Use Unsora from Claude or ChatGPT over MCP",
];

/** Sent once, right after an account is created. */
export function welcomeEmail(input: WelcomeInput): RenderedEmail {
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi there,";
  const url = appUrl("/scheduler/accounts");

  const html = layout({
    preheader: "Your Unsora account is ready. Connect an account to start posting.",
    content: [
      heading("Welcome to Unsora"),
      paragraph(hello),
      paragraph(
        "Your account is ready. Unsora plans, creates and publishes your social posts in one place. A few things to try first:",
      ),
      list(IDEAS),
      button("Connect your accounts", url),
      paragraph("Reply to this email any time: a person reads it.", {
        muted: true,
        small: true,
        last: true,
      }),
    ].join("\n"),
    footer: accountFooter(input.email),
  });

  const text = [
    hello,
    "",
    "Your Unsora account is ready. A few things to try first:",
    ...IDEAS.map((idea) => `- ${idea}`),
    "",
    `Connect your accounts: ${url}`,
    "",
    "Reply to this email any time: a person reads it.",
  ].join("\n");

  return { subject: "Welcome to Unsora", html, text };
}
