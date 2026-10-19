# Changelog

## 0.7.0 - 2026-10-19

### Added

- `authorizeReads(effect, request, policy, denied)` and `ReadPolicy` in `readPolicy.ts` share a key authorization policy between query reads and live hints. `QueryReads` in `serverMetadata.ts` exposes the declared query read keys to server middleware.
- `changesRpc(name)` retains the literal contract name for typed native clients.

### Fixed

- effect-contract's `live` coordinator no longer reconciles its read scope when `paused` is read for the first time; a component that showed the pause state while connecting used to make every loaded query read again.
- Opening a Board page sends each read once. The page starts its reads after the live connection's first update, which used to read navigation and watcher state a second time, and a failed connection does not hold the page.
- A file event that changes neither the bytes nor the modification time no longer refreshes open Board pages. A file saved with the same bytes and a new modification time still refreshes them.
- Live streams filter changed keys with the viewer's read policy and suppress empty hints, while preserving independently allowed list hints.

## 0.6.0 - 2026-10-18

### Added

- Contracts attach command invalidation metadata and a host-served change subscription. `serverMetadata.ts` exports `CommandInvalidation` and `changesRpc(name)` for server adapters.
- Bindings expose the `LiveConnection` symbol from `automaticLive.ts`; React session boundaries mount its `connection` atom and track the binding's query keys. `LiveBound` describes its connection and status atoms; `automaticLive(service, name)` and `ChangesClient` expose the underlying tracked coordination. `live` also accepts a function for `resyncKeys`.

### Fixed

- Live server hints contain only changed keys intersecting the subscription, so one item's change does not refetch unrelated item queries.

### Breaking

- Contracts reserve the `<contract>.$changes` RPC name for automatic subscriptions. Use Platform's database host and NDJSON transport for automatic live queries, and remove application subscription handlers and `live()` mounting when using a React session boundary.

## 0.5.1 - 2026-10-17

### Fixed

- Publish against `@shivaedev/types` 0.2.1 so framework consumers share the current version.

## 0.5.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`.

## 0.4.1 - 2026-10-12

### Added

- `makeLiveServer` in `makeLiveServer.ts` converts local Reactivity invalidations into native `LiveHint` streams for explicit read keys. Independent helpers keep their resync scopes separate. Each subscription starts with `Resync`; `resync` reconciles every active stream, including after a PostgreSQL listener loses its connection.
- Declare typed streaming operations with Schema payloads and elements, rejections and read keys in native RPC contracts. Bound `run` returns a native Stream, with HTTP tests proving element delivery, declared failures and server subscription release on completion or client interruption.

### Changed

- Prefix generic type parameter names in contract, operation and collection declarations with `T` while preserving their types and runtime behavior.
- Document the package's purpose, native RPC and freshness model, complete usage, design priorities and roadmap; publish `docs/` with the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.4.0 - 2026-10-05

### Added

- Optional `live.ts` invalidation over native Streams, Reactivity and AtomRpc runtimes: precise changed keys, explicit full-scope reconciliation after initial/reconnected delivery, bounded paused observations, resume, typed stream failures and scoped teardown. Native query atoms own retained data and stale-request interruption.
- `Key` and `LiveHint` Schemas for existing list/item keys and Changed/Resync hints. A real streaming HTTP/browser fixture demonstrates their composition with native newline-delimited RPC serialization.
- Browser-safe `resume.ts` owns the existing native/browser resume signal without React peers; effect-react delegates its existing entry to it.

### Changed

- `bind` accepts a native client group with additional RPC operations while preserving the declared contract's types and rejecting clients missing its operations.

## 0.3.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-contract`: `@shivaedev/effect-contract/bind.ts` (`Bound`, `BoundCommand`, `BoundQuery`, `bind`, `Failure`, `QueryOptions`, `RunFailure`), `@shivaedev/effect-contract/contract.ts` (`Contract`, `contract`, `Declared`, `OperationRpc`, `Tag`), `@shivaedev/effect-contract/keys.ts` (`Collection`, `collection`, `Identity`, `ItemKey`, `invalidationKeys`, `Key`, `ListKey`, `readKeys`), `@shivaedev/effect-contract/operation.ts` (`Command`, `CommandShape`, `command`, `OperationShape`, `PayloadSchema`, `Query`, `QueryShape`, `query`), `@shivaedev/effect-contract/rejection.ts` (`FieldRejection`, `fieldRejection`, `MatchingTags`, `Reject`, `RejectedBy`, `RejectionClass`, `RejectionSpecs`, `Rejections`, `RejectionUnion`, `RejectionValue`, `TaggedRejection`)

## 0.2.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

## 0.2.0 - 2026-10-04

### Changed

- Consolidate duplicate test cases around observable package behavior.
- The function members of `Contract`, `Query` and `Command` are declared as properties, so TypeScript checks their parameters strictly. `QueryShape.reads` and `CommandShape.invalidates` stay bivariant, so a contract still takes operations with typed payloads; the package now depends on `@shivaedev/types` for `Bivariant`.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.0 - 2026-09-26

### Added

- Declare queries and commands with typed rejections and reactivity keys; group
  them into a native `RpcGroup` with namespaced tags.
- Bind a contract to a native `AtomRpc` service: query atoms register declared
  read keys; command runs invalidate declared keys after success.
