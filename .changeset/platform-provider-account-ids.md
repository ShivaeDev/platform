---
"@shivaedev/platform": minor
---

### Added

- Opt in to provider account IDs on `SessionUser.providerAccounts` by passing a `GetProviderAccounts` lookup to `betterAuthSessions`. Export `ProviderAccountValue` (`providerId`, `accountId`) and `SessionWithProviderAccounts` for typed access without querying Better Auth’s account table.
