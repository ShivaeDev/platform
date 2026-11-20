---
"@shivaedev/react": minor
"@shivaedev/form": minor
"@shivaedev/contract": minor
"@shivaedev/errors": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/react`: a bound command given to `useAction`, `usePendingCommand` or `useUndoableChange`, and the save of `useCreate` or `useEditor`, now show their failures without screen code. A shared rejection from `@shivaedev/errors/taxonomy.ts` publishes its server message through the mounted `NoticeHost`; a rejection whose `field` names a form field still lands on that field; `Unauthorized` still rechecks the session and now also shows its message; interrupted work publishes nothing. Delete screen-local alerts that only repeated the message, such as `{Option.isSome(editor.failure) && <p role="alert">{editor.failure.value.message}</p>}`.
- `@shivaedev/react`: `notices.onFailure` and `rejectField` are removed in favour of one per-tag `failures` option. Before: `useAction(api.remove, { notices: { onFailure: () => ({ message: "Could not remove" }) } })`. After: `useAction(api.remove, { failures: { Conflict: couldNotRemove } })` with `function couldNotRemove() { return { message: "Could not remove" }; }` declared outside the component, or leave it out to show the server's message. Before: `useEditor(api.retitle, { query, fixed: { id }, rejectField: (error) => ({ field: "title", message: error.message }) })`. After: `useEditor(api.retitle, { query, fixed: { id }, failures: { SubtitleRejected: onTitle } })` with `function onTitle(error: SubtitleRejected) { return { field: "title" as const, message: error.message }; }` declared outside the component, because Biome's `noNestedComponentDefinitions` reads a one-parameter function under a PascalCase key inside a component as a component. A handler receives the error and the invocation's input and returns a notice descriptor, a field rejection (form hooks only) or `"silent"`; `"message"` shows the error's own message and `"silent"` shows nothing for that tag. `silent: true` shows nothing for any failure of the call.
- `@shivaedev/react`: a command or save that can fail with a rejection the application declared for itself does not compile until `failures` names it; the error names the tag, for example `Property '"failures.SubtitleRejected"' is missing`. Add `failures: { SubtitleRejected: "message" }`, or a handler, to each such call.
- `@shivaedev/react`: `QueryView`'s `loading` and `failure` are optional. Without them the view renders the application's `QueryViewDefaults`, or a `Loading…` status and the failure's message with a Retry button that calls `refresh`. A query that can fail with an application-declared rejection still requires `failure`. Remove `loading` and `failure` renderers that repeated the default.
- `@shivaedev/form`: `FieldRejectionMapping` is removed; the React form hooks no longer take `rejectField`. `rejecting` and `RejectField` are unchanged for a form used directly.

### Added

- `@shivaedev/react`: `NoticeHost` takes `failure(unexpected)`, the application's one wording for a lost connection, a server outage, an `InternalServerError`, a defect or an untagged failure, called once per failed invocation. Without it the host shows `Could not reach the server. Check your connection and try again.`, the server's redacted message, or `Something went wrong. Try again.`, never a cause. Without `render`, notices render with `role="alert"` or `role="status"` and a Dismiss button. A `Notice` carries `kind`: `"success"`, `"rejection"` or `"failure"`.
- `@shivaedev/react`: `QueryViewDefaults` in `client/QueryView.ts` sets the application's default `failure` and `loading` rendering for every `QueryView` below it.
- `@shivaedev/contract`: `failureKind(error)` in `failureKind.ts` returns `"request"`, `"framework"` or `"app"`, with the `FrameworkFailure` and `AppRejection<E>` types and the `isFrameworkFailure` guard.
- `@shivaedev/errors`: `RequestRejection` and `ServerFailure` group the taxonomy classes, with the `isRequestRejection` and `isServerFailure` guards.

### Changed

- `@shivaedev/create-app`: generated apps mount one notice host in `src/client/Notices.tsx`, and their note screens carry no failure wiring: a conflict, a refused session and a defect each appear as a notice.
