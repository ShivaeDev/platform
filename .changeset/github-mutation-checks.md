---
"@shivaedev/github": minor
---

### Added

- Send PUT and DELETE through the shared authenticated mutation path, omit absent request bodies, and decode bodyless 204 results as `void` by omitting the response schema or using `Schema.Void`.
- Find the latest commit check run by name, app ID, or both with `findLatestCheckRun`, and create or update it with `upsertCheckRun`. Check-run responses expose the app ID when present and recognize GitHub Actions-only read statuses.

### Breaking

- `CreateCheckRun` requires a conclusion when `status` is `completed`, with validation before any request. Consumers creating completed runs must supply `conclusion`; use `queued` or `in_progress` when no conclusion is available.
- `CheckRunStatus` includes `waiting`, `requested` and `pending` from GitHub Actions responses. Consumers with exhaustive status handling must add these cases. GitHub App create and update inputs remain restricted to `queued`, `in_progress` and `completed`.
