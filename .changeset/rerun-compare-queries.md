---
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Added

- Queries can opt into `live: "rerun-and-compare"`. Hosted subscriptions rerun the authorized query as the subscribed viewer, hash its JSON-schema-encoded result with SHA-256, and push a typed `Result` only when it changes. Bound queries consume those results without a client refetch. Other queries keep hint-and-refetch delivery.
- Rerun subscriptions end with `QueryReadDenied` when access is denied. The host registers change listeners before its initial result read, and reconciliation reruns the query through the same read policy.

### Breaking

- `@shivaedev/contract`'s `ChangesClient` transport helper now covers result messages and erases query-specific stream failures. Consumers using that helper to read changes must use their contract's native AtomRpc client type instead; derive message and failure types with `Rpc.SuccessChunk` and `Rpc.ErrorExit` of the contract's `$changes` RPC. Contract-derived bound query types remain specific to their query.
