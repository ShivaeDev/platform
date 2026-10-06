# Changelog

## Unreleased

### Changed

- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-changes`: `@shivaedev/effect-changes/channel.ts` (`Channel`, `ChannelOptions`, `makeChannel`), `@shivaedev/effect-changes/frame.ts` (`Frame`, `Outcome`), `@shivaedev/effect-changes/observe.ts` (`Observation`, `Observer`), `@shivaedev/effect-changes/publish.ts` (`Publish`, `PublishFailure`)

## 0.1.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.0 - 2026-09-26

### Added

- Add `makeChannel`: record changes inside a transaction and publish them once,
  deduplicated by key, only after the outermost frame for their owner commits.
  Nested frames merge on commit and are discarded on rollback; frames are kept
  per transaction owner.
- Wrap exit-reporting native transactions with `within`, Promise-committing
  drivers with `open` and `settle`, and non-transactional work with `batch`.
- Publish exactly when the database committed, including when the caller is
  interrupted while `COMMIT` is in flight.
- Log a sink failure after commit, whether a failed Effect, a defect or a
  synchronous throw, and keep the committed result by default;
  `onPublishFailure: "die"` raises a defect instead.
- Expose `channel.Sink` and `channel.Observer` as `Context.Reference`s: tests
  can swap the sink for a scope and observe every recorded, published and
  discarded change.
