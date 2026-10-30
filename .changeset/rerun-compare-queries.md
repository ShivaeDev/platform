---
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Added

- Queries can opt into `live: "rerun-and-compare"`. Hosted subscriptions rerun the authorized query as the subscribed viewer, hash its JSON-schema-encoded result with SHA-256, and push a typed `Result` only when it changes. Bound queries consume those results without a client refetch. Other queries keep hint-and-refetch delivery.
- Rerun subscriptions end with `QueryReadDenied` when access is denied. The host registers change listeners before its initial result read, and reconciliation reruns the query through the same read policy.
