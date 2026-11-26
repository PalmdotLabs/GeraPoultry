import type { Metadata } from 'next';
import { requireRoleReadAccess } from '../../role-access';
import { RoleEditorScreen } from '../../role-editor-screen';
import { RoleForbiddenState, RolePageHeader } from '../../role-ui';

export const metadata: Metadata = { title: 'Role details | Fieldbook' };

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const destination = `/roles/${encodeURIComponent(id)}/edit`;
  const access = await requireRoleReadAccess(destination);

  if (access.status === 'forbidden') {
    return (
      <>
        <RolePageHeader
          title="Role details"
          description="Review this role and its permission assignments."
        />
        <RoleForbiddenState />
      </>
    );
  }

  return (
    <RoleEditorScreen mode="edit" roleId={id} canManage={access.canManage} />
  );
}
