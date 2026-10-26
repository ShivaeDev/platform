---
"@shivaedev/platform": minor
---

### Breaking

- Remove `authTestUtils` from `@shivaedev/platform/server/better-auth/testing.ts`. Import `testUtils` from `better-auth/plugins` and call it with the same options instead. Keep importing `signedInUser` and `storedProviderAccounts` from Platform.

### Changed

- Require Better Auth 1.7.11, whose plugin types support `testUtils()` with `exactOptionalPropertyTypes` without a wrapper.
