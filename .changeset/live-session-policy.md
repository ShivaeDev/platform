---
"@shivaedev/contract": minor
"@shivaedev/identity": minor
"@shivaedev/server": minor
---

### Breaking

- Contract change streams emit `QueryReadDenied` as a delivery when an established subscription loses read access, keeping the subscription open so a later hint can resume delivery after access returns. Custom consumers must handle this delivery alongside `Changed`, `Resync` and `Result`; use `SubscriptionHint` for hint consumers. Initial subscription refusals remain typed stream failures. Bound query atoms display the denial and recover on a later authorized hint.

### Added

- Identity exposes `currentSessionContext` to recheck an authenticated stream's session and refresh its existing `SessionUser` and `SessionUserWithProviderAccounts` services.
- Query subscriptions accept an optional `refresh` Effect supplying the context for each policy check and query rerun.

### Fixed

- Session-backed application hosts evaluate each live hint's read policy and pushed query against the current session, including changed roles and grants. Signing out, revocation and expiry still end subscriptions with `Unauthorized`.
