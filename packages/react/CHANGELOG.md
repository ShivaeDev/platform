# Changelog

## 0.18.1 - 2026-10-26

### Changed

- Release with updated workspace dependencies.

## 0.18.0 - 2026-10-25

### Added

- Pass the session-owned native registry as the second argument to `SessionBoundary.connect`, allowing session-scoped contracts to bind before screens render. Session replacement and sign-out release their private tracking, live registrations and pending refreshes; existing one-argument callbacks continue to work.

## 0.17.0 - 2026-10-25

### Added

- `bind` accepts an optional `resume: ResumeSource` to reopen and reconcile automatic live subscriptions from application lifecycle events alongside the browser defaults. Registry disposal unsubscribes the source.
- React automatic session subscriptions use the same source supplied to `bind` in `SessionBoundary.connect`, so native shells can reconcile live query screens from their own lifecycle events.

## 0.16.0 - 2026-10-25

### Added

- Add an optional session notice host with application-rendered controls, dismissal, expiry and native action status. Queries, command Effects and form submissions can supply notice descriptors; Undo runs an application Effect with its own payload and expected version, keeps conflicts on that action, and releases entries and pending actions when their notice or session ends.

## 0.15.0 - 2026-10-25

### Added

- Add stateless `QueryView` renderers for loading, successful content and typed query rejections with native refresh. Failed refreshes keep successful content mounted, while defects reach the application's error boundary.
- `@shivaedev/effect-test` readiness retries accept `timeout` and `wait` options. A timeout preserves the final typed failure; a custom wait lets adapters settle observable work through the same retry engine.

### Breaking

- `@shivaedev/effect-react/client/testing.ts` now returns an Effect from `eventually(assert)`. Replace `yield* Effect.promise(() => eventually(assert))` with `yield* eventually(assert)` in stories and Effect tests, or replace `await eventually(assert)` with `await Effect.runPromise(eventually(assert))` in async tests. Assertions wait inside React `act` in live time, including under TestClock. Timeout errors include elapsed milliseconds and the last assertion message, with the assertion error as their `cause`.

## 0.14.0 - 2026-10-25

### Added

- `useAction(runtime, run, options?)` runs optional `onSuccess(value, input)` and `onFailure(error, input)` callbacks inside each command invocation using the latest committed callbacks. Native atoms retain execution, interruption and aggregate state; `concurrent: true` allows overlapping commands. Bound commands keep their own invalidation without waiting for refetches, Unauthorized failures request one session recheck per invocation, and session replacement discards outgoing feedback. The existing atom overload remains available.

## 0.13.0 - 2026-10-25

### Added

- `queryRoute` supplies TanStack Router query loaders and search dependencies, mapping `NotFound` rejections to the route's not-found component.

### Changed

- Generated starter notes routes use query loaders and show a not-found screen for missing notes, with a link back to the list.

## 0.12.5 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.12.4 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.12.3 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

### Fixed

- Call the latest create, save and field-rejection callbacks across React renders while preserving the draft. Replace forms when their schema or runtime identity changes, and document which options are captured for a form lifetime.

## 0.12.2 - 2026-10-24

### Changed

- Align published dependency and peer pins and the generated starter with React and React DOM 19.3.1, TanStack Router 1.170.45, Better Auth 1.7.10, happy-dom 21.0.3 and Vitest 5.0.5. The starter also uses pg-boss dashboard 1.12.1.

## 0.12.1 - 2026-10-21

### Changed

- Release with updated workspace dependencies.

## 0.12.0 - 2026-10-19

### Added

- Choose a live changed-hint coalescing window per bound query with React's `useQuery(atom, { coalesceWindow })`, keeping the session window as the default. Queries over one connection refetch on their own schedules; changing the option does not reconnect or refetch queries.
- Configure a bound query's window through its registry with `queryCoalesceWindow(query)` from `@shivaedev/effect-contract/queryCoalesceWindow.ts`.

## 0.11.1 - 2026-10-19

### Fixed

- Recheck the session when an automatic live connection fails with `Unauthorized`, so `SessionBoundary` shows its signed-out content without another query read, stops reconnecting while signed out and restores live updates after sign-in.

## 0.11.0 - 2026-10-19

### Added

