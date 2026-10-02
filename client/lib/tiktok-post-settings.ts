/**
 * Shared types + helpers for the TikTok posting options UI.
 *
 * The UI state (`TikTokOptionsState`) is what we render and mutate. When a post
 * is submitted it is flattened into `TikTokPostSettings` (snake_case fields that
 * mirror TikTok's `post_info`) and stored on the per-account `settings` payload.
 */

/** Persisted, snake_case shape sent to the backend per TikTok account. */
export interface TikTokPostSettings {
  privacy_level?: string;
  disable_comment?: boolean;
  disable_duet?: boolean;
  disable_stitch?: boolean;
  brand_content_toggle?: boolean;
  brand_organic_toggle?: boolean;
  is_aigc?: boolean;
}

/** UI-facing state held per selected TikTok account. */
export interface TikTokOptionsState {
  /** "" means no privacy level has been selected yet (required, no default). */
  privacyLevel: string;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  /** Master "this is commercial content" disclosure toggle. */
  commercialDisclosure: boolean;
  /** "Your brand" — promoting yourself/your own business (brand_organic_toggle). */
  yourBrand: boolean;
  /** "Branded content" — promoting a third party (brand_content_toggle). */
  brandedContent: boolean;
  /** AI-generated content flag (is_aigc). */
  aigc: boolean;
}

export const SELF_ONLY = "SELF_ONLY";

export const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

export const TIKTOK_MUSIC_USAGE_URL =
  "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
export const TIKTOK_BRANDED_CONTENT_POLICY_URL =
  "https://www.tiktok.com/legal/page/global/bc-policy/en";

export function defaultTikTokOptionsState(): TikTokOptionsState {
  return {
    privacyLevel: "",
    allowComment: false,
    allowDuet: false,
    allowStitch: false,
    commercialDisclosure: false,
    yourBrand: false,
    brandedContent: false,
    aigc: false,
  };
}

/**
 * Whether the current options satisfy TikTok's posting requirements:
 * a privacy level must be chosen, and if commercial disclosure is on at least
 * one of "Your brand"/"Branded content" must be selected. Branded content may
 * not be SELF_ONLY.
 */
export function isTikTokOptionsValid(state: TikTokOptionsState): boolean {
  if (!state.privacyLevel) return false;
  if (state.commercialDisclosure && !state.yourBrand && !state.brandedContent) {
    return false;
  }
  if (state.brandedContent && state.privacyLevel === SELF_ONLY) {
    return false;
  }
  return true;
}

/** Flatten UI state into the persisted snake_case settings object. */
export function toTikTokPostSettings(
  state: TikTokOptionsState,
): TikTokPostSettings {
  return {
    privacy_level: state.privacyLevel,
    disable_comment: !state.allowComment,
    disable_duet: !state.allowDuet,
    disable_stitch: !state.allowStitch,
    brand_content_toggle: state.brandedContent,
    brand_organic_toggle: state.yourBrand,
    is_aigc: state.aigc,
  };
}

/** Rebuild UI state from a persisted settings object (e.g. when editing). */
export function fromTikTokPostSettings(
  settings: TikTokPostSettings | null | undefined,
): TikTokOptionsState {
  const base = defaultTikTokOptionsState();
  if (!settings) return base;
  const yourBrand = !!settings.brand_organic_toggle;
  const brandedContent = !!settings.brand_content_toggle;
  return {
    privacyLevel: settings.privacy_level ?? "",
    allowComment: settings.disable_comment === false,
    allowDuet: settings.disable_duet === false,
    allowStitch: settings.disable_stitch === false,
    commercialDisclosure: yourBrand || brandedContent,
    yourBrand,
    brandedContent,
    aigc: !!settings.is_aigc,
  };
}
