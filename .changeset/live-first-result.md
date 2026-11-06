---
"@shivaedev/contract": minor
"@shivaedev/admin": minor
"@shivaedev/identity": minor
"@shivaedev/react": patch
"@shivaedev/server": minor
"@shivaedev/test-kits": minor
---

### Changed

- `@shivaedev/contract`: Live query subscriptions deliver their first authorized result after registering read keys, removing the separate initial query request for bound queries and route loaders. Later updates retain hint-then-read or the query's chosen rerun-and-compare behavior.
- `@shivaedev/react`: Live screens and route loaders consume the subscription's first result without a separate query request.
- `@shivaedev/server`: Hosted live subscriptions run all initial queries through the existing authorized runner after registration.
- `@shivaedev/test-kits`: Contract story listeners accept initial results alongside change hints.

### Breaking

- `@shivaedev/contract`: Every contract's `$changes` success type includes typed `Result` values. Custom stream consumers must handle results as well as hints; custom subscription hosts pass their authorized query runner to `subscribe(subscription, read)` to deliver the initial value.

- `@shivaedev/test-kits`: `HintViewer.hints` contains `QueryUpdate` values, including results. Custom readout renderers must handle `Result` and `Unchanged` alongside hints.

- `@shivaedev/contract`: Direct `automaticLive().query` callers now supply a result decoder, comparison flag and reactive source factory. Direct `queryDelivery` callers supply the decoder and comparison flag, and `automaticQuery` callers pass the delivery's `version` as `resultVersion` and `updates` as `subscriptionVersion`. Use `bind` or `makeClient` to obtain this wiring automatically.

- `@shivaedev/server`: Native hosts building `hostChanges(group)` now provide the group's ordinary RPC handler services with `Layer.provideMerge(handlers)`. `appHost` supplies them automatically.
- `@shivaedev/admin`: Generated page subscriptions return their initial authorized query value. Raw subscription consumers handle `Result` instead of waiting for an initial `Resync`.
- `@shivaedev/identity`: Generated query subscriptions return their initial authorized value. Raw subscription consumers handle `Result`; session revocation still ends established subscriptions.
