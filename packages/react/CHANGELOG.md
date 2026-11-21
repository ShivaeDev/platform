# Changelog

## 0.59.3 - 2026-11-21

### Changed

- Update `@shivaedev/contract` from 0.58.0 to 0.59.0.
- Update `@shivaedev/identity` from 0.44.0 to 0.44.1.

## 0.59.2 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.43.0 to 0.44.0.

## 0.59.1 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.42.0 to 0.43.0.

## 0.59.0 - 2026-11-21

### Fixed

- A route whose first load fails with a rejection the app declared shows what the route's own `failures` handlers return for its refresh notice, the server's message for `"message"`, instead of the notice host's unexpected-failure wording. The failure screen offers no Retry for such a rejection, since reading again brings the same answer; every other failure keeps its wording and its Retry.

### Breaking

- `queryRoute(buildQuery, { failures })` now takes the handlers for the rejections the app declared, and the declaration does not compile without them; a route's `useQuery()` takes only `keepPreviousData`. Move the `failures` passed to the route's `useQuery({ failures })` into the route's `queryRoute(...)` options, beside `redirects`. A route whose query can fail with a declared rejection now needs them even when its screen only calls `useLoaded()`.
- `FailureLayout`'s `retry` is optional: the router's failure screen leaves it out where reading again cannot help. An application's `loadFailure` screen or `QueryViewDefaults` failure renderer renders its Retry button only when `retry` is given.

## 0.58.1 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.41.0 to 0.42.0.

## 0.58.0 - 2026-11-21

### Added

- a route's loaded query (`queryRoute(...).useQuery()`, `useLoaderQuery`) and an editor given the route's loaded row publish a failed refresh to the mounted `NoticeHost` without screen code. The last data and the draft stay; a shared request rejection shows the server's `message`, and a server outage, an `InternalServerError`, a defect or an untagged failure shows the host's `failure` wording. The notice carries a Retry action that refreshes the query, a query shows one such notice at a time, and the notice goes when the query next succeeds. A lost connection and a refused read publish nothing.
- a route under `SessionApp` or `sessionRouter` whose loader fails shows a default failure screen without declaring `errorComponent`, worded as a notice would be, with a Retry that reruns the route's own query. Pass `loadFailure` in the routing options to replace that screen once for every route; it receives `FailureLayout` (`{ message, retry, retrying }`) from `client/QueryView.ts`. A refusal still shows `forbidden`, `NotFound` still shows the not-found screen, and an error thrown while a route renders still reaches the application.
- `QueryView`'s default failure words a server failure with the mounted `NoticeHost`'s `failure` wording, so an application states that wording once.
- an `authSession` retries its own failed checks, whether or not a `SessionBoundary` or `SessionApp` is mounted, so an app that cannot reach its host at launch reaches the signed-in screen once the host answers. The next check goes out 1 second after a failure, doubling up to every 30 seconds, and at once on a visible `online` or `visibilitychange` event. While it waits, the atom reports the failure as `waiting`. `refresh` still settles with one check's outcome. `authSession(read, { runtime })` runs the retries on another atom runtime, such as one carrying a story's controlled Clock; `SessionRuntime` names the runtime it takes.

### Breaking

- a route's `useQuery()` and `useLoaderQuery` take `{ keepPreviousData, failures }` in place of `useQuery`'s options. Remove a `notice` callback that worded shared rejections or outages, since the default now shows them; move the wording of a rejection the app declared into `failures: { Tag: handler }`, where a handler receives the error and returns a notice descriptor or `"silent"`, or use `"message"`. Such a rejection now needs a handler: the call does not compile without one.
- `useEditor` drops `queryNotice`. An editor given `loaded` publishes its query's failed refreshes by default and takes `queryFailures` for a rejection the app declared, which it requires; an editor without `loaded` shows its query's failures through `QueryView`.
- `QueryViewDefaults`' and `QueryViewRenderers`' `failure` receives `{ message, retry, retrying }` in place of `(error, query)`, so it lays out words the server or the notice host already chose. Move framework-failure wording into `NoticeHost`'s `failure` and keep only the layout. `queryFailureMessage` is removed; the default failure reads the host's wording instead. A view's own `failure(error, query)` is unchanged.
- `FailureHostContext` holds `{ report, word }` in place of the report function.
- `sessionRouter`'s `defaultErrorComponent` is the route failure screen in place of `PermissionBoundaryError`.
- `SessionBoundary` and `SessionApp` no longer retry a failed `recheck`; they share an in-flight check and leave retrying to the session atom. Delete the `runtime` prop from `SessionBoundary` and pass that runtime to `authSession(read, { runtime })` instead. A void `recheck` callback keeps its own retry policy.
- `@shivaedev/react/client/useSessionRetry.ts` is deleted, because the session atom now retries a failed check by itself. Delete the import, the `useSessionRetry(...)` call and any retry code of the application's own built around it.
- `AuthSessionOptions` from `@shivaedev/react/client/authSession.ts` now holds only `runtime`. The `{ remember }` options moved to the new `RememberedSessionOptions`, which also takes `runtime`; an application that names `AuthSessionOptions` for `{ remember }` names `RememberedSessionOptions` instead. Calls such as `authSession(read, { remember })` are unchanged.
- a failed session check reads as `waiting` while it retries, so `useQuery(session.atom).pending` stays true after a failure. A screen that showed "checking" while `pending` and a failure only afterwards checks for the failure first.

## 0.57.1 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.39.0 to 0.40.0.

## 0.57.0 - 2026-11-21

### Added

- `SessionApp` from `@shivaedev/react/client/SessionApp.ts` mounts an application's session and routes in one element. It takes the `clientApp` value, the auth actions, the current session, `recheck`, `persist`, an optional `history`, and the app's own `home`, `shell`, `forbidden` screen, `notFound` page, `parseSearch` and `stringifySearch`, plus `onCatch`, the router's `defaultOnCatch`, and `hidden`, which shows a refused route as not found instead of `forbidden`. It renders `SessionBoundary` with the app's `connect` and `warm`, identifies a generation by `session.user.id`, signs out through `auth.signOut`, builds one router per session generation with the current session readable as `session()` in route context, routes a signed-out visitor through the app connected with no session, and continues a fresh sign-in at `/sign-in` to its `returnTo`. Every route comes from the client modules; `home` renders at `/` while no module route claims it.
- `sessionRouter(options)` from `@shivaedev/react/client/sessionRouter.ts` builds that router for one connection, for kits and hosts without a session boundary, and `SessionRouter<typeof app>` types it for TanStack's `Register`. Its root route, `sessionRoot()` from `@shivaedev/react/client/sessionRoot.ts`, checks every matched route with `permissionGuard`, adds the permission of the module admin page whose path or detail path matches the location segment by segment (a `$id`, `{$id}` or `{-$id}` segment matches any one segment, so a literal route such as `/admin/reports/new` under a detail path is guarded too, and the bare `/admin` needs the first page's permission), takes the app's `notFound` as its `notFoundComponent`, and sends signed-out visitors to `/sign-in` with the requested location in `returnTo`. The router sets `defaultPendingMs: Infinity`, `disableGlobalCatchBoundary` and `defaultErrorComponent: PermissionBoundaryError`, wraps the app's shell in `PermissionBoundary` with the `forbidden` screen, and renders through react's `RouterProvider`.
- `SessionBoundary` gives its signed-out tree its `recheck` and retry policy. `useSessionRecheck()` works there, so a sign-in screen asks for the session it created.

