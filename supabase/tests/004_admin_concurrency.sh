#!/usr/bin/env bash
# Run after a clean local reset and the SQL pgTAP suite:
#   bash supabase/tests/004_admin_concurrency.sh
# Optional: SUPABASE_DB_URL overrides the local postgres connection.
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
TMP_DIR="$(mktemp -d)"
FIFO_A="$TMP_DIR/session-a"
FIFO_B="$TMP_DIR/session-b"
OUT_A="$TMP_DIR/session-a.log"
OUT_B="$TMP_DIR/session-b.log"
ADMIN_A="50000000-0000-0000-0000-000000000001"
ADMIN_B="50000000-0000-0000-0000-000000000002"
PID_A=""
PID_B=""

cleanup() {
  if [[ -n "$PID_A" || -n "$PID_B" ]]; then
    kill $PID_A $PID_B 2>/dev/null || true
    wait $PID_A $PID_B 2>/dev/null || true
  fi

  # Test-only privileged cleanup: the successful race necessarily leaves one
  # fixture as the final admin, which the invariant intentionally protects.
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
begin;
alter table public.profiles disable trigger profiles_require_remaining_active_admin;
alter table public.profiles disable trigger profiles_require_remaining_active_admin_on_delete;
alter table public.user_roles disable trigger user_roles_require_remaining_active_admin;
alter table public.user_roles disable trigger user_roles_require_remaining_active_admin_on_delete;
delete from auth.users where id in ('$ADMIN_A', '$ADMIN_B');
alter table public.profiles enable trigger profiles_require_remaining_active_admin;
alter table public.profiles enable trigger profiles_require_remaining_active_admin_on_delete;
alter table public.user_roles enable trigger user_roles_require_remaining_active_admin;
alter table public.user_roles enable trigger user_roles_require_remaining_active_admin_on_delete;
commit;
SQL
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<SQL
begin;
alter table public.profiles disable trigger profiles_require_remaining_active_admin;
alter table public.profiles disable trigger profiles_require_remaining_active_admin_on_delete;
alter table public.user_roles disable trigger user_roles_require_remaining_active_admin;
alter table public.user_roles disable trigger user_roles_require_remaining_active_admin_on_delete;
delete from auth.users where id in ('$ADMIN_A', '$ADMIN_B');
alter table public.profiles enable trigger profiles_require_remaining_active_admin;
alter table public.profiles enable trigger profiles_require_remaining_active_admin_on_delete;
alter table public.user_roles enable trigger user_roles_require_remaining_active_admin;
alter table public.user_roles enable trigger user_roles_require_remaining_active_admin_on_delete;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
) values
  ('$ADMIN_A', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'concurrent-admin-a@example.test',
   'not-a-real-password', now(), now(), now(),
   '{"display_name":"Concurrent Admin A"}'::jsonb),
  ('$ADMIN_B', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'concurrent-admin-b@example.test',
   'not-a-real-password', now(), now(), now(),
   '{"display_name":"Concurrent Admin B"}'::jsonb);
insert into public.user_roles (user_id, role_id)
select id, (select id from public.roles where code = 'admin')
from auth.users where id in ('$ADMIN_A', '$ADMIN_B');
commit;
SQL

mkfifo "$FIFO_A" "$FIFO_B"
exec 3<>"$FIFO_A"
exec 4<>"$FIFO_B"

psql "$DB_URL" -q -v ON_ERROR_STOP=1 <&3 >"$OUT_A" 2>&1 &
PID_A=$!
printf 'begin;\ndelete from public.user_roles where user_id = '\''%s'\'';\nselect '\''session_a_locked'\'' as ready;\n' \
  "$ADMIN_A" >&3

# Wait for A to hold the shared transaction-scoped validation lock.
for _ in $(seq 1 200); do
  if grep -q session_a_locked "$OUT_A"; then break; fi
  if ! kill -0 "$PID_A" 2>/dev/null; then cat "$OUT_A"; exit 1; fi
  sleep 0.1
done
grep -q session_a_locked "$OUT_A"

psql "$DB_URL" -q -v ON_ERROR_STOP=1 >"$OUT_B" 2>&1 <<SQL &
begin;
select 'session_b_started' as ready;
delete from public.user_roles where user_id = '$ADMIN_B';
commit;
SQL
PID_B=$!

for _ in $(seq 1 200); do
  if grep -q session_b_started "$OUT_B"; then break; fi
  if ! kill -0 "$PID_B" 2>/dev/null; then cat "$OUT_B"; exit 1; fi
  sleep 0.1
done
grep -q session_b_started "$OUT_B"

B_BLOCKED=""
for _ in $(seq 1 200); do
  B_BLOCKED="$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
    select exists (
      select 1 from pg_stat_activity
      where pid <> pg_backend_pid()
        and state = 'active'
        and wait_event_type = 'Lock'
        and wait_event = 'advisory'
        and query like '%$ADMIN_B%'
    );
  ")"
  if [[ "$B_BLOCKED" == "t" ]]; then break; fi
  if ! kill -0 "$PID_B" 2>/dev/null; then cat "$OUT_B"; exit 1; fi
  sleep 0.1
done
if [[ "$B_BLOCKED" != "t" ]]; then
  echo "Session B did not reach the shared advisory lock." >&2
  cat "$OUT_B"
  exit 1
fi

# B is now deleting the other admin and waiting on A's advisory lock. Committing
# A must let A win; B wakes, re-reads committed state, and must be rejected.
printf 'commit;\n\\q\n' >&3
if wait "$PID_A"; then
  PID_A=""
else
  cat "$OUT_A"
  exit 1
fi

if wait "$PID_B"; then
  PID_B=""
  echo "Expected the second admin-removal transaction to fail." >&2
  cat "$OUT_B"
  exit 1
else
  PID_B=""
fi
grep -q "Cannot remove the final active administrator's admin role" "$OUT_B"

RESULT="$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  select (
    select count(*) from public.user_roles
    where user_id in ('$ADMIN_A', '$ADMIN_B')
  ) || '|' || exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where p.is_active and r.code = 'admin' and r.is_system
  );
")"
if [[ "$RESULT" != "1|true" ]]; then
  echo "Concurrency invariant failed: $RESULT" >&2
  exit 1
fi

printf 'PASS: one transaction wins, the other fails, and an active admin remains.\n'
