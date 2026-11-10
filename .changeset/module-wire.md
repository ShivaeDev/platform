---
"@shivaedev/contract": minor
---

### Added

- `defineModule` takes an optional `wire`: per operation a success schema and rejection classes, written by a generate step from `run`'s types. Each operation without its own `success` or `rejections` is served with its wire entry, so the server encodes with the schemas the browser decodes with. The compiler compares the wire with `run` and reports a stale one on the module's `name` line, one problem per operation: `WireSuccessStale`, `WireRejectionsStale`, and `OperationMissingFromWire` for an operation that declares no success, returns something and has no entry.
- `clientContract({ name, wire, payloads?, queries?, commands?, middleware?, subject?, keyScope? })` from `@shivaedev/contract/clientContract.ts` builds the browser's contract of a module from its wire, payloads, `reads` and `invalidates`, with no `run` or read policy, for generated files. `ClientMatchesModule<Client, Module>` from `@shivaedev/contract/clientMatchesModule.ts` asserts that its RPCs equal the server module's and otherwise fails with `ClientDiffersFromModule`, naming the operations and `pnpm generate`.
- The check that a declared success equals what `run` returns also covers a `Schema.Class` held in an array, struct field, tuple, record, union or `Option`: a plain object in that position is `SuccessClassNotReturned`.

### Breaking

- `QueryShape["readPolicy"]` is optional, as it already was at run time, because the browser's contract of a module has no read policy; `contract()` still requires one on every query. Code that calls the policy of an erased `QueryShape` checks for `undefined` first.