### Changed

- a `useQuery` or `useAction` result that fails with `Unauthorized` in `SessionBoundary`'s signed-out tree now asks for one session check, as it does signed in; a check that answers signed out asks no second time.

### Breaking

- the `Register` interface of `@shivaedev/react/client/module.ts` takes the app's `auth` and `session` types in place of `root`, and `RootRoute` is the root route `SessionApp` builds. Replace `interface Register { readonly root: ReturnType<typeof rootRoute> }` with `interface Register { readonly auth: AuthActions; readonly session: AppSession }`, delete the app's own root route, and read `adminPages`, `auth`, `modules`, `navigate`, `redirects`, `registry` and `session()` from the root route's context as before.

## 0.56.0 - 2026-11-21

### Added

- `clientModule(contracts, (clients) => parts)` from `@shivaedev/react/client/module.ts` names the contracts a module's screens call, once, under the module's own names, and hands the callback a typed bound client for each; its parts are `routes: (root) => [...]`, `warm`, `admin`, `menu`, `overlays` and `footer`. Module routes get a typed root through the `Register` interface, which the application augments once with `{ readonly root: ReturnType<typeof rootRoute> }`. `AdminNavigation` describes an admin page for navigation by its shape.
- `clientApp(modules, options?)` from `@shivaedev/react/client/app.ts` makes one client over every module's contracts with `makeClient`, binding a contract that two modules name once, and returns `connect` and `warm` that spread into `SessionBoundary`. The connection carries `routes(root)`, `adminPages`, `modules` and the client's activity, `runtime` and `sync`; `options` takes `url`, `protocol`, `headers` and the other client options for story kits and native shells.

## 0.55.1 - 2026-11-21

### Changed

- Update `@shivaedev/contract` from 0.55.0 to 0.56.0.
- Update `@shivaedev/identity` from 0.38.1 to 0.38.2.

## 0.55.0 - 2026-11-21

### Added

- `NoticeHost`'s default wording for a command whose socket the host closed with code 1009, because the message was over its body limit, is `What you sent is too large for the server. Try again with something smaller.` instead of the lost-connection message.

### Breaking

- `usePendingCommand` no longer takes `queries`. Delete the option: the hold already lasts until the command is reflected, which every query the command changed now shows.
- `UnexpectedFailure["kind"]` has the new member `"tooLarge"` for that failure, so an application's own `failure` wording can tell it apart from `"connection"`. To migrate, add a `"tooLarge"` case to a `switch` over `kind` that lists every kind, or let its default branch show `failure.message`.

## 0.54.1 - 2026-11-21

### Fixed

- a live query's `Unauthorized` failure asks the session's auth owner to recheck once. It reached the screen through the query's result and through the live status, and a recheck that returned at once ran twice.

## 0.54.0 - 2026-11-21

### Added

- `RouterProvider` from `@shivaedev/react/RouterProvider.ts` takes TanStack's `RouterProvider` props and renders it, and holds `useFirstSettled` until the first route has rendered, so the hook reveals a routed first screen in one step wherever it is called. Swap the import of TanStack's `RouterProvider` for this one; nothing else changes.

### Changed

- `useFirstSettled(client)` turns `true` once the screen that calls it has rendered and nothing on the client is waiting, so a first screen that reads no query, such as a blank form or a welcome page, is revealed instead of waiting forever. A screen that reads queries is still revealed in one step after they answer, and a query that shows a stored or retained result does not hold the reveal back while it revalidates.

### Breaking

- import from `@shivaedev/react/Forbidden.ts` instead of `@shivaedev/react/adapters/Forbidden.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/PermissionContext.ts` instead of `@shivaedev/react/adapters/PermissionContext.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/queryRouteFailure.ts` instead of `@shivaedev/react/adapters/queryRouteFailure.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/screenPending.ts` instead of `@shivaedev/react/adapters/screenPending.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/signInRedirect.ts` instead of `@shivaedev/react/adapters/signInRedirect.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/useLatestCallback.ts` instead of `@shivaedev/react/adapters/useLatestCallback.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/SessionSignOut.ts` instead of `@shivaedev/react/client/adapters/SessionSignOut.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/crypto.ts` instead of `@shivaedev/react/client/adapters/crypto.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/handlerRuntime.ts` instead of `@shivaedev/react/client/adapters/handlerRuntime.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useActionResult.ts` instead of `@shivaedev/react/client/adapters/useActionResult.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useConnectionStatus.ts` instead of `@shivaedev/react/client/adapters/useConnectionStatus.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useFeedback.ts` instead of `@shivaedev/react/client/adapters/useFeedback.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useQueryNotice.ts` instead of `@shivaedev/react/client/adapters/useQueryNotice.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useSessionRetry.ts` instead of `@shivaedev/react/client/adapters/useSessionRetry.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useSubmissionCallbacks.ts` instead of `@shivaedev/react/client/adapters/useSubmissionCallbacks.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useUndoableChange.ts` instead of `@shivaedev/react/client/adapters/useUndoableChange.ts`, which moved out of `adapters/`.
- import from `@shivaedev/react/client/useWarmQueries.ts` instead of `@shivaedev/react/client/adapters/useWarmQueries.ts`, which moved out of `adapters/`.
- a `useFirstSettled` above TanStack's own `RouterProvider` now turns `true` at the first render, before the first route exists. Import `RouterProvider` from `@shivaedev/react/RouterProvider.ts` in place of TanStack's, with the same props, and the hook waits for the first route again.

## 0.53.0 - 2026-11-20

### Added

- `SessionBoundary` takes `persist`, a storage Layer such as `browserQueryStorage`. Every result retention keeps is written to the device for the user `identify` names, within a second of settling and at once when the page hides, bounded by `queryRetention.capacity` and `queryRetention.storedBytes` (about 5 MB by default). The next generation for that user reads them before its first screen, so a reload shows the last results at once, marked `stale` and `refreshing` like retained ones, and a route loader commits without waiting. The boundary wipes stored results when the session ends or comes back signed out, and the previous user's when another user signs in. The person's data then rests on the device, readable by anyone using that browser profile.
- a sign-out through `SessionBoundary`'s `signOut` action wipes the stored results as soon as the request succeeds, and the remembered session too when `persist` also supplies the session memory, such as `Layer.merge(browserSessionMemory, browserQueryStorage)`.

### Changed

- when a command or form save succeeds, the failure notices that same hook published earlier go without Dismiss. A notice nobody resolves still stays until dismissed or expired.

### Breaking

- a function provided to `FailureHostContext` returns the published notice's dismiss function, or `undefined` when it published nothing.

## 0.52.0 - 2026-11-20

### Added

