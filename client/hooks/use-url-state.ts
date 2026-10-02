"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function useUrlState<T extends Record<string, any>>(
  defaultState: T
): [T, (updates: Partial<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current URL params into state
  const currentState: T = { ...defaultState };
  searchParams.forEach((value, key) => {
    if (key in defaultState) {
      // Handle different types
      if (typeof defaultState[key] === "number") {
        // @ts-ignore
        currentState[key] = parseInt(value) as any;
      } else if (typeof defaultState[key] === "boolean") {
        // @ts-ignore
        currentState[key] = (value === "true") as any;
      } else {
        // @ts-ignore
        currentState[key] = value as any;
      }
    }
  });

  const setState = (updates: Partial<T>) => {
    const newState = { ...currentState, ...updates };
    const params = new URLSearchParams();

    // Add non-default values to URL
    Object.keys(newState).forEach((key) => {
      const value = newState[key];
      // Only add if not default value and not undefined/null/empty
      if (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== defaultState[key]
      ) {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  return [currentState, setState];
}
