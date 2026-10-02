export const STRIPE_PRICES = {
  basic: process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID as string,
  pro: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID as string,
  power: process.env.NEXT_PUBLIC_STRIPE_POWER_PRICE_ID as string,
};

export const PLAN_DETAILS = {
  free: {
    name: "Free",
    credits: 0,
    price: 0,
    color: "secondary",
    description: "Get started for free",
  },
  basic: {
    name: "Basic",
    credits: 500,
    price: 19,
    color: "default",
    description: "Everything you need to start creating professional AI content.",
  },
  pro: {
    name: "Pro",
    credits: 1100,
    price: 39,
    color: "default",
    description: "For creators who need more power and priority access.",
    isPopular: true,
  },
  power: {
    name: "Power",
    credits: 5000,
    price: 149,
    color: "default",
    description: "Maximum output for teams, agencies, and power users.",
    isBestValue: true,
  },
};

// Base features available in all plans
const BASE_FEATURES = [
  "Seedance 2.0",
  "Video Generation",
  "Image Generation",
  "Motion Control",
  "Video Upscaler (Bulk)",
  "Image Upscaler",
  "Subtitle Remover",
  "Subtitle Editor",
  "Movie Materials Generator",
  "AI Influencer Studio",
] as const;

export const BASIC_PLAN_FEATURES = [...BASE_FEATURES];

export const PRO_PLAN_FEATURES = [...BASE_FEATURES, "Priority Support"];

export const POWER_PLAN_FEATURES = [...BASE_FEATURES, "Priority Support"];

export const PLANS = [
  { key: "basic" as const, features: BASIC_PLAN_FEATURES },
  { key: "pro" as const, features: PRO_PLAN_FEATURES },
  { key: "power" as const, features: POWER_PLAN_FEATURES },
];

/**
 * Purely-presentational plan data that stays on the client (marketing copy).
 * The commercial facts — name, price, credits, isPopular — come from the DB
 * via `useSubscriptionPlans()`. Keyed by the same stable plan `key`.
 */
export const PLAN_PRESENTATION: Record<
  string,
  { features: readonly string[]; isBestValue?: boolean }
> = {
  basic: { features: BASIC_PLAN_FEATURES },
  pro: { features: PRO_PLAN_FEATURES },
  power: { features: POWER_PLAN_FEATURES, isBestValue: true },
};

export const DURATION_LIMITS = {
  system: 600,
  twitter: 140,
  youtube: 180,
};

export const EXPLORE_CATEGORIES = [
  "For You",
  "Videos",
  "Images",
  "Motion Control",
  "Creatives",
];

export const SHOWCASE_ITEMS = [
  {
    id: 1,
    image:
      "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?auto=format&fit=crop&w=600&q=80",
    user: "artisan_ai",
    likes: 407,
    isVideo: false,
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
    user: "landscape_pro",
    likes: 280,
    isVideo: true,
    duration: "0:29",
  },
  {
    id: 3,
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
    user: "portrait_studio",
    likes: 193,
    isVideo: false,
  },
  {
    id: 4,
    image:
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=600&q=80",
    user: "OPAL",
    likes: 809,
    isVideo: false,
  },
  {
    id: 5,
    image:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80",
    user: "cinema_ai",
    likes: 198,
    isVideo: true,
    duration: "1:06",
  },
  {
    id: 6,
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
    user: "influencer_lab",
    likes: 342,
    isVideo: false,
  },
  {
    id: 7,
    image:
      "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=600&q=80",
    user: "Skyfall",
    likes: 220,
    isVideo: true,
    duration: "0:45",
  },
  {
    id: 8,
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80",
    user: "videosAlpha",
    likes: 156,
    isVideo: false,
  },
];
