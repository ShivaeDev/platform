---
"@shivaedev/test-story": minor
---

### Fixed

- Subscription opening waits settle when a stream completes without a value, dies or disconnects, preserving answered subscriptions and tagged refusals.

### Breaking

- `screenDriver` with client activity now exposes `SignalNotReceived` from `nextLiveHint()` when the activity stream ends without a new hint. Handle this typed error from `@shivaedev/test-story/server/until.ts` instead of assuming the wait always succeeds. Subscription readouts include a `closed` state for streams that terminate before answering; consumers matching subscription states must handle `closed`.
