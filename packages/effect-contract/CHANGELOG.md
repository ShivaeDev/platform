# Changelog

## Unreleased

### Changed

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
