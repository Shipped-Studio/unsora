/**
 * Mock API data for the preview harness, shaped like the real v1 responses
 * (see apps/server/src/api/v1). Times are relative to now so schedules and
 * "x days ago" labels look right whenever the preview runs.
 */

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const img = (seed: string, w = 1080, h = 1350) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const avatar = (n: number) => `https://i.pravatar.cc/96?img=${n}`;
const VIDEO = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const AUDIO = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3";

export const ACCOUNTS = [
  { id: "acc_yt", provider: "google", providerAccountId: "UC1", accountName: "Unsora Studio", accountUsername: "unsorastudio", profilePicture: avatar(12), expiresAt: null },
  { id: "acc_tt", provider: "tiktok", providerAccountId: "tt1", accountName: "Sadek Creates", accountUsername: "sadekcreates", profilePicture: avatar(33), expiresAt: null },
  { id: "acc_ig", provider: "instagram", providerAccountId: "ig1", accountName: "unsora.ai", accountUsername: "unsora.ai", profilePicture: avatar(47), expiresAt: null },
  { id: "acc_fb", provider: "facebook", providerAccountId: "fb1", accountName: "Unsora", accountUsername: null, profilePicture: avatar(5), expiresAt: null },
  { id: "acc_li", provider: "linkedin", providerAccountId: "li1", accountName: "Sadek Irfan", accountUsername: null, profilePicture: null, expiresAt: null },
  { id: "acc_pin", provider: "pinterest", providerAccountId: "pin1", accountName: "Unsora Ideas", accountUsername: "unsoraideas", profilePicture: avatar(20), expiresAt: null },
  { id: "acc_bs", provider: "bluesky", providerAccountId: "bs1", accountName: "unsora.bsky.social", accountUsername: "unsora.bsky.social", profilePicture: avatar(60), expiresAt: null },
];

const accountRef = (id: string) => {
  const a = ACCOUNTS.find((x) => x.id === id)!;
  return { id: a.id, provider: a.provider, accountName: a.accountName, accountUsername: a.accountUsername, profilePicture: a.profilePicture };
};

const asset = (url: string, type: "IMAGE" | "VIDEO") => ({ id: "as_" + url.length, url, mimeType: type === "VIDEO" ? "video/mp4" : "image/jpeg", type });

function post(
  id: string,
  status: string,
  opts: {
    caption: string;
    accounts: string[];
    media?: { url: string; type: "IMAGE" | "VIDEO" }[];
    scheduledFor?: string | null;
    publishedAt?: string | null;
    createdAt?: string;
    legs?: Record<string, { published?: boolean; error?: string; url?: string; title?: string }>;
  },
) {
  return {
    id,
    status,
    type: opts.media?.some((m) => m.type === "VIDEO") ? "VIDEO" : opts.media?.length ? "CAROUSEL" : "TEXT",
    mainCaption: opts.caption,
    error: null,
    createdAt: opts.createdAt ?? iso(-2 * DAY),
    updatedAt: iso(-HOUR),
    scheduledFor: opts.scheduledFor ?? null,
    scheduledTimezone: "Asia/Dhaka",
    publishedAt: opts.publishedAt ?? null,
    source: "MCP",
    media: (opts.media ?? []).map((m, i) => ({ id: `m_${id}_${i}`, type: m.type, order: i, asset: asset(m.url, m.type) })),
    postAccounts: opts.accounts.map((accountId) => {
      const leg = opts.legs?.[accountId] ?? {};
      return {
        id: `pa_${id}_${accountId}`,
        accountId,
        customCaption: null,
        title: leg.title ?? null,
        settings: null,
        published: !!leg.published,
        publishedAt: leg.published ? opts.publishedAt : null,
        publishedUrl: leg.url ?? null,
        error: leg.error ?? null,
        account: accountRef(accountId),
      };
    }),
  };
}

