---
"@shivaedev/identity": minor
"@shivaedev/contract": patch
---

### Added

- `@shivaedev/identity`: store account timezone, locale and units through authenticated preference contracts. Browser sign-in capture preserves subsequent edits.
- `@shivaedev/identity`: provide an account clock with a configurable local day start and DST-aware logical days and half-open day ranges.

### Fixed

- `@shivaedev/contract`: emit portable declarations for exported contracts with declared subjects.

### Breaking

- `@shivaedev/identity`: import `AccountDayStart` and `LogicalDay` from `@shivaedev/identity/server/account-clock/settings.ts`. `server/AccountClock.ts` exports the service only.
