import { Request, Response } from "express";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { prisma } from "../lib/db";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_SLOTS = 70;
/** How far ahead to look for a free slot. */
const LOOKAHEAD_DAYS = 56;
/** A slot this close to now is skipped; the scheduler runs once a minute. */
const MIN_LEAD_MS = 2 * 60 * 1000;

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

async function loadUser(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, timezone: true, weekStartsOn: true },
  });
}

interface SlotInput {
  weekday: number;
  time: string;
}

function sortSlots<T extends SlotInput>(slots: T[]) {
  return [...slots].sort(
    (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
  );
}

/**
 * Next free posting slots after now, in UTC. A slot is taken when a
 * scheduled post already sits within a minute of it.
 */
export async function findNextSlots(input: {
  userId: string;
  timeZone: string;
  count: number;
  excludePostId?: string;
}) {
  const slots = await prisma.postingSlot.findMany({
    where: { userId: input.userId },
    select: { weekday: true, time: true },
  });
  if (slots.length === 0) return [];

  const now = new Date();
  const horizon = addDays(now, LOOKAHEAD_DAYS + 1);
  const scheduled = await prisma.post.findMany({
    where: {
      userId: input.userId,
      status: "SCHEDULED",
      scheduledFor: { gte: now, lte: horizon },
      ...(input.excludePostId ? { id: { not: input.excludePostId } } : {}),
    },
    select: { scheduledFor: true },
  });
  const takenMinutes = new Set(
    scheduled.map((p) => Math.round(p.scheduledFor!.getTime() / 60_000)),
  );
  const isTaken = (date: Date) => {
    const minute = Math.round(date.getTime() / 60_000);
    return (
      takenMinutes.has(minute - 1) ||
      takenMinutes.has(minute) ||
      takenMinutes.has(minute + 1)
    );
  };

  const byWeekday = new Map<number, string[]>();
  for (const slot of sortSlots(slots)) {
    byWeekday.set(slot.weekday, [...(byWeekday.get(slot.weekday) ?? []), slot.time]);
  }

  // Walk calendar dates in the user's zone. Stepping by 24h instead can skip
  // a day across a DST change.
  const [year, month, day] = formatInTimeZone(now, input.timeZone, "yyyy-MM-dd")
    .split("-")
    .map(Number);

  const results: Date[] = [];
  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset++) {
    const calendarDay = new Date(Date.UTC(year, month - 1, day + offset));
    const dateInZone = calendarDay.toISOString().slice(0, 10);
    const weekday = calendarDay.getUTCDay();

    for (const time of byWeekday.get(weekday) ?? []) {
      const instant = fromZonedTime(`${dateInZone}T${time}:00`, input.timeZone);
      if (instant.getTime() < now.getTime() + MIN_LEAD_MS) continue;
      if (isTaken(instant)) continue;
      results.push(instant);
      if (results.length >= input.count) return results;
    }
  }
  return results;
}

export class ScheduleController {
  getSlots = async (req: Request, res: Response) => {
    try {
      const user = await loadUser(req.auth.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const slots = await prisma.postingSlot.findMany({
        where: { userId: user.id },
        select: { id: true, weekday: true, time: true },
      });

      return res.json({
        success: true,
        data: {
          timezone: user.timezone,
          weekStartsOn: user.weekStartsOn,
          slots: sortSlots(slots),
        },
      });
    } catch (error) {
      console.error("Get posting slots error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load posting times" });
    }
  };

  /** Replaces the user's weekly posting times. */
  replaceSlots = async (req: Request, res: Response) => {
    try {
      const { slots, timezone } = req.body as {
        slots?: SlotInput[];
        timezone?: string;
      };

      if (!Array.isArray(slots) || slots.length > MAX_SLOTS) {
        return res.status(400).json({
          success: false,
          error: `Send between 0 and ${MAX_SLOTS} posting times.`,
        });
      }
      const invalid = slots.find(
        (s) =>
          !Number.isInteger(s?.weekday) ||
          s.weekday < 0 ||
          s.weekday > 6 ||
          !TIME_RE.test(s?.time ?? ""),
      );
      if (invalid) {
        return res.status(400).json({
          success: false,
          error: "Each posting time needs a weekday (0-6) and a time like 09:30.",
        });
      }
      if (timezone !== undefined && !isValidTimeZone(timezone)) {
        return res
          .status(400)
          .json({ success: false, error: "Unknown timezone." });
      }

      const user = await loadUser(req.auth.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const unique = new Map(slots.map((s) => [`${s.weekday}-${s.time}`, s]));

      await prisma.$transaction([
        prisma.postingSlot.deleteMany({ where: { userId: user.id } }),
        prisma.postingSlot.createMany({
          data: [...unique.values()].map((s) => ({
            userId: user.id,
            weekday: s.weekday,
            time: s.time,
          })),
        }),
        ...(timezone
          ? [
              prisma.user.update({
                where: { id: user.id },
                data: { timezone },
              }),
            ]
          : []),
      ]);

      const saved = await prisma.postingSlot.findMany({
        where: { userId: user.id },
        select: { id: true, weekday: true, time: true },
      });

      return res.json({
        success: true,
        data: {
          timezone: timezone ?? user.timezone,
          weekStartsOn: user.weekStartsOn,
          slots: sortSlots(saved),
        },
      });
    } catch (error) {
      console.error("Replace posting slots error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to save posting times" });
    }
  };

  /** `?count=5&timezone=Europe/Berlin&exclude=<postId>` */
  getNextSlots = async (req: Request, res: Response) => {
    try {
      const user = await loadUser(req.auth.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const requestedZone = req.query.timezone;
      const timeZone = isValidTimeZone(requestedZone)
        ? requestedZone
        : user.timezone && isValidTimeZone(user.timezone)
          ? user.timezone
          : "UTC";
      const count = Math.min(20, Math.max(1, Number(req.query.count) || 5));
      const excludePostId =
        typeof req.query.exclude === "string" ? req.query.exclude : undefined;

      const next = await findNextSlots({
        userId: user.id,
        timeZone,
        count,
        excludePostId,
      });

      return res.json({
        success: true,
        data: { timezone: timeZone, slots: next.map((d) => d.toISOString()) },
      });
    } catch (error) {
      console.error("Get next posting slots error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to find the next free slot" });
    }
  };
}
