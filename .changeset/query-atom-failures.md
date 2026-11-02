---
"@shivaedev/contract": minor
---

### Breaking

- Query atom failure types include client-middleware errors and the contract's change-subscription errors. Consumers with exhaustive error handlers must handle the additional subscription failures, including `MissingReadPolicy`, `WebSocketRequired`, and rejections declared by other queries in the contract. Explicit `BoundQuery` annotations can pass the subscription RPC as the third type parameter or be replaced with inference from the bound API. Direct `run` failure types stay specific to their RPC.
