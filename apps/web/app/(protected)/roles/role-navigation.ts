import type { Role } from '@poultry/validation';

export function getRoleDirectoryAction(
  role: Pick<Role, 'id' | 'name' | 'isSystem'>,
  canManage: boolean,
) {
  const label = canManage && !role.isSystem ? 'Edit' : 'View';

  return {
    href: `/roles/${encodeURIComponent(role.id)}/edit`,
    label,
    ariaLabel: `${label} ${role.name}`,
  };
}
