---
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Added

- Declare collection policies beside module contracts with `ModuleReadPolicies` and combine them with `mergeReadPolicies`. Unclaimed collections are denied. Each policy receives the request's optional viewer.
- The application host accepts a merged `readPolicy` and checks queries and live hints inside native session middleware, using its resolved identity without another session lookup. Policies can use application services and return `Forbidden` or `AuthUnavailable`.
- Query authorization and live-hint filtering check keys concurrently so native `Effect.request` resolvers can batch membership checks. Plain Effect policies remain supported.

### Breaking

- `authorizeReads` now takes `(effect, request, policy, viewer, denied)`, and policies take `(key, viewer)`. Pass `Option.some(resolvedIdentity)` or `Option.none()` before the denial effect. Existing unary policy functions may ignore the new viewer argument. Apps using `appHost` can replace custom read middleware with its `readPolicy` option and merge their modules' policy maps.
