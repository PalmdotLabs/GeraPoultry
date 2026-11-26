# Poultry Farm & Feed Mill Management System

A mobile-first management system for farm and feed-mill employees, with a separate web dashboard for administration and reporting.

## Agreed architecture

Current status and next work: [26 November audit](docs/audits/2026-11-26-progress-audit.md) and [build plan with acceptance criteria](docs/build-plan.md). The foundation is implemented; operational MVP workflows remain pending. Invitation/recovery setup and live acceptance are documented in [authentication email setup](docs/auth-email-setup.md).

- `apps/mobile`: Expo + React Native + TypeScript employee app; Android first, iOS later.
- `apps/web`: Next.js + TypeScript admin dashboard.
- `packages/api-client`, `types`, `validation`, `config`: shared contracts and configuration; `packages/domain` holds server-only business calculations.
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
- Kickoff formalities are considered complete for work sequencing per the owner's instruction. Payment records remain unchanged until there is evidence and an explicit request to update them.
- Six months of bug fixes and minor changes within approved scope; new features and major workflow changes require written change approval.
- Client owns and pays for hosting, Supabase/production backend, domain, EAS or other third-party subscriptions.
- Do not create or push a remote GitHub repository or incur paid service charges without authorization.

See [AGENTS.md](AGENTS.md) for working instructions and the [workflow decision register](docs/decisions/workflow-decision-register.md) for client answers and provisional rules.

Project documentation is in [`docs/`](docs/README.md), including the accepted ADR, system boundaries, workflow inventory, and unresolved client decisions.

The selected UI direction is documented in [`docs/ui-design/`](docs/ui-design/README.md). Use it as a visual guide while keeping behavior grounded in approved workflows and the decision register.

## Hosted Supabase development

The current development target is the hosted Supabase project configured in `apps/web/.env.local`. It supports either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred for new projects) or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`, alongside `NEXT_PUBLIC_SUPABASE_URL`.

Use the standard commands so Next.js reads that file without overriding it:

```sh
npx --yes pnpm@11.25.0 dev:web
```

`dev:web` explicitly uses webpack for stable Fast Refresh in this workspace; production builds are unchanged. The `dev:web:local`, `start:web:local`, `build:web:local`, and `db:bootstrap` commands are only for the optional Docker-backed Supabase alternative below. They derive configuration from the local CLI and must not be mixed with hosted credentials.

For setup, also configure `SUPABASE_ENVIRONMENT=development`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` as server-only values in `apps/web/.env.local`. Use the Session pooler database URL when the direct host requires IPv6, as on this workstation; the guarded migration script rejects URLs belonging to another project. Public signup must remain disabled, and `HOSTED_ADMIN_EMAIL` plus `HOSTED_ADMIN_PASSWORD` are required only for initial administrator bootstrap. No secrets are committed or printed by these commands.

```sh
npx --yes pnpm@11.25.0 db:push:hosted:dry-run
npx --yes pnpm@11.25.0 db:push:hosted
npx --yes pnpm@11.25.0 db:types:hosted
npx --yes pnpm@11.25.0 db:bootstrap:hosted
npx --yes pnpm@11.25.0 dev:web
```

`db:push:hosted` applies new migrations and requires project-owner consent through the CLI. Run `db:bootstrap:hosted` only for initial setup or after deliberately resetting hosted authentication; it refuses to modify an account whose email already exists.

Verify the hosted backend and optimized build with:

```sh
npx --yes pnpm@11.25.0 test:session-api:hosted
npx --yes pnpm@11.25.0 typecheck
npx --yes pnpm@11.25.0 --filter @poultry/web build
npx --yes pnpm@11.25.0 --filter @poultry/web start
```

The hosted session check requires a running web server on port 3000. It verifies public signup is disabled, anonymous and invalid-token rejection, and the development administrator's live bearer permissions.

## Administration capabilities

The protected admin currently includes:

