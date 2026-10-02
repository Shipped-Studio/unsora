/**
 * Legacy query key, kept for components/generator/use-media-attachments.ts.
 * New code should use `libraryQueryKeys` from hooks/use-library.ts.
 */
import { libraryQueryKeys } from "./use-library";

/** Invalidating this refreshes every Library query. */
export const assetQueryKeys = {
  all: libraryQueryKeys.all,
};