export const POSTS = [
  post("p_sched1", "SCHEDULED", {
    caption: "5 prompts that turned our product shots into scroll-stoppers 👇 Save this for your next launch.",
    accounts: ["acc_ig", "acc_tt", "acc_pin"],
    media: [{ url: img("launch1"), type: "IMAGE" }, { url: img("launch2"), type: "IMAGE" }, { url: img("launch3"), type: "IMAGE" }],
    scheduledFor: iso(5 * HOUR),
  }),
  post("p_sched2", "SCHEDULED", {
    caption: "How we built a 30-second ad with zero filming — full breakdown.",
    accounts: ["acc_yt", "acc_tt"],
    media: [{ url: VIDEO, type: "VIDEO" }],
    scheduledFor: iso(DAY + 2 * HOUR),
    legs: { acc_yt: { title: "Zero-filming ad breakdown" } },
  }),
  post("p_draft", "DRAFT", {
    caption: "Draft: weekly roundup of the best AI video models for creators.",
    accounts: ["acc_li", "acc_fb"],
    createdAt: iso(-3 * HOUR),
  }),
  post("p_partial", "PARTIALLY_PUBLISHED", {
    caption: "Behind the scenes of our AI influencer studio ✨",
    accounts: ["acc_ig", "acc_tt", "acc_fb"],
    media: [{ url: VIDEO, type: "VIDEO" }],
    publishedAt: iso(-DAY),
    legs: {
      acc_ig: { published: true, url: "https://instagram.com/p/example" },
      acc_fb: { published: true, url: "https://facebook.com/example" },
      acc_tt: { error: "TikTok rejected the video: duration exceeds the account's limit." },
    },
  }),
  post("p_pub", "PUBLISHED", {
    caption: "New: clip a 2-hour podcast into 10 shorts in one click.",
    accounts: ["acc_yt", "acc_li"],
    media: [{ url: VIDEO, type: "VIDEO" }],
    publishedAt: iso(-3 * DAY),
    legs: {
      acc_yt: { published: true, url: "https://youtube.com/shorts/example", title: "Podcast to shorts" },
      acc_li: { published: true, url: "https://linkedin.com/feed/update/example" },
    },
  }),
  post("p_failed", "FAILED", {
    caption: "Carousel test with a 9:16 image.",
    accounts: ["acc_ig"],
    media: [{ url: img("tall", 1080, 1920), type: "IMAGE" }],
    publishedAt: null,
    scheduledFor: iso(-4 * DAY),
    legs: { acc_ig: { error: "The aspect ratio is not supported (9:16). Use 4:5 to 1.91:1." } },
  }),
];

export function listPosts(args: Record<string, unknown>) {
  const status = typeof args.status === "string" ? args.status : null;
  const posts = status ? POSTS.filter((p) => p.status === status) : POSTS;
  return { success: true, data: { posts, pagination: { page: 1, limit: 20, total: posts.length, totalPages: 1 } } };
}

/** get_post: a publishing post finishes after a few checks. */
const publishChecks: Record<string, number> = {};
export function getPost(id: string) {
  const base = POSTS.find((p) => p.id === id) ?? NEW_POST;
  const checks = (publishChecks[id] = (publishChecks[id] ?? 0) + 1);
  if (id === NEW_POST.id) {
    if (checks < 2) return { success: true, data: { ...NEW_POST, status: "PUBLISHING" } };
    return {
      success: true,
      data: {
        ...NEW_POST,
        status: "PUBLISHED",
        publishedAt: iso(0),
        postAccounts: NEW_POST.postAccounts.map((pa) => ({ ...pa, published: true, publishedUrl: "https://example.com/" + pa.accountId })),
      },
    };
  }
  return { success: true, data: base };
}

export const NEW_POST = post("p_new", "PUBLISHING", {
  caption: "Fresh drop from the composer.",
  accounts: ["acc_tt", "acc_pin"],
  media: [{ url: img("composer1"), type: "IMAGE" }],
  createdAt: iso(0),
});

export const CREDITS = { credits: 1840 };
export const SUBSCRIPTION = {
  success: true,
  data: {
    plan: "pro", status: "active", isActive: true, isCancelled: false,
    stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1", stripePriceId: "price_1",
    stripeCurrentPeriodEnd: iso(19 * DAY),
  },
};