- `authSession(read, { remember: browserSessionMemory })` answers at once with the remembered session, marked as refreshing, and checks the session in the background, so `SessionBoundary` renders and the live socket opens while the check is on the wire. The same user keeps the generation with refreshed permissions, another user starts a new one, a signed-out answer wipes the memory before the signed-out screen renders, a failed check keeps the remembered session rendering, and past the remembered expiry the launch waits for the check. With `remember`, the session's value is `RememberedSession | null`.
- with `remember`, the session has `signOut(request)`, which wipes the memory as soon as the sign-out request succeeds, so a relaunch starts without a remembered session even when the session check after the sign-out never answers.
- `SessionBoundary` takes `warm`, a function of the session's client that returns bound query atoms, such as `warm={(client) => [client.water.day.query({ date }), client.notes.list.query()]}`. Each listed query is mounted in the session's registry when the generation commits and stays subscribed until sign-out, another user or unmount, so a screen that reads it later renders its current value in its first render, also after a long idle stretch. The list is read again on every render and compared by atom identity: a changed payload opens the new query and hands the old one to retention. A warm query that no screen reads does not hold back `useFirstSettled`. Each listed query holds one subscription on the host for the whole session. Delete components that only mounted queries to keep them warm and list those queries instead.

### Changed

- `PermissionBoundary` runs the router's guards again when the grants of its session change without a navigation, so a screen that needs a removed grant is replaced by the refusal.

## 0.51.0 - 2026-11-20

### Added

- the result of `queryRoute(buildQuery)` has `useQuery(options?)`, which reads the route's query with the current match's params, decoded search, context and loader value, so a route's component no longer names the operation and its arguments again. `useLoaded()` returns the same atom as `query` and the loader value as `loaded`, to spread into a loader-backed `useEditor`. Replace `useLoaderQuery(api.get.query({ id }), route.useLoaderData())` in a route's component with `noteQuery.useQuery()`, keeping the `queryRoute` result as `noteQuery`; `useLoaderQuery` stays for loaders written with `loadQuery`.
- a query route reads `redirects` from the router context, so `redirects.signedOut` and `redirects.refused` are stated once for every query route. A route's own `queryRoute(buildQuery, { redirects })` still overrides them for its query.
- `signInRedirect(path)` in `adapters/signInRedirect.ts` builds a signed-out redirect to `path` that carries the requested location in `returnTo`.

### Changed

- from this version, with the `@shivaedev/quality` release of this change, write a `failures` handler inline in the component: `useEditor(api.retitle, { query, fixed: { id }, failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) } })`. The 0.50.0 note said to declare a handler such as `onTitle` or `couldNotRemove` outside the component because Biome's `noNestedComponentDefinitions` read it as a component; that is no longer needed, and the README now shows the inline form.

### Breaking

- `queryRoute` moves to `client/adapters/queryRoute.ts`, beside the client hooks its `useQuery()` uses. Change `@shivaedev/react/adapters/queryRoute.ts` imports to `@shivaedev/react/client/adapters/queryRoute.ts`.
- `permissionGuard` takes `signedOut`, the redirect callback, in place of the `signIn` path. Before: `permissionGuard({ session, signIn: "/sign-in" })`. After: put `redirects: { signedOut: signInRedirect("/sign-in") }` in the router context and pass it to the guard: `beforeLoad: ({ context, ...route }) => permissionGuard({ session, signedOut: context.redirects.signedOut })(route)`.

## 0.50.0 - 2026-11-20

### Added

- `NoticeHost` takes `failure(unexpected)`, the application's one wording for a lost connection, a server outage, an `InternalServerError`, a defect or an untagged failure, called once per failed invocation. Without it the host shows `Could not reach the server. Check your connection and try again.`, the server's redacted message, or `Something went wrong. Try again.`, never a cause. Without `render`, notices render with `role="alert"` or `role="status"` and a Dismiss button. A `Notice` carries `kind`: `"success"`, `"rejection"` or `"failure"`.
- `QueryViewDefaults` in `client/QueryView.ts` sets the application's default `failure` and `loading` rendering for every `QueryView` below it.
- `useCreate` and `useEditor` take their form fields from the command's payload schema when `fields` is omitted, and `useEditor` fills its inputs by encoding each row with those fields when `values` is omitted. `fixed` supplies the payload fields the form does not edit, and every save sends `{ ...fixed, ...values }`. `fixed` and the form's fields must cover the payload exactly: a missing key, a key outside the payload or a value of the wrong type does not compile, and the error names the key. Passing a bound query where a command belongs reports `a bound query only reads: read it with useQuery, and pass a command here`.

### Breaking

- a bound command given to `useAction`, `usePendingCommand` or `useUndoableChange`, and the save of `useCreate` or `useEditor`, now show their failures without screen code. A shared rejection from `@shivaedev/errors/taxonomy.ts` publishes its server message through the mounted `NoticeHost`; a rejection whose `field` names a form field still lands on that field; `Unauthorized` still rechecks the session and now also shows its message; interrupted work publishes nothing. Delete screen-local alerts that only repeated the message, such as `{Option.isSome(editor.failure) && <p role="alert">{editor.failure.value.message}</p>}`.
- `notices.onFailure` and `rejectField` are removed in favour of one per-tag `failures` option. Before: `useAction(api.remove, { notices: { onFailure: () => ({ message: "Could not remove" }) } })`. After: `useAction(api.remove, { failures: { Conflict: couldNotRemove } })` with `function couldNotRemove() { return { message: "Could not remove" }; }` declared outside the component, or leave it out to show the server's message. Before: `useEditor(api.retitle, { query, fixed: { id }, rejectField: (error) => ({ field: "title", message: error.message }) })`. After: `useEditor(api.retitle, { query, fixed: { id }, failures: { SubtitleRejected: onTitle } })` with `function onTitle(error: SubtitleRejected) { return { field: "title" as const, message: error.message }; }` declared outside the component, because Biome's `noNestedComponentDefinitions` reads a one-parameter function under a PascalCase key inside a component as a component. A handler receives the error and the invocation's input and returns a notice descriptor, a field rejection (form hooks only) or `"silent"`; `"message"` shows the error's own message and `"silent"` shows nothing for that tag. `silent: true` shows nothing for any failure of the call.
- a command or save that can fail with a rejection the application declared for itself does not compile until `failures` names it; the error names the tag, for example `Property '"failures.SubtitleRejected"' is missing`. Add `failures: { SubtitleRejected: "message" }`, or a handler, to each such call.
- `QueryView`'s `loading` and `failure` are optional. Without them the view renders the application's `QueryViewDefaults`, or a `Loading…` status and the failure's message with a Retry button that calls `refresh`. A query that can fail with an application-declared rejection still requires `failure`. Remove `loading` and `failure` renderers that repeated the default.
- `useAction` takes the bound command instead of a runtime and its `run`. The plain action atom form `useAction(atom)` is unchanged. Before: `useAction(NotesClient.runtime, api.remove.run, { onSuccess })`. After: `useAction(api.remove, { onSuccess })`. For an Effect that is not a single bound command, pass `{ run, runtime }`: `useAction({ run: save, runtime: NotesClient.runtime })`.
- `useCreate` takes the operation first and its options second; the `create` and `runtime` options are gone, and `fields` is optional. Before: `useCreate({ fields: NoteFields, initialValues: { title: "" }, create: api.create.run, runtime: NotesClient.runtime })`. After: `useCreate(api.create, { initialValues: { title: "" } })`. Keep `fields` when an input holds another encoding than the payload, such as `Schema.NumberFromString` for a number typed as text.
- `useEditor` takes the operation first and its options second; the `save` and `runtime` options are gone, and `fields` and `values` are optional. Before: `useEditor({ query: api.get.query({ id }), fields: NoteFields, values: (note) => ({ title: note.title }), save: (values) => api.update.run({ id, ...values }), runtime: NotesClient.runtime })`. After: `useEditor(api.update, { query: api.get.query({ id }), fixed: { id } })`. Pass `values(row)` when the row's shape differs from the fields; a payload field the row lacks, such as an expected version, goes in `fixed`. A save that composes several Effects passes `{ run, runtime }` as the operation: `useEditor({ run: (values) => save(id, values), runtime }, { fields, query, values })`.
- `useUndoableChange` and `usePendingCommand` take the bound command itself, and `useUndoableChange` takes `update` in its options. Before: `useUndoableChange({ ...api.change, runtime: NotesClient.runtime, update }, { describe })` and `usePendingCommand({ ...api.toggle, runtime: ItemsClient.runtime }, { value, wanted })`. After: `useUndoableChange(api.change, { describe, update })` and `usePendingCommand(api.toggle, { value, wanted })`. The `VersionedChangeCommand` and `PendingCommand` types are removed; both hooks accept any `{ run, runtime }`.
- the `CreateConfig` and `EditorConfig` types are now `CreateOptions` and `EditorOptions`, without the operation's members.

