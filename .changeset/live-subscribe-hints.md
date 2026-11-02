---
"@shivaedev/contract": minor
---

### Fixed

- `LiveServer.subscribe` preserves `SubscriptionHint` deliveries when no query runner is supplied, including an explicit `undefined`. Calls with a query runner keep `QueryUpdate` deliveries and retain the subscription's typed failures and service requirements.

### Breaking

- Calls to `LiveServer.subscribe` that explicitly supply its error and service type arguments and a query runner must also supply the runner type as the third type argument, or omit the type arguments and let TypeScript infer them.
