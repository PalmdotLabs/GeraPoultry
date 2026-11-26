import { z } from 'zod';

const nonEmptyStringSchema = z.string().min(1);
const uuidSchema = z.string().uuid();
const isoTimestampSchema = z.iso.datetime({ offset: true });

export const roleSummarySchema = z.strictObject({
  code: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
});

export const sessionContextSchema = z.strictObject({
  displayName: nonEmptyStringSchema,
  roles: z.array(roleSummarySchema),
  permissions: z.array(nonEmptyStringSchema),
});

export const apiErrorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
]);

export const apiErrorIssueSchema = z.strictObject({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

export const apiErrorBodySchema = z.strictObject({
  code: apiErrorCodeSchema,
  message: z.string(),
  requestId: z.string().uuid(),
  issues: z.array(apiErrorIssueSchema).optional(),
});

export const apiErrorResponseSchema = z.strictObject({
  error: apiErrorBodySchema,
});

export const apiResponseSchema = <DataSchema extends z.ZodType>(
  dataSchema: DataSchema,
) => z.strictObject({ data: dataSchema });

export const sessionSchema = z.strictObject({
  user: z.strictObject({
    id: uuidSchema,
    email: z.string().email().nullable(),
    displayName: nonEmptyStringSchema,
  }),
  roles: z.array(roleSummarySchema),
  permissions: z.array(nonEmptyStringSchema),
});

export const sessionResponseSchema = apiResponseSchema(sessionSchema);

export const administrativeUserRoleSchema = z.strictObject({
  id: uuidSchema,
  code: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
});

export const userSchema = z.strictObject({
  id: uuidSchema,
  email: z.string().email().nullable(),
  displayName: nonEmptyStringSchema,
  isActive: z.boolean(),
  invitedAt: isoTimestampSchema.nullable(),
  emailConfirmedAt: isoTimestampSchema.nullable(),
  lastSignInAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
  roles: z.array(administrativeUserRoleSchema),
});

export const permissionSchema = z.strictObject({
  id: uuidSchema,
  code: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  description: z.string(),
});

export const roleSchema = z.strictObject({
  id: uuidSchema,
  code: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  description: z.string(),
  isSystem: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  permissionIds: z.array(uuidSchema),
});

export const auditEventSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  actorId: uuidSchema.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  requestId: uuidSchema.nullable(),
  occurredAt: isoTimestampSchema,
  metadata: z.record(z.string(), z.unknown()),
});

export const paginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export const listUsersQuerySchema = paginationQuerySchema;
export const listAuditEventsQuerySchema = paginationQuerySchema;

export const inviteUserRequestSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email(),
  displayName: z.string().trim().min(1).max(120),
});

export const setUserActiveRequestSchema = z.strictObject({
  isActive: z.boolean(),
});

export const setUserRolesRequestSchema = z.strictObject({
  roleIds: z.array(uuidSchema).max(50),
});

export const createRoleRequestSchema = z.strictObject({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  permissionIds: z.array(uuidSchema).max(50),
});

export const updateRoleRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  permissionIds: z.array(uuidSchema).max(50),
});

export const userListSchema = z.strictObject({
  users: z.array(userSchema),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});

export const userResultSchema = z.strictObject({ user: userSchema });
export const listUsersResponseSchema = apiResponseSchema(userListSchema);
export const getUserResponseSchema = apiResponseSchema(userResultSchema);
export const inviteUserResponseSchema = getUserResponseSchema;
export const setUserActiveResponseSchema = getUserResponseSchema;
export const setUserRolesResponseSchema = getUserResponseSchema;

export const roleListSchema = z.strictObject({
  roles: z.array(roleSchema),
  permissions: z.array(permissionSchema),
});

export const roleResultSchema = z.strictObject({ role: roleSchema });
export const listRolesResponseSchema = apiResponseSchema(roleListSchema);
export const createRoleResponseSchema = apiResponseSchema(roleResultSchema);
export const updateRoleResponseSchema = createRoleResponseSchema;
export const deleteRoleResultSchema = z.strictObject({
  deleted: z.literal(true),
});
export const deleteRoleResponseSchema = apiResponseSchema(
  deleteRoleResultSchema,
);

