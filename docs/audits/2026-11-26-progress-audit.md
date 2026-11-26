# Progress audit — 26 November 2026

## Assessment

The project is at the **technical foundation** stage. The code has useful security boundaries and passes current deterministic checks; it does not yet deliver the farm's operational workflows. There is no evidence to justify throwing away the foundation because of which model produced it. Continue through the [build plan](../build-plan.md) after closing its source and acceptance gaps.

## Evidence by area

| Area              | Observed implementation                                                                                                     | Acceptance boundary                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workspace         | Expo/Next.js monorepo, shared types/validation/API client/domain/config, pinned dependencies, lint/format commands          | Most implementation remains untracked in local Git; only AGENTS.md and README.md are tracked. No remote push performed.                                            |
| Database          | Five migrations for profiles, roles, permissions, assignments, audit, guarded administration RPCs and last-admin protection | Reviewed source; current live migration parity, grants and concurrency behavior were not independently rerun. No business tables observed.                         |
| Web foundation    | Sign-in/recovery, protected shell, session API, user invitations/activation/roles, role editor and audit history            | Production compilation passes. Browser interaction and delivered email acceptance were not rerun in this audit.                                                    |
| Mobile foundation | Email/password Auth, protected session persistence/cleanup, live session validation, Today/Account shell                    | Logic tests pass; no native Android UI acceptance in this audit.                                                                                                   |
| Domain            | Validated provisional hen-day helper; zero hens returns null                                                                | No connected flock/collection workflow yet. Formula remains provisional.                                                                                           |
| Fieldbook         | Web implements warm paper/forest layout; mobile had divergent colors                                                        | Mobile theme now aligned with web's readable Fieldbook palette; device visual QA pending. Dark appearance is unimplemented.                                        |
| Farm workflows    | Scope inventory and decision register                                                                                       | Flocks/sheds/vaccines, inventory/feed/costing, egg/cold-storage/sales/trays, finance/expenses and operational reports remain unimplemented as end-to-end features. |
| Delivery          | EAS profiles and local native commands                                                                                      | No delivery-ready APK or production deployment verified.                                                                                                           |

## Checks performed

- TypeScript checks passed for mobile, web, API client, domain, types and validation.
- ESLint passed with zero warnings; initial formatting check passed.
- Existing deterministic tests: 69 passed. After new callback and domain regression tests: **75 passed, 0 failed**.
- Optimized Next.js production build and web/mobile type checks passed again after the callback changes. ESLint and formatting are checked for the final documentation/theme changes as well.
- Hosted development session check passed on an isolated local server at port 3100: signup disabled, anonymous denial, invalid-token denial and real administrator bearer access. This verifies that session path, not all administration endpoints, cookie behavior, email templates or database concurrency.
- The first integration attempt on port 3000 failed to reach a usable API; an attempted server start found that port occupied. An isolated server resolved the test setup issue. Existing port-3000 processes were not stopped.
- Docker daemon is unavailable. Did not run `db:test`, which resets a local database, and did not point destructive concurrency fixtures at hosted development.
- Native Android/iOS checks were not run. About 5.5 GiB free disk was observed; prior docs record disk-related emulator/CocoaPods failures. A physical Android device or adequate disk is required for acceptance.

The supplied pnpm runner attempted automatic dependency reconciliation and refused to purge modules without a terminal. Existing installed binaries were used for the checks; no dependency replacement was needed. `pnpm --config.verify-deps-before-run=false` can bypass that environment-specific preflight when using the installed tree, but a clean install still needs independent reproducibility acceptance.

## Corrections made

1. **Email callback gap:** code-only exchange did not support server-issued invitation token hashes. Added restricted invite/recovery token-hash verification, ambiguous-parameter rejection, safe failure redirects and no-referrer/no-store headers. Added three tests. Hosted templates still need configuration and delivered-link acceptance; see [email setup](../auth-email-setup.md). This follows [Supabase email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates).
2. **Local/hosted key mixing:** local launcher set only the anonymous alias while hosted `.env.local` could supply the preferred publishable alias. It now sets both public aliases to the local key.
3. **Uncovered calculation:** added three hen-day tests for zero/invalid counts and uncapped valid rates. No new domain rule or formula change.
4. **Fragmented test entry points:** added root `test` command collecting deterministic web, mobile, package and script suites. Database/live integration checks remain explicit separate commands.
5. **Design drift:** aligned mobile semantic colors with web's Fieldbook palette; clarified light-only implementation in design docs.
6. **Documentation drift:** corrected system overview's claim that server access was undecided; added audit/build/email guidance and index links.

## Notion reconciliation

[Saved Notion audit and plan](https://app.notion.com/p/4244da26a3cf81a1ac5efd4d043eb75c).

- Project status moved from Onboarding to In Progress; next milestone now refers to approved workflow mapping and foundation acceptance.
- Marked the monorepo skeleton checklist item complete. Historical client/payment gate checkboxes remain untouched.
- Repository/environment and data-model tasks now In Progress, with remaining criteria; flock task remains In Progress with helper-only progress explicitly stated.
- Added dated evidence/acceptance notes to eight existing technical/module/QA/delivery tasks, preserving their prior notes. Operational tasks remain Not Started.
- Added missing tasks for approved-source mapping, foundation database/email/Android acceptance and shared payments/receivables/expenses. No assignees or dates were invented.
- Five answered client decisions remain recorded; lay formula remains provisional. Proposal acceptance and advance tasks were not marked Done.
- Read the actual payment records: [advance](https://app.notion.com/p/4074da26a3cf8136b1f4cb600c61031d) is ₹15,000 **Due** with no paid date; [final balance](https://app.notion.com/p/4074da26a3cf810eb79efd41a59a6de1) is ₹15,000 **Not Invoiced** with no paid date. Neither record was edited.
- Added owner-sequencing context to the onboarding/project records without asserting client identity or payment evidence.

## Remaining risks and access

- Approved proposal/spec copies or their shared location are still required for detailed workflow rules and acceptance. The inspected Notion project/onboarding records name the documents but do not supply their approved contents.
- Client identity/contact fields are still blank in Notion; this audit does not infer identity or reopen formalities for sequencing.
- Hosted email template configuration, a test inbox, Android device resources and disposable local database runtime are required for remaining foundation acceptance.
- Existing historical target of 9 December is not revalidated by this audit. Size the approved remaining scope before reconfirming a delivery forecast.
- Security review here is source inspection plus bounded checks, not a full runtime penetration test. No claim of operational MVP completion, production readiness or payment receipt is made.

## Next development checkpoint

Complete B-01/B-02/B-06 in the build plan, then implement the first shed → flock placement → mortality/live counts → egg collection → hen-day slice with real contracts, transactional effects and device evidence. Keep material additions subject to written change control.
