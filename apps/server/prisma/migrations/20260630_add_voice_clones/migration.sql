-- CreateTable
CREATE TABLE "voice_clones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "elevenlabs_voice_id" TEXT NOT NULL,
    "sampleAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_clones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_clones_elevenlabs_voice_id_key" ON "voice_clones"("elevenlabs_voice_id");

-- CreateIndex
CREATE INDEX "voice_clones_userId_idx" ON "voice_clones"("userId");

-- CreateIndex
CREATE INDEX "voice_clones_userId_createdAt_idx" ON "voice_clones"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "voice_clones" ADD CONSTRAINT "voice_clones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_clones" ADD CONSTRAINT "voice_clones_sampleAssetId_fkey" FOREIGN KEY ("sampleAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
