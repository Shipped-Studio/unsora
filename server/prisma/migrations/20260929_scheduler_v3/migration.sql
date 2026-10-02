-- CreateEnum
CREATE TYPE "PostSource" AS ENUM ('WEB', 'API', 'MCP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "timezone" TEXT,
ADD COLUMN "weekStartsOn" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN "source" "PostSource" NOT NULL DEFAULT 'WEB',
ADD COLUMN "apiKeyId" TEXT;

-- CreateTable
CREATE TABLE "posting_slots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posting_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "posts_userId_source_idx" ON "posts"("userId", "source");

-- CreateIndex
CREATE INDEX "posts_apiKeyId_idx" ON "posts"("apiKeyId");

-- CreateIndex
CREATE INDEX "posting_slots_userId_idx" ON "posting_slots"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "posting_slots_userId_weekday_time_key" ON "posting_slots"("userId", "weekday", "time");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_slots" ADD CONSTRAINT "posting_slots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
