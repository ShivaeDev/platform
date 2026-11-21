---
"@shivaedev/build": minor
"@shivaedev/contract": minor
---

### Breaking

- `@shivaedev/contract`: a browser contract built by `clientContract` carries no keys. Its definition names the module's queries and commands as lists, `queries: ["list"]` and `commands: ["create"]`, in place of records holding each query's `reads` and `readsCollections` and each command's `invalidates`, so `ClientContractDefinition`'s `queries` and `commands` are now `readonly string[]`. The host serves the module, whose keys decide which open queries a change reaches, and the browser's queries refresh from the server's announcements. An application runs `pnpm generate` and deletes nothing by hand; only a hand-written `clientContract` call changes, by replacing each record with the list of its keys.
- `@shivaedev/build`: the generated browser contract no longer copies a query's `reads` or `readsCollections` or a command's `invalidates`, and `OperationFacts` drops its `reads`, `readsCollections` and `invalidates` fields. A changed `reads` or `invalidates` leaves the generated file as it is, and `generate` reports it `current`.

### Added

- `@shivaedev/build`: a key may be declared in the operation's own file, beside the operation that reads or invalidates it. The generator refused such a value before, because it copied keys into the generated file.
