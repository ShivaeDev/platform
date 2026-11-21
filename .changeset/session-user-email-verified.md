---
"@shivaedev/identity": minor
---

### Added

- `SessionUser` carries `emailVerified`, whether the signed-in person has confirmed their email address. An operation reads it from the session lookup Platform already makes, so it learns the flag with no second session read, and a `defineSeed` run reads the seeded persona's stored flag. An account that has not confirmed reads `false`; the first lookup after the person follows the confirmation link reads `true`.

### Breaking

- `SessionUserSchema`, `SessionUserValue` and `UserSessionShape` require `emailVerified: boolean`. A custom session provider adds `emailVerified` to the `user` it returns, and a test fixture that builds a `SessionUser` value or a provider's session user adds the field too, such as `Effect.provideService(SessionUser, { email, emailVerified: true, id, name })`. A provider without it still compiles, because `SessionPolicy.provider` requires only `user.id`: every operation behind `AuthenticatedUser`, `AuthenticatedUserWithProviderAccounts`, permission middleware, a subject resolver or `mcpRoutes` then fails as a defect when it reads the session user, while the person stays signed in. Operations behind `Authenticated` alone keep working. An application on Better Auth changes nothing, because Better Auth always supplies the field.
