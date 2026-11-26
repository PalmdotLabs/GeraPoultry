#!/usr/bin/env bash
# Run after a clean local reset and the SQL pgTAP suite:
#   bash supabase/tests/007_role_assignment_concurrency.sh
# Optional: SUPABASE_DB_URL overrides the local postgres connection.
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
TMP_DIR="$(mktemp -d)"
ADMIN="80000000-0000-0000-0000-000000000011"
TARGET="80000000-0000-0000-0000-000000000012"
ROLE_A="81000000-0000-0000-0000-000000000011"
ROLE_B="81000000-0000-0000-0000-000000000012"
PID_A=""
PID_B=""

clean_fixtures() {
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<SQL
begin;
alter table public.profiles disable trigger profiles_require_remaining_active_admin;
alter table public.profiles disable trigger profiles_require_remaining_active_admin_on_delete;
alter table public.user_roles disable trigger user_roles_require_remaining_active_admin;
alter table public.user_roles disable trigger user_roles_require_remaining_active_admin_on_delete;
delete from public.audit_events
where actor_id = '$ADMIN'
   or target_id in ('$ROLE_A', '$ROLE_B');
delete from public.user_roles
where assigned_by = '$ADMIN' or user_id in ('$ADMIN', '$TARGET');
delete from public.roles where id in ('$ROLE_A', '$ROLE_B');
delete from auth.users where id in ('$ADMIN', '$TARGET');
alter table public.profiles enable trigger profiles_require_remaining_active_admin;
alter table public.profiles enable trigger profiles_require_remaining_active_admin_on_delete;
alter table public.user_roles enable trigger user_roles_require_remaining_active_admin;
alter table public.user_roles enable trigger user_roles_require_remaining_active_admin_on_delete;
commit;
SQL
}

cleanup() {
  for pid in "$PID_A" "$PID_B"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  clean_fixtures >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

wait_for_marker() {
  local pid="$1"
  local file="$2"
  local marker="$3"
  for _ in $(seq 1 200); do
    if grep -q "$marker" "$file"; then return; fi
    if ! kill -0 "$pid" 2>/dev/null; then
      cat "$file"
      exit 1
    fi
    sleep 0.1
  done
  echo "Timed out waiting for $marker." >&2
  cat "$file"
  exit 1
}

wait_for_role_lock() {
  local pid="$1"
  local role_id="$2"
  local blocked=""
  for _ in $(seq 1 200); do
    blocked="$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
      select exists (
        select 1 from pg_stat_activity
        where pid <> pg_backend_pid()
          and state = 'active'
          and wait_event_type = 'Lock'
          and query like '%$role_id%'
      );
    ")"
    if [[ "$blocked" == "t" ]]; then return; fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Session exited before reaching the role lock." >&2
      exit 1
    fi
    sleep 0.1
  done
  echo "Session did not reach the role lock for $role_id." >&2
  exit 1
}

clean_fixtures
psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
) values
  ('$ADMIN', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'role-race-admin@example.test',
   'not-a-real-password', now(), now(), now(),
   '{"display_name":"Role Race Admin"}'::jsonb),
  ('$TARGET', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'role-race-target@example.test',
   'not-a-real-password', now(), now(), now(),
   '{"display_name":"Role Race Target"}'::jsonb);
insert into public.user_roles (user_id, role_id)
select '$ADMIN', id from public.roles where code = 'admin';
insert into public.roles (id, code, name) values
  ('$ROLE_A', 'role_race_a', 'Role race A'),
  ('$ROLE_B', 'role_race_b', 'Role race B');
SQL

# Assignment wins the key-share lock. Deletion must wait, then refuse the new
# in-use role rather than cascading or turning the assignment race into 23503.
FIFO_A="$TMP_DIR/assignment-first-a"
FIFO_B="$TMP_DIR/assignment-first-b"
OUT_A="$TMP_DIR/assignment-first-a.log"
OUT_B="$TMP_DIR/assignment-first-b.log"
mkfifo "$FIFO_A" "$FIFO_B"
exec 3<>"$FIFO_A"
exec 4<>"$FIFO_B"

psql "$DB_URL" -q -v ON_ERROR_STOP=1 <&3 >"$OUT_A" 2>&1 &
PID_A=$!
printf 'begin;\nset local role authenticated;\nselect set_config('\''request.jwt.claims'\'', '\''{"sub":"%s"}'\'', true);\nselect public.admin_set_user_roles('\''%s'\'', array['\''%s'\''::uuid]);\nselect '\''assignment_locked'\'' as ready;\n' \
  "$ADMIN" "$TARGET" "$ROLE_A" >&3
wait_for_marker "$PID_A" "$OUT_A" assignment_locked

