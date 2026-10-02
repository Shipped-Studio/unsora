-- CreateTable
CREATE TABLE "music_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'mureka-v9',
    "lyrics" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'mp3',
    "taskId" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outputAssetId" TEXT,

    CONSTRAINT "music_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "music_generations_taskId_key" ON "music_generations"("taskId");

-- CreateIndex
CREATE INDEX "music_generations_userId_idx" ON "music_generations"("userId");

-- CreateIndex
CREATE INDEX "music_generations_status_idx" ON "music_generations"("status");

-- CreateIndex
CREATE INDEX "music_generations_taskId_idx" ON "music_generations"("taskId");

-- CreateIndex
CREATE INDEX "music_generations_userId_status_idx" ON "music_generations"("userId", "status");

-- CreateIndex
CREATE INDEX "music_generations_userId_createdAt_idx" ON "music_generations"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "music_generations_status_createdAt_idx" ON "music_generations"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "music_generations" ADD CONSTRAINT "music_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_generations" ADD CONSTRAINT "music_generations_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
