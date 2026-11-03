---
"@shivaedev/email": minor
"@shivaedev/identity": minor
"@shivaedev/sql": minor
"@shivaedev/contract": minor
"@shivaedev/test-kits": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/email`: Move `inbox`, `emailLink` and `ReceivedEmail` from `@shivaedev/email/server/testing/adapters/inbox.ts` to `@shivaedev/test-kits/email/adapters/inbox.ts`. Add test-kits as a development dependency. Email no longer has a test-story peer dependency.
- `@shivaedev/identity`: Move `signedInUser`, `signInAgain`, `passwordUser` and `storedProviderAccounts` from `@shivaedev/identity/server/better-auth/testing.ts` to `@shivaedev/test-kits/identity/adapters/betterAuth.ts`. Move `testUserEmail` and `signedSessionToken` from `@shivaedev/identity/server/better-auth/adapters/testingCredentials.ts` to `@shivaedev/test-kits/identity/adapters/testingCredentials.ts`. Add test-kits as a development dependency.
- `@shivaedev/sql`: Move `withChangeCoverage`, `expectPublished`, `UnannouncedWrites`, `PublishedKeysMismatch` and `ChangeCoverage` from `@shivaedev/sql/testing.ts` to `@shivaedev/test-kits/sql/testing.ts`. Add test-kits as a development dependency.
- `@shivaedev/contract`: Move `watchHints`, `heard`, `layerMemoryProtocol` and `HintViewer` from `@shivaedev/contract/testing.ts` to `@shivaedev/test-kits/contract/testing.ts`. Add test-kits as a development dependency.

### Added

- `@shivaedev/test-kits`: Compose email inboxes, Better Auth session preconditions, PostgreSQL change assertions and native RPC subscription helpers in application story kits through domain-specific imports.

### Changed

- `@shivaedev/create-app`: Generated starters take test-kits as a development dependency and use its email and signed-in session helpers.
