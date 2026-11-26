# Flock, shed and vaccination

The first slice covers shed setup, initial flock placement, mortality, collection and hen-day display. The [v1.0 specification](../README.md#source-of-truth) §§2–5, 8.1, 10–12 and the [decision register](../decisions/workflow-decision-register.md) govern this map.

## First slice and access matrix

| Action                                            | Actor                                                | Inputs and effects                                                                                                                                                                                   | Acceptance                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set up sheds and breeds (§§2–3)                   | Admin                                                | Configure sheds and manually entered breed names. Use configured records in flock forms.                                                                                                             | Employees can select eligible records in permitted forms. Master-data changes require admin access.                                                                                                                                                            |
| Register an arriving batch and place birds (§4.1) | Admin or employee with create access                 | Batch ID, breed, arrival date, age at arrival, number of birds housed and the initial allocation across one or more sheds. Store live allocations by batch and shed.                                 | Persist the batch and all placements together. Allocated birds reconcile to the number housed. A rejected submission leaves both batch and allocations unchanged.                                                                                              |
| Record mortality (§4.3)                           | Admin or employee with create access                 | Date, batch, shed, bird count and optional reason/remarks. Reduce the available allocation in that batch and shed and expose the loss in the mortality report.                                       | Reject a count above the available allocation. Concurrent entries cannot take the balance below zero. A retry cannot apply the same loss twice.                                                                                                                |
| Record daily egg collection (§8.1)                | Admin or employee with create access                 | Date, shed, batch where applicable, shift, configured grade, tray and loose quantities, and good, cracked/broken and dirty/stained counts. One tray equals 30 eggs. Store counts as individual eggs. | Preserve grade and quality breakdowns. Cracked eggs are excluded from sellable stock. The dirty/stained stock setting defaults to enabled. The saleability rule remains open.                                                                                  |
| Read production and flock totals (§10)            | Admin or employee granted the relevant report access | Daily collection by shed and grade, flock counts and mortality by batch, shed and period, and the provisional hen-day metric.                                                                        | Production includes all quality classes. Rate inputs reconcile to source collection and live laying hen counts for the same grain and date. Demonstrate the provisional rate where collection and live laying counts are explicit for the same flock and date. |
| Correct or delete submitted records (§2)          | Admin                                                | Trace the correction/deletion in audit history and reconcile affected counts and egg stock.                                                                                                          | Employees cannot edit or delete submitted records. Audit history identifies the actor and affected record. Demonstrate corrections on records with clear effects. Defer cascading reversals for stock that has moved or sold.                                  |

## Shed and breed setup

The first implementation supports `GET` and `POST` at `/api/v1/farm-setup/sheds` and `/api/v1/farm-setup/breeds`. `farm.setup.read` is granted to the system admin and can be assigned to employee roles that need the lookups. Creation requires the active system admin role and records who created the entry in the audit history. Names are trimmed at the API and unique within each list regardless of case. The shared API client exposes both operations for the demo forms.

The Fieldbook admin page at `/farm-setup` lists both lookups and lets the system admin add records. The browser check covered empty lists, load retry, validation, creation, duplicate names, reload, permission restrictions and a narrow viewport. It used the real web routes and an isolated Auth and Data API fixture. The migration and database permission tests passed on disposable PostgreSQL. Hosted development also verified administrator creation, employee lookup access, duplicate-name rejection, and creator attribution in the audit history.

## Flock arrival and initial placement

`POST /api/v1/flocks` requires `flocks.create` and saves the arrival, placements and one audit event in a single transaction. The batch code is unique regardless of case. Record the entered arrival age in days or weeks. Initial placements use distinct configured sheds and must account for every housed bird. The submission ID is scoped to the submitting user. Retrying the same submission returns the original flock ID, including when placement rows arrive in a different order. Reusing the submission ID with changed details returns a conflict.

`GET /api/v1/flocks` requires `flocks.read` and lists the initial placements. Both permissions are available to assign to employee roles and are granted to the system admin. The original placement records provide the baseline for the later mortality and movement workflows. Disposable PostgreSQL checks passed for access, atomicity, validation, and overlapping retries.

In Fieldbook, open **Flocks** to view arrivals and their original shed allocations. **Register flock** uses the configured breed and shed lists, shows the running allocation total, and preserves the submission ID on an unchanged retry while the form is open. Registering from the web dashboard requires `flocks.create` and `farm.setup.read`. Viewing arrivals requires `flocks.read`. Browser checks verified these boundaries and the split, missing-setup and retry flows through the production-mode web app with an isolated Data API fixture.

## Mortality and current counts

`POST /api/v1/flocks/[id]/mortality` requires `flocks.mortality.create`. It records a date, a shed assigned to the flock, the number of birds lost, and optional remarks. The report, deduction and audit entry commit together. The server rejects losses greater than the current count and returns the existing report ID on an unchanged retry. The system admin has this permission by default.

`GET /api/v1/flocks/[id]/live-counts` requires `flocks.read` and returns the original and current counts by shed. Existing and new placements start at their original counts. Posted mortality changes the current count while retaining the recorded date for future reporting. This count source does not determine a historical hen-day denominator.

In Fieldbook, open the batch's **Live counts** link from **Flocks**. The screen shows original and current counts per shed and for the flock. Users with `flocks.mortality.create` can record a loss against a listed shed. The form retains an unchanged submission ID for retries while it is open. A confirmed save reloads the current counts.

Disposable PostgreSQL verification covered the existing-placement backfill, new placements, permissions, invalid submissions, replay at zero birds, audit history and overlapping losses. The mortality migration has also been applied in hosted development.

## Hosted development verification

On 26 November 2026, both farm migrations were applied to hosted development. All seven migration versions and the generated public TypeScript schema matched the repository. A loopback web server used the live development Auth and Data API for both cookie and bearer sessions.

The live check registered a 100-bird flock split 35 and 65 across two sheds. Retries returned the original flock ID, with two placement rows and one registration audit event. A changed replay returned a conflict. Invalid totals and an unknown shed left no flock records. Separate employee accounts verified the create and read boundaries. The QA flock, placements, sheds, breed and temporary roles were removed. The QA accounts were disabled and their sessions revoked, with audit history retained.

After the mortality migration, all eight migration versions and the generated public types matched the repository. Chrome against hosted development confirmed that a loss of seven reduced one shed from 40 to 33 birds while the other stayed at 60. An over-limit loss was rejected, a retry after an interrupted response produced one deduction and one audit entry, and a read-only account could view counts. QA operational data and the temporary role were removed, and the QA account was disabled and signed out. Audit records were retained.

## First demo boundary

Use a single laying flock in a shed with an explicit count on the collection date for the hen-day example. Demonstrate mortality as a separate change to the current allocation. Keep shared-shed collections attributable to the shed when there is no explicit batch link. Where the inputs do not support a rate, leave the rate unavailable.

## Future client review after the first demo

The owner deferred these topics because they were outside the original walkthrough. They are retained for client discussion once there is a working demo.

- Confirm the daily live-hen snapshot time and whether same-day mortality, movement, and manual stage changes affect that day's denominator. Confirm how a missing count appears. The existing pure helper returns no rate for zero hens.
- Define whether and when a collection must name a batch in a shared shed and how to attribute collection to batches and laying stages for reports. Confirm whether the initial placement or a separate manual stage entry identifies the batch as laying.
- Confirm the unit for age at arrival, allowed backdating and effective dates, and how admin corrections affect dependent counts or egg stock that has already moved or sold.
- Confirm dirty/stained egg saleability. The owner settled stock inclusion separately in C-04.
- Confirm any collection uniqueness rules by date, shift, shed, batch and grade. Submission replay protection is required independently.

## Follow-on flock work

- Spec §4.2 requires batch, source shed, destination shed, movement date and count. Validate source availability and preserve the movement record while transferring the same count between allocations.
- Spec §4.4 requires manual stage changes and permits manual shed observations where used.
- Spec §5 uses arrival age and configured schedules to derive vaccine due dates. An authorised user records date, vaccine, batch or shed as applicable, and optional remarks. Recording the matching vaccination clears the due or overdue state. Admin controls reminder timing and recipients per C-03. Default values and delivery channels remain open.
