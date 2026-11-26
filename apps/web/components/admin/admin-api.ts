'use client';

import { createApiClient } from '@poultry/api-client';
import type {
  AuditEvent,
  AuditEventList,
  Permission,
  Role,
  RoleList,
  User,
  UserList,
} from '@poultry/validation';

export const adminApi = createApiClient({ credentials: 'same-origin' });

export type AdminUser = User;
export type AdminUserList = UserList;
export type AdminRole = Role;
export type AdminPermission = Permission;
export type AdminRoleCatalog = RoleList;
export type AdminAuditEvent = AuditEvent;
export type AdminAuditEventList = AuditEventList;
