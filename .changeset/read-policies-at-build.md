---
"@shivaedev/contract": minor
"@shivaedev/server": minor
"@shivaedev/admin": minor
"@shivaedev/work-board": minor
---

### Breaking

- Every contract query requires a `readPolicy`, including plain RPC reads. Add `readPolicy: signedIn` for any signed-in viewer, an explicit `() => Effect.succeed(true)` for public reads, or an application policy for restricted reads. Plain calls without a policy now fail closed with `MissingReadPolicy` even on native servers that bypass startup validation.
- The application server Layer fails with typed `MissingReadPolicies` before listening when untyped queries omit policies. Handle this boot error if your application narrows startup failures; its `queries` field lists every affected RPC. Query atom error types now follow their native RPC errors without an extra client-side `MissingReadPolicy` branch. Custom `ChangesQueries` annotations must now include their query definitions in `queries` alongside `resolve`.

### Added

- Contract exports the `signedIn` read policy and `validateReadPolicies(group)` for native hosts to validate their RPC group during Layer construction.

### Fixed

- Admin's built-in Users and Jobs queries and Work Board's daemon diagnostics queries explicitly declare read policies; existing permission and loopback boundaries continue to own access.
