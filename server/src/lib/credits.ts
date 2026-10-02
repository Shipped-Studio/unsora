import {
  CreditSource,
  CreditTransactionType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import prisma from "./db";

/**
 * Credit bucket service.
 *
 * The `CreditGrant` table is the SOLE source of truth for a user's credit
 * balance. There is no cached counter on `User` — every read aggregates
 * grants directly. Every mutation also writes a `CreditTransaction` row for
 * the audit log (admin debugging, refunds, support).
 *
 * Concurrency: every mutating operation runs inside a single Postgres
 * transaction with `SELECT ... FOR UPDATE` row locks on the affected grants
 * to prevent race conditions when two jobs consume credits simultaneously.
 */

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient credits. Need ${required}, have ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface GrantOptions {
  userId: string;
  amount: number;
  source: CreditSource;
  reason: string;
  expiresAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}

interface ConsumeOptions {
  userId: string;
  amount: number;
  reason: string;
  metadata?: Prisma.InputJsonValue;
  apiKeyId?: string;
}

interface ConsumeResult {
  transactionId: string;
  allocations: { grantId: string; amount: number }[];
  /**
   * The user's active balance immediately after this consumption committed.
   * Returned so callers can echo it to the client without an extra round-trip
   * to `getCreditBalance`. Computed from the rows already locked in the
   * same transaction, so it's authoritative — there is no race window.
   */
  balanceAfter: number;
}

interface RefundResult {
  transactionId: string;
  alreadyRefunded: boolean;
  /** Active balance after the refund. Undefined when `alreadyRefunded`. */
  balanceAfter?: number;
}

interface Allocation {
  grantId: string;
  amount: number;
}

interface LockedGrantRow {
  id: string;
  amount: number;
  used: number;
  expires_at: Date | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Authoritative balance derived from the grant table. Use this everywhere —
 * pre-flight checks, UI payloads, admin views. There is no cached column.
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const result = await prisma.creditGrant.aggregate({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    _sum: { amount: true, used: true },
  });
  return (result._sum.amount ?? 0) - (result._sum.used ?? 0);
}

/**
 * Batch version: returns a Map<userId, balance> in a single round-trip.
 * Useful for admin lists where you'd otherwise N+1.
 */
export async function getCreditBalances(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const grouped = await prisma.creditGrant.groupBy({
    by: ["userId"],
    where: {
      userId: { in: userIds },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    _sum: { amount: true, used: true },
  });

  const map = new Map<string, number>();
  for (const id of userIds) map.set(id, 0);
  for (const row of grouped) {
    const balance = (row._sum.amount ?? 0) - (row._sum.used ?? 0);
    map.set(row.userId, balance);
  }
  return map;
}

/**
 * Lifetime credits a user has actually spent (sum of CONSUMPTION transactions,
 * net of any REFUNDs). Replaces the old `User.creditsUsed` counter.
 */
export async function getLifetimeCreditsUsed(userId: string): Promise<number> {
  const consumed = await prisma.creditTransaction.aggregate({
    where: { userId, type: CreditTransactionType.CONSUMPTION },
    _sum: { amount: true },
  });
  const refunded = await prisma.creditTransaction.aggregate({
    where: { userId, type: CreditTransactionType.REFUND },
    _sum: { amount: true },
  });
  // CONSUMPTION amounts are negative, REFUND amounts positive.
  // Net spend = -sum(consumption) - sum(refund).
  return -(consumed._sum.amount ?? 0) - (refunded._sum.amount ?? 0);
}

/** Same as above but batched. */
export async function getLifetimeCreditsUsedBatch(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const [consumed, refunded] = await Promise.all([
    prisma.creditTransaction.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        type: CreditTransactionType.CONSUMPTION,
      },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        type: CreditTransactionType.REFUND,
      },
      _sum: { amount: true },
    }),
  ]);

  const map = new Map<string, number>();
  for (const id of userIds) map.set(id, 0);
  for (const row of consumed) {
    map.set(row.userId, (map.get(row.userId) ?? 0) - (row._sum.amount ?? 0));
  }
  for (const row of refunded) {
    map.set(row.userId, (map.get(row.userId) ?? 0) - (row._sum.amount ?? 0));
  }
  return map;
}

/**
 * Active grants in the order they will be consumed (expiring first, oldest
 * first). Useful for the billing UI.
 */
