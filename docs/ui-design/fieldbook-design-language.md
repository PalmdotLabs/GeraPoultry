# Fieldbook design language

Status: **Selected visual direction**  
Decision owner: project owner  
Reference: Fieldbook concept reviewed in the project chat on 2026-11-24

## Intent

Make daily farm work feel clear, steady and approachable. Use a restrained forest-green identity, warm paper-like backgrounds, soft sage groupings and a small clay accent. Favor readable labels and obvious actions over decorative dashboard chrome.

## Visual tokens

These are starting values from the reviewed concept. Treat them as design tokens; adjust for contrast and platform rendering during implementation.

| Token      | Starting value | Intended use                                             |
| ---------- | -------------- | -------------------------------------------------------- |
| Forest     | `#60734E`      | Primary actions, selected navigation, key icons          |
| Ink        | `#29352A`      | Main text and headings                                   |
| Muted ink  | `#70796D`      | Secondary labels, hints and supporting text              |
| Warm paper | `#F0EFE5`      | App canvas and navigation rail surfaces                  |
| Soft white | `#FFFDF6`      | Cards and raised content surfaces                        |
| Sage wash  | `#E7EADC`      | Selected rows, quiet callouts and grouped content        |
| Fine line  | `#E1E3D8`      | Subtle borders and separators                            |
| Clay       | `#B77855`      | Occasional secondary emphasis; never the only status cue |

Use semantic names in implementation rather than scattering raw hex values. Check text and control contrast in light and dark appearance before finalizing. Dark appearance should preserve the same semantic hierarchy with suitable darker surfaces and lighter text.

The current apps implement light appearance. The web CSS and mobile theme use a darker primary forest (`#526540`, strong `#3F5131`) and muted ink (`#697364`) for readable text/control contrast while retaining the Fieldbook paper, sage and ink colors. The mobile palette was aligned during the 2026-11-26 audit. Dark appearance remains unimplemented and is not an acceptance claim.

## Type and hierarchy

- Use the native system sans-serif for a familiar, legible feel.
- Screen titles are concise and prominent; section headings are clearly smaller; labels and helper text remain readable at device scale.
- Use sentence case for navigation and actions. Reserve uppercase letter-spaced text for small metadata such as date or section eyebrow labels.
- Avoid dense all-caps labels, tiny captions, and color-only distinctions.

## Shape, spacing and iconography

- Use comfortable spacing and softly rounded cards and controls. Keep spacing consistent within a screen and provide a compact option only where record-heavy admin content needs it.
- Use simple, familiar line icons paired with text for important actions. Icons supplement labels rather than replace them.
- Use thin, low-contrast dividers; reserve stronger borders for fields, focus states and important grouping.
- Motion should be brief and functional. Respect reduced-motion preferences and avoid motion as the sole feedback for a saved change.

## States and content

- Show meaningful empty/setup states (for example, no flock set up or no collection recorded) without inventing counts, names, dates or activity.
- Distinguish unavailable, not configured, zero and loading states; they do not mean the same thing.
- Pair status color with text or an icon and keep errors visibly distinct from neutral information.
- Confirm destructive or consequential actions and make successful save/sync feedback explicit.
- Do not expose implementation terms or internal package names in the product UI.

## Confirmed UI-relevant decisions

- Vaccine reminder timing and recipients are configured in admin settings; do not show a hard-coded schedule. An unconfigured state should prompt an administrator to configure one.
- The dirty/stained egg stock setting is enabled by default to count these eggs in stock. Stock inclusion does not itself imply saleability; follow the approved workflow rule.
- Lay percentage uses the provisional hen-day formula recorded in the [decision register](../decisions/workflow-decision-register.md); avoid hard-coded sample values and retain the provisional qualifier until validated against the approved detailed specification.
- Shed feed transfers do not wait for receiving acknowledgement.
- External feed sales support partial payments and receivables, following the egg-sales payment pattern.

## Reference mockup

The reviewed Fieldbook mockup is a concept only. Build native screens in `apps/mobile` and `apps/web` and keep the design source of truth in this document. Do not add the mockup HTML as an application dependency.