export const auditEventListSchema = z.strictObject({
  events: z.array(auditEventSchema),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});

export const listAuditEventsResponseSchema =
  apiResponseSchema(auditEventListSchema);

export type RoleSummary = z.infer<typeof roleSummarySchema>;
export type SessionContext = z.infer<typeof sessionContextSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorIssue = z.infer<typeof apiErrorIssueSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type AdministrativeUserRole = z.infer<
  typeof administrativeUserRoleSchema
>;
export type User = z.infer<typeof userSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type Role = z.infer<typeof roleSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;
export type InviteUserRequest = z.infer<typeof inviteUserRequestSchema>;
export type SetUserActiveRequest = z.infer<typeof setUserActiveRequestSchema>;
export type SetUserRolesRequest = z.infer<typeof setUserRolesRequestSchema>;
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;
export type UserList = z.infer<typeof userListSchema>;
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
export type GetUserResponse = z.infer<typeof getUserResponseSchema>;
export type InviteUserResponse = z.infer<typeof inviteUserResponseSchema>;
export type SetUserActiveResponse = z.infer<typeof setUserActiveResponseSchema>;
export type SetUserRolesResponse = z.infer<typeof setUserRolesResponseSchema>;
export type RoleList = z.infer<typeof roleListSchema>;
export type ListRolesResponse = z.infer<typeof listRolesResponseSchema>;
export type CreateRoleResponse = z.infer<typeof createRoleResponseSchema>;
export type UpdateRoleResponse = z.infer<typeof updateRoleResponseSchema>;
export type DeleteRoleResult = z.infer<typeof deleteRoleResultSchema>;
export type DeleteRoleResponse = z.infer<typeof deleteRoleResponseSchema>;
export type AuditEventList = z.infer<typeof auditEventListSchema>;
export type ListAuditEventsResponse = z.infer<
  typeof listAuditEventsResponseSchema
>;

export const farmSetupKindSchema = z.enum(['sheds', 'breeds', 'egg-grades']);

export const createFarmSetupRecordRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
});

export const farmSetupRecordSchema = z.strictObject({
  id: uuidSchema,
  name: nonEmptyStringSchema,
});

export const listFarmSetupResponseSchema = apiResponseSchema(
  z.strictObject({ records: z.array(farmSetupRecordSchema) }),
);

export const createFarmSetupRecordResponseSchema = apiResponseSchema(
  z.strictObject({ record: farmSetupRecordSchema }),
);

export type FarmSetupKind = z.infer<typeof farmSetupKindSchema>;
export type CreateFarmSetupRecordRequest = z.infer<
  typeof createFarmSetupRecordRequestSchema
>;
export type FarmSetupRecord = z.infer<typeof farmSetupRecordSchema>;

const operationalDateSchema = z.iso
  .date()
  .refine((date) => !date.startsWith('0000-'));
const pgIntegerMax = 2_147_483_647;
const birdCountSchema = z.number().int().min(1).max(pgIntegerMax);
const flockPlacementSchema = z.strictObject({
  shedId: uuidSchema.transform((id) => id.toLowerCase()),
  birdCount: birdCountSchema,
});

const flockArrivalFields = {
  batchCode: z.string().trim().min(1).max(120),
  breedId: uuidSchema,
  arrivalDate: operationalDateSchema,
  ageAtArrival: z.number().int().min(0).max(pgIntegerMax),
  ageUnit: z.enum(['days', 'weeks']),
  birdsHoused: birdCountSchema,
  placements: z.array(flockPlacementSchema).min(1),
};

