---
"@shivaedev/contract": minor
---

### Breaking

- `makeLiveServer.subscribe` now has `QueryReadDenied` in its stream error channel. Custom RPC streams using it must include `QueryReadDenied` in their error schema and handle the failure. Contract-generated change streams already declare this error.

### Fixed

- A denied per-hint query policy recheck ends the live subscription with `QueryReadDenied` instead of dropping the hint. Automatic bound queries rerun through their authorized read so an open screen can render the denial from its query result.
