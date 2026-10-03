import {
  detailsTable,
  detailsText,
  heading,
  INTERNAL_FOOTER,
  layout,
  type RenderedEmail,
} from "../../layout";
import { fmtDateTime } from "../../format";

export interface NewSignupInput {
  userId: string;
  clerkId: string;
  email: string;
  name?: string | null;
  username?: string | null;
  signupMethod?: string | null;
  signedUpAt: Date;
}

/** Team notice for every new account. */
export function newSignupEmail(input: NewSignupInput): RenderedEmail {
  const rows: [string, string | null | undefined][] = [
    ["Email", input.email],
    ["Name", input.name],
    ["Username", input.username],
    ["Signed up with", input.signupMethod],
    ["When", fmtDateTime(input.signedUpAt)],
    ["User id", input.userId],
    ["Clerk id", input.clerkId],
  ];

  const html = layout({
    preheader: `${input.email} just signed up.`,
    content: [heading("New signup"), detailsTable(rows)].join("\n"),
    footer: INTERNAL_FOOTER,
  });

  return {
    subject: `New signup: ${input.email}`,
    html,
    text: `New signup\n\n${detailsText(rows)}`,
  };
}
