# Poultry Farm & Feed Mill Management System

A mobile-first management system for farm and feed-mill employees, with a separate web dashboard for administration and reporting.

## Agreed architecture

- `apps/mobile`: Expo + React Native + TypeScript employee app; Android first, iOS later.
- `apps/web`: Next.js + TypeScript admin dashboard.
- `packages/api-client`, `types`, `validation`, `config`: shared contracts and configuration.
- `supabase`: PostgreSQL migrations, with Supabase Auth and Storage; authoritative business rules stay server-side.
- EAS Build: Android now, iOS later. Local drafts and controlled syncing where needed; no commitment to full offline operation.

## Project records

- Project brief and tracker: [Notion project page](https://app.notion.com/p/4074da26a3cf81c98ae9f8b8c5d8db55)
- Client/proposal acceptance and onboarding: [Notion client page](https://app.notion.com/p/4074da26a3cf81bd8431c6286934b9f4)
- Tasks and milestones database: [Notion tracker](https://app.notion.com/p/4d28f7cd4f86472f849762c8b8b40a12)
- Existing task: [Build purchases, feed mill and costing](https://app.notion.com/p/4074da26a3cf8134ac47f8d1b50ef45c)

The proposal and detailed workflow specification are the approved scope sources. Their copies/links are still to be placed in the client project folder when available; the proposal governs commercial terms.

## Commercial and delivery constraints

- Development fee: ₹30,000; ₹15,000 advance before development and ₹15,000 after the agreed MVP.
- Advance is not recorded as received. Do not mark it paid or begin work that depends on the payment gate.
- Six months of bug fixes and minor changes within approved scope; new features and major workflow changes require written change approval.
- Client owns and pays for hosting, Supabase/production backend, domain, EAS or other third-party subscriptions.
- Do not create or push a remote GitHub repository or incur paid service charges without authorization.

See [AGENTS.md](AGENTS.md) for working instructions and the current open decisions.
