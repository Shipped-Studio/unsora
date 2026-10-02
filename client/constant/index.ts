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

// Plan-specific features
export const BASIC_PLAN_FEATURES = [...BASE_FEATURES];

export const PRO_PLAN_FEATURES = [...BASE_FEATURES, "Priority Support"];

export const POWER_PLAN_FEATURES = [...BASE_FEATURES, "Priority Support"];

// Keep for backward compatibility if needed, but prefer specific lists
export const PLAN_FEATURES = BASIC_PLAN_FEATURES;

export const FAQS = [
  {
    question: "Who is this for?",
    answer:
      "AI video creators, marketers and agencies generating dozens of AI videos/short-form videos for social media, ads and A/B testing. Who want them polished, without AI watermarks and viral-ready without manual editing.",
  },
  {
    question: "How do credits work?",
    answer:
      "Watermark removal costs 1 credit per video. Upscaling costs 1 credit per video. Subtitles are unlimited on pro and power plans. Credits refresh monthly.",
  },
  {
    question: "Does the watermark remover actually work?",
    answer:
      "Yes. Watermarks from Sora 2, Runway, Pika, and other AI platforms are removed cleanly—no ghosting, blur or artifacts.",
  },
  {
    question: "How does the upscaler work?",
    answer:
      "We upscale to 1080p using AI that enhances clarity without introducing artifacts. Your videos look crisp, not over-processed.",
  },
  {
    question: "What about subtitles?",
    answer:
      "Subtitles are unlimited on Pro and Power plans. Our AI generates engaging, viral-style captions that boost watch time and engagement across all platforms.",
  },
  {
    question: "What video formats are supported?",
    answer: "MP4, MOV and direct public Sora links.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel in one click from your account dashboard. No cancellation fees or hidden charges.",
  },
  {
    question: "Is there a refund?",
    answer:
      "Yes. If you've used less than 20% of your monthly credits, contact us for a full refund, no questions asked.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "We offer a free trial to test all features, the first 5 videos are on us. After that, you'll need a paid plan to continue processing videos.",
  },
  {
    question: "Need help?",
    answer: "support@tryunsora.com",
  },
];

export const MORE_EXAMPLES = [
  {
    before:
      "https://stsadekirfan532192938747.blob.core.windows.net/trykillion/1762340007904-video.Sora%20Video%3A%20s_69093334dbb881919ff7b4e84a4b6c93",
    after:
      "https://stsadekirfan532192938747.blob.core.windows.net/trykillion/1762340153998-video.mp4",
  },
  {
    before:
      "https://stsadekirfan532192938747.blob.core.windows.net/trykillion/1762340014584-video.Sora%20Video%3A%20s_69078d1a46148191b71abca3b39cbf2e",
    after:
      "https://stsadekirfan532192938747.blob.core.windows.net/trykillion/1762340261145-video.mp4",
  },
  {
    before:
      "https://stsadekirfan532192938747.blob.core.windows.net/trykillion/uploads/2025-11-05T13-19-00-288Z-2025-11-05T10-49-31-714Z-user-zkM2bJtaANCjAP48bJBumul8_gen_01k953wt2ffym99hegcbmqxgac_watermarked_md.mp4",
    after:
      "https://stsadekirfan532192938747.blob.core.windows.net/trykillion/1762349075173-video.mp4",
  },
];

// Sheduler constant
export const DURATION_LIMITS = {
  twitter: 140, // 2:20
  youtube: 180, // 3:00
  system: 300, // 5:00
};

export const SUPPORTED_RATIOS = [
  { ratio: 16 / 9, label: "16:9 (Landscape)" },
  { ratio: 9 / 16, label: "9:16 (Vertical)" },
  { ratio: 4 / 3, label: "4:3" },
  { ratio: 3 / 4, label: "3:4" },
  { ratio: 1, label: "1:1 (Square)" },
];

export const SEEDANCE_2_0_VIDEOS = [
  {
    id: 1,
    url: "https://unsora-videos.s3.us-east-2.amazonaws.com/videos/1771487911505_893fb0fc-32d7-43d1-a1c6-174acb2878d4+(2).mp4",
  },
  {
    id: 2,
    url: "https://unsora-videos.s3.us-east-2.amazonaws.com/videos/4730945c5df14d709ddda841fc103801.mp4",
  },
  {
    id: 3,
    url: "https://unsora-videos.s3.us-east-2.amazonaws.com/videos/67378dd89fbe435499d0b6514b95d087.mp4",
  },
  {
    id: 4,
    url: "https://unsora-videos.s3.us-east-2.amazonaws.com/videos/739d450d68704c93aa0b0ed164167449.mp4",
  },
  {
    id: 5,
    url: "https://unsora-videos.s3.us-east-2.amazonaws.com/videos/9d10e8d4a17f41619fe7cfd8e7cd98aa+(1).mp4",
  },
  {
    id: 6,
    url: "https://unsora-videos.s3.us-east-2.amazonaws.com/videos/c207b16b18e04d93b3b22c06311ea6d8.mp4",
  },
  {
    id: 7,
    url: "https://unsora-videos.s3.us-east-2.amazonaws.com/videos/8a0885b556ca45488eede8509a7f58f9.mp4",
  },
];