## 0.49.2 - 2026-11-20

### Changed

- Require Effect 4.1.4 and its matching platform packages.
- `useCreate` and `useEditor` accept a save failing with `Conflict` or `BadRequest` without `rejectField`. Drop `rejectField: fieldRejectionOf(Fields)` where it only repeated the default.

## 0.49.1 - 2026-11-19

### Changed

- Update `@shivaedev/access` from 0.6.3 to 0.6.4.
- Update `@shivaedev/contract` from 0.47.0 to 0.48.0.
- Update `@shivaedev/errors` from 0.12.0 to 0.13.0.
- Update `@shivaedev/form` from 0.19.3 to 0.19.4.
- Update `@shivaedev/identity` from 0.32.3 to 0.33.0.

## 0.49.0 - 2026-11-18

### Breaking

- `usePendingCommand` holds the requested value until the command is reflected, when every live query open on the connection shows the server's state after it, in place of waiting for a watched query's next result. A command that changes nothing now frees its control. The hook takes the bound command and its client's runtime where it took an action atom: change `usePendingCommand(toggle(row.id), { queries: [list], value, wanted })`, with `toggle` an `Atom.family` of `ItemsClient.runtime.fn(...)`, to `usePendingCommand({ ...api.toggle, runtime: ItemsClient.runtime }, { value, wanted })`, pass the row's id in the dispatched input and delete the family. `queries` is optional: keep it, as an array with a stable identity, only for queries the client reloads itself, such as those of a `live: false` client. `result`, `data` and `cause` now settle when the command is reflected.

## 0.48.1 - 2026-11-18

### Changed

- Update `@shivaedev/contract` from 0.45.0 to 0.46.0.
- Update `@shivaedev/identity` from 0.32.1 to 0.32.2.

## 0.48.0 - 2026-11-18

### Added

- `useFirstSettled(client)` from `@shivaedev/react/client/adapters/useFirstSettled.ts` tells an application when a session's first screen is ready. It returns `false` until a query mounted on the client has delivered its first success or failure and no mounted query awaits a first result and no command is in flight, then stays `true` for that client through later commands and newly mounted queries. A new session generation whose `connect` makes a new client starts at `false` again, and a client that mounts no query stays at `false`.

### Changed

- `useAction(runtime, run)` with a `run` function written inline in the component fails its next render with an error that names `useAction`, says `run` is the action's identity and gives the fix: pass a bound command such as `api.rename.run`, or wrap the function in `useCallback` or `useMemo`. Such a component used to fail with React's `Too many re-renders`. Replacing a mounted control's command with another stable function works as before.

## 0.47.3 - 2026-11-11

### Changed

- Update `@shivaedev/identity` from 0.31.2 to 0.32.0.

## 0.47.2 - 2026-11-11

### Fixed

- A route whose component mounts after its loader read a query now continues the loader's subscription and first result, so the query handler runs once per page view, for live and `live: false` queries alike. `loadQuery` keeps a successful query mounted for a five-second hand-over window on the query runtime's `Clock`; a route that is left or never mounts releases it when the window passes.
- `screenPending()` settles while a live query is mounted. A live query still keeps the screen pending until its first answer arrives; its open subscription no longer keeps it pending forever.

## 0.47.1 - 2026-11-10

### Changed

- Update `@shivaedev/contract` from 0.43.4 to 0.43.5.
- Update `@shivaedev/identity` from 0.31.0 to 0.31.1.

## 0.47.0 - 2026-11-08

### Added

- Add shared notice descriptor types at `@shivaedev/react/noticeTypes.ts`.

### Breaking

- Move `@shivaedev/react/NoticeContext.ts` to `@shivaedev/react/client/NoticeContext.ts`, `@shivaedev/react/PermissionContext.ts` to `@shivaedev/react/adapters/PermissionContext.ts`, `@shivaedev/react/RecheckContext.ts` to `@shivaedev/react/client/RecheckContext.ts`, `@shivaedev/react/SignOutRegistryContext.ts` to `@shivaedev/react/client/SignOutRegistryContext.ts`, `@shivaedev/react/notices.ts` to `@shivaedev/react/client/notices.ts`, and `@shivaedev/react/sessionRecheck.ts` to `@shivaedev/react/adapters/sessionRecheck.ts`; update imports to the new paths.
- Move `@shivaedev/react/adapters/useNoticePublisher.ts` to `@shivaedev/react/client/adapters/useNoticePublisher.ts`, `@shivaedev/react/adapters/usePermissionFailure.ts` to `@shivaedev/react/client/adapters/usePermissionFailure.ts`, `@shivaedev/react/adapters/useQueryNotice.ts` to `@shivaedev/react/client/adapters/useQueryNotice.ts`, and `@shivaedev/react/adapters/useSubmissionCallbacks.ts` to `@shivaedev/react/client/adapters/useSubmissionCallbacks.ts`.
- `useLoaderHandoff` in `@shivaedev/react/adapters/useLoaderHandoff.ts` now reads the registry from React context. Change `useLoaderHandoff(registry, atom)` to `useLoaderHandoff(atom)`.

## 0.46.7 - 2026-11-08

### Changed

- Update `@shivaedev/contract` from 0.43.3 to 0.43.4.
- Update `@shivaedev/identity` from 0.30.5 to 0.30.6.

