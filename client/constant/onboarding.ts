export const CAROUSEL_ITEMS = [
  {
    id: "video-generator",
    name: "Video Generator",
    description: "Generate AI videos with multiple models",
    badge: "NEW",
  },
  {
    id: "image-generator",
    name: "Image Generator",
    description: "Create images with advanced AI models",
    badge: "NEW",
  },
  {
    id: "ai-influencer",
    name: "AI Influencer Studio",
    description: "Ultra-realistic influencer photos",
    badge: "NEW",
  },
  {
    id: "ai-avatar",
    name: "AI Avatar Maker",
    description: "Create talking avatar videos from a photo",
    badge: "NEW",
  },
  {
    id: "motion-control",
    name: "Motion Control",
    description: "AI motion capture and transfer",
    badge: "V3.0",
  },
];

export const REFERRAL_SOURCES = [
  { id: "google", label: "Google Search" },
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "Twitter / X" },
  { id: "tiktok", label: "TikTok" },
  { id: "friend", label: "Friend / Referral" },
  { id: "reddit", label: "Reddit" },
  { id: "instagram", label: "Instagram" },
  { id: "other", label: "Other" },
] as const;

export const ROLES = [
  {
    id: "content-creator",
    label: "Content Creator",
    subtitle: "Youtube, Tiktok, Instagram",
  },
  {
    id: "marketer",
    label: "Marketer/ Advertiser",
    subtitle: "Ads, campaigns, social media",
  },
  {
    id: "filmmaker",
    label: "Filmmaker, Editor",
    subtitle: "Professional video production",
  },
  {
    id: "business",
    label: "Business/ Agency",
    subtitle: "Client work, branding, scale",
  },
  {
    id: "hobbyist",
    label: "Hobbyist / Explorer",
    subtitle: "Just experimenting with AI",
  },
  {
    id: "developer",
    label: "Developer/ Builder",
    subtitle: "API integration, automation",
  },
] as const;

export type ToolCategory = "VIDEO" | "AUDIO" | "IMAGE";

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  badge?: string;
}

export const TOOLS: Tool[] = [
  {
    id: "video-generator",
    name: "Video Generator",
    description: "Generate AI videos with multiple...",
    category: "VIDEO",
    badge: "NEW",
  },
  {
    id: "image-generator",
    name: "Image Generator",
    description: "Create images with advanced AI...",
    category: "IMAGE",
    badge: "NEW",
  },
  {
    id: "ai-influencer",
    name: "AI Influencer Studio",
    description: "Ultra-realistic influencer photos",
    category: "VIDEO",
    badge: "NEW",
  },
  {
    id: "ai-avatar",
    name: "AI Avatar Maker",
    description: "Create talking avatar videos from a...",
    category: "VIDEO",
    badge: "NEW",
  },
  {
    id: "motion-control",
    name: "Motion Control",
    description: "AI motion capture and transfer",
    category: "AUDIO",
    badge: "V3.0",
  },
  {
    id: "video-face-swap",
    name: "Video Face Swap",
    description: "Swap faces in videos seamlessly",
    category: "AUDIO",
  },
  {
    id: "subtitle-editor",
    name: "Subtitle Editor",
    description: "Edit and style video subtitles",
    category: "IMAGE",
  },
  {
    id: "video-upscaler",
    name: "Video Upscaler",
    description: "Upscale videos to higher quality",
    category: "IMAGE",
  },
  {
    id: "voice-changer",
    name: "Voice Changer",
    description: "Transform voices with AI",
    category: "AUDIO",
  },
];

export const SHOWCASE_ITEMS = [
  {
    id: "video-generator",
    name: "Video Generator",
    badge: "NEW",
    toolId: "video-generator",
    gradient: "from-neutral-800 via-neutral-600 to-neutral-900",
  },
  {
    id: "image-generator",
    name: "Image Generator",
    badge: "NEW",
    toolId: "image-generator",
    gradient: "from-zinc-800 via-zinc-600 to-zinc-900",
  },
  {
    id: "ai-influencer",
    name: "AI Influencer Studio",
    badge: "NEW",
    toolId: "ai-influencer",
    gradient: "from-stone-800 via-stone-600 to-stone-900",
  },
  {
    id: "ai-avatar",
    name: "AI Avatar Maker",
    badge: "NEW",
    toolId: "ai-avatar",
    gradient: "from-neutral-900 via-neutral-700 to-neutral-800",
  },
  {
    id: "motion-control",
    name: "Motion Control",
    badge: "V3.0",
    toolId: "motion-control",
    gradient: "from-zinc-900 via-zinc-700 to-zinc-800",
  },
  {
    id: "video-face-swap",
    name: "Video Face Swap",
    toolId: "video-face-swap",
    gradient: "from-neutral-700 via-neutral-800 to-neutral-950",
  },
  {
    id: "subtitle-editor",
    name: "Subtitle Editor",
    toolId: "subtitle-editor",
    gradient: "from-stone-900 via-stone-700 to-stone-800",
  },
  {
    id: "video-upscaler",
    name: "Video Upscaler",
    toolId: "video-upscaler",
    gradient: "from-zinc-700 via-zinc-800 to-zinc-950",
  },
  {
    id: "voice-changer",
    name: "Voice Changer",
    toolId: "voice-changer",
    gradient: "from-neutral-800 via-neutral-900 to-black",
  },
];

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for exploring",
    price: 19,
    credits: 500,
    cta: "Current Plan",
    ctaStyle: "outline" as const,
    popular: false,
    features: [
      "Seedance 2.0",
      "Sora Watermark Remover (10 Credits)",
      "720p quality",
      "Basic support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For serious creators",
    price: 39,
    credits: 1100,
    cta: "Upgrade to Pro",
    ctaStyle: "filled" as const,
    popular: true,
    features: [
      "Unlimited videos",
      "Unlimited images",
      "Up to 4K quality",
      "Priority support",
      "Multiple outputs",
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "For teams & agencies",
    price: 149,
    credits: 5000,
    cta: "Get Business",
    ctaStyle: "filled" as const,
    popular: false,
    features: [
      "Everything in Pro",
      "Team workspace",
      "API access",
      "8K quality",
      "24/7 dedicated support",
    ],
  },
];
