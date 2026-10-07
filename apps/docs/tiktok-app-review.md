# TikTok App Review — Submission Guide (Unsora)

This is the checklist + script for (re)submitting the TikTok for Developers app
for production approval of the **Content Posting API** (`video.publish`) and
**Display API** (`video.list`).

## Previous rejection — what was fixed

| Reviewer note | Fix | Where |
|---|---|---|
| "Redirect URI should not contain TikTok." | Renamed the OAuth callback to `…/api/connect/tt/callback` (no "tiktok" substring). | `server/src/routes/connect.routes.ts`, `TIKTOK_REDIRECT` in `.env*` |
| "Icon does not match brand." | Upload the Unsora brand icon (1024×1024) in the portal — **manual** (see below). | TikTok Developer Portal |

> **Action required in the portal:** update the registered **Web redirect URI** to
> `https://mvp2.tryunsora.com/api/connect/tt/callback` (must match exactly), and
> replace the app icon with the Unsora logo. Confirm the app **name** is "Unsora"
> (must match the website, must not reference TikTok or any social platform).

## Scopes requested + justification

| Scope | Why Unsora needs it |
|---|---|
| `user.info.basic` | Identify the connected TikTok account (open_id, display name, avatar) shown in the connections list and on the posting page. |
| `video.publish` | Direct Post: publish the user's video to their TikTok profile, and call `creator_info/query` to render a compliant posting UI. |
| `video.list` | After a successful post, query the published video to retrieve its public **share/post URL** to show the user. |

Scope string sent at authorize time: `user.info.basic,video.publish,video.list`
(`server/src/oauth/tiktok.ts`).

## Posting flow (Direct Post via FILE_UPLOAD)

1. User connects a TikTok account (OAuth) → tokens stored on `SocialAccount`.
2. On the **Create Post** page, when a TikTok account is selected we call
   `POST /v2/post/publish/creator_info/query/` and render the options UI.
3. On publish, the server downloads the uploaded video and pushes the bytes to
   TikTok via **`FILE_UPLOAD`** (`/v2/post/publish/video/init/` → chunked `PUT`
   to `upload_url`).
4. We poll `/v2/post/publish/status/fetch/`; on `PUBLISH_COMPLETE` we query
   `/v2/video/query/` (scope `video.list`) for the post's `share_url`.

## UX Guidelines compliance map

Every mandatory element from TikTok's
[Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)
is implemented in `client/components/scheduler/tiktok-post-options.tsx`:

| Requirement | Implementation |
|---|---|
| Show creator nickname before posting | Avatar + `creator_nickname` header. |
| Privacy selector, **no default**, options only from `privacy_level_options` | `Select` with placeholder, populated from creator info; publish gated until chosen. |
| Comment / Duet / Stitch toggles, unchecked by default; greyed when disabled | `InteractionToggle` respects `comment_disabled` / `duet_disabled` / `stitch_disabled`. |
| Commercial content disclosure, default OFF; ≥1 option required when ON | "Disclose video content" switch → "Your brand" / "Branded content" checkboxes; publish gated. |
| "Your brand" → Promotional content; "Branded content" → Paid partnership | Helper text under each checkbox. |
| Branded content cannot be private | `SELF_ONLY` option disabled while "Branded content" is checked; clears a prior SELF_ONLY selection. |
| Consent declaration (Music Usage Confirmation; + Branded Content Policy) | Linked declaration text above the publish button, switches with disclosure state. |
| Enforce `max_video_post_duration_sec` | Duration check blocks publish if exceeded. |
| Content preview | Existing sidebar video preview. |
| Processing-time notice | Note shown near the publish button. |
| Editable caption/hashtags | Existing caption editor. |

## Sandbox testing (before production audit)

- Add the test TikTok account(s) as **target users** in the sandbox (up to 10).
- Demonstrate the full flow on the sandbox: connect → pick privacy "Only me" →
  publish → post appears (private) on the profile.
- **Unaudited behavior:** until the app passes audit, all posts are forced to
  `SELF_ONLY` (private). This is expected — don't flag it as a bug in the demo.

## Demo video checklist (1–5 videos, ≤50 MB each)

- [ ] Show login + connecting a TikTok account (consent screen with the scopes).
- [ ] Show the Create Post page rendering the creator nickname + options.
- [ ] Show privacy selection (no default), interaction toggles, disclosure flow.
- [ ] Publish and show the resulting post URL.
- [ ] Narrate each on-screen element so it maps to the guidelines table above.

## Website requirements

- Official site fully developed and externally facing (tryunsora.com).
- **Privacy Policy and Terms of Service links must be visible without opening a
  menu** (e.g. in the footer, directly on the page).
