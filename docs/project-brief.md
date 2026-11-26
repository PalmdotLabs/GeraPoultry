# Project brief

## Purpose

Build a mobile-first management system for poultry farm and feed-mill employees, with a separate web dashboard for administration and reporting.

## Agreed scope

The Notion project record lists these in-scope areas:

- Flock, shed and vaccination management.
- Feed mill operations and feed costing.
- Purchases of ingredients, medicines, chicks, eggs and paper trays.
- Egg stock, cold storage and sales.
- Payments and receivables.
- Tray ledger, expenses and reports.
- Testing, deployment and basic handover for the agreed MVP.
- Six months from delivery of bug fixes and minor changes within the approved scope.

New modules/features, major workflow changes, ongoing maintenance/monitoring, hosting and third-party charges are excluded unless separately approved in writing.

## Commercial baseline

- Total development fee: ₹30,000.
- Advance: ₹15,000 before development begins.
- Final payment: ₹15,000 after delivery of the agreed MVP.
- The advance is not recorded as paid in the current Notion record. Do not change payment status without evidence and an explicit update request.
- Client owns and pays for production backend/database, web hosting/server, domain and required email, push or other subscriptions.

The owner has directed that kickoff formalities be considered complete for work sequencing. This does not change the payment record or the historical Notion checkboxes.

## Delivery direction

- Employee app: Expo + React Native + TypeScript; Android first, iOS later.
- Admin: separate Next.js + TypeScript web application.
- Monorepo with shared API client, types, validation and configuration packages.
- Supabase PostgreSQL, Auth and Storage; authoritative business logic stays server-side.
- EAS Build for Android now and iOS later.
- Support local drafts and controlled syncing where needed; full offline operation is not included in the current decision.

See [ADR-001](architecture/decisions/ADR-001-mobile-first-architecture.md).

## Current limits of this brief

The named proposal and Detailed Scope & Workflow Specification v1.0 have not been copied into this repository yet. The workflow pages here summarize only the current Notion project record and tracker plus the recorded client decisions. Detailed roles, other formulas, transitions, validation and acceptance criteria must come from the approved specification and recorded decisions.
