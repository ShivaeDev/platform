---
"@shivaedev/contract": minor
---

### Added

- `defineModule` takes an optional `wire`: per operation a success schema and rejection classes, for a generator to write from `run`'s types (until it ships, written by hand). An operation with a wire entry is served with that entry's success and rejections, plus `InternalServerError` and `ServiceUnavailable`, even when it declares its own, so the server encodes with the schemas the browser decodes with; an operation without an entry is served with what it declares. The compiler compares the wire with `run` and reports a stale one on the module's `name` line, one problem per operation: `WireSuccessStale`, `WireRejectionsStale`, and `OperationMissingFromWire` for an operation that declares no success, returns something and has no entry.
- `clientContract({ name, wire, payloads?, queries?, commands?, middleware?, subject?, keyScope? })` from `@shivaedev/contract/clientContract.ts` builds the browser's contract of a module from its wire, payloads, `reads` and `invalidates`, with no `run` or read policy, for generated files; every query and command it declares needs a wire entry. `ClientMatchesModule<Client, Module>` from `@shivaedev/contract/clientMatchesModule.ts` asserts that its RPCs equal the server module's and otherwise fails with `ClientDiffersFromModule`, naming the operations and `pnpm generate`.
- The check that a declared success equals what `run` returns also covers a `Schema.Class` held in an array, struct field, tuple, record, union or `Option`: a plain object in that position is `SuccessClassNotReturned`.

### Breaking

- `QueryShape["readPolicy"]` is optional, as it already was at run time, because the browser's contract of a module has no read policy; `contract()` still requires one on every query. Code that calls the policy of an erased `QueryShape` checks for `undefined` first.
- `contract()` requires a read policy on every query in its type, so an array typed `readonly QueryShape[]` passed as `queries` no longer compiles. Type the array with the queries' own type instead, for example `const queries: readonly (typeof Get)[] = [Get, Get];`, or pass the queries inline.
- `SuccessDiffersFromRun`, `SuccessClassNotReturned` and `ArrayMutabilityDiffers` moved from `@shivaedev/contract/runProof.ts` to `@shivaedev/contract/successProof.ts`; import them from the new path.
