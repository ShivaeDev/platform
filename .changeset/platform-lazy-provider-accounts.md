---
"@shivaedev/platform": minor
---

### Breaking

- Provider accounts load when a handler asks for them. Replace `SessionUser.providerAccounts` array reads with `yield* (yield* SessionUserWithProviderAccounts).providerAccounts`, declare `AuthenticatedUserWithProviderAccounts` on the RPC, and install `authenticatedUserWithProviderAccountsLayer(sessions)`. Add `AuthUnavailable` and `Unauthorized` to the RPC's error schema because account lookup failures now fail the reading handler. Base `SessionUserValue` no longer has `providerAccounts`.
- A custom session provider supplies `user.providerAccounts` as `Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>`, described by the new `ProviderAccountsSessionShape`, instead of an array. The request boundary memoizes this Effect and projects its results to provider and account IDs. `betterAuthSessions(getSession, getProviderAccounts)` supplies this shape; without a lookup its session user has no accounts field. `SessionUserWithProviderAccountsValue` describes the accounts-capable handler profile. Identity-only requests do not call the lookup, and repeated reads share one lookup per request.
