# Fieldbook employee mobile app

Expo + React Native Android employee app using hosted Supabase email/password Auth. The Next.js `/api/v1/session` response is authoritative for active profile state, display name, email, roles, and permissions. Mobile never requires `admin.access`, calls administration APIs, or connects directly to the database with a service-role credential.

## Local configuration

Copy `.env.example` to `.env.local` and provide only public values:

- `EXPO_PUBLIC_SUPABASE_URL`: hosted Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: hosted publishable key, not a service-role or secret key.
- `EXPO_PUBLIC_API_URL`: Next.js API origin. Use `http://10.0.2.2:3000` from the standard Android emulator when Next runs on the development host. For a physical device or production build, replace this with the reachable development host or deployed HTTPS API origin. If omitted, development defaults to `http://localhost:3000` for non-emulator environments.

Do not copy web server secrets, database URLs, administrator passwords, or service-role keys into mobile configuration. Do not commit `.env.local`.

## Session and verification behavior

Supabase owns all session persistence and refresh through its async storage adapter. It stores only Supabase session JSON in encrypted `expo-secure-store`, using two banks and versioned manifests. Chunk sizes are capped at 1,800 UTF-8 bytes, storage operations for a session key are serialized, and every deletion settles before the next queued operation. Missing/invalid manifests clear both banks, and orphaned chunks are scrubbed rather than trusted. Failed previous-bank cleanup writes a durable cleanup-pending marker that can be retried without erasing the newly committed bank. Independent of that marker, a separate `secure-cleanup-required` intent is persisted before logout. It survives process/provider restarts and prevents any restore or new credential write until protected-session cleanup and explicit marker finalization both succeed. Marker creation and marker-deletion failures fail closed in `cleanupFailed`, not as successful sign-out. Passwords, refresh tokens, and session JSON are not exposed to log output.

Sign-in and restore both require a successful live session API response. Returning to the foreground and Supabase token refresh trigger another live check only for an authenticated session; there is no polling timer or passwordless restoration from a failed cleanup. Only Supabase's own session JSON is persisted in SecureStore; roles and profile details shown to the employee are separately revalidated from the live API rather than trusted from a cache. Passwords are not persisted or logged, and token/provider error details are not exposed to users. Retryable Supabase refresh, network, and protected-storage failures preserve the session and show explicit warning/retry states rather than deleting recoverable sign-in data. Network, parsing, and response-contract failures are explicitly not offline authentication. Previously verified profile text may remain visible with an error after a later verification failure, but no offline operations are offered.

Sign-out uses `supabase.auth.signOut({ scope: 'local' })`. It targets this device only and does not claim to revoke other sessions. While this call runs under the owning cleanup operation, only reads made during the scoped Auth operation may load the saved session; ordinary reads and all writes remain blocked. The read authority dies on return without removing the durable cleanup marker. Even if writing that intent fails, the app still attempts the Auth-local cleanup paths; storage-clearing failure never becomes secure successful sign-out. Explicit user sign-out and rejected-profile cleanup are allowed only while the originating generation still owns the operation; pending Supabase `SIGNED_OUT` events do not expose login early or let an obsolete cleanup erase a newer account. If protected cleanup fails, the persisted cleanup-required intent leaves the app in `cleanupFailed`, blocks automatic foreground/token validation and fresh sign-in, and persists across provider/app restarts. Only a fully completed protected cleanup permits explicit logout-marker finalization and fresh authentication. It does not falsely report secure successful sign-out or revive the old identity automatically.

## Native runtime verification boundary

Hosted transport and storage behavior is verified: all seven workspace typechecks, web production build, and mobile authentication/storage tests pass. A real hosted employee with an active profile was authenticated through Supabase and the Next.js session API, returning zero roles and zero permissions. The fixture was deleted afterward with audit history preserved, and its local test-credentials file was removed.

No working Android or iOS UI is currently claimed. Android emulator preflight required approximately 7.4 GB of userdata space and the usable host disk was smaller. The owner explicitly deferred Android simulator verification and suggested trying the existing iPhone 17 Simulator. That existing simulator was available, but native CocoaPods setup failed with `ENOSPC` during dependency copying/downloading. Build staging, the fresh Android AVD/data partition, and temporary installer data from this session were removed; no existing simulator application or client records were modified. No EAS/cloud build, production signing, or native screenshot was produced.

When next performing Android runtime acceptance, allow enough disk for a fresh system image and debug artifacts. The original preflight required approximately 7.4 GB before userdata creation, and the available 4.8 GB was insufficient. A new image will need to be installed when that space is available. Configure only public Auth values with `npx --yes pnpm@11.25.0 mobile:env`, run Next locally on port 3000, and use the local build command in the package manifest if desired; no cloud service is required.

For an existing iOS simulator, set `EXPO_PUBLIC_API_URL=http://localhost:3000` for that run and keep the standard Android emulator API URL unchanged elsewhere. Xcode and CocoaPods are present on this workstation, but a reliable local build additionally needs enough free space for the native artifacts. There was no acceptance proof after the failed preflight, so no UI assertion is inferred from the implementation.

Expected device checks when runtime is possible: failed/successful sign-in, accurate identity and roles, secure restoration and token refresh, foreground role changes, inactive/missing profiles, no-role employees, explicit refresh, local sign-out, and complete cleanup after corrupt SecureStore chunks or expired/revoked credentials.

Operational farm records, business workflows, drafts, full offline support, production API hosting, production signing, and admin-management UI are outside this slice.
