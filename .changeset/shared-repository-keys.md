---
"@shivaedev/changes": minor
"@shivaedev/contract": minor
"@shivaedev/identity": minor
"@shivaedev/react": patch
"@shivaedev/server": patch
"@shivaedev/sql": patch
---

### Fixed

- `@shivaedev/sql`: Repository writes from workers refresh matching session-scoped queries over the application's change channel. Every subscriber rechecks its own read policy before receiving hints or results, including rerun-and-compare queries. Client caches retain their registry isolation.

- `@shivaedev/server`: Authenticated hosts subscribe to plain repository keys and publish unscoped command dependencies.
- `@shivaedev/react`: Mounted session queries refresh after worker writes, and a denied recheck reaches the query as `QueryReadDenied`.

### Breaking

- `@shivaedev/changes`: `@shivaedev/changes/keys.ts` no longer accepts a context argument in `readKeys`, `invalidationKeys` or `collectionInvalidationKeys`. Remove account prefixes and context arguments from server registrations and publications; use plain model record and bucket keys. For custom client cache coordination, import `KeyContext`, `clientReadKeys` and `clientInvalidationKeys` from `@shivaedev/contract/clientKeys.ts` instead. `bind` and `makeClient` handle this automatically.
- `@shivaedev/contract`: `makeLiveServer.stream` and `LiveServer.stream` accept keys only. Their `subscribe` methods now take `(subscription, authorizedRunner?)`; remove the former context argument. `QuerySubscription.globalKeys` is removed because all server keys share the repository namespace; remove it from custom subscription objects.
- `@shivaedev/identity`: `sessionKeyContext` and the `@shivaedev/identity/server/sessionKeys.ts` module are removed. Import `resolveChanges` from `@shivaedev/identity/server/resolveChanges.ts` instead. `resolveChanges` now returns the authorized subscription directly, instead of `{ subscription, context }`; pass that result to `subscribe`. Keep request-local identity for read policy and data filtering. Session-scoped queries declare ordinary reads without additional session keys, and shared keys may trigger policy checks for several accounts.
