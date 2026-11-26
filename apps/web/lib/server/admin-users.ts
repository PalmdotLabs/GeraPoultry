import 'server-only';

import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import type { Database } from '@poultry/types';
import type { InviteUserRequest, User } from '@poultry/validation';
import { createAuthAdminClient } from '@/lib/server/auth-admin';
import {
  AdministrativeHttpError,
  configuredAppOrigin,
  mapRpcError,
} from '@/lib/server/admin-api';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type RoleRow = Pick<
  Database['public']['Tables']['roles']['Row'],
  'id' | 'code' | 'name'
>;
type AuthUserMetadata = Pick<
  AuthUser,
  | 'id'
  | 'email'
  | 'invited_at'
  | 'email_confirmed_at'
  | 'last_sign_in_at'
  | 'created_at'
>;

function assertReadSucceeded(error: { message: string } | null) {
  if (error) throw new Error('Unable to read administrative user data.');
}

function toAdministrativeUser(
  authUser: AuthUserMetadata,
  profile: ProfileRow,
  roles: RoleRow[],
): User {
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    displayName: profile.display_name,
    isActive: profile.is_active,
    invitedAt: authUser.invited_at ?? null,
    emailConfirmedAt: authUser.email_confirmed_at ?? null,
    lastSignInAt: authUser.last_sign_in_at ?? null,
    createdAt: profile.created_at || authUser.created_at,
    roles: roles
      .map(({ id, code, name }) => ({ id, code, name }))
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id),
      ),
  };
}

async function composeUsers(
  supabase: SupabaseClient<Database>,
  authUsers: AuthUserMetadata[],
): Promise<User[]> {
  if (!authUsers.length) return [];
  const ids = authUsers.map((user) => user.id);
  const [profilesResult, summaryResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name,is_active,created_at,updated_at')
      .in('id', ids),
    supabase.rpc('get_assigned_role_summaries', { p_user_ids: ids }),
  ]);
  assertReadSucceeded(profilesResult.error);
  assertReadSucceeded(summaryResult.error);

  const profiles = profilesResult.data ?? [];
  const summaries = summaryResult.data ?? [];
  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
  const rolesByUser = new Map<string, RoleRow[]>();
  for (const summary of summaries) {
    const assigned = rolesByUser.get(summary.user_id) ?? [];
    assigned.push({
      id: summary.role_id,
      code: summary.role_code,
      name: summary.role_name,
    });
    rolesByUser.set(summary.user_id, assigned);
  }

  return authUsers.flatMap((authUser) => {
    const profile = profilesById.get(authUser.id);
    return profile
      ? [
          toAdministrativeUser(
            authUser,
            profile,
            rolesByUser.get(authUser.id) ?? [],
          ),
        ]
      : [];
  });
}

export async function listAdministrativeUsers(
  supabase: SupabaseClient<Database>,
  page: number,
  perPage: number,
) {
  const { data, error } = await supabase.rpc('administrative_auth_users_page', {
    p_offset: (page - 1) * perPage,
    p_limit: perPage,
  });
  const payload = data as { users: AuthUserMetadata[]; total: number } | null;
  if (
    error ||
    !payload ||
    !Array.isArray(payload.users) ||
    !Number.isSafeInteger(payload.total) ||
    payload.total < 0
  ) {
    throw new Error('Unable to list Auth users with authoritative pagination.');
  }

  const users = await composeUsers(supabase, payload.users);
  return { users, page, perPage, total: payload.total };
}

export async function getAdministrativeUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<User> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,display_name,is_active,created_at,updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error('Unable to read the user profile.');
  if (!profile) {
    throw new AdministrativeHttpError(
      404,
      'NOT_FOUND',
      'The requested user was not found.',
    );
  }

  const { data, error: authError } =
    await createAuthAdminClient().auth.admin.getUserById(userId);
  if (authError || !data.user) {
    if (authError?.status === 404 || authError?.code === 'user_not_found') {
      throw new AdministrativeHttpError(
        404,
        'NOT_FOUND',
        'The requested user was not found.',
      );
    }
    throw new Error('Unable to read Auth user metadata.');
  }

  const [user] = await composeUsers(supabase, [data.user]);
  if (!user) {
    throw new AdministrativeHttpError(
      404,
      'NOT_FOUND',
      'The requested user was not found.',
    );
  }
  return user;
}

export async function inviteAdministrativeUser(
  supabase: SupabaseClient<Database>,
  input: InviteUserRequest,
  requestId: string,
) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const redirectTo = `${configuredAppOrigin()}/auth/callback?next=/reset-password`;
  const { data, error } =
    await createAuthAdminClient().auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo,
    });

  if (error) {
    if (
      ['email_exists', 'user_already_exists'].includes(error.code ?? '') ||
      (error.status === 422 && /already|exists|registered/i.test(error.message))
    ) {
      throw new AdministrativeHttpError(
        409,
        'CONFLICT',
        'A user with this email address already exists.',
      );
    }
    throw new Error('Unable to create the Supabase Auth invitation.');
  }
  if (!data.user?.id || !data.user.email) {
    throw new Error('Supabase Auth returned an incomplete invitation.');
  }

  const { error: auditError } = await supabase.rpc('admin_record_user_invite', {
    p_target_user_id: data.user.id,
    p_target_email: data.user.email,
    p_request_id: requestId,
  });
  if (auditError) {
    // The Auth account is durable. Do not delete it or claim it does not exist.
    throw new AdministrativeHttpError(
      500,
      'INTERNAL_ERROR',
      'The invitation was created, but its audit write failed. Reconcile this user before sending another invitation.',
    );
  }

  try {
    return await getAdministrativeUser(supabase, data.user.id);
  } catch {
    throw new AdministrativeHttpError(
      500,
      'INTERNAL_ERROR',
      'The invitation was created and audited, but the user details could not be loaded. Review the user list before sending another invitation.',
    );
  }
}

export async function setAdministrativeUserActive(
  supabase: SupabaseClient<Database>,
  userId: string,
  isActive: boolean,
) {
  const { error } = await supabase.rpc('admin_set_user_active', {
    p_target_user_id: userId,
    p_is_active: isActive,
  });
  if (error) throw mapRpcError(error);
  return getAdministrativeUser(supabase, userId);
}

export async function setAdministrativeUserRoles(
  supabase: SupabaseClient<Database>,
  userId: string,
  roleIds: string[],
) {
  const { error } = await supabase.rpc('admin_set_user_roles', {
    p_target_user_id: userId,
    p_role_ids: roleIds,
  });
  if (error) throw mapRpcError(error);
  return getAdministrativeUser(supabase, userId);
}
