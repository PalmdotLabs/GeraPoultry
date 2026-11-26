import assert from 'node:assert/strict';
import test from 'node:test';
import type { Role } from '@poultry/validation';
import { getRoleDirectoryAction } from './role-navigation';

const customRole: Role = {
  id: '88fd8c34-660b-4f87-a11e-9f25c1a859d6',
  code: 'records_viewer',
  name: 'Records viewer',
  description: 'Read selected records',
  isSystem: false,
  createdAt: '2026-11-20T10:00:00Z',
  updatedAt: '2026-11-20T10:00:00Z',
  permissionIds: [],
};

test('a manager can navigate to edit a custom role', () => {
  assert.deepEqual(getRoleDirectoryAction(customRole, true), {
    href: `/roles/${customRole.id}/edit`,
    label: 'Edit',
    ariaLabel: 'Edit Records viewer',
  });
});

test('a non-manager can navigate to view a custom role', () => {
  assert.deepEqual(getRoleDirectoryAction(customRole, false), {
    href: `/roles/${customRole.id}/edit`,
    label: 'View',
    ariaLabel: 'View Records viewer',
  });
});

test('a manager can navigate to view a protected system role', () => {
  const systemRole: Role = {
    ...customRole,
    code: 'admin',
    name: 'Administrator',
    isSystem: true,
  };

  assert.deepEqual(getRoleDirectoryAction(systemRole, true), {
    href: `/roles/${systemRole.id}/edit`,
    label: 'View',
    ariaLabel: 'View Administrator',
  });
});

test('role detail destinations encode the role ID', () => {
  const action = getRoleDirectoryAction(
    { ...customRole, id: 'role/id ?#' },
    false,
  );

  assert.equal(action.href, '/roles/role%2Fid%20%3F%23/edit');
});
