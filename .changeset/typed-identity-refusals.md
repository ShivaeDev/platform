---
"@shivaedev/identity": minor
---

### Added

- Declare identity's refusal wire codes once and map policy denial to `SIGN_IN_REFUSED` and policy or account-role-seed failure to `AUTH_UNAVAILABLE` in `authCall`.
- Accept application code literals as `authCall`'s second argument, preserving database-hook and email-delivery codes in its closed failure union. `AuthFailure.withCodes` supplies a native schema for the extended union.

### Fixed

- Return application email-delivery refusals from mounted HTTP requests even when Better Auth catches the delivery error internally.

### Breaking

- Exhaustive `AuthFailureCode` mappings must add `SIGN_IN_REFUSED` and `AUTH_UNAVAILABLE`. Handle declared application codes in the extended union returned by calls that pass application code literals.
