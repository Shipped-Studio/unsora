-- Monthly credits tiers mirror the one-time packs: the same credits, $1 less
-- a month, so they keep the packs' markup.
--
-- A credit is costed at $0.028 (CREDIT_USD_VALUE) with a 20% generation
-- margin, so each covers about $0.0233 of model cost. After Stripe's fee
-- (2.9% + 30c), with every credit used:
--
--   Lite   $19 /   500   +56%   (pack:   500 for $20)
--   Core   $49 / 1,500   +35%   (pack: 1,500 for $50)
--   Max   $149 / 5,000   +24%   (pack: 5,000 for $150)
--
-- Only tiers still at their seeded price and credits are changed, so a tier
-- already edited at /admin/pricing stays. A Stripe price made for the old
-- amount is kept as a previous price (subscriptions on it still route as
-- credits) and cleared, so the next checkout creates one at the new amount.

WITH next ("key", "credits", "priceCents", "oldCredits", "oldPriceCents") AS (
  VALUES
    ('credits_lite', 500, 1900, 1000, 2900),
    ('credits_core', 1500, 4900, 3000, 7900),
    ('credits_max', 5000, 14900, 10000, 22900)
)
UPDATE "plans" AS p
SET
  "credits" = next."credits",
  "priceCents" = next."priceCents",
  "metadata" = CASE
    WHEN p."stripePriceId" IS NULL THEN p."metadata"
    ELSE jsonb_set(
      COALESCE(p."metadata", '{}'::jsonb),
      '{previousStripePriceIds}',
      COALESCE(p."metadata"->'previousStripePriceIds', '[]'::jsonb) || to_jsonb(p."stripePriceId")
    )
  END,
  "stripePriceId" = NULL,
  "updatedAt" = now()
FROM next
WHERE p."key" = next."key"
  AND p."credits" = next."oldCredits"
  AND p."priceCents" = next."oldPriceCents";
