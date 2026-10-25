---
"@shivaedev/platform": minor
---

### Added

- Resolve session-scoped contract subscriptions and command invalidations from request-local `Identity.id`, isolating accounts while notifying other sessions of the same account. Authenticated identity, profile, provider-account and role middleware preserve commit-bound publication and key deduplication.

### Breaking

- Hosted contracts must supply application handlers with `Api.application.toLayer(...)` and leave `$changes` to `appHost`. Custom `$changes` handlers must accept generated query references, call `resolveChanges(rpc, queries)` from `@shivaedev/platform/server/rpc-server/sessionKeys.ts` inside the authenticated stream invocation, and pass both `keys` and `context` to `changes.stream`. Do not accept client-supplied physical keys or scope, or resolve identity while constructing a shared Layer.
- Tracing publishes only unscoped command invalidations. Custom authentication middleware for session-scoped contracts must wrap the invocation with `sessionCommandChanges(effect, rpc, payload)` from `@shivaedev/platform/server/commandChanges.ts` inside its request-local `Identity` provider. Platform's authenticated identity, profile and role middleware do this automatically. Explicit transaction invalidations must use `invalidationKeys(keys, { scope: identity.id })` to share the same scope and deduplication.
