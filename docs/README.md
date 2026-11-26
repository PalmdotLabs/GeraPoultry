# Project documentation

This folder keeps the current project brief, accepted architecture and known workflow boundaries close to the code.

## Start here

- [Current progress audit](audits/2026-11-26-progress-audit.md): verified capabilities, corrections, limitations and Notion reconciliation.
- [Build plan](build-plan.md): ordered increments, dependencies and acceptance criteria before development continues.
- [Authentication email setup](auth-email-setup.md): invitation/recovery callback configuration and remaining live acceptance.
- [Project brief](project-brief.md): scope, delivery constraints and source links.
- [System architecture](architecture/system-overview.md): application/backend boundaries and implementation items still to settle.
- [Architecture decisions](architecture/decisions/README.md): accepted decisions and their history.
- [Workflow inventory](flows/README.md): in-scope areas and the current level of workflow detail.
- [Workflow decision register](decisions/workflow-decision-register.md): the five client answers and the provisional lay-rate formula.
- [Technical kickoff checklist](kickoff-checklist.md): implementation setup and prerequisites.
- [UI design direction](ui-design/README.md): the selected Fieldbook visual language and screen guidance.

## Source of truth

The approved Proposal & Scope of Work / Quotation v1.0 governs commercial terms. The approved Detailed Scope & Workflow Specification v1.0 governs detailed workflows. The Notion project record and tracker remain the operational source until their approved attachments are copied into this repository:

- [Notion project page](https://app.notion.com/p/4074da26a3cf81c98ae9f8b8c5d8db55)
- [Client onboarding record](https://app.notion.com/p/4074da26a3cf81bd8431c6286934b9f4)
- [Tasks & Milestones tracker](https://app.notion.com/p/4d28f7cd4f86472f849762c8b8b40a12)

The proposal and detailed specification copies are not yet in this repository. Until they are available, these notes capture only what is present in the project record and existing tracker; they are not a replacement for the approved documents.

## Documentation rules

- Keep commercial terms and client commitments aligned with the proposal.
- Mark unknown workflow behavior as open; do not infer rules from screen needs.
- Record accepted technical decisions as numbered ADRs. Supersede an ADR with a new record rather than silently rewriting history.
- Update the workflow inventory and decision register when the client confirms an answer or supplies the approved specification.
