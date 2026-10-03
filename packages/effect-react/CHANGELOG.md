# Changelog

## Unreleased

### Changed

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Replace a JSDoc block with a short reason comment, so the package passes the comment rules of `@shivaedev/quality`.

- Build with the `@shivaedev/quality` tsconfig presets, which target ES2025 and allow only erasable TypeScript syntax.

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
