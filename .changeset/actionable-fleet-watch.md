---
"@shivaedev/work-fleet": minor
"@shivaedev/pr-watch": minor
---

### Breaking

- `@shivaedev/work-fleet`: Work Fleet's continuous watch, including `watch --follow`, prints actionable events once per work item, head and reason. Consumers of the former follow summaries should read named event fields or use `--json`; use `--all` for routine progress and health diagnostics, or `--events` for an explicit selection.

- `@shivaedev/pr-watch`: Custom implementations of the GitHub snapshot service must include the observed head SHA in each returned snapshot's `head` field.

### Added

- `@shivaedev/pr-watch`: PR watch snapshots and events retain the observed head SHA so Fleet can distinguish actions on successive heads.

### Fixed

- `@shivaedev/work-fleet`: Keep ordinary dispatch deferrals, merged PRs, completed work, brief daemon outages, recovering GitHub errors, requeued Board context changes, unsubstantiated release holds and queue-related auto-merge changes quiet in Fleet's default watch.
