import { Prisma } from "@prisma/client";

export interface LegInput {
  accountId: string;
  customCaption?: string | null;
  title?: string | null;
  /** `undefined` keeps the leg's current settings; `null` clears them. */
  settings?: Record<string, unknown> | null;
}

interface ExistingLeg {
  id: string;
  accountId: string;
  published: boolean;
}

function settingsValue(settings: LegInput["settings"]) {
  if (settings === undefined) return undefined;
  if (settings && typeof settings === "object") {
    return settings as Prisma.InputJsonValue;
  }
  return Prisma.DbNull;
}

/**
 * Reconciles a post's per-account legs with the requested account list.
 *
 * Published legs are never touched or removed: they carry the platform post
 * id and URL, and resetting them would publish the same content twice on the
 * next run. Unpublished legs are updated in place, missing ones are created,
 * and unpublished legs that are no longer requested are deleted.
 */
export async function reconcilePostLegs(
  tx: Prisma.TransactionClient,
  postId: string,
  existing: ExistingLeg[],
  requested: LegInput[],
) {
  const requestedIds = new Set(requested.map((leg) => leg.accountId));
  const existingByAccount = new Map(existing.map((leg) => [leg.accountId, leg]));

  const removable = existing
    .filter((leg) => !leg.published && !requestedIds.has(leg.accountId))
    .map((leg) => leg.id);
  if (removable.length) {
    await tx.postAccount.deleteMany({ where: { id: { in: removable } } });
  }

  for (const leg of requested) {
    const current = existingByAccount.get(leg.accountId);
    if (current?.published) continue;

    const data = {
      customCaption: leg.customCaption || null,
      title: leg.title || null,
      settings: settingsValue(leg.settings),
    };

    if (current) {
      await tx.postAccount.update({
        where: { id: current.id },
        data: { ...data, error: null },
      });
    } else {
      await tx.postAccount.create({
        data: { postId, accountId: leg.accountId, ...data },
      });
    }
  }
}
