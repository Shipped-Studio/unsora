-- DropThumbSetAndThumbTemplate
ALTER TABLE "image_generations" DROP CONSTRAINT IF EXISTS "image_generations_thumbSetId_fkey";
DROP INDEX IF EXISTS "image_generations_thumbSetId_idx";
ALTER TABLE "image_generations" DROP COLUMN IF EXISTS "thumbSetId";

DROP TABLE IF EXISTS "_SetToThumbTemplate";
DROP TABLE IF EXISTS "thumb_sets";
DROP TABLE IF EXISTS "thumb_templates";
