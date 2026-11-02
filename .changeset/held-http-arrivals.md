---
"@shivaedev/test-story": minor
---

### Added

- Fake HTTP services expose replaying `received` and `completed` Effect streams so stories can wait independently for each request's arrival and response completion, separately from abandonment.

### Breaking

- Held route replies and scripted status reply functions now compute at request arrival, before waiting for release. Move state changes that should affect the reply before sending the request, or use an immediate `fault` to replace a waiting reply at injection time.
