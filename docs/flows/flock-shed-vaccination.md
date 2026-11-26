# Flock, shed and vaccination

**Status:** Scope identified; detailed process awaits the approved workflow specification.

## In-scope capabilities

- Manage flock/batch and shed information.
- Record flock/shed operations, including bird movements and mortality where defined by the approved specification.
- Manage vaccination records and reminders.

## Confirmed behavior

- Lay percentage uses daily hen-day production: eggs laid on the date divided by live laying hens in that flock on the date, multiplied by 100. See [workflow decision register](../decisions/workflow-decision-register.md); this is provisional pending review of the approved specification.
- The calculation is implemented in `packages/domain/src/lay-percentage.ts`; it returns `null` when the flock has zero live laying hens for that date.
- Shed feed transfers do not wait for receiving-shed acknowledgement; the sender's recorded transfer is complete.
- Vaccine reminder timing and recipients are configurable in admin settings. Do not hard-code reminder defaults.

## Awaiting approved specification

- Do not assume other flock-count formulas, vaccination permissions or close-out rules; derive them from the approved specification and recorded decisions.

## Flow detail to capture

Actors, allowed flock/shed changes, bird-count effects, required records, reminder creation and delivery, corrections, audit history and acceptance criteria.
