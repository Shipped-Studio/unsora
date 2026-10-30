import { Prisma } from "@prisma/client";
import prisma from "./db";
import { grantCredits } from "./credits";
import { isBlockedSignupEmail } from "./signup-policy";

/** Free credits every new account starts with, so generation works out of the box. */
export const WELCOME_CREDITS = 100;

/**
 * Creates the DB row for a Clerk user and grants the welcome credits. Both the
 * Clerk `user.created` webhook and the user's first API request call this,
 * in either order. It's a plain create (not an upsert) so only the call that
 * actually inserts the row grants the credits; the other hits the unique key
 * and gets the existing row with `created: false`.
 */
export async function createUserOnSignup(
  clerkId: string,
  email: string,
): Promise<{ user: { id: string; email: string }; created: boolean }> {
  let user: { id: string; email: string };
  try {
    user = await prisma.user.create({
      data: { clerkId, email },
      select: { id: true, email: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.user.findUniqueOrThrow({
        where: { clerkId },
        select: { id: true, email: true },
      });
      return { user: existing, created: false };
    }
    throw error;
  }

  // Disposable-email domains don't get free credits.
  if (!isBlockedSignupEmail(email)) {
    await grantCredits({
      userId: user.id,
      amount: WELCOME_CREDITS,
      source: "PROMOTION",
      reason: "welcome:auto-grant",
      expiresAt: null,
      metadata: { note: "Granted when the account was created" },
    });
  }

  return { user, created: true };
}
