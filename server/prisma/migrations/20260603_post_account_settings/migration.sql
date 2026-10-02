-- Consolidate platform options into post_accounts.settings (replaces tiktok_settings if present).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_accounts'
      AND column_name = 'tiktok_settings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'post_accounts'
        AND column_name = 'settings'
    ) THEN
      ALTER TABLE "post_accounts" RENAME COLUMN "tiktok_settings" TO "settings";
    ELSE
      UPDATE "post_accounts"
      SET "settings" = COALESCE("settings", "tiktok_settings")
      WHERE "tiktok_settings" IS NOT NULL;
      ALTER TABLE "post_accounts" DROP COLUMN "tiktok_settings";
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_accounts'
      AND column_name = 'settings'
  ) THEN
    ALTER TABLE "post_accounts" ADD COLUMN "settings" JSONB;
  END IF;
END $$;
