# Egg stock, cold storage, sales and trays

See [the workflow specification](../README.md#source-of-truth) §§2–3 and 7–9, and C-04 in the [decision register](../decisions/workflow-decision-register.md).

| Workflow             | Source-backed behavior                                                                                                                                  | Acceptance                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Farm collection      | Use the [first flock workflow](flock-shed-vaccination.md). Record good, cracked and dirty/stained quantities by configured grade.                       | Preserve the production breakdown and distinguish saleable stock. Verify the default dirty/stained stock setting. |
| Egg purchases        | Record supplier or source, date, grade, quantity and purchase cost. Add to available stock and preserve purchase identity.                              | Purchased eggs follow the same cold-storage path as farm eggs and remain distinguishable in reports.              |
| Storage and recovery | Transfer quantities between available and cold storage by grade. Recover cold stock to available before any sale.                                       | Both sides reconcile, insufficient-stock moves are rejected, and sales use available sellable stock.              |
| Sales                | Record customer, grade, quantity, tray type, date, customer-specific per-egg price, terms and due date. Deduct sellable stock and calculate sale value. | Validate stock and reconcile quantity, price and sale value.                                                      |
| Plastic trays        | Track issues, good returns, damaged returns and authorised adjustments separately from money. Subtract both return classes and adjustments from issues. | Damaged returns reduce outstanding trays and remain separately reportable.                                        |
| Paper trays          | Record purchase and usage or dispatch.                                                                                                                  | Paper trays have no return balance.                                                                               |

Confirm dirty/stained saleability, stock allocation rules when sources mix, and reversal behavior for linked stock, tray and payment records.

## Collection entry

Fieldbook uses **Farm setup → Egg grades** for administrator setup and **Egg collection** for recording and reviewing production. Collection entry requires `eggs.collection.create` and `farm.setup.read` in the web dashboard. Viewing saved entries requires `eggs.collection.read`. A user with flock read access may link a collection to a flock assigned to the selected shed. Leaving that choice blank records the collection against the shed alone.

The form accepts trays and loose eggs for good, cracked or broken, and dirty or stained eggs. The server converts one tray to 30 eggs, stores each category as a whole-egg count, and records the combined production total. Repeating a submission returns the same collection ID and preserves one audit entry. A shift is entered as a label for this increment. Stock movements, the dirty/stained stock setting and hen-day reporting remain separate increments.

The migration and permission checks passed on disposable PostgreSQL, including two overlapping submissions that saved 70 eggs with one collection ID and one audit entry. A browser run against an isolated Auth and Data API fixture covered grade setup, tray conversion, optional flock attribution, shed-only entry, retry, production totals, permissions and a narrow viewport. Hosted development still needs the egg collection migration.
