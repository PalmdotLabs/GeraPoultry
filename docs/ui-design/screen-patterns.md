# Screen and interaction patterns

This guide translates the selected Fieldbook visual direction into layout guidance. It does not replace the approved workflow specification or define permissions and business rules.

## Employee app (mobile)

### Today / home

- Start with a brief greeting or workspace label and a clear “Today” section.
- Surface the next useful task or an honest empty state, such as “No collection recorded”.
- Use a small grid or list of frequent actions only when those actions are approved for the signed-in role.
- Show vaccination reminders only when configured and relevant. If none are configured, say so plainly and direct the employee to an administrator when appropriate.
- Keep primary destinations reachable with a bottom navigation bar; use a “More” destination for less frequent areas.

### Work entry

- Keep forms focused on one task, with labels, units and validation messages close to the relevant fields.
- Make save status clear, including when a record is a local draft or is waiting to sync.
- Support local drafts and controlled syncing where needed. Do not imply full offline operation.
- Provide a visible next step after a successful save; do not imply success before the server accepts authoritative changes.

## Admin web dashboard

- Use a persistent left navigation rail for major work areas and settings, with clear selected state and text labels.
- Keep page title, context and main action together at the top of the content area.
- Use summary cards for a small number of useful measures. Empty or unconfigured data should be explicit rather than replaced by sample metrics.
- Use tables/lists for operational records with readable columns, filters and clear empty/loading/error states.
- Put workspace configuration in Settings and label setting scope and effect plainly.
- At smaller widths, preserve content hierarchy and access to navigation; allow tables to scroll or adapt without hiding essential actions.

## Configuration patterns

- Vaccine reminder settings should support administrator-defined timing and recipients. The creation/edit workflow and available recipient roles must come from approved requirements.
- The dirty/stained egg stock option should state that enabling it counts those eggs in stock. Keep the separate saleability rule visible where egg sale flows require it.
- Settings should explain consequential changes and show save/error confirmation. Authorization and audit requirements remain server-owned and must follow the approved access model.

## Shared interaction rules

- Prefer one clearly emphasized primary action per view; secondary actions should not compete visually.
- Use explicit labels and confirmation for destructive or irreversible actions.
- Preserve keyboard access and visible focus on web; support screen readers, scalable text and touch-sized controls on mobile.
- Keep messages short, specific and actionable. Never rely on color alone for status or validation.
- Treat all UI values as display/input only until validated by the server-side business logic.
