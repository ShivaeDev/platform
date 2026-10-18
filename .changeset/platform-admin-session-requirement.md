---
"@shivaedev/platform": minor
---

### Breaking

- `requireAdmin` now requires `SessionUser` and fails with `Forbidden` for non-admin users. Put RPC handlers behind `AuthenticatedUser`, and wrap HTTP handlers with `withSessionUser`, so authentication supplies the profile and rejects signed-out requests with `Unauthorized`.
