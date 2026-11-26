# UI design

## Selected direction

Use **Fieldbook** as the visual direction for both products: a warm, calm, practical interface grounded in farm work. The design mockup is a reference, not a specification of workflow behavior.

- [Fieldbook design language](fieldbook-design-language.md): palette, typography, components and accessibility guidance.
- [Screen and interaction patterns](screen-patterns.md): employee mobile app and admin web dashboard patterns.

## Product split

- Employee app: Expo + React Native, primarily used on Android phones during daily farm operations.
- Admin dashboard: separate Next.js web app for setup, configuration, oversight and reporting.
- Keep component implementation platform-appropriate. Share tokens and domain vocabulary where useful; do not force identical navigation or layouts across mobile and web.

## Design boundaries

- UI structure must not invent or change a business rule. Refer to the [workflow decision register](../decisions/workflow-decision-register.md) and approved workflow specification.
- Clearly distinguish missing setup, empty records, loading and errors. Do not fill screens with fabricated business data.
- Keep authoritative validation, permissions and calculations server-side as required by [ADR-001](../architecture/decisions/ADR-001-mobile-first-architecture.md) and [ADR-002](../architecture/decisions/ADR-002-server-side-domain-package.md).
- The initial HTML concept is a visual aid; it is not production UI or a dependency. Recreate approved patterns with the project's React Native and Next.js stack.
