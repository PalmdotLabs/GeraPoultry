import type { Metadata } from 'next';
import { requireRoleReadAccess } from '../role-access';
import { RoleEditorScreen } from '../role-editor-screen';
import { RoleForbiddenState, RolePageHeader } from '../role-ui';

export const metadata: Metadata = { title: 'Create role | Fieldbook' };

export default async function NewRolePage() {
  const access = await requireRoleReadAccess('/roles/new');

  if (access.status === 'forbidden') {
    return (
      <>
        <RolePageHeader
          title="Create role"
          description="Define a custom role and explicitly choose its permissions."
        />
        <RoleForbiddenState />
      </>
    );
  }

  return <RoleEditorScreen mode="create" canManage={access.canManage} />;
}
