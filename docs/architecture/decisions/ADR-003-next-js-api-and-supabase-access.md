# ADR-003: Next.js application API and Supabase access patterns

- **Status:** Accepted for foundation implementation
- **Decision date:** 2026-11-24
- **Source:** Project owner approval of the backend-first implementation plan

## Context

ADR-001 requires authoritative server-side business behavior but leaves the server runtime and client Auth/Storage patterns open. The Expo employee app and Next.js admin need one stable application API and shared contracts without introducing unnecessary deployment infrastructure.

## Decision

1. Use Next.js server route handlers under `apps/web/app/api/v1` as the trusted application API for the admin and employee applications. The initial runtime is the Next.js Node.js server runtime deployed with the admin application.
2. Use Supabase Auth directly from each client for identity and session operations. Next.js uses `@supabase/ssr` cookie sessions; Expo will use a platform-appropriate secure storage adapter and bearer access tokens when mobile authentication is implemented.
3. Application API database access uses the requesting user's Supabase identity so PostgreSQL row-level security remains authoritative. Service-role credentials are never shipped to either client and are used only for specific server administration operations that cannot use user-scoped access.
4. `packages/domain` remains server-only. Route handlers and other server entry points may import it; client applications cannot.
5. Supabase Storage buckets will be private by default. Clients will use user-scoped policies and signed URLs when an approved document workflow requires Storage. No bucket is created before such a workflow exists.
6. Public environment variables contain only the Supabase URL and publishable/anonymous key. Service-role and other privileged credentials remain server-only. Local development uses the Supabase CLI before any hosted development or production project is provisioned.

## Consequences

- One application API can use the monorepo's TypeScript and domain packages directly and serves both web and mobile.
- Mobile API availability depends on the deployed Next.js application, but Auth and Storage remain Supabase services.
- Cookie and bearer-token authentication must result in the same server-side identity and permission checks.
- RLS is a required security boundary, not a substitute for explicit server authorization on privileged operations.
- Local development requires a Docker-compatible container runtime. Hosted environments and client-owned production credentials remain separate provisioning work.

## Alternatives considered

- **Supabase Edge Functions:** a valid future runtime, but not selected initially because it adds a second server runtime and deployment workflow while the Next.js server can already host the shared application API.
- **Direct client CRUD for all workflows:** rejected for authoritative operations because clients must not own inventory, costing, permission, or other business invariants.

## Revisit when

Revisit if independent backend scaling, sustained background workloads, runtime limitations, or client deployment requirements make the combined Next.js API unsuitable. Record any replacement in a new ADR.
