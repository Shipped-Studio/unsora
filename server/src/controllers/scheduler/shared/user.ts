import { prisma } from "../../../lib/db";

export async function getUserIdFromClerkId(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  return user?.id ?? null;
}
