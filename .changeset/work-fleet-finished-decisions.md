---
"@shivaedev/work-fleet": minor
---

### Added

- Close open Fleet decision requests with a recorded reason when their Board work is done, deferred or superseded, including work finished outside Fleet. Run `work-fleet close-finished-decisions` to close existing unanswered decisions in one pass, or preview them with `--dry-run`.
- Markdown Board gateways expose optional `closeFinishedDecisions({ dryRun?, workId? })` with `CloseFinishedOptions` and the `ClosedDecision` schema, returning each decision source, linked work ID and closure reason.

### Breaking

- `writeCompletion` returns `Effect<boolean, ...>` instead of `Effect<void, ...>` so callers can confirm that the expected source was current and the completion content was written or already present. Consumers that need a void effect can apply `Effect.asVoid`.