## 0.46.6 - 2026-11-08

### Fixed

- `usePendingCommand` keeps the requested value after a successful command until a watched query delivers its next settled Result, so a switch backed by a live query no longer flips back to the old value before the server's push arrives.

## 0.46.5 - 2026-11-07

### Changed

- Update `@shivaedev/contract` from 0.43.2 to 0.43.3.
- Update `@shivaedev/identity` from 0.30.4 to 0.30.5.

## 0.46.4 - 2026-11-07

### Changed

- Update `@shivaedev/identity` from 0.30.3 to 0.30.4.

## 0.46.3 - 2026-11-07

### Changed

- Update `@shivaedev/contract` from 0.43.1 to 0.43.2.
- Update `@shivaedev/identity` from 0.30.2 to 0.30.3.

## 0.46.2 - 2026-11-07

### Changed

- Update `@shivaedev/access` from 0.6.0 to 0.6.1.
- Update `@shivaedev/contract` from 0.43.0 to 0.43.1.
- Update `@shivaedev/errors` from 0.10.0 to 0.10.1.
- Update `@shivaedev/form` from 0.19.0 to 0.19.1.
- Update `@shivaedev/identity` from 0.30.1 to 0.30.2.

## 0.46.1 - 2026-11-07

### Changed

- Update `@shivaedev/identity` from 0.30.0 to 0.30.1.

## 0.46.0 - 2026-11-06

### Breaking

- Live query screens receive server-pushed values. Remove `SessionBoundary.liveCoalesceWindow` and `QueryOptions.coalesceWindow`; server coalescing applies automatically.

## 0.45.1 - 2026-11-06

### Changed

- Update `@shivaedev/identity` from 0.29.1 to 0.29.2.

## 0.45.0 - 2026-11-06

### Added

- Expose `useQuery().stale` while retained data waits for a fresh result. Session disposal clears all retained results.

### Breaking

- Completed route loaders release their execution mount and use the same bounded result retention as component reads. Loaders revisiting a kept result return it immediately; component mounts revalidate while showing that stale value.

## 0.44.2 - 2026-11-06

### Changed

- Live screens and route loaders consume the subscription's first result without a separate query request.

## 0.44.1 - 2026-11-05

### Changed

- Update `@shivaedev/contract` from 0.39.0 to 0.40.0.
- Update `@shivaedev/identity` from 0.27.0 to 0.28.0.

## 0.44.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. `clientCrypto` provides `SecureRandom` and `Digest` from `effect/crypto` instead of `Crypto`, and `useNewId` needs an atom runtime with `SecureRandom`. Replace `Crypto.Crypto` in handler and runtime types with those services.

## 0.43.0 - 2026-11-05

### Added

- `SessionBoundary` accepts a native atom `runtime` for its session-recheck retry loop. Supply a runtime carrying the story Clock to drive recovery backoff without real waits.

### Fixed

- Story examples use the controlled clock.

### Breaking

- Remove `internal/` from module imports, including imports of its adapters.

## 0.42.0 - 2026-11-05

### Added

- Let `useUndoableChange` build an inverse command input from the successful result with `undoInput`, carrying per-row versions or an undo token for batch changes. Existing single-row versioned calls keep working unchanged.
- Expose the immediate `waiting-for-connection` status through `useConnectionStatus` while a bound command waits, keeping actions pending until delivery or the typed connection timeout.
- Provides `useDebouncedValue` and cancellable `useDelay` hooks on the atom runtime's Effect Clock. Pending timers count as observed atom work for screen settlement and cancel on unmount.

### Fixed

- Editors preserve keys omitted during save normalization, and create forms preserve omissions through reset.

### Breaking

- `useConnectionStatus` can return `waiting-for-connection`. Render it as a reconnect notice while the action remains pending.

## 0.41.2 - 2026-11-04

### Changed

- Update `@shivaedev/identity` from 0.26.0 to 0.26.1.

## 0.41.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.41.0 - 2026-11-04

### Added

- Add `useUndoableChange` for versioned commands: capture an inverse payload, guard Undo with the returned version, keep the latest removal notice across reordered replies, preserve typed results and hold deployment updates while writes are pending.
- `SessionBoundary` accepts a session-check Effect, retries failed checks with exponential backoff, and retries immediately on online or foreground events. Its optional `signOut` atom holds the signed-in tree until the auth owner reports signed out.

### Fixed

- Socket transport failures no longer request a session check; typed authentication refusals still do.

## 0.40.0 - 2026-11-04

### Added

- Activate staged updates while hidden once registered blockers release, and expose an application-owned reload action when activation is unavailable or blocked.
- Provide `useNewId` and `useClock` callbacks backed by atom runtime Crypto and Clock services, plus a Web Crypto client layer.
- Add `usePromiseAction` to dispatch promise calls with native action state, `UnknownError` failures by default and an optional typed rejection mapper.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.39.0 - 2026-11-04

### Added

- `useConnectionStatus(client)` exposes one debounced `live | reconnecting` status across every binding on a client.
- Query state exposes `refusal` separately from RPC transport failures, keeping retained data available during socket recovery. `QueryView` reports refusals through its failure slot while keeping transport causes available on the query.

### Fixed

- Session boundaries mount nested live bindings and apply the session coalescing window to them.

### Breaking

- `QueryView` calls its failure renderer only for refusals. Read `query.cause` for transport diagnostics and use the client connection status for a shared reconnecting notice.

## 0.38.1 - 2026-11-04

### Changed

- Update `@shivaedev/access` from 0.4.1 to 0.4.2.
- Update `@shivaedev/contract` from 0.33.1 to 0.34.0.
- Update `@shivaedev/errors` from 0.7.0 to 0.8.0.
- Update `@shivaedev/form` from 0.14.0 to 0.15.0.
- Update `@shivaedev/identity` from 0.22.1 to 0.23.0.

## 0.38.0 - 2026-11-03

### Fixed

- Keep mounted action controls pending when their command changes until the outgoing request settles. Show only the current command's result, data and cause for both native-atom and runtime actions.

### Breaking

- The runtime overload of `useAction` uses its `run` function as the command identity. Pass the stable bound command function directly, or memoize a wrapper with `useCallback` or `useMemo`, so rerenders of the same command retain its state. Completion callbacks still use the latest committed props.

## 0.37.0 - 2026-11-03

### Added

- Editors and create forms attach observed draft storage to the form atoms' lifetime.

### Fixed

- Completing an older submission preserves newer shared draft input and local edits in progress.

## 0.36.0 - 2026-11-03

### Breaking

- React hooks under `@shivaedev/react/internal/` now live under `@shivaedev/react/internal/adapters/`. Change imports of `useLatestCallback.ts`, `useNoticePublisher.ts`, `usePermissionFailure.ts`, `useQueryNotice.ts` and `useSubmissionCallbacks.ts` to that directory; their exports and behavior are unchanged.

## 0.35.0 - 2026-11-03

### Added

- Session boundaries mount every API declared with contract's `composeBindings`, including APIs nested inside feature modules, and apply the session's live coalescing window to each binding.
- Accept and forward form's `requiredMessages`, `checks`, `debounce` and `arrayKeys` in editor, create and submission configurations, preserving encoded field types and runtime service requirements.

