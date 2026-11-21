---
"@shivaedev/identity": minor
---

### Added

- `SessionUser` carries `emailVerified`, whether the signed-in person has confirmed their email address. An operation reads it from the session lookup Platform already makes, so it learns the flag with no second session read, and a `defineSeed` run reads the seeded persona's stored flag. An account that has not confirmed reads `false`; the first lookup after the person follows the confirmation link reads `true`.

### Breaking

- `SessionUserSchema`, `SessionUserValue` and `UserSessionShape` require `emailVerified: boolean`. A custom session provider returns `emailVerified` in its `user`, and a test fixture that builds a `SessionUser` value or a provider's session user, such as `Effect.provideService(SessionUser, { email, emailVerified: true, id, name })`, adds the field; a provider's user without it fails to decode on the request. An application on Better Auth changes nothing, because Better Auth always supplies the field.
