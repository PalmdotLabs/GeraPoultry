# Authentication email setup and acceptance

The server callback supports PKCE `code` exchanges and `token_hash` verification for `invite` and `recovery` only. Invitation emails sent by the server administration client do not establish a browser PKCE verifier. Configure email templates explicitly; a default link that returns tokens in the URL fragment cannot be consumed by a server route.

## Hosted configuration required

In Supabase Auth URL configuration, set Site URL to the canonical application origin and allow its `/auth/callback` destination. Use HTTPS for production. Keep public signup disabled. Do not use localhost in production templates.

Use the following link destinations in the **Invite user** and **Reset password** templates respectively. These use the configured Site URL, so update it for each environment:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/reset-password
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

Template changes have not been applied to hosted configuration by this audit. Existing PKCE recovery links continue to work in the requesting browser. Record template configuration evidence without recording a token, password or full recovery URL.

## Acceptance checklist

- [ ] Check Site URL, redirect allow-list, signup setting, email delivery provider and both templates in the development project.
- [ ] Invite a designated test account, open the delivered link in a fresh browser, set a password and sign in. Verify the profile has no roles until assigned.
- [ ] Request recovery, open the link, set a password, and verify the old password fails and the new one works.
- [ ] Verify expired/replayed links show a useful error and do not establish a new session.
- [ ] Verify an external `next` URL cannot redirect away from the app.
- [ ] Repeat relevant permission and deactivation cases after access changes.

Code regression tests cover verification dispatch, malformed/ambiguous parameters and rejected verification. They do not prove hosted template settings or email delivery.

Reference: [Supabase authentication email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
