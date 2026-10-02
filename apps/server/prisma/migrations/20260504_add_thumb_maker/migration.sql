-- CreateTable ThumbProject
CREATE TABLE "thumb_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "highlights" TEXT[],
    "targetAudience" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thumb_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable ThumbTemplate
CREATE TABLE "thumb_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "imageAssetId" TEXT NOT NULL,
    "tags" TEXT[],
    "creator" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thumb_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable ThumbSet
CREATE TABLE "thumb_sets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "additionalInstructions" TEXT,
    "channelStyle" TEXT,
    "expression" TEXT,
    "variations" INTEGER NOT NULL DEFAULT 1,
    "youtubeLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thumb_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable SetToThumbTemplate (many-to-many junction)
CREATE TABLE "_SetToThumbTemplate" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- AlterTable ImageGeneration: add thumbSetId
ALTER TABLE "image_generations" ADD COLUMN "thumbSetId" TEXT;

-- CreateIndex
CREATE INDEX "thumb_projects_userId_idx" ON "thumb_projects"("userId");
CREATE INDEX "thumb_projects_userId_createdAt_idx" ON "thumb_projects"("userId", "createdAt" DESC);
CREATE INDEX "thumb_templates_userId_idx" ON "thumb_templates"("userId");
CREATE INDEX "thumb_templates_tags_idx" ON "thumb_templates"("tags");
CREATE INDEX "thumb_templates_creator_idx" ON "thumb_templates"("creator");
CREATE INDEX "thumb_sets_userId_idx" ON "thumb_sets"("userId");
CREATE INDEX "thumb_sets_projectId_idx" ON "thumb_sets"("projectId");
CREATE INDEX "thumb_sets_userId_createdAt_idx" ON "thumb_sets"("userId", "createdAt" DESC);
CREATE INDEX "thumb_sets_status_idx" ON "thumb_sets"("status");
CREATE INDEX "image_generations_thumbSetId_idx" ON "image_generations"("thumbSetId");
CREATE UNIQUE INDEX "_SetToThumbTemplate_AB_unique" ON "_SetToThumbTemplate"("A", "B");
CREATE INDEX "_SetToThumbTemplate_B_index" ON "_SetToThumbTemplate"("B");

-- AddForeignKey
ALTER TABLE "thumb_projects" ADD CONSTRAINT "thumb_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "thumb_projects" ADD CONSTRAINT "thumb_projects_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "thumb_templates" ADD CONSTRAINT "thumb_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "thumb_templates" ADD CONSTRAINT "thumb_templates_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "thumb_sets" ADD CONSTRAINT "thumb_sets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "thumb_sets" ADD CONSTRAINT "thumb_sets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "thumb_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SetToThumbTemplate" ADD CONSTRAINT "_SetToThumbTemplate_A_fkey" FOREIGN KEY ("A") REFERENCES "thumb_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SetToThumbTemplate" ADD CONSTRAINT "_SetToThumbTemplate_B_fkey" FOREIGN KEY ("B") REFERENCES "thumb_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_thumbSetId_fkey" FOREIGN KEY ("thumbSetId") REFERENCES "thumb_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
