---
"@shivaedev/effect-react": minor
---

### Added

- `useAction(runtime, run, options?)` runs optional `onSuccess(value, input)` and `onFailure(error, input)` callbacks inside each command invocation using the latest committed callbacks. Native atoms retain execution, interruption and aggregate state; `concurrent: true` allows overlapping commands. Bound commands keep their own invalidation without waiting for refetches, Unauthorized failures request one session recheck per invocation, and session replacement discards outgoing feedback. The existing atom overload remains available.
