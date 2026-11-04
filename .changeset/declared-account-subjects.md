---
"@shivaedev/contract": minor
"@shivaedev/identity": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/contract`: Contracts accept a subject declaration that supplies request context through native RPC middleware and includes its typed refusals in the client's error channel.
- `@shivaedev/identity`: Identity provides `selfSubject`, `accountSubject` and a branded `Subject` service. Services can read the session user independently of the account being acted on; delegated accounts require the permission's `any` grant.
- `@shivaedev/server`: Session hosts resolve and authorize declared subjects before handlers run. Self commands take no account id; delegated requests select an account with the `x-platform-subject` transport header and receive the contract's typed refusal when unauthorized.

### Breaking

- `@shivaedev/contract`: Import the `OperationRpc` and `Tag` helper types from `@shivaedev/contract/operationRpc.ts` instead of `@shivaedev/contract/contract.ts`.