### Fixed

- Keep a failed route's query in its registry until its own retry refreshes it or the route leaves, so refreshing another query cannot recover the failed route.
- Mounted session queries refresh after worker writes, and a denied recheck reaches the query as `QueryReadDenied`.

### Breaking

- The `internal/liveBindings.ts` module is removed. Consumers that imported it must import `liveBindings` from `@shivaedev/contract/composeBindings.ts` instead.
- `useEditor` and `useCreate` require explicit draft storage alongside time. Acquire `persistence` with form's `draftPersistence` Effect from `@shivaedev/form/adapters/draftPersistence.ts`, provide `browserDraftStorage` from `@shivaedev/form/adapters/browserDraftStorage.ts`, and pass `persistedDraft: { key, ...persistence }`.
- Import `authCall` and `AuthActionResult` from `@shivaedev/identity/client/adapters/authCall.ts` instead of `@shivaedev/react/client/authAction.ts`. Import `AuthFailure` from `@shivaedev/identity/client/AuthFailure.ts` and the `AuthFailureCode` schema and type from `@shivaedev/identity/client/AuthFailureCode.ts`.
- React's `authAction` now accepts an input-to-Effect function: replace `authAction(runPromise)` with `authAction(authCall(runPromise))` using identity's bridge. React's `authQuery` also accepts an input-to-Effect function: wrap the Promise reader with `authQuery` from `@shivaedev/identity/client/adapters/authQuery.ts` before passing it to React's atom family.
- React's `authSession` now accepts a session Effect: wrap the Promise reader with `authSession` from `@shivaedev/identity/client/adapters/authSession.ts` before passing it to React's session atom. Import `SessionWithPermissions` from that identity adapter instead of React's session module. `AuthSession<A, E>` now exposes exactly `E`; include `AuthUnavailable` in `E` when explicitly annotating an identity-backed session.
- Import the `PermissionSession` schema and type from `@shivaedev/identity/PermissionSession.ts` instead of `@shivaedev/react/permissions.ts`. Import `can` from `@shivaedev/react/can.ts` instead of `@shivaedev/react/permissions.ts`. The removed exports have no compatibility aliases.

## 0.34.0 - 2026-11-02

### Breaking

- Import `AtomServices` from `@shivaedev/react/AtomServices.ts` instead of the removed `@shivaedev/react/fieldRejection.ts` module.
- Import `queryRoute` from `@shivaedev/react/adapters/queryRoute.ts` instead of `@shivaedev/react/queryRoute.ts`.
- Import `permissionGuard`, `PermissionGuardOptions` and `PermissionGuardContext` from `@shivaedev/react/adapters/permissionGuard.ts` instead of `@shivaedev/react/permissionGuard.ts`.
- Import `PermissionBoundary`, `PermissionBoundaryError`, `PermissionBoundaryProps` and `useCan` from `@shivaedev/react/adapters/permissionBoundary.ts` instead of `@shivaedev/react/client/permissionBoundary.ts`.
- Import `screenPending` and `ScreenPendingOptions` from `@shivaedev/react/adapters/screenPending.ts` instead of `@shivaedev/react/client/screenPending.ts`.
- Import `useSignOut` from `@shivaedev/react/client/adapters/useSignOut.ts` instead of `@shivaedev/react/client/useSignOut.ts`.
- Direct imports of `useLoaderHandoff` move from `@shivaedev/react/internal/useLoaderHandoff.ts` to `@shivaedev/react/adapters/useLoaderHandoff.ts`. Direct imports of `keepLoaderQuery`, `acceptLoaderQuery` and `pendingLoaderQuery` move from `@shivaedev/react/internal/queryHandoff.ts` to `@shivaedev/react/adapters/queryHandoff.ts`.
- Import `Forbidden` and `ForbiddenProps` from `@shivaedev/react/adapters/Forbidden.ts` instead of `@shivaedev/react/client/Forbidden.ts`.

## 0.33.0 - 2026-11-02

### Added

- Form and React submission configurations accept a `savedValues` mapping to normalize a successful submission against its captured baseline while retaining later field edits.
- Return a `useRetry` hook from `queryRoute` so a route's error component can refresh its query and render a successful result without rebuilding the query or replacing the surrounding shell.
- Accept optional `redirects.signedOut` and `redirects.refused` callbacks for native typed TanStack redirects. Signed-out redirects can preserve the full return location with `signInSearch`; refused reads handle both `Forbidden` and `QueryReadDenied`.

### Fixed

- Editors preserve newer received baselines when an earlier save completes, and merge normalized saved fields without erasing later edits.
- Create forms retain optional keys removed while a submission is in flight when resetting their inputs.
- Keep live coalescing overrides owned by each query reader, so removing a reader restores the remaining reader's override. Clearing a session's live coalescing override restores the binding's original window.

### Breaking

- Direct callers of `@shivaedev/react/client/mountLive.ts` now run `mountLive(client, window)` as an Effect requiring `AtomRegistry.AtomRegistry`, instead of passing the registry as its first argument. Provide the registry with `Effect.provideService(AtomRegistry.AtomRegistry, registry)` and call the returned cleanup when the reader unmounts.
- Direct calls to the loader returned by `queryRoute` now require `location` alongside `abortController`, context, deps and params. Pass the native TanStack loader context, or add the requested location to a custom loader invocation.

## 0.32.0 - 2026-11-01

### Added

- React exposes an Effect `PermissionSession` schema alongside its inferred session type, using access's shared permission codec.
- React session reads expose typed permission grants while preserving provider fields.
- React supplies `Forbidden` with a router link back to an allowed route, and `PermissionBoundaryError` for route failures inside the router.
- Identity's `betterAuthMount` accepts `onPasswordReset`, an Effect callback that runs with the host's context and composes after Better Auth's native reset callback.
- React's `permissionGuard` accepts `hidden: true` to render TanStack Router's not-found page when a signed-in viewer lacks a required permission.

### Breaking

- React's `authSession` now requires a nullable session with a `user` object and validates its permission grants. Use `authQuery` for reads of other payload shapes; remove application session permission decoders when using `authSession`.
- `PermissionSession` is now a schema-derived type. Extend it with an intersection or an application interface rather than module augmentation.

## 0.31.1 - 2026-11-01

### Changed

- Update `@shivaedev/access` from 0.3.4 to 0.3.5.
- Update `@shivaedev/contract` from 0.30.0 to 0.30.1.
- Update `@shivaedev/errors` from 0.4.0 to 0.4.1.

## 0.31.0 - 2026-11-01

### Added

- Export Effect logs as trace events and ErrorReporter reports as error spans through the redacting Railway OTLP pipeline in appHost and worker Layers.
- Mount a same-origin browser error reporting route in appHost, with server redaction, bounded reports and per-client rate limiting.
- Generated starters enable Railway manual tracing for web and worker services and mount browser reporting by default.
- Add useBrowserErrors to forward uncaught browser errors and unhandled rejections to the host, removing listeners on unmount.

