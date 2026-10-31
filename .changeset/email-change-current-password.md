---
"@shivaedev/identity": minor
---

### Breaking

- Better Auth mounts require the account's current password for `/change-email`, including signed bearer sessions. Send `password` alongside `newEmail` in the HTTP JSON body; Better Auth's typed `changeEmail` method does not declare this extra field. Passwordless accounts cannot change email under this default. Applications with another account-verification policy can explicitly opt out with `betterAuthMount(options, { hardening: { requirePasswordForEmailChange: false } })`.
- Better Auth mounts revoke existing sessions after a password reset by default. Applications that intentionally retain sessions must set `emailAndPassword.revokeSessionsOnPasswordReset: false` in their Better Auth options.
