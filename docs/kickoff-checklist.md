# Technical kickoff checklist

The owner has asked that kickoff formalities be considered complete for work sequencing. This repository does not independently verify written acceptance, client identity or receipt of payment. The Notion project/onboarding records remain unchanged; in particular, the ₹15,000 advance is not marked as paid here or in Notion.

## Foundation completed in this repository

- [x] Create the local monorepo structure for mobile, web, shared packages and Supabase migrations.
- [x] Record the accepted mobile-first architecture in [ADR-001](architecture/decisions/ADR-001-mobile-first-architecture.md).
- [x] Establish the initial Expo and Next.js app shells and pnpm workspace.
- [x] Document known workflow areas and unresolved client questions.

## Backend and Auth foundation completed

- [x] Configure local-first Supabase CLI development with public sign-up disabled and no hosted project provisioning.
- [x] Add migration-first profiles, permissions, roles, assignments, audit history, RLS and last-active-admin protection.
- [x] Verify 151 database assertions plus a synchronized admin-race and both role-assignment/deletion races from a clean local reset, including inactive/no-role denial, multi-row/concurrent last-admin protection, trusted assignment provenance, audit attribution, and administration RPC behavior.
- [x] Implement direct email/password Auth, password recovery through local mail, protected admin routes, sign-out and cookie/bearer session API behavior in the Next.js admin.
- [x] Establish shared session validation, typed errors, a platform-neutral API client and generated PostgreSQL types.
- [x] Exercise real browser login, forbidden states, sign-out, password recovery, narrow layouts and production-build bearer API access.
- [x] Complete independent security and quality reviews and resolve their findings, including production cookie flags, sign-out fallback, audit provenance and multi-row/concurrent administrator invariants.

## Administration completed in hosted development

- [x] Apply the administration RPC migration with group-owner consent and regenerate database types from the hosted project.
- [x] Implement invitation, activation/deactivation, role assignment, custom-role management, and administrative audit history without creating plaintext user passwords or seeding business roles.
- [x] Exercise the real user/role interfaces, server/RLS permissions, cookie CSRF protection, in-use deletion protection, no-role denial, and live final-admin rejection.
- [x] Clean disposable QA accounts and roles while retaining the audit records and original development administrator account.
- [x] Enforce role mutations through guarded RPCs, replay-safe invitation audit evidence, locked role assignment, mixed-permission summaries, globally ordered Auth pagination, and non-argument database credential channels.
- [x] Close independent security and quality reviews with all reported findings resolved and no remaining required or medium/high defects in the completed administration scope.

## Employee mobile foundation completed

- [x] Implement hosted email/password Auth with encrypted, chunked SecureStore persistence, safe restoration and local sign-out using the shared live session contract.
- [x] Verify live profile/role identity for an active no-role hosted employee and then delete that fixture while preserving audit history.
- [x] Add regression coverage for chunk integrity/corruption, token-provider failures, network retry, inactivity, cleanup, and production HTTPS versus local-development-origin rules.
- [x] Document public-only mobile environment generation and preserve Android-first deployment without EAS/cloud builds.

## Native runtime verification pending

- [ ] Exercise the employee authentication flow on an actual Android device or simulator. Android emulator preflight requires about 7.4 GB and current host capacity is insufficient. The owner deferred Android UI verification for now.
- [ ] Retry the user-requested debug run on the existing iPhone 17 Simulator with adequate space for CocoaPods/native artifacts; that setup failed with `ENOSPC` and its staging was removed. No production iOS signing or cloud build has been configured.

## Technical work to continue

- [ ] Obtain and store/link the approved Proposal & Scope of Work / Quotation v1.0 and Detailed Scope & Workflow Specification v1.0.
- [x] Establish TypeScript/ES module conventions and environment-variable handling.
- [x] Select lint/format tooling. Root commands are `lint`, `format`, and `format:check`, with framework-specific Expo and Next.js lint presets. ESLint 9 is deliberately pinned because Expo 58's bundled plugins do not currently declare ESLint 10 support. Prettier covers maintained JavaScript/TypeScript, styles, configuration and existing documentation; SQL migrations remain governed by migration review and database tests.
- [x] Decide development versus production Supabase setup, access roles and secret handling before provisioning; hosted development is now configured and production remains unprovisioned.
- [x] Choose the server-side runtime/deployment location and document Auth/Storage client access patterns in [ADR-003](architecture/decisions/ADR-003-next-js-api-and-supabase-access.md).
- [ ] Derive the initial data model, permissions, RLS policies, audit approach and business invariants from approved workflows; do not design tables or policies from this checklist alone.
- [x] Establish shared validation ownership and implement the initial session API contract before business screens; workflow-specific contracts still depend on the approved specification.
- [ ] Set up and document the Expo Android development/build workflow. Defer iOS signing and builds until requested.
- [ ] Select the first end-to-end workflow and add acceptance criteria/dependencies to the existing task tracker.
- [ ] Align testing, deployment and handover steps with the agreed MVP and client-owned accounts.

## Cost and access constraints

- Client owns and pays for hosting, Supabase production backend/database, domain and required email, push or other subscriptions.
- Do not provision paid services or initiate an EAS build without checking account/billing implications.
- Do not create or push a remote repository. The local checkout already has an `origin` remote; do not alter or use it to push.
- Never put real credentials in source control. Keep `.env*` files ignored except a non-secret `.env.example` template.