export async function listActiveGrants(userId: string) {
  return prisma.creditGrant.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// Grant
// ---------------------------------------------------------------------------

/**
 * Add a new credit bucket. ALWAYS creates a row, never overwrites — that's
 * the whole point of the bucket system.
 */
export async function grantCredits(opts: GrantOptions) {
  if (opts.amount <= 0) {
    throw new Error(`grantCredits: amount must be > 0 (got ${opts.amount})`);
  }

  return prisma.$transaction(async (tx) => {
    const grant = await tx.creditGrant.create({
      data: {
        userId: opts.userId,
        amount: opts.amount,
        source: opts.source,
        reason: opts.reason,
        expiresAt: opts.expiresAt ?? null,
      },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        type: CreditTransactionType.GRANT,
        amount: opts.amount,
        reason: opts.reason,
        grantId: grant.id,
        metadata: opts.metadata,
      },
    });

    return { grantId: grant.id, transactionId: transaction.id };
  });
}

// ---------------------------------------------------------------------------
// Consume (FIFO by expiry)
// ---------------------------------------------------------------------------

/**
 * Spend `amount` credits, drawing from grants in FIFO-by-expiry order so
 * subscription credits (which expire) are spent before top-ups (which don't).
 *
 * Throws `InsufficientCreditsError` if the user does not have enough active
 * credits. The whole operation is atomic.
 *
 * Returns the transaction id; callers should persist this on the work item
 * (e.g. on the queue job payload) so the credits can be refunded later via
 * `refundConsumption(transactionId, ...)` if the job fails.
 */
export async function consumeCredits(opts: ConsumeOptions): Promise<ConsumeResult> {
  if (opts.amount <= 0) {
    throw new Error(`consumeCredits: amount must be > 0 (got ${opts.amount})`);
  }

  return prisma.$transaction(async (tx) => {
    // Lock the candidate grants so no other transaction can race us.
    const rows = await tx.$queryRaw<LockedGrantRow[]>`
      SELECT id, amount, used, "expiresAt" AS expires_at, "createdAt" AS created_at
      FROM credit_grants
      WHERE "userId" = ${opts.userId}
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
        AND amount > used
      ORDER BY "expiresAt" ASC NULLS LAST, "createdAt" ASC
      FOR UPDATE
    `;

    const available = rows.reduce((sum, g) => sum + (g.amount - g.used), 0);
    if (available < opts.amount) {
      throw new InsufficientCreditsError(opts.amount, available);
    }

    const allocations: Allocation[] = [];
    let remaining = opts.amount;
    for (const row of rows) {
      if (remaining <= 0) break;
      const avail = row.amount - row.used;
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      allocations.push({ grantId: row.id, amount: take });
      remaining -= take;
    }

    for (const alloc of allocations) {
      await tx.creditGrant.update({
        where: { id: alloc.grantId },
        data: { used: { increment: alloc.amount } },
      });
    }

    const transaction = await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        type: CreditTransactionType.CONSUMPTION,
        amount: -opts.amount,
        reason: opts.reason,
        grantId: allocations[0]?.grantId,
        apiKeyId: opts.apiKeyId ?? null,
        metadata: {
          ...((opts.metadata as Record<string, unknown>) ?? {}),
          allocations,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      transactionId: transaction.id,
      allocations,
      balanceAfter: available - opts.amount,
    };
  });
}

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------

/**
 * Reverse a previous consumption. Restores `used` on the same grants the
 * consumption originally drew from (capped at 0 to be safe), so a subscription
 * credit that was reserved for a failed job is returned to the subscription
 * bucket — and will still expire at the original time.
 *
 * Idempotent: calling refund twice on the same consumption is a no-op.
 */