export function analytics(days: number) {
  const n = days;
  const timeseries = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * DAY);
    const wave = Math.round(900 + 600 * Math.sin(i / 3) + i * 40 + (i % 7 === 5 ? 1500 : 0));
    return { date: d.toISOString().slice(0, 10), views: Math.max(0, wave), likes: Math.round(wave * 0.08), comments: Math.round(wave * 0.012), shares: Math.round(wave * 0.02) };
  });
  const sum = (k: "views" | "likes" | "comments" | "shares") => timeseries.reduce((a, p) => a + p[k], 0);
  const totals = { views: sum("views"), likes: sum("likes"), comments: sum("comments"), shares: sum("shares"), saves: Math.round(sum("likes") * 0.3) };
  const split = [["tiktok", 0.46, 9], ["instagram", 0.27, 7], ["google", 0.17, 4], ["facebook", 0.06, 3], ["linkedin", 0.04, 2]] as const;
  const byPlatform = split.map(([platform, f, posts]) => ({
    platform,
    views: Math.round(totals.views * f), likes: Math.round(totals.likes * f), comments: Math.round(totals.comments * f),
    shares: Math.round(totals.shares * f), saves: Math.round(totals.saves * f), posts,
  }));
  const posts = [
    ["tiktok", "sadekcreates", 33, "This AI ad took 4 minutes to make", 48200],
    ["instagram", "unsora.ai", 47, "Behind the scenes of our AI influencer studio ✨", 21900],
    ["google", "unsorastudio", 12, "Podcast to shorts in one click", 15400],
    ["tiktok", "sadekcreates", 33, "3 prompts for product photos", 12100],
    ["facebook", null, 5, "Weekly creator roundup", 4300],
    ["linkedin", null, null, "How we automate our content calendar", 2100],
  ].map(([platform, user, av, caption, views], i) => ({
    postAccountId: "pa" + i, platform, accountUsername: user, profilePicture: av ? avatar(av as number) : null,
    caption, postType: "VIDEO", publishedAt: iso(-(i + 1) * 2 * DAY), publishedUrl: "https://example.com/p" + i,
    metrics: { views, likes: Math.round((views as number) * 0.07), comments: Math.round((views as number) * 0.01), shares: Math.round((views as number) * 0.02), saves: 40 },
    lastFetchedAt: iso(-HOUR),
  }));
  return { success: true, data: { days, totals, postCount: 25, byPlatform, timeseries, posts } };
}

const gen = (i: number, status = "COMPLETED") => ({
  id: "img_" + i, model: "nano-banana-2", prompt: ["Neon product shot of headphones", "Cozy cafe flat lay", "Mountain sunrise, cinematic", "Minimal skincare bottle on stone", "Streetwear lookbook, 35mm", "Futuristic city at dusk"][i % 6],
  status, error: status === "FAILED" ? "Content flagged" : null, createdAt: iso(-i * 5 * HOUR),
  outputAsset: status === "COMPLETED" ? asset(img("lib" + i), "IMAGE") : null, thumbnailAsset: null,
});

export function library(type: string) {
  const pagination = { currentPage: 1, totalPages: 2, totalCount: 30, limit: 24, hasNextPage: true, hasPreviousPage: false };
  if (type === "music") {
    return { success: true, generations: [1, 2, 3].map((i) => ({ id: "mu" + i, songTitle: ["Neon Rain", "Golden Hour", "Midnight Drive"][i - 1], status: i === 3 ? "PROCESSING" : "COMPLETED", createdAt: iso(-i * DAY), outputAsset: i === 3 ? null : { url: AUDIO } })), pagination: { ...pagination, totalPages: 1 } };
  }
  if (type === "video") {
    return { success: true, generations: [1, 2, 3, 4].map((i) => ({ id: "vid" + i, prompt: "Drone shot over a coastline " + i, status: "COMPLETED", createdAt: iso(-i * DAY), outputAsset: { url: VIDEO }, thumbnailAsset: { url: img("vthumb" + i, 1280, 720) } })), pagination };
  }
  if (type === "clipping") {
    return { success: true, data: [{ id: "cj1", status: "COMPLETED", createdAt: iso(-DAY), clips: [1, 2, 3].map((i) => ({ id: "clip" + i, title: "Viral moment #" + i, status: "COMPLETED", outputAsset: { url: VIDEO }, thumbnailAsset: { url: img("clip" + i, 720, 1280) } })) }] };
  }
  return { success: true, generations: Array.from({ length: 11 }, (_, i) => gen(i, i === 2 ? "PROCESSING" : i === 7 ? "FAILED" : "COMPLETED")), pagination };
}

