---
"@shivaedev/identity": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/identity`: `userProfiles` takes a `UserProfileStorage` port instead of a Better Auth instance. Replace `userProfiles(mounted.auth, ids)` with `userProfiles(mounted.profiles, ids)`, or supply an Effect-based `findByIds` implementation. Its import path and profile result shape stay the same.
- `@shivaedev/identity`: `betterAuthMount` now waits for the auth context and its schema check during scoped acquisition, failing with `AuthUnavailable` and logging the redacted provider cause when either fails. Apply auth migrations before building the mount Layer, handle this typed startup failure, and remove application readiness wrappers.

### Fixed

- `@shivaedev/create-app`: Generated apps rely on identity's scoped auth mount for startup readiness, including admin creation and session fixtures, without an application-owned readiness adapter.
