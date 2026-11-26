# Workflow decision register

Updated: 2026-11-24, from the project owner's answers. These decisions should be reflected in the approved detailed workflow specification when it is available.

| ID   | Decision                                                                                                                                                                                                                                                                           | Status                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| C-01 | Use daily hen-day production for lay percentage: eggs laid that day ÷ live laying hens in that flock that day × 100. Count eggs laid regardless of quality/stock classification. This is a provisional default pending review against the approved specification.                  | Provisional                    |
| C-02 | Shed feed transfers do not require acknowledgement from the receiving shed. Record a transfer as complete when the sender records it; there is no pending acknowledgement state.                                                                                                   | Decided                        |
| C-03 | Vaccine reminder timing and recipients are configurable in admin settings. Do not hard-code a schedule; the administrator sets it.                                                                                                                                                 | Decided                        |
| C-04 | Provide an admin setting that controls whether dirty/stained eggs count in stock. Default the setting to enabled (count them), as directed. Stock inclusion alone does not make an egg saleable; the detailed saleability rule must come from the approved workflow specification. | Decided; detail boundary noted |
| C-05 | External feed sales support partial payments and receivables, following the egg-sales payment pattern.                                                                                                                                                                             | Decided                        |

## Lay percentage definition

The selected metric is **hen-day egg production**. For one flock on one date:

`lay percentage = eggs laid on that date / live laying hens in that flock on that date × 100`

This uses hens alive on the date, so mortality is reflected in the denominator. It differs from **hen-housed production**, which uses the number initially housed. For a date range, calculate from total eggs divided by total live hen-days, then multiply by 100; do not average daily percentages without weighting for flock size. The metric counts eggs produced, while the stock setting separately controls whether dirty/stained eggs count in stock.

References:

- [USDA/NASS, Layers '99: Part II — hen-day egg production](https://ageconsearch.umn.edu/record/32765/files/lay99de2.pdf)
- [North Carolina State University repository — hen-day egg production definition and formula](https://repository.lib.ncsu.edu/bitstreams/7e22e385-273d-48c7-ad1a-59634b4d54b4/download)

## Follow-through

- Reflect these rules in the approved Detailed Scope & Workflow Specification when it is available.
- Implement the stock toggle and vaccine reminder settings through admin configuration, with permission and audit behavior defined from the approved access model.
- Keep the lay percentage provisional until it is checked against the approved specification; replace it only with a documented decision.
- Keep the related Notion task synchronized. Do not change payment status.
