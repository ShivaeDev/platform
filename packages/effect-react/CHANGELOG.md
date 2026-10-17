# Changelog

## 0.4.1 - 2026-10-17

### Fixed

- Align the published contract dependency with the current framework release.

## 0.4.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/atom-react` 4.0.4 alongside it, and Vitest 5 for the test helpers.

## 0.3.0 - 2026-10-13

### Added

- `useEditor` and `useCreate` accept opt-in `persistedDraft` settings with application keys, storage and bounds. They inherit `SessionBoundary` ownership, which drops tracked drafts when the session changes or ends, including drafts from unmounted screens.

### Changed

- Include `@shivaedev/effect-form` as a workspace dependency for shared draft ownership at the session boundary.

### Fixed

- Reconcile `SessionBoundary` draft ownership when a session replacement commits. A suspended, canceled transition preserves the visible session's draft and future persistence; committed replacements also clear old drafts while Activity is hidden.

## 0.2.2 - 2026-10-12

### Added

- Publish `@shivaedev/effect-react/testing.ts` with `render`, `Rendered`, `eventually` and `expectNoReactWarnings` for happy-dom render tests using native atom registries and test RPC layers. `render` exposes its registry, supports rerendering and releases its root, registry and container on unmount. React DOM and Vitest are optional peers needed by the testing entry.
- Add opt-in `useQuery(atom, { keepPreviousData: true })` to retain the last successful value while a changed query payload loads or fails. Query identity changes still reset displayed data by default, and registry changes clear it even with retention enabled. Native results, typed failures and interruption remain visible.
- `@shivaedev/effect-react/router.ts` exports `loadQuery(registry, atom, loaderContext)` for TanStack Router loaders. It reads contract query atoms in the application's shared registry, throws typed failures as their original tagged errors, and releases an aborted loader's subscription. TanStack Router is an optional peer.

### Changed

- Document the package's purpose, native atom mental model, query/action usage, session ownership and editor/create workflows; publish the north star and package roadmap with the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.
- The reference PostgreSQL order handlers use the shared server live helper and support composing PostgreSQL change delivery. The reference fixture proves commits from two HTTP server processes and a pg-boss worker, rollback silence, and live resync after listener loss.

### Fixed

- Keep the last successful query value during same-identity refreshes, including live invalidation, and after failed refreshes even when the native result has no retained success. `refreshing` reports pending work alongside displayed data.

## 0.2.1 - 2026-10-05

### Changed

- Delegate the existing `resume-signal.ts` entry to the shared browser-safe implementation in effect-contract. Install that package as a runtime dependency so existing imports keep working; signal types and behavior remain compatible. Work Board can import the shared native implementation without React peers.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-react`: `@shivaedev/effect-react/result-state.ts` (`ActionState`, `QueryState`, `ResultState`, `isUnauthorized`, `useAction`, `useQuery`), `@shivaedev/effect-react/resume-signal.ts` (`ResumeOptions`, `ResumeSource`, `ResumeWindow`, `resumeSignal`), `@shivaedev/effect-react/session-boundary.ts` (`SessionBoundaryProps`, `SessionBoundary`, `useSessionRecheck`)
  - `@shivaedev/effect-react/form`: `@shivaedev/effect-react/create.ts` (`Create`, `CreateConfig`, `useCreate`), `@shivaedev/effect-react/editor.ts` (`Editor`, `EditorConfig`, `useEditor`), `@shivaedev/effect-react/field-rejection.ts` (`FieldRejection`, `FieldRejectionMapping`, `RejectField`), `@shivaedev/effect-react/save-state.ts` (`SaveState`)

## 0.1.2 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Replace a JSDoc block with a short reason comment, so the package passes the comment rules of `@shivaedev/quality`.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.1 - 2026-09-26

### Changed

- Pin the optional `@shivaedev/effect-form` peer dependency to exactly 0.1.1,
  the version released alongside, instead of `^0.1.0`.

## 0.1.0 - 2026-09-26

### Added

- Add `useEditor`: binds a query atom, schema fields and a save Effect. It
  creates the form when data first arrives, remounts it per query atom, merges
  query refreshes and saved results per field, maps tagged
  `{ _tag, field, message }` rejections (such as effect-contract field
  rejections) onto fields by default and requires `rejectField` when a tagged
  rejection's field type names a field the form lacks, exposes other save
  failures and ignores submits while saving.
- Add `useCreate`: after a successful create it starts a fresh form from the
  initial values, keeping fields edited while the save was in flight.
- Export `useEditor` and `useCreate` from the `@shivaedev/effect-react/form`
  subpath; `@shivaedev/effect-form` (`^0.1.0`) is an optional peer dependency
  needed only by that subpath.
- Add `SessionBoundary`: one credential-bound client and atom registry per
  session generation, remounting its subtree and disposing the registry when the
  session changes or ends. A generation hidden by `<Activity>` renders against a
  fresh registry instead of a disposed one.
- Report `Unauthorized` query/action failures to the boundary's `recheck`
  instead of clearing retained data.
- Add `resumeSignal`, combining visible `visibilitychange`, visible `online` and
  an injectable native resume source for native `Atom.makeRefreshOnSignal` and
  `Atom.swr`.
- Add native atom query and action hooks with retained data, refresh state and
  typed action state.
