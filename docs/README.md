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

The owner supplied the following v1.0 baselines dated 28 October 2026. The proposal governs commercial terms. The detailed specification defines workflow scope, supplemented by the recorded client decisions.

- [Proposal & Scope of Work / Quotation v1.0](scope/Palm_Labs_Poultry_Farm_Feed_Mill_Proposal_Quotation_v1.0.docx)
- [Detailed Scope & Workflow Specification v1.0](scope/Palm_Labs_Poultry_Farm_Feed_Mill_Detailed_Scope_and_Workflows_v1.0.docx)

Notion holds the project records and task history:

- [Notion project page](https://app.notion.com/p/4074da26a3cf81c98ae9f8b8c5d8db55)
- [Client onboarding record](https://app.notion.com/p/4074da26a3cf81bd8431c6286934b9f4)
- [Tasks & Milestones tracker](https://app.notion.com/p/4d28f7cd4f86472f849762c8b8b40a12)

The archived proposal has blank client and signature fields. Written acceptance and payment evidence are kept separately in the project records.

## Documentation rules

- Keep commercial terms and client commitments aligned with the proposal.
- Mark unknown workflow behavior as open; do not infer rules from screen needs.
- Record accepted technical decisions as numbered ADRs. Supersede an ADR with a new record rather than silently rewriting history.
- Update the workflow inventory and decision register when the client confirms an answer or supplies the approved specification.
