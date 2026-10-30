---
"@shivaedev/identity": minor
---

### Added

- Pass a provider-account lookup to a Better Auth mount's `admittedSessions(getSession, getProviderAccounts)` to read linked provider IDs through `SessionUserWithProviderAccounts` while enforcing admission and session revocation. Omitting the lookup preserves the base session shape.
