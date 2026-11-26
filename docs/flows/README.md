# Workflow scope map

The [v1.0 proposal and workflow specification](../README.md#source-of-truth) establish the baseline. The [decision register](../decisions/workflow-decision-register.md) records later answers to the specification's open questions.

## Deliverables and acceptance

| Proposal                   | Specification | Build plan       | Workflow and acceptance                                                                                                                                                                                                                        |
| -------------------------- | ------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Core farm operations    | §§1–5, 7, 11  | B-02–B-10, B-13  | [Flocks, sheds and vaccination](flock-shed-vaccination.md) and [purchases and expenses](finance-and-reports.md). Verify explicit employee permissions, quantity validation, admin-only changes to submitted records and traceable corrections. |
| D2 Feed mill and costing   | §§3, 6, 7     | B-10, B-11, B-13 | [Purchases, feed mill and costing](purchases-feed-mill-costing.md). Verify proportional formulas, sufficient ingredient stock, retained recipe and cost snapshots, reconciled transfers/returns and partial payment on external sales.         |
| D3 Egg inventory and sales | §§3, 7–9      | B-08, B-12, B-13 | [Eggs, cold storage, sales and trays](eggs-sales-and-trays.md). Verify grade and quality recording, source and purchase cost, recovery before sale, payments, plastic tray balances and paper tray usage.                                      |
| D4 Reports and dashboard   | §10           | B-14             | [Finance and reports](finance-and-reports.md). Reconcile operational totals to source entries and apply consistent filters to production, stock, flock, sales, expense and tray reports using test data.                                       |
| D5 Deployment and handover | §§11, 13–14   | B-03–B-05, B-15  | Verify web/API deployment, private Android installation, backup and restore, client-owned service access and the basic walkthrough. Use the proposal's five-business-day written review window and change-control process.                     |

Apply specification §§2 and 11 to each workflow. Employees create submitted records only where explicitly granted. Admin corrections or deletions require audit history, with soft deletion preferred. Saving a local draft has no server stock or count effect. Submission revalidates permission and stock, prevents accidental duplicates, and surfaces pending, submitted or failed status.

See [the build plan](../build-plan.md) for dependencies and sequence. Section 13 of the specification and the proposal's scope exclusions bound the MVP.
