# ADR-002: Keep business calculations in a server-only domain package

- **Status:** Accepted for initial implementation; reversible
- **Decision date:** 2026-11-24
- **Scope:** Code organization only. This does not choose the server runtime or deployment host.

## Context

The accepted architecture requires authoritative business rules to run server-side and be shared consistently by the mobile and admin applications through API contracts. The first confirmed calculation is hen-day egg production. Duplicating it in either client could produce inconsistent reporting.

## Decision

Place authoritative business calculations in `packages/domain`. Import that package only from server-side entry points. Mobile and web clients must call the server API and must not bundle or invoke authoritative domain operations directly.

The package is runtime-agnostic. The project still needs to choose where server-side entry points run and how they deploy.

## First implementation

`calculateHenDayProductionRate` computes eggs laid for one flock/date divided by live laying hens for that same flock/date, multiplied by 100. It counts eggs laid regardless of quality/stock treatment. With zero live laying hens, it returns `null` because the rate is undefined. Invalid counts are rejected. This rule is provisional pending review against the approved Detailed Scope & Workflow Specification v1.0.

## Consequences

- One implementation is available to the eventual server-side API/runtime.
- API routes, Supabase Edge Functions or another server host remain unselected.
- The calculation must be adjusted only through a documented decision if the approved specification differs.