- **Users:** inspect Auth/profile state, invite by Supabase email, activate/deactivate profiles, and assign roles. Invitations start with no roles and no plaintext password is created by the application. Deactivation preserves Auth/audit history; the UI does not hard-delete users.
- **Roles:** create/edit custom roles, assign permission IDs, and delete unused roles through guarded RPCs rather than open client table mutations. The system `admin` role and all core grants are protected, codes are immutable, in-use roles cannot be deleted, and no business roles are seeded. Role readers can open protected system-role definitions from the directory; View navigation never grants `roles.manage`.
- **Audit events:** paginated, newest-first history of invitations, activation, role definitions, permission grants, and assignments, with actors, targets, request IDs where available, and JSON details. Invitation events require actual Auth invitation state and are protected from duplicate/replayed records.

| Permission     | Allows                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| `admin.access` | Open the protected admin application.                                               |
| `users.read`   | Read user identity/profile/role information.                                        |
| `users.manage` | Invite users, change profile activation, and assign roles.                          |
| `roles.read`   | Read roles and the permission catalog; also required by the role-assignment editor. |
| `roles.manage` | Create, edit, and delete allowed custom roles.                                      |
| `audit.read`   | Read administration audit history.                                                  |

All APIs enforce these checks server-side and through RLS/RPCs; hiding navigation is not the security boundary. Cookie-authenticated mutations must also match the configured `Origin`; bearer-authenticated non-browser API clients authenticate without that ambient cookie cross-site risk. The service-role key is used only by server-side Auth administration and never by the API client or browser.

`APP_ORIGIN` defaults to `http://localhost:3000` only in development. Production mutations and invitations must explicitly set the canonical HTTPS origin, for example `APP_ORIGIN=https://admin.example.com`. Supabase Auth's Site URL and redirect allow-list must include that origin and its `/auth/callback` route. The app validates the configured origin rather than trusting request Host headers.

Use `dev:web` as normal, then **Users**, **Roles**, or **Audit history** in the left navigation. Migration setup is already complete for this hosted development project; do not rerun `db:bootstrap:hosted` for an existing administrator.

## Employee mobile foundation

The Expo app now has hosted email/password authentication, encrypted SecureStore session persistence, live profile and role validation, foreground refresh, revocation handling, and local sign-out. Active employees can use Today/Account with real profile details even without assigned roles; inactive profiles are rejected. No farm operations or offline capability are implied.

```sh
npx --yes pnpm@11.25.0 mobile:env
npx --yes pnpm@11.25.0 dev:web
npx --yes pnpm@11.25.0 dev:android
```

`mobile:env` copies only public Supabase URL/publishable-key values from the hosted web environment and configures the Android emulator API origin `http://10.0.2.2:3000`. It does not copy administrator passwords, service-role credentials, or database URLs. Do not use web-only credentials in production mobile bundles. Override `EXPO_PUBLIC_API_URL` for non-emulator devices or production HTTPS hosting. `build:android:local` invokes `expo run:android` locally, not EAS.

Source behavior, SecureStore corruption cleanup, foreground refresh, local sign-out, and API/token failure cases have passing regression tests. A real active employee with no roles was also verified through the hosted session API and then removed with audit retention. Native Android/iOS UI was not verified: the host disk filled during emulator preflight and during the requested local iOS CocoaPods attempt, whose staging was removed. See [`apps/mobile/README.md`](apps/mobile/README.md) for the precise verification boundary and resource requirements before first device acceptance.

## Optional local Supabase development

The repository includes local Supabase identity/RBAC/audit migrations, email/password Auth, a protected Next.js admin shell, shared session contracts, generated database types, and an API client that accepts browser cookies or Expo-compatible bearer tokens. Business workflows remain pending the approved specification.

### Prerequisites

- Node.js 22.13 or newer and npm. Commands below use the pinned pnpm version through `npx`; substitute `pnpm` when it is installed.
- A Docker-compatible runtime. A free macOS option is Colima with the Docker CLI:

  ```sh
  brew install colima docker
  colima start --cpu 2 --memory 4 --disk 20
  ```

  Keep approximately 12 GB of host disk space free for the local images and VM. Only the services used by the app are enabled; Realtime and Edge Runtime are disabled.

