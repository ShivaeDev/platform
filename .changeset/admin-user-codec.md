---
"@shivaedev/admin": minor
---

### Breaking

- `AppUser` now decodes PostgreSQL `Date` timestamps into UTC `DateTime` values. Direct Schema callers must pass a `Date` for `createdAt`; use `Schema.toCodecJson(AppUser)` when decoding or encoding JSON timestamps. Native RPC keeps ISO strings on the wire and UTC `DateTime` values for callers.

### Changed

- User reads validate rows with `SqlSchema` using the shared `AppUser` fields. User operation spans are named `Admin.listUsers` and `Admin.changeUserRole`; adjust trace filters that used the `Platform` names.
