import { Prisma } from "@prisma/client";
import prisma from "./db";

/**
 * Creates the DB row for a Clerk user. New accounts start with no credits;
 * the first credits come with the free trial (the `trial` plan's allotment,
 * see lib/plans.ts). Both the Clerk `user.created` webhook and the user's
 * first API request call this, in either order. It's a plain create (not an
 * upsert), so the call that loses the race hits the unique key and gets the
 * existing row with `created: false`.
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

  return { user, created: true };
}
