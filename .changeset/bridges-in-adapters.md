---
"@shivaedev/identity": minor
"@shivaedev/test-kits": minor
"@shivaedev/test-story": minor
---

### Breaking

- `@shivaedev/identity`: Move `@shivaedev/identity/server/better-auth/signInGate.ts` to `@shivaedev/identity/server/better-auth/adapters/signInGate.ts`, `@shivaedev/identity/server/better-auth/revokeUnadmitted.ts` to `@shivaedev/identity/server/better-auth/adapters/revokeUnadmitted.ts` and `@shivaedev/identity/server/better-auth/admittedSessions.ts` to `@shivaedev/identity/server/better-auth/adapters/admittedSessions.ts`; update imports to the new paths.
- `@shivaedev/test-kits`: Move `testingOperation` from `@shivaedev/test-kits/jobs/testingOperation.ts` to `@shivaedev/test-kits/jobs/adapters/testingOperation.ts`, and `testingInspection` from the same module to `@shivaedev/test-kits/jobs/testingInspection.ts`; update imports to the new paths.
- `@shivaedev/test-story`: Move `@shivaedev/test-story/server/domNavigate.ts` to `@shivaedev/test-story/server/adapters/domNavigate.ts`, `@shivaedev/test-story/server/seed.ts` to `@shivaedev/test-story/server/adapters/seed.ts` and `@shivaedev/test-story/server/start.ts` to `@shivaedev/test-story/server/adapters/start.ts`; update imports to the new paths.

### Changed

- `@shivaedev/identity`: The `authTestDatabase` readouts `roleColumn`, `sessionIpAddresses`, `sessions`, `userRoles` and `users` decode their rows and fail with `SchemaError` when a row does not match.
