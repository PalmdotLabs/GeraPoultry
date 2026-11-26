# Egg stock, cold storage, sales and trays

**Status:** Scope identified; detailed process awaits the approved workflow specification.

## In-scope capabilities

- Track egg stock and cold storage.
- Record egg sales and related payments/receivables.
- Maintain the tray ledger.
- Record egg purchases where they are part of the approved workflow.

## Open behavior

- An admin setting controls whether dirty/stained eggs count in stock; the initial setting is enabled. Stock inclusion does not itself define saleability; see the [workflow decision register](../decisions/workflow-decision-register.md).
- Do not assume grading categories, stock reservation, sale allocation, returns, tray-deposit rules or reconciliation behavior.

## Flow detail to capture

Egg receipt/collection, quality classification, cold-storage movement, sale, payment allocation, tray issue/return and corrections, with exact stock effects and acceptance criteria from the approved specification.
