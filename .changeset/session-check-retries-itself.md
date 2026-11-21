---
"@shivaedev/react": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/react`: an `authSession` retries its own failed checks, whether or not a `SessionBoundary` or `SessionApp` is mounted, so an app that cannot reach its host at launch reaches the signed-in screen once the host answers. The next check goes out 1 second after a failure, doubling up to every 30 seconds, and at once on a visible `online` or `visibilitychange` event. While it waits, the atom reports the failure as `waiting`. `refresh` still settles with one check's outcome. `authSession(read, { runtime })` runs the retries on another atom runtime, such as one carrying a story's controlled Clock; `SessionRuntime` names the runtime it takes.

### Breaking

- `@shivaedev/react`: `SessionBoundary` and `SessionApp` no longer retry a failed `recheck`; they share an in-flight check and leave retrying to the session atom. Delete the `runtime` prop from `SessionBoundary` and pass that runtime to `authSession(read, { runtime })` instead. A void `recheck` callback keeps its own retry policy.
- `@shivaedev/react`: `@shivaedev/react/client/useSessionRetry.ts` is deleted, because the session atom now retries a failed check by itself. Delete the import, the `useSessionRetry(...)` call and any retry code of the application's own built around it.
- `@shivaedev/react`: `AuthSessionOptions` from `@shivaedev/react/client/authSession.ts` now holds only `runtime`. The `{ remember }` options moved to the new `RememberedSessionOptions`, which also takes `runtime`; an application that names `AuthSessionOptions` for `{ remember }` names `RememberedSessionOptions` instead. Calls such as `authSession(read, { remember })` are unchanged.
- `@shivaedev/react`: a failed session check reads as `waiting` while it retries, so `useQuery(session.atom).pending` stays true after a failure. A screen that showed "checking" while `pending` and a failure only afterwards checks for the failure first.

### Changed

- `@shivaedev/create-app`: generated apps check the session again by themselves after a failed check at launch; the session failure screen keeps its Retry button.