- Coalesce live changed hints over a default 20 ms window, with one follow-up read when hints arrive during an in-flight refetch. Configure `live()` with `coalesceWindow`, or set its returned `coalesceWindow` atom; zero retains immediate invalidation. Reconciliation stays immediate.
- Configure automatic live connections per React `SessionBoundary` with `liveCoalesceWindow`.

## 0.10.2 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.10.1 - 2026-10-19

### Fixed

- Wait for an active query loader before a newly mounted `useLoaderQuery` screen renders, so links to cached routes after invalidation show the changed data on their first render. Already mounted screens keep their data during refreshes.

## 0.10.0 - 2026-10-19

### Added

- effect-react exports `actionTrace(effect, name?)` from `actionTrace.ts` to group an action's RPC Effects under a fresh trace. Editor saves and create submissions automatically group their save Effects in a `ui.submit` trace. Native HTTP RPC clients send W3C trace context through the host to SQL and job enqueueing; pg-boss worker attempts retain their separate, linked traces.

### Fixed

- Platform appHost preserves incoming W3C `traceparent` context for RPC handling even without an installed tracer or exporter. Request ids stay annotated on the RPC span.

## 0.9.0 - 2026-10-19

### Added

- `captureReactWarnings` in `client/testing.ts` acquires a scoped, silent capture for story kits. Its `ReactWarnings` handle reads console calls and unexpected caught React errors as a `ReactWarningsReadout`, excludes declared caught errors, and restores `console.error` on scope closure, including failed stories. `expectNoReactWarnings` uses the same capture mechanism.

## 0.8.0 - 2026-10-18

### Added

- Session boundaries mount automatic live connections on bound contract APIs returned by `connect`, either directly or as properties such as `client.api`. Connections follow the session registry lifetime and query keys. `client/mountLive.ts` also exports `mountLive(registry, client)`, returning the release function for a custom owner.

### Breaking

- `SessionBoundary` now connects live queries automatically when its client contains a contract binding. Remove application `live()` calls and connection mounts; serve the contract through a Platform database host with NDJSON serialization.

## 0.7.0 - 2026-10-18

### Added

- Pass React's `RootOptions` to test `render(node, options)`, including `onCaughtError`, `onUncaughtError` and `onRecoverableError`.
- Declare expected boundary errors with `expectNoReactWarnings().expectCaughtError(predicate)`, using its returned `onCaughtError` handler in `render`. Unexpected caught errors, console errors, React warnings and missing expected errors still fail the guard.
- `useLoaderQuery(atom, routeLoaderData)` and `LoadedQueryState` expose loaded query data directly and retain the last value during refetches, without an Initial result or per-screen loading branch.
- `useEditor({ ...config, loaded: routeLoaderData })` and `LoadedEditor` provide a defined form and direct query data for loader-backed editors.
- `usePendingCommand`, `PendingCommandOptions` and `PendingCommandState` from `client/pendingCommand.ts` expose a command's wanted display value while it runs and its watched queries refetch, then adopt the server value. Typed command failures revert the display and remain in the native action result.
- Bind independently controlled list rows to separate native action atoms with `Atom.family`, so a typed rejection on one row leaves another row's pending display intact.

### Fixed

- Keep loader queries mounted until a component subscribes or their route owner aborts, so delayed route mounts share the loader's execution. Give SessionBoundary registries the same idle window as atom-react's default registry; unread results are released when their route owner ends.

## 0.6.0 - 2026-10-18

### Added

- `authAction` in `client/authAction.ts` binds Better Auth client promises to native action atoms for `useAction`, with pending state and typed returned failures. Rejected promises fail with the exported `AuthActionUnavailable` error; `AuthActionResult` describes the structural client result.

## 0.5.1 - 2026-10-18

### Fixed

- Route loaders and `loadQuery` recheck the owning `SessionBoundary` session once when a query fails with `Unauthorized`, so sign-in redirects can see an ended session.

## 0.5.0 - 2026-10-18

### Breaking

- Modules are named in camelCase: `field-rejection.ts` becomes `fieldRejection.ts`, and `resume-signal.ts` becomes `resumeSignal.ts`.
- Every module's import path is now its path under `src/`. `router.ts` becomes `loadQuery.ts`; `create.ts`, `editor.ts` and `testing.ts` move under `client/`; `result-state.ts`, `save-state.ts` and `session-boundary.ts` become `client/resultState.ts`, `client/saveState.ts` and `client/sessionBoundary.ts`.

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
