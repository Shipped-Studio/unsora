-- DropThumbProject
ALTER TABLE "thumb_sets" DROP CONSTRAINT IF EXISTS "thumb_sets_projectId_fkey";
DROP INDEX IF EXISTS "thumb_sets_projectId_idx";
ALTER TABLE "thumb_sets" DROP COLUMN IF EXISTS "projectId";

DROP TABLE IF EXISTS "thumb_projects";
