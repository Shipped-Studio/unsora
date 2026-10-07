import { prisma } from "../../../lib/db";
import { socialAccountLimitFor } from "../../../lib/plans";

export const ACCOUNT_LIMIT_MESSAGE =
  "This Unsora workspace has reached its plan's account limit. Ask the owner to upgrade or disconnect an account.";

/**
 * Whether an OAuth callback may save this account. Re-authorizing an account
 * the workspace already has is always fine (the callbacks upsert by provider
 * + providerAccountId); a new one needs a free slot on the owner's plan.
 * The auth-URL routes check the limit too, but a link can be opened later or
 * shared, so the callback checks again.
 */
export async function canAddAccount(
  userId: string,
  provider: string,
  providerAccountId: string,
): Promise<boolean> {
  const existing = await prisma.socialAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    select: { userId: true },
  });
  if (existing?.userId === userId) return true;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const limit = await socialAccountLimitFor(user?.plan);
  if (limit === null) return false;

  const count = await prisma.socialAccount.count({ where: { userId } });
  return count < limit;
}
