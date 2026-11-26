# ADR-001: Mobile-first application architecture

- **Status:** Accepted for project setup
- **Decision date:** 2026-11-24
- **Source:** Project owner direction recorded in the [Notion project page](https://app.notion.com/p/4074da26a3cf81c98ae9f8b8c5d8db55)

## Context

Daily work is primarily performed by farm and feed-mill employees on mobile. Management needs a separate web dashboard for administration, reporting and configuration. The earlier web-first/Capacitor direction no longer matches that priority.

## Decision

1. Build the employee application with Expo, React Native and TypeScript. Android is first; iOS can follow using Expo and EAS Build.
2. Build a separate Next.js + TypeScript web dashboard for administration, reporting and configuration.
3. Keep both apps in one monorepo and share the API client, TypeScript types, validation schemas and configuration packages.
4. Use Supabase PostgreSQL, Auth and Storage. Keep authoritative business rules and privileged operations server-side; client apps must not independently implement the source of truth for those rules.
5. Use EAS Build for Android builds now and iOS builds later. This decision does not provision a paid service or production account.
6. Support local drafts and controlled syncing where needed. Full offline operation is not part of this decision.

## Consequences

- The mobile and admin interfaces are purpose-built for their users while sharing contracts and validation.
- The repository must preserve a server-side boundary for sensitive business rules.
- The chosen server runtime, deployment location, network protocol, Supabase schema and authorization model remain implementation decisions.
- Client-owned hosting and subscription costs remain governed by the existing commercial terms.

## Alternatives considered

- **Web-first app packaged with Capacitor:** rejected because the employee workflow is mobile-first and calls for a purpose-built native mobile experience.
- **One React Native Web UI for both surfaces:** not selected; the admin dashboard has separate web needs and will be implemented in Next.js.

## Revisit when

Revisit only if client workflows, operating constraints or delivery requirements materially change. Record any replacement decision in a new ADR and keep this record for history.