export const SUGGESTED_PROMPTS = [
  {
    label: "Cinematic drama",
    text: "Inside a parked car at night in heavy rain, a Japanese couple sits trapped in suffocating silence. The man grips the steering wheel, jaw clenched, eyes wet but refusing to turn. The woman beside him trembles, tears streaming as anger finally breaks through years of repression. Neon city lights smear across rain-covered glass like bleeding color. Emotional eruption contained in a confined space. HBO/Netflix prestige drama tone, ultra-realistic skin texture, trembling breath, tear reflections, rain streak distortion. Camera outside passenger window through wet glass, tight medium close-up on both faces, shallow depth, slight handheld instability, oppressive blue-black grade. 4K cinematic realism. 15s.  Dialogue (Japanese):  Woman (shaking, voice cracking into anger): 「ねえ…私のこと、いつから見なくなったの？」 (When… did you stop seeing me?)  Man (through teeth, breaking): 「見てたよ…ずっと。怖くて、触れられなかっただけだ。」 (I did… all along. I was just too afraid to reach you.)  Woman (crying openly now): 「嘘。あなたは逃げただけ。私が壊れていくのを、隣で見てただけ！」 (Lies. You just ran. You watched me fall apart right beside you!)  Man (voice collapsing): 「……ごめん。守れなかった。」 …I’m sorry. I couldn’t protect you.  Woman (whisper, devastated): 「守ってほしかったのは…あなたじゃない。あなたの愛だった。」 (It wasn’t you I needed to protect me… it was your love.)",
  },
  {
    label: "Product adventure",
    text: "A friendly white wolf playfully chasing and tumbling with a beautiful blonde cute young woman in deep snow-covered forest. Multiple dynamic cuts: wide playful chase, close-up joyful expressions, medium shot of them rolling down a hill laughing. Suddenly the ground cracks—they fall together into a hidden ice cavern below, landing softly in snow. They discover a frozen skeleton clutching an ancient map in its bony hand. Expressive character animation, vibrant colors, whimsical yet adventurous tone.",
  },
  {
    label: "Surreal painting",
    text: "Inside a classic painting on the wall: The painted character looks guilty, eyes darting left and right, then peeks out of the frame nervously. Quickly reaches out of the painting to grab a can of Coke from the real table in front, takes a sneaky sip with satisfied expression. Footsteps approach—panics, hurriedly places the can back. A Western cowboy enters frame, picks up the can casually and walks off. Final push-in to pure black background with dramatic top light on the can alone. Artistic subtitles fade in: “宜口可乐，不可不尝！” (Coke – you must try it!). Meta 2D-to-3D transition, humorous tone, high detail.",
  },
  {
    label: "Luxury commercial",
    text: "Luxury watch showcase: A premium stainless steel diver's watch on black velvet pedestal in dark studio. Slow 360-degree orbit clockwise, soft key light from 45 degrees creating specular highlights on bezel and crystal. Macro close-ups transition to reveal intricate dial engravings and lume glow. Subtle reflections, no distractions, ultra-sharp 8K focus, elegant minimalist commercial style.",
  },
  {
    label: "Art film",
    text: `# Deodorant Film — Boxing Concept

**15 sec | 24fps | 16:9 + 9:16 | Kodak Vision3 500T 35mm, heavy grain**

## Concept
A boxer pushes his body to the edge. Through sweat, impact, and heat — the deodorant holds. A pressure test disguised as cinema.

## Look & Feel
Crushed blacks, teal midtones, burnt amber highlights. Skin warm, everything else cold. 2.39:1 anamorphic. SMASH CUTS ONLY — synced to impacts, accelerating like a heartbeat under stress. No dissolves, no fades, ever.

## Audio
Sub-bass heartbeat accelerating from 60bpm to 160bpm. Foley-heavy impacts (rope snap, glove crack, breath burst). Dark industrial percussion, no melody. At 14 sec — total silence. Clean tone. Logo.

## Shot List

| Shot | Time | Duration | Description |
|------|------|----------|-------------|
| 1 | 00:00–00:02 | 2s | **PRODUCT RITUAL.** Macro: hand grabs deodorant, pulls cap, applies. Hard side light. |
| 2 | 00:02–00:03.5 | 1.5s | Wide: jumping rope in hazy concrete gym. Locked tripod. |
| 3 | 00:03.5–00:05 | 1.5s | Close-up: fist hits heavy bag, sweat explodes. 96fps slo-mo. |
| 4 | 00:05–00:06.5 | 1.5s | Low tracking shot: running through empty dawn streets. Lens flare. |
| 5 | 00:06.5–00:07.5 | 1s | **PRODUCT PROOF.** Macro insert: underarm mid-workout, sweat everywhere, product holds. |
| 6 | 00:07.5–00:08.5 | 1s | Sparring — getting hit, recovering, countering. Two rapid cuts. |
| 7 | 00:08.5–00:09.5 | 1s | Shadowboxing toward camera. Eyes locked. |
| 8 | 00:09.5–00:10.5 | 1s | Rapid montage: lacing shoes, wrapping hands, rope, exhale. Cuts every 0.5s. |
| 9 | 00:10.5–00:12 | 1.5s | Arena entrance. Steadicam. Anamorphic flares. Eyes forward. |
| 10 | 00:12–00:13 | 1s | Ring. Bell. First punch. SMASH CUT. |
| 11 | 00:13–00:14 | 1s | Victory. Arms raised. One second only. |
| 12 | 00:14–00:15 | 1s | **PRODUCT PAYOFF.** Black. Silence. Packshot fades in. *"Won't break under pressure."* |

## Product Strategy
Three appearances — **ritual** (Shot 1), **proof** (Shot 5), **payoff** (Shot 12). Never the focus for more than 2 seconds. It earns its place by surviving the same 15 seconds the athlete does.

## Key Directives
The intensity never plateaus. Sweat is in every frame — it's the visual motif that makes the product's survival matter. Product moments stay raw and embedded in the action, never clinical. The final second of silence after 14 seconds of chaos is the most powerful beat in the film.`,
  },
];
