-- CreateTable
CREATE TABLE "avatar_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'skyreels-v3',
    "transcript" TEXT NOT NULL,
    "emotion" TEXT NOT NULL DEFAULT 'neutral',
    "prompt" TEXT NOT NULL DEFAULT '',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "voiceId" TEXT NOT NULL DEFAULT 'Friendly_Person',
    "imageAssetId" TEXT,
    "audioAssetId" TEXT,
    "taskId" TEXT,
    "ttsTaskId" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outputAssetId" TEXT,

    CONSTRAINT "avatar_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'minimax-speech-2.6-hd',
    "text" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL DEFAULT 'Friendly_Person',
    "emotion" TEXT NOT NULL DEFAULT 'neutral',
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "outputFormat" TEXT NOT NULL DEFAULT 'mp3',
    "taskId" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outputAssetId" TEXT,

    CONSTRAINT "voice_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avatar_generations_taskId_key" ON "avatar_generations"("taskId");

-- CreateIndex
CREATE INDEX "avatar_generations_userId_idx" ON "avatar_generations"("userId");

-- CreateIndex
CREATE INDEX "avatar_generations_status_idx" ON "avatar_generations"("status");

-- CreateIndex
CREATE INDEX "avatar_generations_taskId_idx" ON "avatar_generations"("taskId");

-- CreateIndex
CREATE INDEX "avatar_generations_userId_status_idx" ON "avatar_generations"("userId", "status");

-- CreateIndex
CREATE INDEX "avatar_generations_userId_createdAt_idx" ON "avatar_generations"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "avatar_generations_status_createdAt_idx" ON "avatar_generations"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "voice_generations_taskId_key" ON "voice_generations"("taskId");

-- CreateIndex
CREATE INDEX "voice_generations_userId_idx" ON "voice_generations"("userId");

-- CreateIndex
CREATE INDEX "voice_generations_status_idx" ON "voice_generations"("status");

-- CreateIndex
CREATE INDEX "voice_generations_taskId_idx" ON "voice_generations"("taskId");

-- CreateIndex
CREATE INDEX "voice_generations_userId_status_idx" ON "voice_generations"("userId", "status");

-- CreateIndex
CREATE INDEX "voice_generations_userId_createdAt_idx" ON "voice_generations"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "voice_generations_status_createdAt_idx" ON "voice_generations"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "avatar_generations" ADD CONSTRAINT "avatar_generations_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_generations" ADD CONSTRAINT "avatar_generations_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_generations" ADD CONSTRAINT "avatar_generations_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_generations" ADD CONSTRAINT "avatar_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_generations" ADD CONSTRAINT "voice_generations_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_generations" ADD CONSTRAINT "voice_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
