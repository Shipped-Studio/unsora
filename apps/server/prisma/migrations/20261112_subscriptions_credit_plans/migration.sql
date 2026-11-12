-- Starting Monthly credits tiers. Prices and credits are edited at
-- /admin/pricing; the Stripe product and price are created there on save, or
-- on the first checkout of a tier that has none yet. Each tier costs less per
-- credit than the one-time packs ($0.040 / $0.033 / $0.030).
INSERT INTO "plans" (
  "id", "key", "name", "description", "type", "credits", "priceCents",
  "currency", "interval", "sortOrder", "isActive", "isPopular", "updatedAt"
)
VALUES
  (gen_random_uuid()::text, 'credits_lite', 'Lite',
   'For trying ideas and the odd clip.',
   'CREDIT_SUBSCRIPTION', 1000, 2900, 'usd', 'MONTH', 1, true, false, now()),
  (gen_random_uuid()::text, 'credits_core', 'Core',
   'For creating every week.',
   'CREDIT_SUBSCRIPTION', 3000, 7900, 'usd', 'MONTH', 2, true, true, now()),
  (gen_random_uuid()::text, 'credits_max', 'Max',
   'For daily video and clipping.',
   'CREDIT_SUBSCRIPTION', 10000, 22900, 'usd', 'MONTH', 3, true, false, now())
ON CONFLICT ("key") DO NOTHING;