psql "$DB_URL" -q -v ON_ERROR_STOP=1 >"$OUT_B" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub":"$ADMIN"}', true
);
select 'delete_started' as ready;
select public.admin_delete_role('$ROLE_A');
commit;
SQL
PID_B=$!
wait_for_marker "$PID_B" "$OUT_B" delete_started
wait_for_role_lock "$PID_B" "$ROLE_A"

printf 'commit;\n\\q\n' >&3
if ! wait "$PID_A"; then
  cat "$OUT_A"
  exit 1
fi
PID_A=""
if wait "$PID_B"; then
  PID_B=""
  echo "Expected the in-use role deletion to fail with P0409." >&2
  cat "$OUT_B"
  exit 1
else
  PID_B=""
fi
if grep -q '23503' "$OUT_B"; then
  echo "Assignment-first deletion leaked a foreign-key violation." >&2
  cat "$OUT_B"
  exit 1
fi
grep -q 'A role assigned to a user cannot be deleted.' "$OUT_B"

RESULT="$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  select (
    select count(*) from public.user_roles
    where user_id = '$TARGET' and role_id = '$ROLE_A'
  ) || '|' || exists (
    select 1 from public.roles where id = '$ROLE_A'
  ) || '|' || (
    select count(*) from public.audit_events
    where target_type = 'roles' and target_id = '$ROLE_A'
      and action = 'roles.delete'
  );
")"
if [[ "$RESULT" != "1|true|0" ]]; then
  echo "Assignment-first invariant failed: $RESULT" >&2
  exit 1
fi
printf 'PASS: assignment-first preserves the assignment and deletion returns P0409, never 23503.\n'
exec 3>&-
exec 4>&-

# Deletion wins the exclusive role lock. Assignment must wait, then resolve no
# requested role and return controlled P0404 without changing existing roles.
FIFO_A="$TMP_DIR/delete-first-a"
FIFO_B="$TMP_DIR/delete-first-b"
OUT_A="$TMP_DIR/delete-first-a.log"
OUT_B="$TMP_DIR/delete-first-b.log"
mkfifo "$FIFO_A" "$FIFO_B"
exec 3<>"$FIFO_A"
exec 4<>"$FIFO_B"

psql "$DB_URL" -q -v ON_ERROR_STOP=1 <&3 >"$OUT_A" 2>&1 &
PID_A=$!
printf 'begin;\nset local role authenticated;\nselect set_config('\''request.jwt.claims'\'', '\''{"sub":"%s"}'\'', true);\nselect public.admin_delete_role('\''%s'\'');\nselect '\''deletion_locked'\'' as ready;\n' \
  "$ADMIN" "$ROLE_B" >&3
wait_for_marker "$PID_A" "$OUT_A" deletion_locked

psql "$DB_URL" -q -v ON_ERROR_STOP=1 >"$OUT_B" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims', '{"sub":"$ADMIN"}', true
);
select 'assignment_started' as ready;
select public.admin_set_user_roles('$TARGET', array['$ROLE_B'::uuid]);
commit;
SQL
PID_B=$!
wait_for_marker "$PID_B" "$OUT_B" assignment_started
wait_for_role_lock "$PID_B" "$ROLE_B"

printf 'commit;\n\\q\n' >&3
if ! wait "$PID_A"; then
  cat "$OUT_A"
  exit 1
fi
PID_A=""
if wait "$PID_B"; then
  PID_B=""
  echo "Expected assignment against the deleted role to fail with P0404." >&2
  cat "$OUT_B"
  exit 1
else
  PID_B=""
fi
if grep -q '23503' "$OUT_B"; then
  echo "Delete-first assignment leaked a foreign-key violation." >&2
  cat "$OUT_B"
  exit 1
fi
grep -q 'One or more target roles were not found.' "$OUT_B"

RESULT="$(psql "$DB_URL" -tA -v ON_ERROR_STOP=1 -c "
  select (
    select count(*) from public.user_roles
    where user_id = '$TARGET' and role_id = '$ROLE_A'
  ) || '|' || exists (
    select 1 from public.roles where id = '$ROLE_B'
  ) || '|' || (
    select count(*) from public.user_roles where role_id = '$ROLE_B'
  ) || '|' || (
    select count(*) from public.audit_events
    where target_type = 'roles' and target_id = '$ROLE_B'
      and action = 'roles.delete'
  );
")"
if [[ "$RESULT" != "1|false|0|1" ]]; then
  echo "Delete-first invariant failed: $RESULT" >&2
  exit 1
fi
printf 'PASS: delete-first returns assignment P0404 and retains the previous valid assignment, never 23503.\n'
exec 3>&-
exec 4>&-