export function uploads() {
  return {
    success: true,
    data: {
      uploads: [1, 2, 3, 4, 5].map((i) => ({ id: "up" + i, name: "upload-" + i + (i === 5 ? ".mp4" : ".jpg"), url: i === 5 ? VIDEO : img("up" + i), mimeType: i === 5 ? "video/mp4" : "image/jpeg", type: i === 5 ? "VIDEO" : "IMAGE", fileSize: 120000, createdAt: iso(-i * DAY) })),
      pagination: { page: 1, limit: 24, total: 5, totalPages: 1 },
    },
  };
}

export const PINTEREST_BOARDS = {
  success: true,
  data: [
    { id: "b1", name: "Product photography", privacy: "PUBLIC" },
    { id: "b2", name: "AI art ideas", privacy: "PUBLIC" },
    { id: "b3", name: "Drafts", privacy: "SECRET" },
  ],
};

export const TIKTOK_CREATOR = {
  success: true,
  data: {
    creator_avatar_url: avatar(33),
    creator_username: "sadekcreates",
    creator_nickname: "Sadek Creates",
    privacy_level_options: ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"],
    comment_disabled: false,
    duet_disabled: false,
    stitch_disabled: true,
    max_video_post_duration_sec: 600,
    can_post: true,
  },
};

export function voiceLibrary(elevenV3Voices: unknown[]) {
  return {
    success: true,
    presets: [
      { id: "Wise_Woman", label: "Wise Woman" },
      { id: "Friendly_Person", label: "Friendly Person" },
      { id: "Deep_Voice_Man", label: "Deep Voice Man" },
      { id: "Calm_Woman", label: "Calm Woman" },
    ],
    elevenV3Voices,
    clones: [
      { id: "clone_1", name: "My narration voice", description: "Recorded in the studio, calm delivery", sampleAsset: { url: AUDIO }, createdAt: iso(-5 * DAY) },
      { id: "clone_2", name: "Podcast me", description: null, sampleAsset: null, createdAt: iso(-2 * DAY) },
    ],
    elevenLabsConfigured: true,
    maxClones: 10,
    cloneCreditCost: 15,
  };
}

export const COMPOSE_PREFILL = {
  prefill: {
    caption: "Turned one product photo into a full campaign with Unsora ✨ #ai #marketing",
    mediaType: "images",
    mediaUrls: [img("compose1"), img("compose2", 1080, 1920), img("compose3", 1080, 1080)],
    accountIds: ["acc_ig", "acc_tt", "acc_pin"],
  },
  accounts: { success: true, data: ACCOUNTS },
  subscription: SUBSCRIPTION,
};

export const COMPOSE_VIDEO = {
  prefill: { caption: "How we built a 30-second ad with zero filming.", mediaType: "video", mediaUrls: [VIDEO], accountIds: ["acc_yt", "acc_tt"] },
  accounts: { success: true, data: ACCOUNTS },
  subscription: SUBSCRIPTION,
};

export const CREATE_POST_RESULT = { success: true, data: { id: NEW_POST.id, status: "publishing", type: "slideshow", caption: NEW_POST.mainCaption, scheduled_at: null, accounts: ["acc_tt", "acc_pin"] }, message: "Post saved as draft" };
