-- Deleting a user cascades to both assets and posts. Checked per statement,
-- this key fails when the assets cascade runs before post_media's, so it's
-- checked at commit instead. Prisma can't express DEFERRABLE; keep it here.

-- DropForeignKey
ALTER TABLE "post_media" DROP CONSTRAINT "post_media_assetId_fkey";

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
