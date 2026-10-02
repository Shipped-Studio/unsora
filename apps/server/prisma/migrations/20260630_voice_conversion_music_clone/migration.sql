-- AlterTable
ALTER TABLE "music_generations" ADD COLUMN "voiceId" TEXT;

-- CreateTable
CREATE TABLE "voice_conversions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "elevenlabs_voice_id" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'mp3',
    "sourceAssetId" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outputAssetId" TEXT,

    CONSTRAINT "voice_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_conversions_userId_idx" ON "voice_conversions"("userId");
CREATE INDEX "voice_conversions_status_idx" ON "voice_conversions"("status");
CREATE INDEX "voice_conversions_userId_status_idx" ON "voice_conversions"("userId", "status");
CREATE INDEX "voice_conversions_userId_createdAt_idx" ON "voice_conversions"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "voice_conversions" ADD CONSTRAINT "voice_conversions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_conversions" ADD CONSTRAINT "voice_conversions_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "voice_conversions" ADD CONSTRAINT "voice_conversions_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
