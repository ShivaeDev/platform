---
"@shivaedev/http": minor
---

### Added

- `filterStatus` and `checkStatus` failures (`RemoteUnauthorized`, `RemoteNotFound`, `RemoteGone`, `RemoteRateLimited`, `RemoteHttpError`) carry an optional `bodyExcerpt`: at most the first 2048 bytes of the error response's text, with whitespace collapsed and secrets masked by `@shivaedev/errors` redaction. Empty, binary, failing or unfinished bodies (one second on Effect's clock) leave it out, and the status failure is still reported.
- `ReadClientError` with reason `status` carries the same `bodyExcerpt`.

### Changed

- Every status failure's `message` now reads `HTTP <status>: <method> <host><path>`, followed by `: <excerpt>` when there is one; previously only `RemoteHttpError` had a message.
- A status failure now reads up to 2048 bytes of the error body, for up to one second, before failing, instead of discarding the body unread.
- `@shivaedev/http` now depends on `@shivaedev/errors`.
