---
"@shivaedev/github": minor
---

### Added

- Add typed, byte-capped issue, user, collaborator-permission, commit, comparison and tree reads, plus paged issue, pull-request-file and commit lists on the GitHub service.
- Let Schema-aware lists select arrays inside envelopes, pace each request and opt into skipping undecodable items. `listPages` reports decoded items and skipped counts for each page; `listBounded` includes the total `skipped` count alongside `items` and `truncated`. Existing numeric byte-limit arguments remain supported, and decoding still fails by default.
