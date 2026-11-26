import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@poultry/types';
import type { CreateRoleRequest, UpdateRoleRequest } from '@poultry/validation';
import { AdministrativeHttpError, mapRpcError } from '@/lib/server/admin-api';

export async function listAdministrativeRoles(
  supabase: SupabaseClient<Database>,
) {
  const [rolesResult, permissionsResult, rolePermissionsResult] =
    await Promise.all([
      supabase
        .from('roles')
        .select('id,code,name,description,is_system,created_at,updated_at'),
      supabase.from('permissions').select('id,code,name,description'),
      supabase.from('role_permissions').select('role_id,permission_id'),
    ]);
  if (
    rolesResult.error ||
    permissionsResult.error ||
    rolePermissionsResult.error
  ) {
    throw new Error('Unable to read roles and permissions.');
  }

  const permissions = permissionsResult.data.sort(
    (left, right) =>
      left.code.localeCompare(right.code) || left.id.localeCompare(right.id),
  );
  const permissionOrder = new Map(
    permissions.map((permission, index) => [permission.id, index]),
  );
  const idsByRole = new Map<string, string[]>();
  for (const assignment of rolePermissionsResult.data) {
    const ids = idsByRole.get(assignment.role_id) ?? [];
    if (permissionOrder.has(assignment.permission_id))
      ids.push(assignment.permission_id);
    idsByRole.set(assignment.role_id, ids);
  }

  const roles = rolesResult.data
    .map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.is_system,
      createdAt: role.created_at,
      updatedAt: role.updated_at,
      permissionIds: [...new Set(idsByRole.get(role.id) ?? [])].sort(
        (left, right) =>
          (permissionOrder.get(left) ?? 0) - (permissionOrder.get(right) ?? 0),
      ),
    }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    );

  return { roles, permissions };
}

export async function getAdministrativeRole(
  supabase: SupabaseClient<Database>,
  roleId: string,
) {
  const { roles } = await listAdministrativeRoles(supabase);
  const role = roles.find((candidate) => candidate.id === roleId);
  if (!role) {
    throw new AdministrativeHttpError(
      404,
      'NOT_FOUND',
      'The requested role was not found.',
    );
  }
  return role;
}

export async function createAdministrativeRole(
  supabase: SupabaseClient<Database>,
  input: CreateRoleRequest,
) {
  const { data, error } = await supabase.rpc('admin_upsert_role', {
    // PostgreSQL accepts NULL here to create a role; the current Supabase
    // generator incorrectly marks this argument as a required UUID.
    p_role_id: null as unknown as string,
    p_code: input.code.trim().toLowerCase(),
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_permission_ids: input.permissionIds,
  });
  if (error) throw mapRpcError(error);
  if (!data) throw new Error('The role mutation returned no role ID.');
  return getAdministrativeRole(supabase, data);
}

export async function updateAdministrativeRole(
  supabase: SupabaseClient<Database>,
  roleId: string,
  input: UpdateRoleRequest,
) {
  const existing = await getAdministrativeRole(supabase, roleId);
  const { data, error } = await supabase.rpc('admin_upsert_role', {
    p_role_id: roleId,
    p_code: existing.code,
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_permission_ids: input.permissionIds,
  });
  if (error) throw mapRpcError(error);
  if (!data) throw new Error('The role mutation returned no role ID.');
  return getAdministrativeRole(supabase, data);
}

export async function deleteAdministrativeRole(
  supabase: SupabaseClient<Database>,
  roleId: string,
) {
  const { error } = await supabase.rpc('admin_delete_role', {
    p_role_id: roleId,
  });
  if (error) throw mapRpcError(error);
  return { deleted: true as const };
}