export async function refundConsumption(
  transactionId: string,
  reason: string,
  metadata?: Prisma.InputJsonValue,
): Promise<RefundResult> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.creditTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!original) {
      throw new Error(`refundConsumption: transaction ${transactionId} not found`);
    }
    if (original.type !== CreditTransactionType.CONSUMPTION) {
      throw new Error(
        `refundConsumption: transaction ${transactionId} is not a CONSUMPTION (got ${original.type})`,
      );
    }

    // Idempotency: bail if a refund already exists.
    const existingRefund = await tx.creditTransaction.findFirst({
      where: {
        refundOfId: transactionId,
        type: CreditTransactionType.REFUND,
      },
      select: { id: true },
    });
    if (existingRefund) {
      return { transactionId: existingRefund.id, alreadyRefunded: true };
    }

    const meta = (original.metadata as { allocations?: Allocation[] } | null) ?? {};
    const allocations = meta.allocations ?? [];
    const refundAmount = Math.abs(original.amount);

    // Restore used on each grant. Use raw SQL to clamp at 0 in case the
    // grant was somehow already adjusted (e.g. an admin manually fixed it).
    for (const alloc of allocations) {
      await tx.$executeRaw`
        UPDATE credit_grants
        SET used = GREATEST(0, used - ${alloc.amount})
        WHERE id = ${alloc.grantId}
      `;
    }

    const refundTxn = await tx.creditTransaction.create({
      data: {
        userId: original.userId,
        type: CreditTransactionType.REFUND,
        amount: refundAmount,
        reason,
        refundOfId: original.id,
        metadata: {
          ...((metadata as Record<string, unknown>) ?? {}),
          allocations,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Recompute the balance inside the same transaction so the value we
    // return reflects the just-applied refund.
    const agg = await tx.creditGrant.aggregate({
      where: {
        userId: original.userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      _sum: { amount: true, used: true },
    });
    const balanceAfter = (agg._sum.amount ?? 0) - (agg._sum.used ?? 0);

    return {
      transactionId: refundTxn.id,
      alreadyRefunded: false,
      balanceAfter,
    };
  });
}

// ---------------------------------------------------------------------------
// Subscription lifecycle
// ---------------------------------------------------------------------------

/**
 * Remaining (unspent, unexpired) credits across the user's SUBSCRIPTION
 * grants only. Used by the plan-upgrade flow to know how many credits to
 * carry over into the new plan's bucket before the old grants are expired.
 * Top-up / promo / admin grants are excluded — they survive the upgrade
 * untouched.
 */
export async function getSubscriptionCreditsRemaining(
  userId: string,
): Promise<number> {
  const result = await prisma.creditGrant.aggregate({
    where: {
      userId,
      source: CreditSource.SUBSCRIPTION,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    _sum: { amount: true, used: true },
  });
  return Math.max(0, (result._sum.amount ?? 0) - (result._sum.used ?? 0));
}

/**
 * Forcibly expire all currently-active SUBSCRIPTION grants for a user.
 * Called on subscription renewal (so the previous cycle's leftover credits
 * vanish before the new cycle's grant is created) and on cancellation.
 *
 * Top-up / promotion / refund grants are intentionally untouched — they're
 * the user's purchased credits and never expire.
 */
export async function expireSubscriptionGrants(userId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const active = await tx.creditGrant.findMany({
      where: {
        userId,
        source: CreditSource.SUBSCRIPTION,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    if (active.length === 0) return { expired: 0, lostCredits: 0 };

    let lostCredits = 0;
    for (const grant of active) {
      const remaining = grant.amount - grant.used;
      if (remaining > 0) {
        lostCredits += remaining;
        await tx.creditTransaction.create({
          data: {
            userId,
            type: CreditTransactionType.EXPIRY,
            amount: -remaining,
            reason,
            grantId: grant.id,
            metadata: { remainingAtExpiry: remaining } as Prisma.InputJsonValue,
          },
        });
      }
      // Mark expired by setting expiresAt to now AND fully consuming.
      // Setting `used = amount` makes the grant invisible to future
      // consumption queries even if expiresAt was NULL.
      await tx.creditGrant.update({
        where: { id: grant.id },
        data: { expiresAt: now, used: grant.amount },
      });
    }

    return { expired: active.length, lostCredits };
  });
}

/**
 * Convenience wrapper for the "subscription cycle starts" event:
 * expire any leftover subscription credits, then grant `amount` new ones
 * that expire at the end of the new cycle.
 */
export async function rolloverSubscriptionCycle(opts: {
  userId: string;
  amount: number;
  expiresAt: Date;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await expireSubscriptionGrants(opts.userId, `${opts.reason}:expire-previous`);
  return grantCredits({
    userId: opts.userId,
    amount: opts.amount,
    source: CreditSource.SUBSCRIPTION,
    reason: opts.reason,
    expiresAt: opts.expiresAt,
    metadata: opts.metadata,
  });
}

// ---------------------------------------------------------------------------
// Admin adjustments
// ---------------------------------------------------------------------------

/**
 * Manually adjust a user's balance (admin only). Positive amount creates an
 * ADMIN-source non-expiring grant; negative amount expires existing grants
 * FIFO until the requested amount is removed.
 */
export async function adjustCredits(opts: {
  userId: string;
  delta: number;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (opts.delta === 0) return null;

  if (opts.delta > 0) {
    return grantCredits({
      userId: opts.userId,
      amount: opts.delta,
      source: CreditSource.ADMIN,
      reason: opts.reason,
      expiresAt: null,
      metadata: opts.metadata,
    });
  }

  // Negative: model as a CONSUMPTION with type ADJUSTMENT in the txn log.
  const result = await consumeCredits({
    userId: opts.userId,
    amount: Math.abs(opts.delta),
    reason: opts.reason,
    metadata: opts.metadata,
  });

  // Reclassify the txn from CONSUMPTION → ADJUSTMENT for clarity in the log.
  await prisma.creditTransaction.update({
    where: { id: result.transactionId },
    data: { type: CreditTransactionType.ADJUSTMENT },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Tx helper (advanced)
// ---------------------------------------------------------------------------

/** Re-export for callers that want to combine credit ops with their own writes. */
export type CreditTx = Tx;
