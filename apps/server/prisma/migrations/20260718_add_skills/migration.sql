-- CreateEnum
CREATE TYPE "SkillSourceType" AS ENUM ('GITHUB', 'UPLOAD');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SkillMediaType" AS ENUM ('IMAGE', 'VIDEO');


-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" "SkillSourceType" NOT NULL DEFAULT 'GITHUB',
    "githubUrl" TEXT,
    "skillMdPath" TEXT,
    "files" JSONB NOT NULL DEFAULT '[]',
    "installCommand" TEXT,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "examples" JSONB NOT NULL DEFAULT '[]',
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "ctaHeadline" TEXT NOT NULL DEFAULT '',
    "ctaBody" TEXT NOT NULL DEFAULT '',
    "status" "SkillStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_media" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "type" "SkillMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "aspect" TEXT NOT NULL DEFAULT '9/16',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- CreateIndex
CREATE INDEX "skills_status_sortOrder_idx" ON "skills"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "skill_media_skillId_sortOrder_idx" ON "skill_media"("skillId", "sortOrder");

-- AddForeignKey
ALTER TABLE "skill_media" ADD CONSTRAINT "skill_media_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

