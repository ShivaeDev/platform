---
"@shivaedev/test-story": minor
---

### Added

- Build fake HTTP fault replies from the answered request and the service’s captured Effect clock, through `scriptFault`, `fault`, `failOnce` and `replyOnce`.
- Read completed response statuses, pending requests and unanswered connections from the fake HTTP request log.
- Hold a parameter scope or only its first matching request, and release a scoped hold on another route’s arrival.
- Match trailing `:name*` route parameters across one or more percent-decoded path segments.