export const createFlockRequestSchema = z
  .strictObject({ ...flockArrivalFields, submissionId: uuidSchema })
  .superRefine(({ placements, birdsHoused }, ctx) => {
    const shedIds = new Set(placements.map(({ shedId }) => shedId));
    if (shedIds.size !== placements.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['placements'],
        message: 'Each shed can appear only once.',
      });
    }
    if (
      placements.reduce((total, row) => total + row.birdCount, 0) !==
      birdsHoused
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['placements'],
        message: 'Allocate all housed birds.',
      });
    }
  });

export const createFlockResponseSchema = apiResponseSchema(
  z.strictObject({ id: uuidSchema }),
);

export const flockListSchema = z.strictObject({
  flocks: z.array(z.strictObject({ id: uuidSchema, ...flockArrivalFields })),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});

export const listFlocksResponseSchema = apiResponseSchema(flockListSchema);

export type CreateFlockRequest = z.infer<typeof createFlockRequestSchema>;
export type FlockList = z.infer<typeof flockListSchema>;

export const recordFlockMortalityRequestSchema = z.strictObject({
  shedId: uuidSchema,
  recordedDate: operationalDateSchema,
  birdCount: birdCountSchema,
  remarks: z.string().trim().max(500).optional(),
  submissionId: uuidSchema,
});

export const recordFlockMortalityResponseSchema = apiResponseSchema(
  z.strictObject({ id: uuidSchema }),
);

const nonnegativePgIntegerSchema = z.number().int().min(0).max(pgIntegerMax);

export const flockLiveCountsSchema = z.strictObject({
  flockId: uuidSchema,
  placements: z
    .array(
      z.strictObject({
        shedId: uuidSchema,
        initialBirdCount: birdCountSchema,
        liveBirdCount: nonnegativePgIntegerSchema,
      }),
    )
    .min(1),
});

export const flockLiveCountsResponseSchema = apiResponseSchema(
  flockLiveCountsSchema,
);

export type RecordFlockMortalityRequest = z.infer<
  typeof recordFlockMortalityRequestSchema
>;
export type FlockLiveCounts = z.infer<typeof flockLiveCountsSchema>;

export const eggsPerTray = 30;

export function countCollectedEggs({
  trays,
  looseEggs,
}: {
  trays: number;
  looseEggs: number;
}) {
  return trays * eggsPerTray + looseEggs;
}

const eggQuantitySchema = z
  .strictObject({
    trays: z
      .number()
      .int()
      .min(0)
      .max(Math.floor(pgIntegerMax / eggsPerTray)),
    looseEggs: nonnegativePgIntegerSchema,
  })
  .refine((quantity) => countCollectedEggs(quantity) <= pgIntegerMax, {
    message: 'Trays and loose eggs exceed the supported egg count.',
  });

const eggCollectionDetails = {
  collectionDate: operationalDateSchema,
  shedId: uuidSchema,
  shift: z.string().trim().min(1).max(80),
  gradeId: uuidSchema,
};

export const recordEggCollectionRequestSchema = z.strictObject({
  ...eggCollectionDetails,
  flockId: uuidSchema.nullable().optional(),
  good: eggQuantitySchema,
  cracked: eggQuantitySchema,
  dirty: eggQuantitySchema,
  submissionId: uuidSchema,
});

export const recordEggCollectionResponseSchema = apiResponseSchema(
  z.strictObject({ id: uuidSchema }),
);

export const eggCollectionListSchema = z.strictObject({
  collections: z.array(
    z.strictObject({
      ...eggCollectionDetails,
      id: uuidSchema,
      flockId: uuidSchema.nullable(),
      goodEggCount: nonnegativePgIntegerSchema,
      crackedEggCount: nonnegativePgIntegerSchema,
      dirtyEggCount: nonnegativePgIntegerSchema,
      totalEggCount: z
        .number()
        .int()
        .min(0)
        .max(3 * pgIntegerMax),
    }),
  ),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});

export const listEggCollectionsResponseSchema = apiResponseSchema(
  eggCollectionListSchema,
);

export type RecordEggCollectionRequest = z.infer<
  typeof recordEggCollectionRequestSchema
>;
export type EggCollectionList = z.infer<typeof eggCollectionListSchema>;