### Fixed

- Mask complete RPC payload annotations before exporting logs and error reports, keeping sensitive error values out of Railway diagnostics even when the request uses public field names.

## 0.30.1 - 2026-10-31

### Changed

- Update `@shivaedev/access` from 0.3.3 to 0.3.4.
- Update `@shivaedev/contract` from 0.29.0 to 0.30.0.
- Update `@shivaedev/errors` from 0.3.0 to 0.4.0.

## 0.30.0 - 2026-10-31

### Added

- `migrateBetterAuth` runs Better Auth schema migrations using the database from Effect's SQL service. Applications pass auth configuration without a database pool.

### Fixed

- Generated applications start with no quality baseline and rely on the jobs package’s peer installation of `pg-boss`.
- Loaded editors construct their form from the supplied row without an unreachable synchronous guard.

### Breaking

- `registerAdmin` reports missing or extra page handlers as defects when its handler Layer is built. Consumers that catch synchronous registration errors must instead observe Layer acquisition failures.

## 0.29.0 - 2026-10-31

### Added

- React query hooks, including `useLoaderQuery` and loader-backed editor queries, expose `denied` for a `QueryReadDenied` refusal so screens can replace retained data.

### Changed

- A `$changes` batch remains all-or-nothing: one denied query rejects or ends live updates for the whole batch. Split queries with independent permissions into separate `$changes` requests; automatic bound queries already subscribe separately.

### Fixed

- Live queries refused with `QueryReadDenied` remain refused through matching invalidations and resume events until their input or viewer changes. They stop automatic subscription attempts and refused reads.
- `queryRoute` sends read denials to the route's not-found component, just like missing records.

## 0.28.0 - 2026-10-31

### Added

- `SessionBoundary` accepts `redirectTo` and an optional `navigate` callback to continue sign-in through a same-origin URL replacement after unmounting the signed-out tree and before mounting the signed-in tree. Unsafe targets fall back to `/`.
- `authSession` exposes a Better Auth read as a native query atom and an Effect that refreshes and awaits its settled result, so user mutations keep their loading state until session data is current.
- React's `permissionGuard` accepts `staticData.signedIn: true` for routes that require a session without a permission grant. Signed-out viewers use the existing sign-in redirect and return location; undeclared routes remain public and matched permission requirements still apply.

### Changed

- Generated starters import schedule definitions and the default queue client factory from their defining modules.
- Generated apps declare the notes routes as signed-in-only and install `permissionGuard` once at the root, redirecting signed-out viewers before loading notes.

### Fixed

- Query, save, command, loader and live connection failures share one session recheck decision, including identity's native `Unauthorized` errors.
- Report exported type aliases of imports, value aliases with `typeof` annotations or local const chains, object facades and unchanged forwarding functions, with repairs naming their defining modules. Keep wrappers that transform inputs, add steps, supply defaults or declare overloads.
- Generated apps let the boundary hand off sign-in navigation and identify cookie sessions by user id, preserving signed-in screen state when a session rotates after a password change.
- Carry the original `NotFound` query rejection in TanStack Router's not-found `data` so a shared root screen can display its server message and typed fields while route-level not-found screens keep precedence.

### Breaking

- React recognizes session rechecks, permission failures and missing routes through the shared error classes. Fail with `Unauthorized`, `Forbidden` and `NotFound` from `@shivaedev/errors/taxonomy.ts` instead of objects or local classes with matching tags. Replace `isUnauthorized` imports from React's `client/resultState.ts` with the taxonomy guard; for a cause, use `Option.exists(Cause.findErrorOption(cause), isUnauthorized)`.
- `authQuery` and `authSession` fail rejected promises with `AuthUnavailable` from `@shivaedev/errors/taxonomy.ts`. Replace `AuthActionUnavailable` imports and error annotations with `AuthUnavailable`, and read its `message` instead of `cause`.
- Quality: the gate now rejects imported second names even when they use type aliases, value annotations, object facades or forwarding functions. Import from the defining module and remove the second name; existing facade debt can be recorded at adoption. Import `USAGE` from `cli/messages.ts` instead of `cli/args.ts`.
- Jobs: import `defaultClientFactory` from `@shivaedev/jobs/server/defaultClientFactory.ts` instead of `server/client.ts`. Import `defineSchedule` from `@shivaedev/jobs/server/defineSchedule.ts` instead of `server/definition.ts`. The removed `server/internal/nativeClient.ts` and `server/internal/scheduleDefinition.ts` exports migrate to those same modules as `defaultClientFactory` and `defineSchedule`. The default factory now exposes its native pg-boss return type; type custom factory mocks against `PgBossClient` or `PgBossClientFactory` from `server/client.ts`.
- React: import `resumeSignal`, `ResumeOptions`, `ResumeSource` and `ResumeWindow` from `@shivaedev/contract/resume.ts`; `@shivaedev/react/resumeSignal.ts` is removed.
- Work Board: import `Identity` from `path/Identity.ts`, view state helpers from `browser/views/state.ts`, `isMarkdown` from `path/isMarkdown.ts`, and `processes` from `server/processOwnership.ts`. The forwarding `server/views/state.ts` and `server/integration/processes.ts` modules are removed. Replace the removed `attention` facade with imports of `managedRequestReceipt` from `server/attention/managedRequestReceipt.ts`, `attentionProjection` from `server/attention/projection.ts`, and `RequestReceipt` from `attention/RequestReceipt.ts`. Replace the removed `publication` facade with direct imports from `server/responses/publicationDirectory.ts`. Import `Changes` from `server/files/changes.ts`, `MarkdownFile` from `server/files/list.ts`, `Snapshot` from `server/search/snapshot.ts`, metadata document/model/diagnostic/parsed types from `integration/metadata.ts`, `InboxProjection` from `browser/views/schema.ts` instead of `AttentionProjection`, `SourceFailure` from `diagnostics/source.ts`, and `WorkspaceOptions` from `server/workspace.ts` instead of the integration facades. Metadata types are also removed from `server/metadata/model.ts` and `server/metadata/parse.ts`; import them from `integration/metadata.ts`.
- Work Fleet: import `WAIT_EXIT`, `WaitState`, `WaitOutcome` and `settled` from `host/waitOutcome.ts` instead of `host/wait.ts`; import `fleetRecords` from `fleetRecords.ts` instead of `operations.ts`.

## 0.27.0 - 2026-10-31

### Added

- `@shivaedev/react`: `queryRoute` passes the loader's router context to its query factory alongside params and validated search. Annotate `context` with the parent route's `types.allContext` to read declared clients and viewer state with type checking.

### Changed

- `@shivaedev/create-app`: generated starter routes read clients and session state from native router context instead of taking them as route factory parameters.

## 0.26.0 - 2026-10-31

### Added

- Screen kits can build a screen driver's `pending` signal with `screenPending({ router })` from `client/screenPending.ts`, which reads the `AtomRegistry` from the environment: it reports pending while a read `AsyncResult` is waiting or the TanStack router is loading a route, and ignores results left waiting by unmounted components.

### Breaking

