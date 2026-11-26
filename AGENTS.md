# Project instructions

Start project-specific work by reading [`docs/README.md`](docs/README.md), then the relevant architecture, workflow or decision document. Keep repo docs aligned with accepted Notion decisions and the approved scope files when they become available.

## Objective and scope

Build the Poultry Farm & Feed Mill Management System for Palm Labs' client. Use the existing proposal and Detailed Scope & Workflow Specification v1.0 as the source of truth. The Notion project page lists the agreed scope, current tasks, recorded workflow decisions, commercial baseline, and Architecture Decision Record ADR-001:
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
- The owner has directed that kickoff formalities be treated as complete for work sequencing. The advance is still not recorded as paid; never change payment status without evidence and an explicit request.
- Six months from delivery for bug fixes and minor changes within approved scope; new modules/features and major workflow changes are excluded absent written approval.
- Client owns and pays for production backend/database, web hosting/server, domain, email/push and other subscriptions.
- Do not create or push a remote GitHub repository. Do not spend money. Do not expose secrets or commit real credentials.
- Keep Notion task history and payment data intact; synchronize the recorded workflow decisions and update task status only when the work actually meets its criteria.

## Existing records and recorded decisions

- Project page: https://app.notion.com/p/4074da26a3cf81c98ae9f8b8c5d8db55
- Client onboarding page: https://app.notion.com/p/4074da26a3cf81bd8431c6286934b9f4
- Tasks & Milestones database: https://app.notion.com/p/4d28f7cd4f86472f849762c8b8b40a12
- Existing purchase/feed-mill/costing task: https://app.notion.com/p/4074da26a3cf8134ac47f8d1b50ef45c
- The owner-supplied Proposal & Scope of Work / Quotation v1.0 and Detailed Scope & Workflow Specification v1.0 are archived under [the documentation sources](docs/README.md#source-of-truth). The proposal governs commercial terms.
- Client answers are recorded in [`docs/decisions/workflow-decision-register.md`](docs/decisions/workflow-decision-register.md). The lay-percentage formula is a provisional hen-day default; the [first workflow map](docs/flows/flock-shed-vaccination.md) records the demo boundary and the decisions deferred to future client review.
- Kickoff gates were declared complete by the owner for work sequencing. Keep the existing Notion payment and gate records unchanged unless evidence and an explicit update request are provided.

## Initial technical kickoff sequence

1. Kickoff gates are considered complete per the owner's instruction; use the archived proposal and specification as implementation references.
2. Agree workspace tooling, TypeScript conventions, lint/format rules, and environment variable handling.
3. Define development and production Supabase environments, access roles, and secret handling before provisioning.
4. Draft the initial data model, permissions, audit approach, and business invariants from the approved workflows.
5. Define shared API contracts and validation ownership before building screens.
6. Set up the Expo Android development/build workflow; defer iOS signing/builds until requested.
7. Select the first end-to-end workflow and record acceptance criteria/dependencies in the existing tracker.
8. Validate testing, deployment, and handover steps against the agreed MVP and client-owned accounts.

The local workspace, dependencies, and neutral app shells are established. No secrets or service accounts have been added. Continue building against the recorded decisions and approved scope; do not invent workflow rules that neither source covers.
