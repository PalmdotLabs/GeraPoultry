import type { Metadata } from 'next';
import { requireRoleReadAccess } from './role-access';
import { RolesScreen } from './roles-screen';
import { RoleForbiddenState, RolePageHeader } from './role-ui';

export const metadata: Metadata = { title: 'Roles | Fieldbook' };

export default async function RolesPage() {
  const access = await requireRoleReadAccess('/roles');

  if (access.status === 'forbidden') {
    return (
      <>
        <RolePageHeader
          title="Roles"
          description="Review role definitions and their assigned permissions."
        />
        <RoleForbiddenState />
      </>
    );
  }

  return <RolesScreen canManage={access.canManage} />;
}