- `loadQuery` moved from `@shivaedev/react/loadQuery.ts` to `@shivaedev/react/adapters/loadQuery.ts`, beside the other bridges from outside libraries into Effect. Change the import path; the function and its behavior are unchanged.

## 0.25.0 - 2026-10-30

### Added

- `authCall` turns a Better Auth client callback into an input-taking Effect for form `onSubmit` handlers.

### Breaking

- `authAction` now fails with `AuthFailure`. Map its closed `code` union to application text instead of reading raw Better Auth error fields or HTTP statuses. Core Better Auth codes pass through; code-less rate limiting becomes `RATE_LIMITED`, and unsupported codes and rejected promises become `UNKNOWN`. Read the original error from `cause`. Replace action error annotations that include `AuthActionUnavailable` with `AuthFailure`; `authQuery` retains its existing failures.

## 0.24.0 - 2026-10-30

### Added

- `useLoaderQuery` accepts the shared query options, including `coalesceWindow`, so loader-backed screens can configure live refetches directly.
- `NoticeHost` accepts an optional `runtime` and runs notice expiry as an Effect sleep on that atom runtime's `Clock`, so a story's `TestClock` drives expiry. Without it, expiry uses Effect's default clock as before.

## 0.23.2 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.23.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.23.0 - 2026-10-30

### Added

- Expose the native submission `cause` on `useEditor`, `useCreate` and `SaveState` so applications can render failures that include defects.
- Export modules under `internal/` in `contract` and `react` and `server/internal/` in `jobs` through the existing `.ts` wildcard, so consumers can import those modules directly by their file paths.
- Access exports the `Permission` Schema and derives its type from it. Role resolution and identity session decoding use that Schema.
- Access exports `forbidden(permission)` and `unauthorized()` from `refusal.ts` for consistent permission refusals.

### Changed

- Generated applications import React test helpers from their existing `@shivaedev/test-story` development dependency.

### Fixed

- Work Board reads draft timestamps and expiry through its form client’s runtime Clock.
- Ignore repeated sign-out dispatch while sign-out is pending.
- Generated apps send an explicitly signed-out visitor to sign-in when the replacement session receives `Unauthorized` from the notes route.

### Breaking

- Persisted drafts require a `now: () => number` callback in core forms, `usePersistedDraft`, `useEditor` and `useCreate`. Capture `Clock.Clock` in the application’s Effect setup and pass `now: () => clock.currentTimeMillisUnsafe()` so timestamps and expiry follow that clock, including TestClock in stories.
- Form no longer exports the identity cast helpers `holder`, `fieldOf`, `choicesOf` or `checkOf` from `shape.ts`, or `keySelector` from `paths.ts`. Use declared reference, field, check and selector types directly; get field refs and choices through the form’s typed `field` and `choices` methods.
- `useSignOut` stops follow-up navigation on component unmount or registry disposal. Keep the component mounted until the request completes, or let the replacement session's route policy navigate to sign-in when a session refresh unmounts it first.
- Move the React test helpers to `@shivaedev/test-story/client/react.ts`. Replace imports from `@shivaedev/react/client/testing.ts` with this path for `render`, `eventually`, `captureReactWarnings`, `expectNoReactWarnings` and their types. Add `@shivaedev/test-story` as a development dependency and install its React helpers' optional peers `react`, `react-dom` and `@effect/atom-react` when using them. React no longer brings `@shivaedev/test` into applications as a runtime dependency.
- Access, identity and React now share access's grant evaluator: an `any` grant covers an `own` check for the same permission name. An `own` grant still cannot cover an `any` check. Applications that need separate capabilities must declare separate permission names; record ownership checks still belong in `canAccess` or `requireAccess`.
- Replace `Access.requirePermission(user, permission)` with `requirePermission(yield* Access.resolve(user.role), permission)` from `@shivaedev/access/requirePermission.ts`. The new function takes a signed-in user; reject an absent session with `unauthorized()` from `@shivaedev/access/refusal.ts` before resolving its role. `requireAccess` continues to handle signed-out users itself.
- Replace identity's `requirePermission(permission)` with access's `requirePermission(yield* SessionUser, permission)`. There is no identity re-export. Admin's built-in handlers use this shared enforcement.
- Access's `requireAccess` now uses the shared permission refusal message, `Permission required: <name> (<strength>)`, instead of `Access denied: <name>`. Consumers should branch on the `Forbidden` tag.

## 0.22.1 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.
- Keep sign-out requests and their sign-in redirects alive when the session boundary replaces its subtree before the response arrives.

## 0.22.0 - 2026-10-29

### Added

- Forwarding proxy fixtures relay WebSocket upgrades, including the same origin and trusted proxy headers as HTTP requests. Existing proxy URLs also work for socket clients.

### Breaking

- Contract clients use Effect RPC over a shared WebSocket by default. Replace `httpClient`, `transformClient` and `serialization` client options with a native `protocol` Layer for custom transports. Node clients can supply upgrade `headers` and a `webSocketConstructor` Layer; browsers use their session cookie automatically.
- Mounting a bound query subscribes before its first authorized read; unmounting releases its subscription. Use `live: false` when binding an ordinary client without subscriptions. Query preparation alone no longer opens a change stream.
- Hosts serve live subscriptions on the WebSocket upgrade at the RPC path. Move HTTP `$changes` consumers to Effect RPC's socket protocol; the POST route serves ordinary RPC only. Configure development proxies to forward WebSocket upgrades.
- React session boundaries bind shared sockets to the identified session, so replacing an account upgrades with its current cookie. They also ask the auth owner to recheck when the live socket closes. Keep `recheck` safe to call after a network interruption; the auth owner still decides whether the session ends.

## 0.21.1 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.21.0 - 2026-10-28

### Added

- `@shivaedev/contract/bind.ts` builds a bound HTTP RPC client and atom runtime from a contract and URL, with an inferred request transform for cookies or bearer tokens.
- `@shivaedev/react/client/useNow.ts` exports `useNow(interval, runtime?)` to render the runtime's Effect clock and refresh on the requested interval, including with TestClock.
- `useSignOut` coordinates explicit sign-out with TanStack Router so `permissionGuard` and `signInSearch` omit the return target during the following session refresh.
- `authQuery` turns Better Auth reads into input-keyed native query atoms, preserving typed auth errors, mapping rejected promises to `AuthActionUnavailable`, and aborting pending requests when their readers unmount.

### Fixed

- Session boundaries deliver the latest committed `recheck` to query, action and save hooks without repeating a refused result when the callback changes identity.

## 0.20.0 - 2026-10-27

### Added

- Read session grants with `can` and `useCan`, guard TanStack routes with `staticData.permission` and `permissionGuard`, and render one `PermissionBoundary` fallback for refused routes and forbidden queries. Signed-out route visits redirect to the application's sign-in path with their return location.

## 0.19.0 - 2026-10-27

### Breaking

- Rename `@shivaedev/effect-react` to `@shivaedev/react`. Change dependency declarations and imports from `@shivaedev/effect-react/...` to `@shivaedev/react/...`; module paths inside the package are unchanged.

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
