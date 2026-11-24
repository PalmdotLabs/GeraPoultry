# Project instructions

## Objective and scope

Build the Poultry Farm & Feed Mill Management System for Palm Labs' client. Use the existing proposal and Detailed Scope & Workflow Specification v1.0 as the source of truth. The Notion project page lists the agreed scope, current tasks, open decisions, commercial baseline, and Architecture Decision Record ADR-001:
https://app.notion.com/p/4074da26a3cf81c98ae9f8b8c5d8db55

In-scope workflows include flock, shed and vaccination; feed mill and feed costing; ingredient, medicine, chick, egg and paper-tray purchases; egg stock, cold storage and sales; payments and receivables; tray ledger; expenses; reports; testing, deployment and basic handover. Preserve the approved workflow boundaries. Raise material additions or workflow changes as written change requests before implementing chargeable work.

## Architecture (accepted)

- Employee app: Expo + React Native + TypeScript, Android first; iOS later.
- Admin dashboard: separate Next.js + TypeScript app.
- Monorepo with shared API client, types, validation schemas, and configuration packages.
- Supabase PostgreSQL, Auth and Storage. Keep privileged operations, authoritative validation, inventory calculations, permissions, and business rules server-side.
- Use EAS Build for Android now and iOS later. Do not purchase plans or provision paid production services without authorization.
- Support local drafts and controlled syncing where needed. Full offline operation is not part of the current decision.

## Commercial and operational constraints

- Fee ₹30,000: ₹15,000 advance before development begins, ₹15,000 after agreed MVP delivery.
- The advance has not been recorded as paid. Never change payment status without evidence and explicit instruction.
- Six months from delivery for bug fixes and minor changes within approved scope; new modules/features and major workflow changes are excluded absent written approval.
- Client owns and pays for production backend/database, web hosting/server, domain, email/push and other subscriptions.
- Do not create or push a remote GitHub repository. Do not spend money. Do not expose secrets or commit real credentials.
- Keep current Notion tasks and open decisions intact; update task status only when the work actually meets its criteria.

## Existing records and open decisions

- Project page: https://app.notion.com/p/4074da26a3cf81c98ae9f8b8c5d8db55
- Client onboarding page: https://app.notion.com/p/4074da26a3cf81bd8431c6286934b9f4
- Tasks & Milestones database: https://app.notion.com/p/4d28f7cd4f86472f849762c8b8b40a12
- Existing purchase/feed-mill/costing task: https://app.notion.com/p/4074da26a3cf8134ac47f8d1b50ef45c
- Proposal & Scope of Work / Quotation v1.0 and Detailed Scope & Workflow Specification v1.0 are named baselines; the approved copies still need to be stored/linked when the shared location is ready. Proposal governs commercial terms.
- Client decisions still open: lay-percentage formula; receiving acknowledgement for shed feed transfers; vaccine reminder defaults/recipients (timing must remain configurable); treatment of dirty/stained eggs for sellable stock; whether external feed sales support partial payments/receivables.
- Kickoff gates: confirm client identity and decision-maker, written proposal/spec acceptance, advance receipt, client-owned production accounts/subscriptions, and development environment/task board readiness.

## Initial technical kickoff sequence

1. Confirm kickoff gates and obtain the proposal/spec files before implementation.
2. Agree workspace tooling, TypeScript conventions, lint/format rules, and environment variable handling.
3. Define development and production Supabase environments, access roles, and secret handling before provisioning.
4. Draft the initial data model, permissions, audit approach, and business invariants from the approved workflows.
5. Define shared API contracts and validation ownership before building screens.
6. Set up the Expo Android development/build workflow; defer iOS signing/builds until requested.
7. Select the first end-to-end workflow and record acceptance criteria/dependencies in the existing tracker.
8. Validate testing, deployment, and handover steps against the agreed MVP and client-owned accounts.

Scaffold folders are intentionally empty until repository tooling, dependencies, credentials, and project choices are approved or confirmed. Do not invent unresolved workflow rules.
