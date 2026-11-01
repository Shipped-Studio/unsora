-- Caption styles users save from the subtitle editor's Customize panel.

-- CreateTable
CREATE TABLE "subtitle_presets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtitle_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subtitle_presets_userId_createdAt_idx" ON "subtitle_presets"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "subtitle_presets" ADD CONSTRAINT "subtitle_presets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
