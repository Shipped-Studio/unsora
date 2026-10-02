-- Library folders. Assets can sit in one folder; deleting a folder unfiles
-- its assets instead of deleting them.

-- CreateTable
CREATE TABLE "asset_folders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_folders_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "assets" ADD COLUMN "folderId" TEXT;

-- CreateIndex
CREATE INDEX "asset_folders_userId_idx" ON "asset_folders"("userId");

-- CreateIndex
CREATE INDEX "assets_userId_folderId_idx" ON "assets"("userId", "folderId");

-- AddForeignKey
ALTER TABLE "asset_folders" ADD CONSTRAINT "asset_folders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "asset_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
