"use client";

import "driver.js/dist/driver.css";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { driver, type DriveStep } from "driver.js";

/*
 * The guided tour: dims the app and walks through the rail, one spotlight at
 * a time. Runs once per account (after onboarding, on Home) and can be
 * replayed from the account menu. Targets carry a data-tour attribute; steps
 * whose target isn't on screen (phone layout, setup already done) are left
 * out, so the "2 of 6" count stays right.
 */

const SEEN_KEY = "tourSeenAt";
const ONBOARDING_PARAM = "onboarding";

const target = (id: string) => `[data-tour="${id}"]`;

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to Unsora",
      description: "A quick look at where everything lives. It takes about 30 seconds.",
      showButtons: ["next", "close"],
    },
  },
  {
    element: target("new-post"),
    popover: {
      title: "New post",
      description:
        "Write a post once and send it to every connected account, now or at a time you pick.",
      side: "right",
      align: "start",
    },
  },
  {
    element: target("mobile-nav"),
    popover: {
      title: "Menu",
      description: "Calendar, AI tools, your library and agents are all in here.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: target("/scheduler/calendar"),
    popover: {
      title: "Calendar",
      description: "Everything scheduled and published, by day, week or month. Drag a post to move it.",
      side: "right",
      align: "start",
    },
  },
  {
    element: target("/scheduler/accounts"),
    popover: {
      title: "Accounts",
      description: "Connect Instagram, TikTok, YouTube, Facebook, X and Bluesky.",
      side: "right",
      align: "start",
    },
  },
  {
    element: target("create"),
    popover: {
      title: "Create with AI",
      description:
        "Make videos, images, clips, captions, voiceovers and music. Anything you make can be scheduled straight from the result.",
      side: "right",
      align: "start",
    },
  },
  {
    element: target("/files"),
    popover: {
      title: "Library",
      description: "Your uploads and everything you've generated, in one place.",
      side: "right",
      align: "start",
    },
  },
  {
    element: target("/connect-agent"),
    popover: {
      title: "Agents",
      description: "Connect Claude, ChatGPT or Cursor so they can create and schedule posts for you.",
      side: "right",
      align: "start",
    },
  },
  {
    element: target("setup"),
    popover: {
      title: "Start here",
      description: "Work through these steps to get your first post out.",
      side: "left",
      align: "start",
    },
  },
];

function isVisible(selector: string) {
  const el = document.querySelector(selector);
  return Boolean(el && el.getClientRects().length > 0);
}

const TourContext = createContext<{ startTour: () => void; seen: boolean }>({
  startTour: () => {},
  seen: true,
});

export const useProductTour = () => useContext(TourContext);

export function ProductTourProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const running = useRef(false);

  const markSeen = useCallback(() => {
    if (!user || user.unsafeMetadata[SEEN_KEY]) return;
    void user.update({
      unsafeMetadata: { ...user.unsafeMetadata, [SEEN_KEY]: new Date().toISOString() },
    });
  }, [user]);

  const startTour = useCallback(() => {
    if (running.current) return;
    const steps = STEPS.filter(
      (step) => typeof step.element !== "string" || isVisible(step.element),
    );
    running.current = true;
    const tour = driver({
      steps,
      showProgress: steps.length > 1,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      popoverClass: "unsora-tour",
      overlayColor: "var(--scrim)",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      popoverOffset: 12,
      smoothScroll: true,
      // Focus the main button so Enter moves on (driver.js focuses close).
      onPopoverRender: (popover) => {
        window.requestAnimationFrame(() => popover.nextButton.focus({ preventScroll: true }));
      },
      onDestroyed: () => {
        running.current = false;
        markSeen();
      },
    });
    tour.drive();
  }, [markSeen]);

  // Until Clerk has loaded, treat the tour as seen so it can't start early.
  const seen = !isLoaded || !user || Boolean(user.unsafeMetadata[SEEN_KEY]);

  return <TourContext.Provider value={{ startTour, seen }}>{children}</TourContext.Provider>;
}

/**
 * Starts the tour on a first visit to Home, once the onboarding dialog is
 * closed and the page has painted. Reads the URL, so render it inside a
 * Suspense boundary.
 */
export function TourAutoStart() {
  const { startTour, seen } = useProductTour();
  const pathname = usePathname();
  const onboardingOpen = useSearchParams().has(ONBOARDING_PARAM);

  useEffect(() => {
    if (seen || onboardingOpen || pathname !== "/") return;
    const timer = window.setTimeout(startTour, 800);
    return () => window.clearTimeout(timer);
  }, [seen, onboardingOpen, pathname, startTour]);

  return null;
}
