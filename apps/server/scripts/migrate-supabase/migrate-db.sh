#!/usr/bin/env bash
# Move the app's database (public schema) from the old Supabase project to the
# new one, bring it up to the current Prisma schema, compare row counts, and
# point stored file URLs at the new storage.
#
#   cd apps/server
#   OLD_DIRECT_URL='postgresql://postgres.<old-ref>:<pw>@<old-host>:5432/postgres' \
#   NEW_DIRECT_URL='postgresql://postgres.<new-ref>:<pw>@<new-host>:5432/postgres' \
#   OLD_STORAGE_BASE='https://<old-ref>.supabase.co/storage/v1/object/public/media/' \
#   NEW_STORAGE_BASE='https://<new-ref>.supabase.co/storage/v1/object/public/media/' \
#   bash scripts/migrate-supabase/migrate-db.sh
#
# Use the session pooler (port 5432) URLs, not the 6543 transaction pooler.
# Percent-encode special characters in passwords (@ -> %40).
# REPLACE=1 drops whatever is already in the new public schema first (use it
# for the real cutover after a rehearsal).
set -euo pipefail

: "${OLD_DIRECT_URL:?set OLD_DIRECT_URL}"
: "${NEW_DIRECT_URL:?set NEW_DIRECT_URL}"
: "${OLD_STORAGE_BASE:?set OLD_STORAGE_BASE}"
: "${NEW_STORAGE_BASE:?set NEW_STORAGE_BASE}"

cd "$(dirname "$0")/../.." # apps/server
HERE=scripts/migrate-supabase
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

existing=$(psql "$NEW_DIRECT_URL" -Atc \
  "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$existing" != "0" ]; then
  if [ "${REPLACE:-0}" != "1" ]; then
    echo "The new database already has $existing table(s) in public."
    echo "Re-run with REPLACE=1 to drop them and restore again."
    exit 1
  fi
  echo "0/5 Clearing the new public schema (REPLACE=1)..."
  psql "$NEW_DIRECT_URL" -v ON_ERROR_STOP=1 -q -c \
    "drop schema public cascade; create schema public;
     grant all on schema public to postgres, service_role;"
fi

echo "1/5 Dumping the old public schema..."
pg_dump "$OLD_DIRECT_URL" --schema=public --format=custom \
  --no-owner --no-privileges --file "$WORK/public.dump"

echo "2/5 Restoring into the new project..."
# The public schema itself already exists in the new project; skip it.
pg_restore --list "$WORK/public.dump" \
  | grep -vE 'SCHEMA - public|COMMENT - SCHEMA public' > "$WORK/restore.list"
pg_restore --dbname "$NEW_DIRECT_URL" --use-list "$WORK/restore.list" \
  --no-owner --no-privileges --exit-on-error "$WORK/public.dump"

echo "3/5 Applying the current Prisma schema (additive changes only)..."
# No --accept-data-loss: if the schema would drop anything, this stops.
DATABASE_URL="$NEW_DIRECT_URL" DIRECT_URL="$NEW_DIRECT_URL" \
  npx prisma db push --skip-generate

echo "4/5 Comparing row counts (old vs new)..."
count_rows() {
  psql "$1" -At -F ' ' <<'SQL'
select table_name,
       (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
SQL
}
count_rows "$OLD_DIRECT_URL" | LC_ALL=C sort > "$WORK/old.counts"
count_rows "$NEW_DIRECT_URL" | LC_ALL=C sort > "$WORK/new.counts"
# Every old table must have the same count in the new database. Tables only in
# the new schema (added by db push) aren't compared.
mismatch=$(LC_ALL=C join -a1 "$WORK/old.counts" "$WORK/new.counts" | awk '$2 != $3')
if [ -n "$mismatch" ]; then
  echo "Row counts differ (table old new):"
  echo "$mismatch"
  exit 1
fi
echo "   $(wc -l < "$WORK/old.counts" | tr -d ' ') tables match."

echo "5/5 Rewriting stored file URLs..."
psql "$NEW_DIRECT_URL" -v ON_ERROR_STOP=1 -q \
  -v old_base="$OLD_STORAGE_BASE" -v new_base="$NEW_STORAGE_BASE" -v apply=1 \
  -f "$HERE/rewrite-storage-urls.sql"

echo "Done."