### Start the application

```sh
npx --yes pnpm@11.25.0 install
npx --yes pnpm@11.25.0 db:start
npx --yes pnpm@11.25.0 db:types
LOCAL_ADMIN_PASSWORD='replace-with-a-local-only-password' npx --yes pnpm@11.25.0 db:bootstrap
npx --yes pnpm@11.25.0 dev:web:local
```

Run `db:bootstrap` once after a clean database reset. Its password is for the local Auth account only, must be at least 12 characters, and is not written to project or environment files by the script. The default local sign-in email is `admin@poultry.local`; `LOCAL_ADMIN_EMAIL` and `LOCAL_ADMIN_DISPLAY_NAME` can override the other account fields.

Open **http://localhost:3000** (not `127.0.0.1:3000`, because Next.js blocks cross-origin development resources by default). Sign in with the bootstrap email and password.

The local launcher reads Supabase's public URL/anonymous key from the running CLI and injects them into the web process. It does not copy the service-role key into the web environment or modify `.env.local`. For a manually configured environment, use `apps/web/.env.example` as the non-secret template and run `dev:web` instead.

Local service interfaces:

- Supabase Studio: http://127.0.0.1:54323
- Password recovery email (Mailpit): http://127.0.0.1:54324

### Verification and useful commands

| Command                                                                              | Behavior                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx --yes pnpm@11.25.0 typecheck`                                                   | Typechecks every workspace package.                                                                                                                                                                                                                  |
| `npx --yes pnpm@11.25.0 lint`                                                        | Runs ESLint with TypeScript rules and framework-specific Expo and Next.js presets; warnings fail the command.                                                                                                                                        |
| `npx --yes pnpm@11.25.0 test:web`                                                    | Runs deterministic web regressions, including role-directory destinations and the distinct system-role and non-manager View links.                                                                                                                   |
| `npx --yes pnpm@11.25.0 format:check`                                                | Checks shared formatting across maintained application/shared-package sources, scripts, configuration and existing documentation.                                                                                                                    |
| `npx --yes pnpm@11.25.0 format`                                                      | Applies the same Prettier conventions to those maintained files.                                                                                                                                                                                     |
| `npx --yes pnpm@11.25.0 db:test`                                                     | **Destroys and recreates the local database**, applies migrations, and runs 151 authorization/RLS/pgTAP assertions plus the admin-race and both role-assignment/deletion race harnesses. Removes local users, including the bootstrap administrator. |
| `npx --yes pnpm@11.25.0 test:api-client`                                             | Runs shared and administration API-client behavioral tests, including safe fetch/token-provider failure handling.                                                                                                                                    |
| `npx --yes pnpm@11.25.0 test:local-scripts`                                          | Tests loopback-only URL validation before credential forwarding.                                                                                                                                                                                     |
| `LOCAL_ADMIN_PASSWORD='your-local-password' npx --yes pnpm@11.25.0 test:session-api` | Against a running web server, checks anonymous 401, invalid bearer 401, and actual administrator bearer access.                                                                                                                                      |
| `npx --yes pnpm@11.25.0 db:types`                                                    | Regenerates `packages/types/src/database.ts` from the running local public schema after migrations.                                                                                                                                                  |
| `npx --yes pnpm@11.25.0 build:web:local`                                             | Produces the optimized Next.js build using local public Supabase configuration.                                                                                                                                                                      |
| `npx --yes pnpm@11.25.0 start:web:local`                                             | Serves the optimized build on port 3000.                                                                                                                                                                                                             |
| `npx --yes pnpm@11.25.0 db:stop`                                                     | Stops local Supabase services. Use `colima stop` as well when the Colima VM is no longer needed.                                                                                                                                                     |

`db:reset` also removes all local users and test fixtures. After either reset path, rerun `db:types`, `db:bootstrap`, and the relevant integration checks. Keep the bootstrap password consistent between bootstrap and session API verification.

No hosted development or production Supabase project is provisioned by these commands.
