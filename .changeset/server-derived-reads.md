---
"@shivaedev/contract": minor
---

### Added

- Queries can declare a `serverReads(payload, viewer)` Effect to load additional read keys on the server after every subscription policy allows access. Its services come from the owning query handler; failures use the query's declared rejections. Bound clients refresh from the resulting hints without receiving record IDs in their payloads.

### Breaking

- `queryKeys` moves from `serverMetadata.ts` to `queryKeys.ts` and now checks every referenced query's read policy before resolving payload and server-derived keys, and preserves their errors and service requirements. Change imports to `@shivaedev/contract/queryKeys.ts`. Custom adapters must provide those services, pass the server-resolved viewer, and handle declared rejections, `MissingReadPolicy` and `QueryReadDenied`; use `querySubscription` to capture handler services and ongoing authorization.
