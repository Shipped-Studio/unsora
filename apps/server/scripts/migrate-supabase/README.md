# Supabase move: ap-northeast-1 → us-east-1

Moves the production database and the `media` storage bucket to the new
project. The `dev`, `landing` and `aura-test` buckets stay in the old project,
so the old project keeps running (test.tryunsora.com and the landing site use
it). Stored file URLs are rewritten to the new project's address.

Run everything from `apps/server`. Use the session pooler (port 5432) URLs
for `*_DIRECT_URL`, and percent-encode special characters in passwords
(`@` → `%40`).

## Before the cutover (no downtime)

1. In the new project, set Storage → Settings → upload size limit at least as
   large as the biggest file in `media` (the app allows 500 MB video imports).
2. Bulk-copy the bucket (re-runnable; skips files already copied):

   ```sh
   OLD_SUPABASE_URL=... OLD_SUPABASE_SECRET_KEY=... \
   NEW_SUPABASE_URL=... NEW_SUPABASE_SECRET_KEY=... \
   BUCKET=media node scripts/migrate-supabase/copy-storage.mjs --dry-run   # then without --dry-run
   ```

3. Rehearse the database move into the new project, then point a local
   server at it and click through the app:

   ```sh
   OLD_DIRECT_URL=... NEW_DIRECT_URL=... \
   OLD_STORAGE_BASE=https://<old-ref>.supabase.co/storage/v1/object/public/media/ \
   NEW_STORAGE_BASE=https://<new-ref>.supabase.co/storage/v1/object/public/media/ \
   bash scripts/migrate-supabase/migrate-db.sh
   ```

   It dumps the old `public` schema, restores it, runs `prisma db push`
   (production has no migration history; the changes since are additive),
   checks every table's row count matches, and rewrites the URLs.

## Cutover (maintenance window, ~15 min)

1. Stop writes: pause the Trigger.dev prod queues and the scheduler, and
   scale the API down (or show a maintenance page).
2. `copy-storage.mjs` again: copies only what was uploaded since step 2.
3. `REPLACE=1 bash scripts/migrate-supabase/migrate-db.sh`: replaces the
   rehearsal data with a fresh copy.
4. Update env vars on **Railway (server)** and **Trigger.dev prod**:
   `DATABASE_URL` (6543, `?pgbouncer=true`), `DIRECT_URL` (5432),
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=media`,
   and `MEDIA_STORAGE_BASE` if it's set (new storage prefix).
5. If `files.tryunsora.com` (Azure Front Door, used for TikTok media) points
   at the old project, repoint its origin to the new one.
6. Redeploy the server, deploy Trigger.dev, resume queues. Check an old
   file, a new upload, a generation and a scheduled post.

## After

- Keep the old project. Delete only the old `media` bucket, and only after a
  few weeks (sent emails and copied links still point at it).
- In the new project, take `public` off the Data API's exposed schemas
  (Settings → API). The app connects as `postgres` and never uses the REST
  API, and the tables have no row-level security.
