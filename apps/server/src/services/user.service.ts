import prisma from "../lib/db";

// User operations
export const getUserByClerkId = async (clerkId: string) => {
  return await prisma.user.findUnique({
    where: { clerkId },
  });
};
